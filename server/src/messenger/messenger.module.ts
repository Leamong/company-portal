import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { MessengerGateway } from './messenger.gateway';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    // Gateway에서 JWT 검증용
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'fallback-secret'),
      }),
    }),
  ],
  controllers: [MessengerController],
  providers: [MessengerService, MessengerGateway],
  exports: [MessengerService, MessengerGateway],
})
export class MessengerModule {}
