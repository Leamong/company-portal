import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClientDocument = Client & Document;

export enum ClientStatus {
  ACTIVE = '활성',
  PENDING = '대기',
  CLOSED = '종료',
}

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  contact: string; // 담당자명

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  industry: string;

  @Prop({ type: String, enum: ClientStatus, default: ClientStatus.ACTIVE })
  status: ClientStatus;

  @Prop({ default: '' })
  notes: string; // 메모

  @Prop({ default: 0 })
  totalOrders: number; // 비정규화: 연결된 주문 수

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
