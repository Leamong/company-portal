import {
  Controller,
  Get,
  Query,
  Sse,
  MessageEvent,
  Inject,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Observable, timer } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { JwtService } from '@nestjs/jwt';
import type { IMailNotificationService } from './interfaces/mail-notification.interface';
import { MAIL_NOTIFICATION_SERVICE } from './interfaces/mail-notification.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('mail-notification')
export class MailNotificationController {
  constructor(
    @Inject(MAIL_NOTIFICATION_SERVICE)
    private readonly mailService: IMailNotificationService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * GET /api/mail-notification/status
   * 현재 미열람 메일 수 + 최신 메일 요약 반환.
   * JWT 인증 필요.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus() {
    const data = await this.mailService.getStatus();
    return { data, statusCode: 200, message: 'ok' };
  }

  /**
   * GET /api/mail-notification/sse?token=<jwt>
   *
   * SSE 엔드포인트. EventSource 는 커스텀 헤더를 지원하지 않으므로
   * JWT 를 쿼리 파라미터로 전달받아 직접 검증합니다.
   *
   * - 연결 즉시 현재 상태 전송 (timer(0, 30_000))
   * - 이후 30 초마다 폴링
   *
   * 향후 하이웍스 IMAP 연동 시 mailService.getStatus() 내부만 교체하면
   * SSE 스트림 구조는 그대로 유지됩니다.
   */
  @Public()
  @Sse('sse')
  sse(@Query('token') token: string): Observable<MessageEvent> {
    try {
      this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return timer(0, 30_000).pipe(
      switchMap(() => this.mailService.getStatus()),
      map((data) => ({ data: JSON.stringify(data) }) as MessageEvent),
    );
  }
}
