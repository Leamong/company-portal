import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChannelDocument = Channel & Document;
export type ChannelScope = 'company' | 'department';

@Schema({ timestamps: true })
export class Channel {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: ['company', 'department'], required: true, index: true })
  scope: ChannelScope;

  // scope='department' 일 때 사용. 부서 삭제 시 archived=true 로 보존
  @Prop({ type: String, default: null, index: true })
  deptKey: string | null;

  // 공지 전용 채널: 작성은 head-admin만 가능
  @Prop({ default: false })
  noticeOnly: boolean;

  // 사이드바 정렬 (낮을수록 위)
  @Prop({ default: 0 })
  order: number;

  // 부서 삭제 등으로 더 이상 활성이 아닌 채널. 사이드바에서 숨김 (게시글은 보존)
  @Prop({ default: false })
  archived: boolean;

  // 부서 채널 자동 생성 표식 (관리자가 직접 생성한 채널인지 구분)
  @Prop({ default: false })
  systemManaged: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
