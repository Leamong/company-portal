import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ApprovalDocument = Approval & Document;

export enum ApprovalType {
  VACATION = '휴가신청',
  EXPENSE = '지출결의',
  OVERTIME = '연장근무',
  OTHER = '기타',
}

export enum ApprovalStatus {
  PENDING = '검토중',
  APPROVED = '승인',
  REJECTED = '반려',
}

@Schema({ timestamps: true })
export class Approval {
  @Prop({ type: String, enum: ApprovalType, required: true })
  type: ApprovalType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  reason: string; // 사유/내용

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  applicantId: Types.ObjectId;

  @Prop({ required: true })
  applicantName: string;

  // 결재자
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approverId: Types.ObjectId | null;

  @Prop({ type: String, default: '헤드 어드민' })
  approverName: string;

  @Prop({
    type: String,
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  // 결재 의견 (승인/반려 시 어드민이 작성)
  @Prop({ type: String, default: '' })
  comment: string;

  // 휴가신청 전용
  @Prop({ type: Date, default: null })
  startDate: Date | null;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  // 지출결의 전용
  @Prop({ type: Number, default: null })
  amount: number | null;

  // 휴가신청 전용 - 휴가 종류 (연차/반차(오전)/반차(오후)/병가/경조사/기타)
  @Prop({ type: String, default: null })
  vacationType: string | null;

  // 연장근무 전용
  @Prop({ type: Date, default: null })
  overtimeDate: Date | null;

  @Prop({ type: String, default: null })
  overtimeStartTime: string | null;

  @Prop({ type: String, default: null })
  overtimeEndTime: string | null;

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const ApprovalSchema = SchemaFactory.createForClass(Approval);
