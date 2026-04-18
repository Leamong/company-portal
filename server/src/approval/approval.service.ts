import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Approval,
  ApprovalDocument,
  ApprovalStatus,
  ApprovalType,
} from './schemas/approval.schema';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/schemas/user.schema';

interface DecideUser {
  _id: string;
  role: string;
  canApprove?: boolean;
}

@Injectable()
export class ApprovalService {
  constructor(
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    private usersService: UsersService,
  ) {}

  // 결재 가능한 사용자 목록 (head-admin + canApprove 직원)
  async getApprovers() {
    const all = await this.usersService.findAll();
    return all
      .filter((u) => u.role === UserRole.HEAD_ADMIN || (u as any).canApprove === true)
      .map((u) => ({
        id: (u as any)._id.toString(),
        name: u.name,
        position: u.position,
        role: u.role,
      }));
  }

  // 내 상신함 (내가 올린 기안)
  async getMyApprovals(userId: string) {
    return this.approvalModel
      .find({ applicantId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  // 수신함 - head-admin은 전체, canApprove 직원은 본인 지정 건만
  async getInbox(user: DecideUser) {
    const query: Record<string, unknown> = { status: ApprovalStatus.PENDING };

    if (user.role !== UserRole.HEAD_ADMIN) {
      // canApprove 직원: 본인이 결재자로 지정된 건만
      query.approverId = new Types.ObjectId(user._id);
    }

    return this.approvalModel.find(query).sort({ createdAt: -1 }).lean();
  }

  // 완료함 - head-admin은 전체, canApprove 직원은 본인 처리 건만
  async getDone(user: DecideUser) {
    const query: Record<string, unknown> = {
      status: { $ne: ApprovalStatus.PENDING },
    };

    if (user.role !== UserRole.HEAD_ADMIN) {
      query.approverId = new Types.ObjectId(user._id);
    }

    return this.approvalModel.find(query).sort({ createdAt: -1 }).lean();
  }

  // 기안 작성
  async create(
    applicantId: string,
    applicantName: string,
    dto: {
      type: ApprovalType;
      title: string;
      reason: string;
      startDate?: string;
      endDate?: string;
      amount?: number;
      approverId?: string;
      approverName?: string;
      vacationType?: string;
      overtimeDate?: string;
      overtimeStartTime?: string;
      overtimeEndTime?: string;
    },
  ) {
    // 결재자 정보 검증 및 이름 확인
    let approverId: Types.ObjectId | null = null;
    let approverName = '헤드 어드민';

    if (dto.approverId) {
      const approver = await this.usersService.findById(dto.approverId);
      if (!approver) throw new NotFoundException('결재자를 찾을 수 없습니다.');
      if (approver.role !== UserRole.HEAD_ADMIN && !(approver as any).canApprove) {
        throw new ForbiddenException('해당 사용자에게 결재 권한이 없습니다.');
      }
      approverId = new Types.ObjectId(dto.approverId);
      approverName = approver.name;
    } else {
      // 기본값: head-admin 자동 배정
      const headAdmin = await this.usersService.findAll().then((users) =>
        users.find((u) => u.role === UserRole.HEAD_ADMIN),
      );
      if (headAdmin) {
        approverId = new Types.ObjectId((headAdmin as any)._id.toString());
        approverName = headAdmin.name;
      }
    }

    return this.approvalModel.create({
      type: dto.type,
      title: dto.title,
      reason: dto.reason,
      applicantId: new Types.ObjectId(applicantId),
      applicantName,
      approverId,
      approverName,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      amount: dto.amount ?? null,
      vacationType: dto.vacationType ?? null,
      overtimeDate: dto.overtimeDate ? new Date(dto.overtimeDate) : null,
      overtimeStartTime: dto.overtimeStartTime ?? null,
      overtimeEndTime: dto.overtimeEndTime ?? null,
    });
  }

  // 결재 처리 (head-admin 또는 canApprove 직원)
  async decide(
    id: string,
    user: DecideUser,
    dto: { status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED; comment?: string },
  ) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('기안을 찾을 수 없습니다.');
    if (doc.status !== ApprovalStatus.PENDING) {
      throw new ForbiddenException('이미 처리된 기안입니다.');
    }

    const isHeadAdmin = user.role === UserRole.HEAD_ADMIN;
    const isAssignedApprover =
      user.canApprove && doc.approverId?.toString() === user._id.toString();

    if (!isHeadAdmin && !isAssignedApprover) {
      throw new ForbiddenException('결재 권한이 없습니다.');
    }

    return this.approvalModel
      .findByIdAndUpdate(
        id,
        { status: dto.status, comment: dto.comment ?? '' },
        { new: true },
      )
      .lean();
  }

  // 기안 취소 (본인 + 검토중 상태일 때만)
  async cancel(id: string, userId: string) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('기안을 찾을 수 없습니다.');
    if (doc.applicantId.toString() !== userId) {
      throw new ForbiddenException('본인의 기안만 취소할 수 있습니다.');
    }
    if (doc.status !== ApprovalStatus.PENDING) {
      throw new ForbiddenException('검토중인 기안만 취소할 수 있습니다.');
    }
    await this.approvalModel.findByIdAndDelete(id);
    return { message: '기안이 취소되었습니다.' };
  }

  // 전체 (어드민용)
  async findAll() {
    return this.approvalModel.find().sort({ createdAt: -1 }).lean();
  }
}
