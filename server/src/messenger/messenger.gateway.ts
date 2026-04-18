import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessengerService } from './messenger.service';

interface AuthPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

@WebSocketGateway({
  namespace: '/messenger',
  cors: { origin: '*', credentials: true },
})
export class MessengerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // userId -> Set<socketId> (같은 유저가 여러 탭으로 접속 가능)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messengerService: MessengerService,
  ) {}

  // ─── 연결 ───────────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<AuthPayload>(token);
      client.data.userId = payload.sub;
      client.data.userName = payload.name?.trim() || payload.email || '알 수 없음';

      // 소켓 맵 등록
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      // 내 채팅방들에 자동 join
      const rooms = await this.messengerService.getRooms(payload.sub);
      for (const room of rooms) {
        client.join(room._id.toString());
      }

      // 온라인 상태 브로드캐스트
      this.server.emit('userOnline', { userId: payload.sub });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.server.emit('userOffline', { userId });
      }
    }
  }

  // ─── 이벤트 ─────────────────────────────────────────────────────────────────

  // 방 입장
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.join(roomId);
    return { event: 'joinedRoom', data: roomId };
  }

  // 메시지 전송
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    const { userId, userName } = client.data;
    if (!userId || !userName || !data.content?.trim()) return;

    const message = await this.messengerService.saveMessage(
      data.roomId,
      userId,
      userName,
      data.content.trim(),
    );

    // Mongoose Document → 순수 plain object 변환 (ObjectId → string)
    // socket.io 직렬화 시 ObjectId가 문자열로 보장되지 않으면 클라이언트에서 비교 실패
    const plain = message.toObject();
    const msgPayload = {
      _id: plain._id.toString(),
      roomId: plain.roomId.toString(),
      senderId: plain.senderId.toString(),
      senderName: plain.senderName,
      content: plain.content,
      readBy: ((plain.readBy ?? []) as import('mongoose').Types.ObjectId[]).map((id) => id.toString()),
      createdAt: (plain.createdAt as Date).toISOString(),
      updatedAt: (plain.updatedAt as Date).toISOString(),
    };

    // 방 전체에 메시지 emit
    this.server.to(data.roomId).emit('newMessage', msgPayload);

    // 방 요약(lastMessage) 업데이트를 참여자들에게 알림
    this.server.to(data.roomId).emit('roomUpdated', { roomId: data.roomId });

    return { event: 'messageSent', data: msgPayload };
  }

  // 읽음 처리
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const { userId } = client.data;
    if (!userId) return;
    await this.messengerService.markRoomAsRead(roomId, userId);
    client.emit('roomRead', { roomId });
  }

  // DM 방 생성 (소켓으로 요청 → 참여자 즉시 room join + 실시간 알림)
  @SubscribeMessage('createDm')
  async handleCreateDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; targetName: string },
  ) {
    const { userId, userName } = client.data;
    if (!userId || !userName) return;

    const room = await this.messengerService.findOrCreateDm(
      userId,
      userName,
      data.targetId,
      data.targetName,
    );
    const roomId = room._id.toString();

    // 요청자 소켓 join
    client.join(roomId);

    // 상대방이 온라인이면 상대방 소켓도 즉시 join + 알림
    this.joinUserToRoom(data.targetId, roomId);
    this.notifyNewRoom([userId, data.targetId], room);

    return { event: 'dmCreated', data: room };
  }

  // 그룹 채팅방 생성 (소켓으로 요청)
  @SubscribeMessage('createGroup')
  async handleCreateGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; participantIds: string[]; participantNames: string[] },
  ) {
    const { userId } = client.data;
    if (!userId) return;

    const room = await this.messengerService.createGroupRoom(
      data.name,
      data.participantIds,
      data.participantNames,
    );
    const roomId = room._id.toString();

    // 모든 참여자 소켓 join + 알림
    for (const pid of data.participantIds) {
      this.joinUserToRoom(pid, roomId);
    }
    this.notifyNewRoom(data.participantIds, room);

    return { event: 'groupCreated', data: room };
  }

  // 타이핑 인디케이터
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    const { userId, userName } = client.data;
    client.to(data.roomId).emit('userTyping', {
      userId,
      userName,
      isTyping: data.isTyping,
    });
  }

  // 온라인 유저 목록 요청
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return {
      event: 'onlineUsers',
      data: Array.from(this.userSockets.keys()),
    };
  }

  // 유저가 방에 있는지 확인 (helper)
  isUserOnline(userId: string) {
    return this.userSockets.has(userId);
  }

  // 특정 유저의 모든 소켓을 room에 join
  private joinUserToRoom(userId: string, roomId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId);
      socket?.join(roomId);
    }
  }

  // 참여자들에게 newRoom 이벤트 발송
  private notifyNewRoom(participantIds: string[], room: object) {
    for (const pid of participantIds) {
      const sockets = this.userSockets.get(pid);
      if (!sockets) continue;
      for (const socketId of sockets) {
        this.server.to(socketId).emit('newRoom', room);
      }
    }
  }
}
