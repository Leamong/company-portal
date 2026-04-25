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
  ApprovalFormType,
} from './schemas/approval.schema';
import {
  ApprovalChainSettings,
  ApprovalChainSettingsDocument,
  DefaultChainStep,
} from './schemas/approval-chain-settings.schema';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/schemas/user.schema';
import { MessengerGateway } from '../messenger/messenger.gateway';
import { LeavePolicyService } from './leave-policy.service';
import { LeaveCategory } from './schemas/leave-policy.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

interface DecideUser {
  _id: string;
  role: string;
  canApprove?: boolean;
}

// 대표는 법적 근로자가 아니므로 인사 계열 결재 양식 상신 대상이 아님
const HEAD_ADMIN_BLOCKED_FORMS = new Set<ApprovalFormType>([
  ApprovalFormType.VACATION,
  ApprovalFormType.OVERTIME,
  ApprovalFormType.ABSENCE,
]);

function deptKeyToLabel(dept: string): string {
  const map: Record<string, string> = {
    marketing: '마케팅팀',
    design: '디자인팀',
    management: '경영팀',
  };
  return map[dept] ?? dept;
}

// formType → 구 type 매핑 (하위 호환)
function legacyTypeFromFormType(formType: ApprovalFormType): ApprovalType {
  if (formType === ApprovalFormType.VACATION) return ApprovalType.VACATION;
  if (formType === ApprovalFormType.OVERTIME || formType === ApprovalFormType.ABSENCE) return ApprovalType.OVERTIME;
  if (formType === ApprovalFormType.EXPENSE || formType === ApprovalFormType.BUSINESS_EXPENSE) return ApprovalType.EXPENSE;
  return ApprovalType.OTHER;
}

function generateDocNumber(formType: ApprovalFormType): string {
  const prefix: Record<ApprovalFormType, string> = {
    [ApprovalFormType.VACATION]: '휴가',
    [ApprovalFormType.OVERTIME]: '연장',
    [ApprovalFormType.ABSENCE]: '결근',
    [ApprovalFormType.EXPENSE]: '지출',
    [ApprovalFormType.BUSINESS_EXPENSE]: '추진',
    [ApprovalFormType.GENERAL]: '기안',
    [ApprovalFormType.COOPERATION]: '협조',
    [ApprovalFormType.TRIP]: '출장',
  };
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  return `${prefix[formType] ?? '기안'}-${ts}`;
}

@Injectable()
export class ApprovalService {
  constructor(
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(ApprovalChainSettings.name)
    private chainSettingsModel: Model<ApprovalChainSettingsDocument>,
    private usersService: UsersService,
    private messengerGateway: MessengerGateway,
    private leavePolicyService: LeavePolicyService,
  ) {}

