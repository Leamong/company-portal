import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

export enum PostCategory {
  NOTICE = '공지',
  MARKETING = '마케팅',
  DESIGN = '디자인',
  GENERAL = '일반',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string; // HTML (TipTap 결과)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  authorName: string;

  @Prop({ type: String, enum: PostCategory, default: PostCategory.GENERAL })
  category: PostCategory;

  @Prop({ default: false })
  isNotice: boolean; // 전사 공지 (head-admin만 설정 가능)

  @Prop({ default: 0 })
  views: number;

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
