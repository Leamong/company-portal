'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';

export interface MailSummary {
  sender: string;
  subject: string;
  receivedAt: string;
}

export interface MailNotificationStatus {
  unreadCount: number;
  latestMail: MailSummary | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * 사내 메일 알림 훅.
 *
 * ─ 동작 방식 ─────────────────────────────────────────────────────────────────
 * 1. 마운트 시 REST GET /api/mail-notification/status 로 초기 상태 조회
 * 2. SSE GET /api/mail-notification/sse?token=<jwt> 로 실시간 업데이트 구독
 *    (서버는 연결 즉시 + 30초마다 이벤트 발행)
 * 3. latestMail 이 변경되면 onNewMail 콜백 실행 → MailToast 트리거
 *
 * ─ 향후 하이웍스 연동 후 ──────────────────────────────────────────────────────
 * 이 훅은 변경 없이 유지됩니다. 백엔드 서비스만 교체하면 됩니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useMailNotification(onNewMail?: (mail: MailSummary) => void) {
  const { accessToken, user } = useAuthStore();
  const [status, setStatus] = useState<MailNotificationStatus>({
    unreadCount: 0,
    latestMail: null,
  });
  const [connected, setConnected] = useState(false);
  const prevLatestRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const hasMail = user?.role === 'head-admin' || user?.pagePermissions?.includes('mail');

  const applyUpdate = useCallback(
    (next: MailNotificationStatus) => {
      setStatus(next);

      if (!next.latestMail) return;
      const key = `${next.latestMail.sender}::${next.latestMail.subject}::${next.latestMail.receivedAt}`;
      if (prevLatestRef.current !== null && prevLatestRef.current !== key) {
        onNewMail?.(next.latestMail);
      }
      prevLatestRef.current = key;
    },
    [onNewMail],
  );

  // 초기 REST 조회
  useEffect(() => {
    if (!accessToken || !hasMail) return;

    fetch(`${API_BASE}/api/mail-notification/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) applyUpdate(res.data as MailNotificationStatus);
      })
      .catch(() => {
        // Mock 단계에서는 네트워크 오류 무시
      });
  }, [accessToken, hasMail, applyUpdate]);

  // SSE 구독
  useEffect(() => {
    if (!accessToken || !hasMail) return;

    const url = `${API_BASE}/api/mail-notification/sse?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as MailNotificationStatus;
        applyUpdate(data);
      } catch {
        // 파싱 실패 무시
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource 는 자동 재연결을 시도하므로 별도 처리 불필요
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [accessToken, hasMail, applyUpdate]);

  return { ...status, connected };
}