  // ─── 휴가 신청 검증 (잔여 연차 + 정책 상한 + 증빙 필수) ──────
  private computeLeaveDays(formData: Record<string, any>): number {
    const vt: string | undefined = formData?.vacationType;
    if (!vt) return 0;
    if (vt.includes('반차')) return 0.5;
    const start = formData?.startDate;
    const end = formData?.endDate || start;
    if (!start) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1);
  }

  private async countApprovedDaysThisYear(
    applicantId: string,
    category: LeaveCategory,
  ): Promise<number> {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const docs = await this.approvalModel
      .find({
        applicantId: new Types.ObjectId(applicantId),
        formType: ApprovalFormType.VACATION,
        status: ApprovalStatus.APPROVED,
        createdAt: { $gte: startOfYear },
      })
      .select('formData')
      .lean();

    let total = 0;
    for (const d of docs) {
      const formData = (d as any).formData ?? {};
      const c = LeavePolicyService.resolveCategory(formData.vacationType);
      if (c === category) total += this.computeLeaveDays(formData);
    }
    return total;
  }

  // 휴가 문서의 사후 증빙 데드라인 계산
  // - policy.evidenceTiming === 'post' 이고 아직 증빙이 없으면 (종료일 또는 오늘) + postEvidenceDays
  // - 이미 증빙이 있거나 timing 이 post 가 아니면 null
  private async computeEvidenceDeadline(doc: any): Promise<Date | null> {
    if (doc.formType !== ApprovalFormType.VACATION) return null;
    const formData = doc.formData ?? {};
    const vt: string | undefined = formData.vacationType;
    const category = LeavePolicyService.resolveCategory(vt);
    if (!category) return null;
    const policy = await this.leavePolicyService.findByCategory(category);
    if (!policy || policy.evidenceTiming !== 'post') return null;

    const existing: string[] = doc.attachments ?? formData.attachments ?? [];
    if (existing.length > 0) return null;

    const base =
      formData.endDate
        ? new Date(formData.endDate)
        : doc.endDate
          ? new Date(doc.endDate)
          : new Date();
    const days = policy.postEvidenceDays ?? 7;
    const deadline = new Date(base);
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }

  private async assertVacationRequestAllowed(
    applicantId: string,
    formData: Record<string, any>,
  ) {
    const vt: string | undefined = formData?.vacationType;
    const category = LeavePolicyService.resolveCategory(vt);
    if (!category) return;

    const policy = await this.leavePolicyService.findByCategory(category);
    if (!policy || !policy.active) {
      throw new ForbiddenException(`'${vt}' 유형은 현재 신청할 수 없습니다.`);
    }

    const days = this.computeLeaveDays(formData);
    if (days <= 0) {
      throw new ForbiddenException('휴가 기간이 올바르지 않습니다.');
    }

    // 휴가 1건당 최대 일수
    if (policy.maxDaysPerRequest > 0 && days > policy.maxDaysPerRequest) {
      throw new ForbiddenException(
        `'${vt}'는 1건당 최대 ${policy.maxDaysPerRequest}일까지 신청할 수 있습니다. (요청 ${days}일)`,
      );
    }

    // 증빙 첨부 검증 — timing='pre' 일 때만 신청 시점에 강제
    const attachments: string[] = formData?.attachments ?? [];
    if (policy.evidenceTiming === 'pre' && attachments.length === 0) {
      throw new ForbiddenException(
        `'${vt}' 유형은 신청 시점에 증빙 서류 첨부가 필수입니다.`,
      );
    }
    // 'post' 는 승인 후 데드라인 내 업로드 허용 — 신청 시점 차단 없음

    // 연차 차감 유형: 잔여 연차 초과 불가
    if (policy.deductFromAnnualLeave) {
      const balance = await this.usersService.getAnnualLeaveBalance(applicantId);
      if (!balance.notApplicable && days > balance.remaining) {
        throw new ForbiddenException(
          `잔여 연차 ${balance.remaining}일을 초과합니다. 요청 ${days}일은 신청할 수 없습니다.`,
        );
      }
    }

    // 연간 누적 상한 (예: 병가 10일)
    if (policy.annualCap > 0) {
      const usedThisYear = await this.countApprovedDaysThisYear(applicantId, category);
      if (usedThisYear + days > policy.annualCap) {
        throw new ForbiddenException(
          `'${vt}'는 연간 ${policy.annualCap}일까지 사용 가능합니다. 올해 이미 ${usedThisYear}일 사용했습니다.`,
        );
      }
    }
  }

  // ─── 실시간 알림 헬퍼 ─────────────────────────────────────────
  // 결재 문서의 상태가 바뀔 때마다 네임스페이스 전체에 브로드캐스트.
  // 클라이언트는 이벤트를 받으면 본인 inbox 카운트/목록을 서버에서 다시 불러옴
  // → 특정 결재자만 이벤트를 받는 구조로 인한 누락을 원천적으로 방지
  private broadcastApprovalChange(
    doc: any,
    kind: 'submitted' | 'decided' | 'cancelled' | 'deleted',
  ) {
    if (!doc) return;
    const payload = {
      kind,
      id: doc._id?.toString?.() ?? '',
      title: doc.title,
      status: doc.status,
      applicantId: doc.applicantId?.toString?.() ?? '',
      applicantName: doc.applicantName,
      formType: doc.formType,
    };
    this.messengerGateway.broadcast('approvalChanged', payload);
  }

  // 검토중 상태의 문서에서 "다음 처리해야 할 결재자"에게만 배지용 알림 송신
  private notifyCurrentApprover(doc: any) {
    if (!doc) return;
    const payload = {
      id: doc._id?.toString?.() ?? '',
      title: doc.title,
      applicantName: doc.applicantName,
      formType: doc.formType,
    };
    const chain = doc.approvalChain ?? [];
    const approverIds = new Set<string>();
    if (chain.length > 0) {
      const nextStep = chain.find((s: any) => s.status === 'pending');
      if (nextStep?.approverId) approverIds.add(nextStep.approverId.toString());
    }
    const approverId = doc.approverId?.toString?.();
    if (approverId) approverIds.add(approverId);

    for (const uid of approverIds) {
      this.messengerGateway.emitToUser(uid, 'approvalSubmitted', payload);
    }
  }

  // 기안자에게 최종 처리 결과 알림
  private notifyApplicantDecided(doc: any) {
    if (!doc?.applicantId) return;
    this.messengerGateway.emitToUser(doc.applicantId.toString(), 'approvalDecided', {
      id: doc._id?.toString?.() ?? '',
      title: doc.title,
      status: doc.status,
    });
  }

  // ─── 상신 가능 여부 검증 (대표는 인사 양식 제출 불가) ────────
  private async assertApplicantCanSubmit(
    applicantId: string,
    formType: ApprovalFormType,
  ) {
    if (!HEAD_ADMIN_BLOCKED_FORMS.has(formType)) return;
    const applicant = await this.usersService.findById(applicantId);
    if (applicant?.role === UserRole.HEAD_ADMIN) {
      throw new ForbiddenException(
        '대표는 인사(휴가·연장근무·결근) 결재 상신 대상이 아닙니다. 부재 상태는 프로필에서 직접 설정하세요.',
      );
    }
  }

  // ─── 결재 체인 설정 ───────────────────────────────────────────
  async getChainSettings(): Promise<DefaultChainStep[]> {
    const settings = await this.chainSettingsModel.findOne().lean();
    return settings?.chain ?? [];
  }

  async saveChainSettings(chain: DefaultChainStep[]): Promise<DefaultChainStep[]> {
    const sorted = [...chain].sort((a, b) => a.order - b.order);
    await this.chainSettingsModel.findOneAndUpdate(
      {},
      { chain: sorted },
      { upsert: true, new: true },
    );
    return sorted;
  }

  // ─── 결재 가능한 사용자 목록 ──────────────────────────────────
  async getApprovers() {
    const all = await this.usersService.findAll();
    return all
      .filter((u) => (u as any).isActive !== false)
      .map((u) => ({
        id: (u as any)._id.toString(),
        name: u.name,
        position: u.position,
        role: u.role,
      }));
  }

  // ─── 통계 (어드민) ────────────────────────────────────────────
  async getStats() {
    const [pending, approved, rejected, today] = await Promise.all([
      this.approvalModel.countDocuments({ status: ApprovalStatus.PENDING }),
      this.approvalModel.countDocuments({ status: ApprovalStatus.APPROVED }),
      this.approvalModel.countDocuments({ status: ApprovalStatus.REJECTED }),
      this.approvalModel.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
    ]);
    return { pending, approved, rejected, today };
  }

  // ─── 내 임시저장함 ────────────────────────────────────────────
  async getMyDrafts(userId: string) {
    return this.approvalModel
      .find({ applicantId: new Types.ObjectId(userId), status: ApprovalStatus.DRAFT })
      .sort({ updatedAt: -1 })
      .lean();
  }

  // ─── 내 기안 문서함 (검토중) ──────────────────────────────────
  async getMyPending(userId: string) {
    return this.approvalModel
      .find({ applicantId: new Types.ObjectId(userId), status: ApprovalStatus.PENDING })
      .sort({ createdAt: -1 })
      .lean();
  }

  // ─── 내 결재 완료함 (승인/반려/취소) ─────────────────────────
  async getMyDone(userId: string) {
    return this.approvalModel
      .find({
        applicantId: new Types.ObjectId(userId),
        status: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED] },
      })
      .sort({ updatedAt: -1 })
      .lean();
  }

  // ─── 내 상신 전체 (기존 호환) ─────────────────────────────────
  async getMyApprovals(userId: string) {
    return this.approvalModel
      .find({
        applicantId: new Types.ObjectId(userId),
        status: { $ne: ApprovalStatus.DRAFT },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  // ─── 결재 대기 수신함 (내가 결재자, 검토중) ──────────────────
  async getInbox(user: DecideUser) {
    // 어드민: 전체 대기 문서 조회 (감독 + 독촉 목적)
    if (user.role === UserRole.HEAD_ADMIN) {
      return this.approvalModel
        .find({ status: ApprovalStatus.PENDING })
        .sort({ createdAt: -1 })
        .lean();
    }
    // 일반 결재권자: 본인이 체인에 포함된 문서 중 최종 미승인 전체 (본인 슬롯 처리 여부 무관)
    return this.approvalModel
      .find({
        status: ApprovalStatus.PENDING,
        $or: [
          { approverId: new Types.ObjectId(user._id), 'approvalChain': { $size: 0 } },
          { 'approvalChain': { $elemMatch: { approverId: user._id } } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  // ─── 결재 수신 완료함 (내가 결재자, 처리완료) ────────────────
  async getInboxDone(user: DecideUser) {
    if (user.role === UserRole.HEAD_ADMIN) {
      return this.approvalModel
        .find({ status: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] } })
        .sort({ updatedAt: -1 })
        .lean();
    }
    return this.approvalModel
      .find({
        status: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
        $or: [
          { approverId: new Types.ObjectId(user._id) },
          { 'approvalChain': { $elemMatch: { approverId: user._id, status: { $ne: 'pending' } } } },
        ],
      })
      .sort({ updatedAt: -1 })
      .lean();
  }

  // ─── 완료함 (기존 호환) ───────────────────────────────────────
  async getDone(user: DecideUser) {
    return this.getInboxDone(user);
  }

  // ─── 부서 문서함 (어드민) ─────────────────────────────────────
  async getDeptDocs(dept: string) {
    const query: Record<string, unknown> = {
      status: { $ne: ApprovalStatus.DRAFT },
    };
    if (dept !== 'all') {
      query.applicantDept = dept;
    }
    return this.approvalModel.find(query).sort({ createdAt: -1 }).lean();
  }

  // ─── 전체 검색 (어드민) ───────────────────────────────────────
  async searchAll(keyword: string) {
    return this.approvalModel
      .find({
        status: { $ne: ApprovalStatus.DRAFT },
        $or: [
          { title: { $regex: keyword, $options: 'i' } },
          { applicantName: { $regex: keyword, $options: 'i' } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  // ─── 임시저장 ─────────────────────────────────────────────────
  async saveDraft(
    applicantId: string,
    applicantName: string,
    applicantDept: string,
    applicantPosition: string,
    dto: {
      formType: ApprovalFormType;
      title: string;
      formData: Record<string, any>;
      approverId?: string;
    },
  ) {
    await this.assertApplicantCanSubmit(applicantId, dto.formType);

    const defaultChain = await this.getChainSettings();
    const approvalChain = defaultChain.map((s) => ({
      ...s,
      status: 'pending' as const,
      stampData: null,
      decidedAt: null,
    }));

    let approverId: Types.ObjectId | null = null;
    let approverName = '헤드 어드민';
    let approverPosition = '대표';
    if (approvalChain.length > 0) {
      approverId = approvalChain[0].approverId as any;
      approverName = approvalChain[0].approverName;
      approverPosition = approvalChain[0].approverPosition || '대표';
    } else if (dto.approverId) {
      const approver = await this.usersService.findById(dto.approverId);
      if (approver) {
        approverId = new Types.ObjectId(dto.approverId);
        approverName = approver.name;
        approverPosition = (approver as any).position || (approver.role === UserRole.HEAD_ADMIN ? '대표' : '사원');
      }
    }

    return this.approvalModel.create({
      formType: dto.formType,
      type: legacyTypeFromFormType(dto.formType),
      title: dto.title || `${applicantName} - ${dto.formType}`,
      reason: dto.formData?.reason || '',
      attachments: dto.formData?.attachments ?? [],
      formData: dto.formData,
      applicantId: new Types.ObjectId(applicantId),
      applicantName,
      applicantDept: /팀|부|실|센터/.test(applicantDept) ? applicantDept : deptKeyToLabel(applicantDept),
      applicantPosition,
      approverId,
      approverName,
      approverPosition,
      status: ApprovalStatus.DRAFT,
      docNumber: generateDocNumber(dto.formType),
      approvalChain,
      currentStep: 0,
    });
  }

  // ─── 기안 작성 (바로 상신) ────────────────────────────────────
  async create(
    applicantId: string,
    applicantName: string,
    applicantDept: string,
    applicantPosition: string,
    dto: {
      formType?: ApprovalFormType;
      type?: ApprovalType;
      title: string;
      reason?: string;
      formData?: Record<string, any>;
      startDate?: string;
      endDate?: string;
      amount?: number;
      approverId?: string;
      approverName?: string;
      vacationType?: string;
      overtimeDate?: string;
      overtimeStartTime?: string;
      overtimeEndTime?: string;
      applicantStampData?: {
        svg: string;
        color: string;
        applicantName: string;
        submittedAt: string;
      } | null;
    },
  ) {
    if (dto.formType) {
      await this.assertApplicantCanSubmit(applicantId, dto.formType);
    }

    // 휴가신청서는 잔여 연차/정책 상한 검증
    if (dto.formType === ApprovalFormType.VACATION) {
      await this.assertVacationRequestAllowed(applicantId, dto.formData ?? {});
    }

    let approverId: Types.ObjectId | null = null;
    let approverName = '헤드 어드민';
    let approverPosition = '대표';

    if (dto.approverId) {
      const approver = await this.usersService.findById(dto.approverId);
      if (!approver) throw new NotFoundException('결재자를 찾을 수 없습니다.');
      if (approver.role !== UserRole.HEAD_ADMIN && !(approver as any).canApprove) {
        throw new ForbiddenException('해당 사용자에게 결재 권한이 없습니다.');
      }
      approverId = new Types.ObjectId(dto.approverId);
      approverName = approver.name;
      approverPosition = (approver as any).position || (approver.role === UserRole.HEAD_ADMIN ? '대표' : '사원');
    } else {
      const headAdmin = await this.usersService.findAll().then((users) =>
        users.find((u) => u.role === UserRole.HEAD_ADMIN),
      );
      if (headAdmin) {
        approverId = new Types.ObjectId((headAdmin as any)._id.toString());
        approverName = headAdmin.name;
        approverPosition = (headAdmin as any).position || '대표';
      }
    }

    const defaultChain = await this.getChainSettings();
    const approvalChain = defaultChain.map((s) => ({
      ...s,
      status: 'pending' as const,
      stampData: null,
      decidedAt: null,
    }));

    if (approvalChain.length > 0 && !dto.approverId) {
      approverId = approvalChain[0].approverId as any;
      approverName = approvalChain[0].approverName;
      approverPosition = approvalChain[0].approverPosition || '대표';
    }

    const formType = dto.formType ?? null;
    const legacyType = formType ? legacyTypeFromFormType(formType) : (dto.type ?? ApprovalType.OTHER);

    const attachmentsFromForm: string[] = dto.formData?.attachments ?? [];
    const created = await this.approvalModel.create({
      formType,
      type: legacyType,
      title: dto.title,
      reason: dto.reason ?? dto.formData?.reason ?? '',
      attachments: attachmentsFromForm,
      formData: dto.formData ?? {},
      applicantId: new Types.ObjectId(applicantId),
      applicantName,
      applicantDept: /팀|부|실|센터/.test(applicantDept) ? applicantDept : deptKeyToLabel(applicantDept),
      applicantPosition,
      approverId,
      approverName,
      approverPosition,
      status: ApprovalStatus.PENDING,
      docNumber: formType ? generateDocNumber(formType) : '',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      amount: dto.amount ?? null,
      vacationType: dto.vacationType ?? null,
      overtimeDate: dto.overtimeDate ? new Date(dto.overtimeDate) : null,
      overtimeStartTime: dto.overtimeStartTime ?? null,
      overtimeEndTime: dto.overtimeEndTime ?? null,
      applicantStampData: dto.applicantStampData ?? null,
      approvalChain,
      currentStep: 0,
    });

    const plain = created.toObject();
    this.notifyCurrentApprover(plain);
    this.broadcastApprovalChange(plain, 'submitted');
    return created;
  }

  // ─── 임시저장 → 상신 ─────────────────────────────────────────
  async submitDraft(id: string, userId: string) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    if (doc.applicantId.toString() !== userId) {
      throw new ForbiddenException('본인의 문서만 상신할 수 있습니다.');
    }
    if (doc.status !== ApprovalStatus.DRAFT) {
      throw new ForbiddenException('임시저장 상태의 문서만 상신할 수 있습니다.');
    }
    if (doc.formType === ApprovalFormType.VACATION) {
      await this.assertVacationRequestAllowed(userId, (doc as any).formData ?? {});
    }
    const submitted = await this.approvalModel
      .findByIdAndUpdate(id, { status: ApprovalStatus.PENDING }, { new: true })
      .lean();
    this.notifyCurrentApprover(submitted);
    this.broadcastApprovalChange(submitted, 'submitted');
    return submitted;
  }

  // ─── 임시저장 수정 ────────────────────────────────────────────
  async updateDraft(
    id: string,
    userId: string,
    dto: { title?: string; formData?: Record<string, any>; approverId?: string },
  ) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    if (doc.applicantId.toString() !== userId) {
      throw new ForbiddenException('본인의 문서만 수정할 수 있습니다.');
    }
    if (doc.status !== ApprovalStatus.DRAFT) {
      throw new ForbiddenException('임시저장 상태의 문서만 수정할 수 있습니다.');
    }

    const update: Record<string, any> = {};
    if (dto.title) update.title = dto.title;
    if (dto.formData) {
      update.formData = dto.formData;
      update.reason = dto.formData.reason ?? doc.reason;
      update.attachments = dto.formData.attachments ?? doc.attachments ?? [];
    }
    if (dto.approverId) {
      const approver = await this.usersService.findById(dto.approverId);
      if (approver) {
        update.approverId = new Types.ObjectId(dto.approverId);
        update.approverName = approver.name;
      }
    }

    return this.approvalModel.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  // ─── 결재 처리 (승인/반려) ────────────────────────────────────
  async decide(
    id: string,
    user: DecideUser,
    dto: {
      status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
      comment?: string;
      stampData?: { svg: string; color: string; approverName: string } | null;
    },
  ) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('기안을 찾을 수 없습니다.');
    if (doc.status !== ApprovalStatus.PENDING) {
      throw new ForbiddenException('이미 처리된 기안입니다.');
    }

    const isHeadAdmin = user.role === UserRole.HEAD_ADMIN;
    const chain = (doc as any).approvalChain ?? [];
    const currentStep = (doc as any).currentStep ?? 0;

    if (chain.length > 0) {
      // 체인에서 현재 결재자의 슬롯을 ID로 찾음
      const approverIdx = chain.findIndex((s: any) => s.approverId === user._id);
      if (approverIdx < 0) {
        throw new ForbiddenException('결재 체인에 포함되지 않은 사용자입니다.');
      }
      if (chain[approverIdx].status !== 'pending') {
        throw new ForbiddenException('이미 처리한 결재입니다.');
      }

      const stampData = dto.stampData
        ? { ...dto.stampData, approvedAt: new Date().toISOString() }
        : null;

      chain[approverIdx] = {
        ...chain[approverIdx],
        status: dto.status === ApprovalStatus.APPROVED ? '승인' : '반려',
        stampData,
        decidedAt: new Date().toISOString(),
      };

      if (dto.status === ApprovalStatus.REJECTED) {
        const rejected = await this.approvalModel
          .findByIdAndUpdate(
            id,
            {
              status: ApprovalStatus.REJECTED,
              comment: dto.comment ?? '',
              approvalChain: chain,
              stampData,
            },
            { new: true },
          )
          .lean();
        this.notifyApplicantDecided(rejected);
        this.broadcastApprovalChange(rejected, 'decided');
        return rejected;
      }

      // 모든 슬롯이 승인 완료되면 최종 승인
      const allApproved = chain.every((s: any) => s.status === '승인');
      if (allApproved) {
        const evidenceDeadline = await this.computeEvidenceDeadline(doc.toObject());
        const approved = await this.approvalModel
          .findByIdAndUpdate(
            id,
            {
              status: ApprovalStatus.APPROVED,
              comment: dto.comment ?? '',
              approvalChain: chain,
              currentStep: chain.length,
              stampData,
              evidenceDeadline,
            },
            { new: true },
          )
          .lean();
        this.notifyApplicantDecided(approved);
        this.broadcastApprovalChange(approved, 'decided');
        return approved;
      }

      // 아직 미결 슬롯 있음 → pending 유지, 도장만 업데이트 + 다음 결재자에게 알림
      const progressed = await this.approvalModel
        .findByIdAndUpdate(
          id,
          { approvalChain: chain },
          { new: true },
        )
        .lean();
      this.notifyCurrentApprover(progressed);
      this.broadcastApprovalChange(progressed, 'submitted');
      return progressed;
    }

    // 단일 결재 (체인 미설정 하위 호환)
    const isAssignedApprover =
      user.canApprove && doc.approverId?.toString() === user._id.toString();
    if (!isHeadAdmin && !isAssignedApprover) {
      throw new ForbiddenException('결재 권한이 없습니다.');
    }

    const stampData = dto.stampData
      ? { ...dto.stampData, approvedAt: new Date().toISOString() }
      : null;

    const evidenceDeadline =
      dto.status === ApprovalStatus.APPROVED
        ? await this.computeEvidenceDeadline(doc.toObject())
        : null;
    const decided = await this.approvalModel
      .findByIdAndUpdate(
        id,
        {
          status: dto.status,
          comment: dto.comment ?? '',
          stampData,
          evidenceDeadline,
        },
        { new: true },
      )
      .lean();
    this.notifyApplicantDecided(decided);
    this.broadcastApprovalChange(decided, 'decided');
    return decided;
  }

  // ─── 관리자용: 직원별 기안 대기 건수 집계 ────────────────────
  // 반환: { [applicantId]: pendingCount }
  async getPendingCountByApplicant(): Promise<Record<string, number>> {
    const agg = await this.approvalModel.aggregate([
      { $match: { status: ApprovalStatus.PENDING } },
      { $group: { _id: '$applicantId', count: { $sum: 1 } } },
    ]);
    const result: Record<string, number> = {};
    for (const row of agg) {
      result[row._id.toString()] = row.count;
    }
    return result;
  }

  // ─── 데일리 증빙 미제출 알림 크론 (매일 09:00) ──────────────
  // D-1 (내일 만료), D-0 (오늘 만료), D+3 (3일 경과) 인 문서의 기안자에게 알림 발송
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async dailyEvidenceReminder() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 후보: APPROVED + evidenceDeadline not null + attachments/formData.attachments 비어 있음
    const candidates = await this.approvalModel
      .find({
        status: ApprovalStatus.APPROVED,
        evidenceDeadline: { $ne: null },
        $or: [{ attachments: { $exists: false } }, { attachments: { $size: 0 } }],
      })
      .select('_id title applicantId evidenceDeadline attachments formData formType')
      .lean();

    for (const doc of candidates) {
      // 레거시 하위 호환: formData.attachments 도 비어 있어야 진짜 미제출
      const formLen = ((doc as any).formData?.attachments ?? []).length;
      if (formLen > 0) continue;

      const deadline = new Date(doc.evidenceDeadline as any);
      const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
      const diffDays = Math.round((deadlineDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

      // D-1, D-0 만 알리고, 이후엔 D+3 마다 한 번씩 (D+3, D+6, …)
      const shouldNotify =
        diffDays === 1 ||
        diffDays === 0 ||
        (diffDays < 0 && diffDays % 3 === 0);

      if (!shouldNotify) continue;

      const label =
        diffDays === 1
          ? 'D-1'
          : diffDays === 0
            ? '오늘 만료'
            : `D+${Math.abs(diffDays)} 경과`;

      const payload = {
        id: doc._id.toString(),
        title: doc.title,
        deadline: deadline.toISOString(),
        label,
        diffDays,
      };

      // 기안자 본인에게 개인 알림
      this.messengerGateway.emitToUser(
        doc.applicantId.toString(),
        'evidenceReminder',
        payload,
      );

      // 대시보드 위젯 재조회 트리거
      this.messengerGateway.emitToUser(
        doc.applicantId.toString(),
        'approvalChanged',
        { kind: 'reminder', id: payload.id },
      );
    }
  }

  // ─── 증빙 미제출 문서 조회 ──────────────────────────────────
  // scope: 'mine' = 내 기안, 'all' = 관리자용 전체
  async getMissingEvidence(user: DecideUser, scope: 'mine' | 'all') {
    const query: Record<string, unknown> = {
      status: ApprovalStatus.APPROVED,
      evidenceDeadline: { $ne: null },
      $or: [
        { attachments: { $exists: false } },
        { attachments: { $size: 0 } },
      ],
    };
    if (scope === 'mine' || user.role !== UserRole.HEAD_ADMIN) {
      query.applicantId = new Types.ObjectId(user._id);
    }
    const docs = await this.approvalModel
      .find(query)
      .select('_id title applicantId applicantName applicantDept formType formData evidenceDeadline attachments createdAt updatedAt')
      .sort({ evidenceDeadline: 1 })
      .lean();
    // attachments 또는 formData.attachments 중 하나라도 있으면 제외 (레거시 하위 호환)
    return docs.filter((d: any) => {
      const topLen = (d.attachments ?? []).length;
      const formLen = (d.formData?.attachments ?? []).length;
      return topLen === 0 && formLen === 0;
    });
  }

  // ─── 사후 증빙 업로드 ────────────────────────────────────────
  async addEvidence(id: string, userId: string, urls: string[]) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    if (doc.applicantId.toString() !== userId) {
      throw new ForbiddenException('본인의 문서에만 증빙을 추가할 수 있습니다.');
    }
    if (!urls || urls.length === 0) {
      throw new ForbiddenException('업로드할 증빙 파일이 없습니다.');
    }

    const existingAttachments: string[] = doc.attachments ?? [];
    const merged = [...existingAttachments, ...urls];
    const formData: Record<string, any> = { ...((doc as any).formData ?? {}) };
    formData.attachments = merged;

    const updated = await this.approvalModel
      .findByIdAndUpdate(
        id,
        { attachments: merged, formData },
        { new: true },
      )
      .lean();
    this.broadcastApprovalChange(updated, 'submitted');
    return updated;
  }

  // ─── 기안 취소 (삭제 대신 상태 변경) ─────────────────────────
  async cancel(id: string, userId: string) {
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('기안을 찾을 수 없습니다.');
    if (doc.applicantId.toString() !== userId) {
      throw new ForbiddenException('본인의 기안만 취소할 수 있습니다.');
    }
    if (
      doc.status !== ApprovalStatus.PENDING &&
      doc.status !== ApprovalStatus.DRAFT
    ) {
      throw new ForbiddenException('검토중 또는 임시저장 상태의 기안만 취소할 수 있습니다.');
    }
    const cancelled = await this.approvalModel
      .findByIdAndUpdate(id, { status: ApprovalStatus.CANCELLED }, { new: true })
      .lean();
    this.broadcastApprovalChange(cancelled, 'cancelled');
    return cancelled;
  }

  // ─── 어드민 전용 영구 삭제 ───────────────────────────────────
  async adminDelete(id: string, userRole: string) {
    if (userRole !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('관리자만 문서를 삭제할 수 있습니다.');
    }
    const doc = await this.approvalModel.findById(id);
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    const plain = doc.toObject();
    await this.approvalModel.findByIdAndDelete(id);
    this.broadcastApprovalChange(plain, 'deleted');
    return { message: '삭제되었습니다.' };
  }

  // ─── 단건 조회 ────────────────────────────────────────────────
  async findOne(id: string) {
    const doc = await this.approvalModel.findById(id).lean();
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    return doc;
  }

  // ─── 읽음 처리 ────────────────────────────────────────────────
  async markAsRead(id: string, userId: string) {
    await this.approvalModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    );
    return { ok: true };
  }

  // ─── 전체 (어드민용) ──────────────────────────────────────────
  async findAll() {
    return this.approvalModel
      .find({ status: { $ne: ApprovalStatus.DRAFT } })
      .sort({ createdAt: -1 })
      .lean();
  }
}
