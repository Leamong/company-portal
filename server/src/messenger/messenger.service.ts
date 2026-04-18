import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument, RoomType } from './schemas/chat-room.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class MessengerService {
  constructor(
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // 내 채팅방 목록 (마지막 메시지 기준 정렬)
  async getRooms(userId: string) {
    const rooms = await this.chatRoomModel
      .find({ participants: new Types.ObjectId(userId) })
      .sort({ lastMessageAt: -1 })
      .lean();

    // .lean() 결과는 항상 plain object → Record 접근만으로 충분
    return rooms.map((room) => ({
      ...room,
      unreadCount: (room.unreadCount as unknown as Record<string, number>)?.[userId] ?? 0,
    }));
  }

  // DM 방 찾기 또는 생성
  async findOrCreateDm(
    user1Id: string,
    user1Name: string,
    user2Id: string,
    user2Name: string,
  ) {
    const existing = await this.chatRoomModel.findOne({
      type: RoomType.DM,
      participants: {
        $all: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
        $size: 2,
      },
    });

    if (existing) return existing;

    return this.chatRoomModel.create({
      type: RoomType.DM,
      participants: [new Types.ObjectId(user1Id), new Types.ObjectId(user2Id)],
      participantNames: [user1Name, user2Name],
      lastMessage: '',
      lastMessageAt: null,
      unreadCount: {},
    });
  }

  // 그룹 채팅방 생성
  async createGroupRoom(
    name: string,
    participantIds: string[],
    participantNames: string[],
  ) {
    return this.chatRoomModel.create({
      type: RoomType.GROUP,
      name,
      participants: participantIds.map((id) => new Types.ObjectId(id)),
      participantNames,
      lastMessage: '',
      lastMessageAt: null,
      unreadCount: {},
    });
  }

  // 메시지 내역 조회
  async getMessages(roomId: string, userId: string, limit = 50, before?: string) {
    const query: Record<string, unknown> = { roomId: new Types.ObjectId(roomId) };
    if (before) {
      query._id = { $lt: new Types.ObjectId(before) };
    }

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .lean();

    // 읽음 처리
    await this.markRoomAsRead(roomId, userId);

    return messages.reverse();
  }

  // 메시지 저장
  async saveMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    content: string,
  ) {
    const message = await this.messageModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId(senderId),
      senderName,
      content,
      readBy: [new Types.ObjectId(senderId)],
    });

    // 채팅방 lastMessage 업데이트 + 상대방 unread +1
    // $set + dot notation으로 Map 필드 개별 업데이트 (MongooseMap spread 오류 방지)
    const room = await this.chatRoomModel.findById(roomId).lean();
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const setPayload: Record<string, unknown> = {
      lastMessage: content.length > 50 ? content.slice(0, 50) + '…' : content,
      lastMessageAt: new Date(),
    };

    const unreadMap = (room.unreadCount as unknown as Record<string, number>) ?? {};
    for (const pid of room.participants) {
      const pidStr = pid.toString();
      if (pidStr !== senderId) {
        setPayload[`unreadCount.${pidStr}`] = (unreadMap[pidStr] ?? 0) + 1;
      }
    }

    await this.chatRoomModel.findByIdAndUpdate(roomId, { $set: setPayload });

    return message;
  }

  // 읽음 처리
  async markRoomAsRead(roomId: string, userId: string) {
    // dot notation으로 특정 유저의 unread 카운트만 0으로 초기화
    await this.chatRoomModel.findByIdAndUpdate(roomId, {
      $set: { [`unreadCount.${userId}`]: 0 },
    });
  }

  // 참여자 추가 (DM → GROUP 자동 전환 포함)
  async addParticipants(
    roomId: string,
    newParticipantIds: string[],
    newParticipantNames: string[],
  ) {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const newIds = newParticipantIds
      .filter((id) => !room.participants.some((p) => p.toString() === id))
      .map((id) => new Types.ObjectId(id));

    const newNames = newParticipantNames.filter(
      (n) => !room.participantNames.includes(n),
    );

    if (newIds.length === 0) return room;

    // DM에 참여자 추가 시 자동으로 그룹 채팅으로 전환
    const updatedType =
      room.type === RoomType.DM ? RoomType.GROUP : room.type;

    return this.chatRoomModel.findByIdAndUpdate(
      roomId,
      {
        $push: {
          participants: { $each: newIds },
          participantNames: { $each: newNames },
        },
        $set: { type: updatedType },
      },
      { new: true },
    );
  }

  // 전체 안 읽은 메시지 수
  async getTotalUnread(userId: string): Promise<number> {
    const rooms = await this.chatRoomModel
      .find({ participants: new Types.ObjectId(userId) })
      .lean();

    return rooms.reduce((sum, room) => {
      const cnt = (room.unreadCount as unknown as Record<string, number>)?.[userId] ?? 0;
      return sum + cnt;
    }, 0);
  }
}
