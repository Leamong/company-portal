import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true })
export class Department {
  @Prop({ required: true, unique: true })
  key: string; // 내부 식별자 (예: marketing, design, management)

  @Prop({ required: true })
  label: string; // 표시 이름 (예: 마케팅팀, 디자인팀)

  @Prop({ type: String, default: 'blue' })
  color: string; // 색상 키 (blue | purple | green | orange | pink | gray | teal | red)

  @Prop({ type: String, default: '' })
  description: string; // 부서 설명

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
