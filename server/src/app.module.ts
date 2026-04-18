import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { ConfirmModule } from './confirm/confirm.module';
import { MessengerModule } from './messenger/messenger.module';
import { BoardModule } from './board/board.module';
import { ApprovalModule } from './approval/approval.module';
import { PositionsModule } from './positions/positions.module';
import { DepartmentsModule } from './departments/departments.module';
import { MailNotificationModule } from './mail-notification/mail-notification.module';
import { CrmModule } from './crm/crm.module';
import { IpWhitelistGuard } from './common/guards/ip-whitelist.guard';

@Module({
  imports: [
    // 환경변수 전역 설정
    ConfigModule.forRoot({ isGlobal: true }),

    // MongoDB Atlas 연결
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),

    // 스케줄러 (자동화 파이프라인)
    ScheduleModule.forRoot(),

    // 기능 모듈
    AuthModule,
    UsersModule,
    TasksModule,
    ConfirmModule,
    MessengerModule,
    BoardModule,
    ApprovalModule,
    PositionsModule,
    DepartmentsModule,
    MailNotificationModule,
    CrmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // IP 화이트리스트 전역 가드
    {
      provide: APP_GUARD,
      useClass: IpWhitelistGuard,
    },
  ],
})
export class AppModule {}
