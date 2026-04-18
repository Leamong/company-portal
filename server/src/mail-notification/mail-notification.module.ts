import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailNotificationController } from './mail-notification.controller';
import { MockMailNotificationService } from './mock-mail-notification.service';
import { MAIL_NOTIFICATION_SERVICE } from './interfaces/mail-notification.interface';

/**
 * 메일 알림 모듈.
 *
 * ─ 서비스 교체 방법 (하이웍스 연동 시) ───────────────────────────────────────
 * providers 배열에서 useClass 를 MockMailNotificationService → HiworksMailNotificationService 로
 * 교체하기만 하면 컨트롤러와 프론트엔드 코드는 변경 없이 동작합니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'fallback-secret'),
      }),
    }),
  ],
  controllers: [MailNotificationController],
  providers: [
    {
      provide: MAIL_NOTIFICATION_SERVICE,
      useClass: MockMailNotificationService,
    },
    MockMailNotificationService,
  ],
})
export class MailNotificationModule {}
