import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TodoDocument = Todo & Document;

@Schema({ timestamps: true })
export class Todo {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ default: false })
  isDone: boolean;

  // 정렬용 (drag/drop 시 사용자가 재배치 가능)
  @Prop({ default: 0 })
  order: number;

  // timestamps: true 자동 생성 — TS 타입 인식을 위해 명시
  createdAt: Date;
  updatedAt: Date;
}

export const TodoSchema = SchemaFactory.createForClass(Todo);
