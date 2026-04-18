import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatRoomDocument = ChatRoom & Document;

export enum RoomType {
  DM = 'dm',
  GROUP = 'group',
}

@Schema({ timestamps: true })
export class ChatRoom {
  @Prop({ type: String, enum: RoomType, default: RoomType.DM })
  type: RoomType;

  // DM: 정확히 2명, GROUP: 2명 이상
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  // 참여자 이름 (빠른 표시용)
  @Prop({ type: [String], default: [] })
  participantNames: string[];

  // 그룹 채팅방 이름 (DM은 null)
  @Prop({ type: String, default: null })
  name: string | null;

  @Prop({ type: String, default: '' })
  lastMessage: string;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  // 각 유저의 읽지 않은 메시지 수 { userId: count }
  @Prop({ type: Map, of: Number, default: {} })
  unreadCount: Map<string, number>;

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
