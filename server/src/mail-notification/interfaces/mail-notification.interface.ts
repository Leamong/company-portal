export interface MailSummary {
  sender: string;
  subject: string;
  receivedAt: string;
}

export interface MailNotificationStatus {
  unreadCount: number;
  latestMail: MailSummary | null;
}

/**
 * 메일 알림 서비스 인터페이스.
 *
 * 현재: MockMailNotificationService (하드코딩 데이터)
 * 향후 교체: HiworksMailNotificationService (IMAP/REST API)
 *
 * 서비스 교체 시 이 인터페이스를 구현하고 mail-notification.module.ts 의
 * provider 토큰(MAIL_NOTIFICATION_SERVICE)만 교체하면 됩니다.
 */
export interface IMailNotificationService {
  getStatus(): Promise<MailNotificationStatus>;
}

export const MAIL_NOTIFICATION_SERVICE = 'MAIL_NOTIFICATION_SERVICE';
