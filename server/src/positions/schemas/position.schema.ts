import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PositionDocument = Position & Document;

@Schema({ timestamps: true })
export class Position {
  @Prop({ required: true })
  title: string; // 직급명 (예: 사원, 주임, 대리, 과장, 차장, 팀장, 이사)

  @Prop({ type: Number, default: 0 })
  level: number; // 순서 (낮을수록 낮은 직급)

  @Prop({ type: String, default: '' })
  description: string; // 간략한 설명

  @Prop({ type: String, default: 'violet' })
  color: string; // 배지 색상 키 — POSITION_COLORS 세트에서 선택 (violet | purple | indigo | amber | cyan | gray)

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const PositionSchema = SchemaFactory.createForClass(Position);
