import { Injectable } from '@nestjs/common';
import {
  IMailNotificationService,
  MailNotificationStatus,
} from './interfaces/mail-notification.interface';

/**
 * Mock 메일 알림 서비스.
 *
 * 가비아 하이웍스 연동 준비 전 프론트엔드 개발용 더미 데이터를 반환합니다.
 *
 * ─ 교체 방법 ─────────────────────────────────────────────────────────────────
 * 1. HiworksMailNotificationService implements IMailNotificationService 생성
 * 2. mail-notification.module.ts 의 provider useClass 를 새 서비스로 교체
 * 3. 이 파일 삭제
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class MockMailNotificationService implements IMailNotificationService {
  async getStatus(): Promise<MailNotificationStatus> {
    return {
      unreadCount: 3,
      latestMail: {
        sender: '영업팀 김과장',
        subject: '견적서 송부 건',
        receivedAt: '2026-04-16 11:10 AM',
      },
    };
  }
}
