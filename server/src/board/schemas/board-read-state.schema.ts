import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BoardReadStateDocument = BoardReadState & Document;

// 사용자별·채널별 마지막으로 읽은 시각.
// (channelId의 게시글 중 createdAt > lastReadAt 인 것이 미열람)
@Schema({ timestamps: true })
export class BoardReadState {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  lastReadAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BoardReadStateSchema = SchemaFactory.createForClass(BoardReadState);
BoardReadStateSchema.index({ userId: 1, channelId: 1 }, { unique: true });
