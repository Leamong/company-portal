import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
} from 'class-validator';
import { User, UserDocument, UserRole } from './schemas/user.schema';

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
  emergencyContact?: { name: string; phone: string; relation: string };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-password').exec();
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
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
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
      profileImage: user.profileImage,
      phone: (user as any).phone ?? '',
      birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
      pagePermissions: user.pagePermissions ?? [],
      canApprove: (user as any).canApprove ?? false,
      canManageAttendance: (user as any).canManageAttendance ?? false,
    };
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}
