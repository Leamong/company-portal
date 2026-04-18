import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConfirmDocument = Confirm & Document;

export enum ConfirmStatus {
  PENDING = '컨펌대기',
  APPROVED = '승인',
  REJECTED = '반려',
  IN_REVISION = '수정중',
}

@Schema({ _id: true, timestamps: false })
export class Pin {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true })
  x: number; // 이미지 내 위치 % (left)

  @Prop({ required: true })
  y: number; // 이미지 내 위치 % (top)

  @Prop({ required: true })
  comment: string;

  @Prop({ required: true })
  author: string; // 작성자 이름 (비정규화)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ default: false })
  resolved: boolean;

  @Prop({ default: () => new Date().toISOString() })
  createdAt: string;
}

export const PinSchema = SchemaFactory.createForClass(Pin);

@Schema({ timestamps: true })
export class Confirm {
  @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
  taskId: Types.ObjectId | null;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  designType: string;

  @Prop({ required: true })
  uploader: string; // 업로더 이름 (비정규화)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploaderId: Types.ObjectId;

  @Prop({ type: String, enum: ConfirmStatus, default: ConfirmStatus.PENDING })
  status: ConfirmStatus;

  @Prop({ default: '' })
  imageUrl: string; // Cloudflare R2 URL

  @Prop({ default: '' })
  imageKey: string; // R2 오브젝트 키

  @Prop({ type: [PinSchema], default: [] })
  pins: Pin[];

  @Prop({ default: 1, min: 1 })
  round: number; // 수정 회차

  @Prop({ default: '' })
  rejectionNote: string; // 반려 사유

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const ConfirmSchema = SchemaFactory.createForClass(Confirm);
