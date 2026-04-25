import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');
import { StorageService } from '../storage/storage.service';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { Approval, ApprovalDocument, ApprovalFormType, ApprovalStatus } from '../approval/schemas/approval.schema';
import {
  calculateAnnualLeaveEntitlement,
  getCurrentLeavePeriodStart,
  leaveDaysFromFormData,
} from './annual-leave.util';

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  position?: string;
  department?: string;
  role?: UserRole;
  phone?: string;
  birthDate?: string;
  emergencyContact?: { name: string; phone: string; relation: string };
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pagePermissions?: string[];

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageAttendance?: boolean;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  birthDate?: string | null;

  @IsOptional()
  hireDate?: string | null;

  @IsOptional()
  @IsNumber()
  annualLeaveAdjustment?: number;

  @IsOptional()
  emergencyContact?: { name: string; phone: string; relation: string };

  @IsOptional()
  @IsString()
  stampSvg?: string | null;

  @IsOptional()
  @IsString()
  stampColor?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    private readonly storageService: StorageService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: createUserDto.email });
    if (existing) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const payload: Record<string, unknown> = {
      ...createUserDto,
      password: hashedPassword,
      birthDate: createUserDto.birthDate ? new Date(createUserDto.birthDate) : null,
    };
    const user = new this.userModel(payload);
    return user.save();
  }

  async findAll(): Promise<any[]> {
    // 1) 전체 사용자 조회
    const users = await this.userModel.find().select('-password').lean().exec();

    // 2) 승인된 휴가 신청 문서 전부 한 번에 조회 (applicantId로 그룹핑을 JS에서 처리)
    const approvedLeaves = await this.approvalModel
      .find({
        formType: ApprovalFormType.VACATION,
        status: ApprovalStatus.APPROVED,
      })
      .select('applicantId formData startDate endDate vacationType')
      .lean()
      .exec();

    // 3) 사용자별로 그룹화
    const leavesByUser = new Map<string, any[]>();
    for (const doc of approvedLeaves) {
      const key = doc.applicantId?.toString();
      if (!key) continue;
      if (!leavesByUser.has(key)) leavesByUser.set(key, []);
      leavesByUser.get(key)!.push(doc);
    }

    // 4) 각 사용자별 연차 계산 결과 첨부
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    return users.map((user: any) => {
      // 대표는 연차 대상 아님
      if (user.role === UserRole.HEAD_ADMIN) {
        return { ...user, leaveBalance: { notApplicable: true } };
      }
      // 입사일 미설정
      if (!user.hireDate) {
        return {
          ...user,
          leaveBalance: {
            notApplicable: false,
            hireDate: null,
            total: 0,
            used: 0,
            remaining: 0,
            periodStart: null,
            periodEnd: null,
            daysUntilExpiry: null,
          },
        };
      }

      const entitlement = calculateAnnualLeaveEntitlement(user.hireDate, now);
      const adjustment = user.annualLeaveAdjustment ?? 0;
      const total = entitlement + adjustment;

      const periodStart = getCurrentLeavePeriodStart(user.hireDate, now);
      const periodEnd = new Date(periodStart);
      periodEnd.setFullYear(periodStart.getFullYear() + 1);

      // 해당 사용자의 승인된 휴가 중 현재 회계연도 기간 내 사용량 합산
      const userDocs = leavesByUser.get(user._id.toString()) ?? [];
      let used = 0;
      for (const doc of userDocs) {
        const formData = (doc as any).formData ?? {};
        const merged = {
          vacationType: formData.vacationType ?? doc.vacationType,
          startDate:
            formData.startDate ??
            (doc.startDate ? new Date(doc.startDate).toISOString() : null),
          endDate:
            formData.endDate ??
            (doc.endDate ? new Date(doc.endDate).toISOString() : null),
        };
        if (!merged.startDate) continue;
        const leaveStart = new Date(merged.startDate);
        if (leaveStart < periodStart || leaveStart >= periodEnd) continue;
        used += leaveDaysFromFormData(merged);
      }

      const daysUntilExpiry = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / msPerDay,
      );

      return {
        ...user,
        leaveBalance: {
          notApplicable: false,
          hireDate: new Date(user.hireDate).toISOString().split('T')[0],
          total,
          used,
          remaining: Math.max(0, total - used),
          adjustment,
          periodStart: periodStart.toISOString().split('T')[0],
          periodEnd: periodEnd.toISOString().split('T')[0],
          daysUntilExpiry,
        },
      };
    });
  }

  // 조직도용: 활성 유저 전체 (비밀번호·IP 제외)
  async findOrgChart() {
    return this.userModel
      .find({ isActive: true })
      .select(
        'name email position department role status profileImage phone birthDate emergencyContact createdAt',
      )
      .sort({ name: 1 })
      .exec();
  }

  // 메신저 DM용: 활성 유저의 이름/부서/직급/프로필
  async findDirectory() {
    return this.userModel
      .find({ isActive: true })
      .select('_id name position department profileImage')
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findHeadAdmin(): Promise<UserDocument | null> {
    return this.userModel.findOne({ role: UserRole.HEAD_ADMIN }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    const { hireDate, birthDate, ...rest } = updateUserDto;
    const patch: Record<string, unknown> = { ...rest };
    if (hireDate !== undefined) {
      patch.hireDate = hireDate ? new Date(hireDate) : null;
    }
    if (birthDate !== undefined) {
      patch.birthDate = birthDate ? new Date(birthDate) : null;
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, patch, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  /**
   * 특정 사용자의 연차 잔여량 계산
   * - total: 근로기준법 기준 발생 연차 + 관리자 보정치
   * - used: 현재 회계연도(입사 기념일 기준) 내 승인 완료된 휴가 신청 문서로부터 집계
   * - remaining: total - used
   */
  async getAnnualLeaveBalance(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('hireDate annualLeaveAdjustment role')
      .exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 대표는 법적 근로자가 아니므로 연차 대상에서 제외
    if (user.role === UserRole.HEAD_ADMIN) {
      return {
        notApplicable: true as const,
        total: 0,
        used: 0,
        remaining: 0,
        hireDate: null,
        adjustment: 0,
        periodStart: null,
        periodEnd: null,
      };
    }

    const hireDate = user.hireDate ?? null;
    const adjustment = user.annualLeaveAdjustment ?? 0;

    if (!hireDate) {
      return {
        notApplicable: false as const,
        total: 0,
        used: 0,
        remaining: 0,
        hireDate: null,
        adjustment,
        periodStart: null,
        periodEnd: null,
      };
    }

    const now = new Date();
    const entitlement = calculateAnnualLeaveEntitlement(hireDate, now);
    const total = entitlement + adjustment;

    const periodStart = getCurrentLeavePeriodStart(hireDate, now);
    const periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodStart.getFullYear() + 1);

    // 현재 회계연도 내 승인된 휴가 신청 집계
    const approvedDocs = await this.approvalModel
      .find({
        applicantId: userId,
        formType: ApprovalFormType.VACATION,
        status: ApprovalStatus.APPROVED,
      })
      .select('formData startDate endDate vacationType')
      .exec();

    let used = 0;
    for (const doc of approvedDocs) {
      // formData 우선, 레거시 필드로 폴백
      const formData = (doc as any).formData ?? {};
      const merged: Record<string, any> = {
        vacationType: formData.vacationType ?? (doc as any).vacationType,
        startDate:
          formData.startDate ?? (doc.startDate ? doc.startDate.toISOString() : null),
        endDate:
          formData.endDate ?? (doc.endDate ? doc.endDate.toISOString() : null),
      };
      if (!merged.startDate) continue;

      const leaveStart = new Date(merged.startDate);
      if (leaveStart < periodStart || leaveStart >= periodEnd) continue;

      used += leaveDaysFromFormData(merged);
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.ceil(
      (periodEnd.getTime() - now.getTime()) / msPerDay,
    );

    return {
      notApplicable: false as const,
      total,
      used,
      remaining: Math.max(0, total - used),
      hireDate: hireDate.toISOString().split('T')[0],
      adjustment,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      daysUntilExpiry,
    };
  }

  /**
   * 대시보드 레이아웃 저장 (본인만)
   * - react-grid-layout 의 Layout[] 형식을 그대로 저장
   * - 신규 사용자/리셋을 위한 빈 배열([]) 저장 허용
   */
  async updateDashboardLayout(
    userId: string,
    layout: Array<{ i: string; x: number; y: number; w: number; h: number; hidden?: boolean }>,
  ) {
    if (!Array.isArray(layout)) {
      throw new ForbiddenException('유효하지 않은 레이아웃 형식입니다.');
    }
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { dashboardLayout: layout },
      { new: true },
    );
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return { ok: true, layout: user.dashboardLayout };
  }

  /**
   * 대표 전용: 부재 상태 직접 변경 (결재 절차 없음)
   * - employee 가 호출 시 ForbiddenException
   * - null / '휴가' / '부재' 세 가지 값만 허용
   */
  async updateAbsenceStatus(userId: string, absenceStatus: string | null) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (user.role !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException(
        '부재 상태 직접 변경은 대표만 가능합니다. 직원은 휴가 신청서를 상신해주세요.',
      );
    }

    const valid = [null, '', '휴가', '부재'];
    if (!valid.includes(absenceStatus as any)) {
      throw new ForbiddenException('유효하지 않은 부재 상태입니다.');
    }

    user.absenceStatus = (absenceStatus || null) as any;
    await user.save();
    return this.toProfileDto(user);
  }

  async updateOwnProfile(
    id: string,
    dto: { name?: string; phone?: string; birthDate?: string | null; profileImage?: string | null },
  ): Promise<UserDocument> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.birthDate !== undefined) {
      patch.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.profileImage === null) {
      // 프로필 사진 삭제 요청: R2에서도 제거
      await this.storageService.deleteObject(`avatars/${id}.webp`);
      patch.profileImage = null;
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, patch, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async updateAvatar(id: string, file: Express.Multer.File): Promise<UserDocument> {
    // WebP로 변환 + 400×400 리사이즈
    const webpBuffer = await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `avatars/${id}.webp`;
    const url = await this.storageService.uploadObject(key, webpBuffer, 'image/webp');

    const user = await this.userModel
      .findByIdAndUpdate(id, { profileImage: url }, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  toProfileDto(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      position: user.position,
      department: user.department,
      role: user.role,
      status: user.status,
      absenceStatus: (user as any).absenceStatus ?? null,
      profileImage: user.profileImage,
      phone: (user as any).phone ?? '',
      birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
      pagePermissions: user.pagePermissions ?? [],
      canApprove: (user as any).canApprove ?? false,
      canManageAttendance: (user as any).canManageAttendance ?? false,
      stampSvg: user.stampSvg ?? null,
      stampColor: (user as any).stampColor ?? '#e11d48',
      dashboardLayout: (user as any).dashboardLayout ?? [],
    };
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}
