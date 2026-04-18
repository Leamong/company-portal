import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// JwtStrategy.validate()가 반환하는 Mongoose UserDocument의 실제 형태
interface ReqUser {
  _id: { toString(): string };
  name: string;
}

@UseGuards(JwtAuthGuard)
@Controller('messenger')
export class MessengerController {
  constructor(private readonly messengerService: MessengerService) {}

  // 내 채팅방 목록
  @Get('rooms')
  getRooms(@CurrentUser() user: ReqUser) {
    return this.messengerService.getRooms(user._id.toString());
  }

  // DM 방 찾기/생성
  @Post('rooms/dm')
  findOrCreateDm(
    @CurrentUser() user: ReqUser,
    @Body() body: { targetId: string; targetName: string },
  ) {
    return this.messengerService.findOrCreateDm(
      user._id.toString(),
      user.name,
      body.targetId,
      body.targetName,
    );
  }

  // 그룹 채팅방 생성
  @Post('rooms/group')
  createGroupRoom(
    @Body() body: {
      name: string;
      participantIds: string[];
      participantNames: string[];
    },
  ) {
    return this.messengerService.createGroupRoom(
      body.name,
      body.participantIds,
      body.participantNames,
    );
  }

  // 메시지 내역
  @Get('rooms/:roomId/messages')
  getMessages(
    @CurrentUser() user: ReqUser,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messengerService.getMessages(
      roomId,
      user._id.toString(),
      limit ? parseInt(limit) : 50,
      before,
    );
  }

  // 참여자 추가
  @Patch('rooms/:roomId/participants')
  addParticipants(
    @Param('roomId') roomId: string,
    @Body() body: { participantIds: string[]; participantNames: string[] },
  ) {
    return this.messengerService.addParticipants(
      roomId,
      body.participantIds,
      body.participantNames,
    );
  }

  // 전체 안 읽은 수
  @Get('unread')
  getTotalUnread(@CurrentUser() user: ReqUser) {
    return this.messengerService.getTotalUnread(user._id.toString());
  }
}
