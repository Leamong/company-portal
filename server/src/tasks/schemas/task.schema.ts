import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  CONSULTING = '상담중',
  APPROVED = '결재완료',
  IN_PRODUCTION = '제작중',
  PENDING_CONFIRM = '컨펌대기',
  DELIVERED = '고객사전달완료',
}

// 허용된 상태 전환 규칙 (직원 기준, 어드민은 제한 없음)
export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.CONSULTING]: [TaskStatus.APPROVED],
  [TaskStatus.APPROVED]: [TaskStatus.IN_PRODUCTION],
  [TaskStatus.IN_PRODUCTION]: [TaskStatus.PENDING_CONFIRM, TaskStatus.APPROVED], // 수정 재작업 허용
  [TaskStatus.PENDING_CONFIRM]: [TaskStatus.DELIVERED, TaskStatus.IN_PRODUCTION], // 반려 시 제작중으로
  [TaskStatus.DELIVERED]: [], // 종착 상태
};

export enum DesignType {
  BANNER = '배너',
  LOGO = '로고',
  SNS = 'SNS',
  CATALOG = '카탈로그',
  PRINT = '인쇄물',
  ETC = '기타',
}

export enum Priority {
  URGENT = '긴급',
  NORMAL = '일반',
}

export enum TaskDepartment {
  MARKETING = 'marketing',
  DESIGN = 'design',
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  client: string; // 고객사명

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assigneeId: Types.ObjectId | null;

  @Prop({ default: '' })
  assigneeName: string; // 비정규화: 표시용 이름

  @Prop({ type: String, enum: TaskDepartment, required: true })
  department: TaskDepartment;

  @Prop({ required: true })
  dueDate: string; // YYYY-MM-DD

  @Prop({ required: true })
  orderDate: string; // YYYY-MM-DD

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: String, enum: DesignType, required: true })
  designType: DesignType;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.CONSULTING })
  status: TaskStatus;

  @Prop({ type: String, enum: Priority, default: Priority.NORMAL })
  priority: Priority;

  @Prop({ default: '' })
  notes: string; // 특이사항

  @Prop({ type: Date, default: null })
  archivedAt: Date | null; // 보관 시각 (전달완료 즉시 기록)

  @Prop({ type: Date, default: null })
  imagesDeletedAt: Date | null; // R2 이미지 삭제 완료 시각

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
