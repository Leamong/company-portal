import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConsultationDocument = Consultation & Document;

export enum ConsultationType {
  MEETING = '미팅',
  CALL = '전화',
  EMAIL = '이메일',
  OTHER = '기타',
}

@Schema({ timestamps: true })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ type: String, enum: ConsultationType, required: true })
  type: ConsultationType;

  @Prop({ required: true })
  memo: string;

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
