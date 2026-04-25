import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApprovalDocument = Approval & Document;

// 기존 type 필드 (하위 호환)
export enum ApprovalType {
  VACATION = '휴가신청',
  EXPENSE = '지출결의',
  OVERTIME = '연장근무',
  OTHER = '기타',
}

// 신규 양식 유형 (8종)
export enum ApprovalFormType {
  VACATION = '휴가신청서',
  OVERTIME = '연장근무신청서',
  ABSENCE = '결근계',
  EXPENSE = '지출결의서',
  BUSINESS_EXPENSE = '업무추진비신청서',
  GENERAL = '업무기안서',
  COOPERATION = '업무협조 요청서',
  TRIP = '국내출장신청서',
}

export enum ApprovalStatus {
  DRAFT = '임시저장',
  PENDING = '검토중',
  APPROVED = '승인',
  REJECTED = '반려',
  CANCELLED = '취소',
}

@Schema({ timestamps: true })
export class Approval {
  // 신규: 구체적 양식 유형
  @Prop({ type: String, enum: ApprovalFormType, default: null })
  formType: ApprovalFormType | null;

  // 기존: 대분류 (하위 호환용)
  @Prop({ type: String, enum: ApprovalType, default: ApprovalType.OTHER })
  type: ApprovalType;

  @Prop({ required: true })
  title: string;

  // 기존 reason 필드 유지 (하위 호환)
  @Prop({ type: String, default: '' })
  reason: string;

  // 신규: 양식 전체 데이터를 JSON으로 저장
  @Prop({ type: Object, default: {} })
  formData: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  applicantId: Types.ObjectId;

  @Prop({ required: true })
  applicantName: string;

  @Prop({ type: String, default: '' })
  applicantDept: string;

  @Prop({ type: String, default: '' })
  applicantPosition: string;

  // 결재자
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approverId: Types.ObjectId | null;

  @Prop({ type: String, default: '헤드 어드민' })
  approverName: string;

  @Prop({ type: String, default: '대표' })
  approverPosition: string;

  @Prop({
    type: String,
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Prop({ type: String, default: '' })
  comment: string;

  // 문서 번호 (자동 생성)
  @Prop({ type: String, default: '' })
  docNumber: string;

  // 첨부파일 (R2 URL 목록)
  @Prop({ type: [String], default: [] })
  attachments: string[];

  // 승인 시 결재자 도장 스냅샷 저장 (단일 결재 하위 호환)
  @Prop({ type: Object, default: null })
  stampData: {
    svg: string;
    color: string;
    approverName: string;
    approvedAt: string;
  } | null;

  // 신청인 도장 (제출 시 자동 생성)
  @Prop({ type: Object, default: null })
  applicantStampData: {
    svg: string;
    color: string;
    applicantName: string;
    submittedAt: string;
  } | null;

  // 다단계 결재 체인
  @Prop({
    type: [
      {
        approverId: { type: String },
        approverName: { type: String },
        approverPosition: { type: String, default: '' },
        order: { type: Number },
        status: { type: String, default: 'pending' },
        stampData: { type: Object, default: null },
        decidedAt: { type: String, default: null },
        _id: false,
      },
    ],
    default: [],
  })
  approvalChain: Array<{
    approverId: string;
    approverName: string;
    approverPosition: string;
    order: number;
    status: 'pending' | '승인' | '반려';
    stampData: { svg: string; color: string; approverName: string; approvedAt: string } | null;
    decidedAt: string | null;
  }>;

  @Prop({ type: Number, default: 0 })
  currentStep: number;

  // 이 문서를 읽음 처리한 유저 ID 목록 (읽음 뱃지 계산용)
  @Prop({ type: [Types.ObjectId], default: [] })
  readBy: Types.ObjectId[];

  // 사후 증빙 데드라인 (병가/경조사 등 post timing). null 이면 사전 증빙이거나 증빙 불필요
  @Prop({ type: Date, default: null })
  evidenceDeadline: Date | null;

  // ─── 기존 필드 유지 (하위 호환) ───────────────────────────────
  @Prop({ type: Date, default: null })
  startDate: Date | null;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: Number, default: null })
  amount: number | null;

  @Prop({ type: String, default: null })
  vacationType: string | null;

  @Prop({ type: Date, default: null })
  overtimeDate: Date | null;

  @Prop({ type: String, default: null })
  overtimeStartTime: string | null;

  @Prop({ type: String, default: null })
  overtimeEndTime: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ApprovalSchema = SchemaFactory.createForClass(Approval);
