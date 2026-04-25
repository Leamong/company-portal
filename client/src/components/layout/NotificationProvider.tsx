'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import api from '@/lib/api';

let notifSocket: Socket | null = null;

interface Room {
  unreadCount: number;
}

interface NewMessagePayload {
  roomId: string;
  senderId: string;
}

export default function NotificationProvider() {
  const { accessToken, user } = useAuthStore();
  const pathname = usePathname();
  const {
    incrementUnread,
    setUnreadMessages,
    clearUnreadMessages,
    setApprovalUnread,
    setBoardUnread,
    bumpBoardUnread,
    setLeaveExpiryWarning,
  } = useNotificationStore();

  // pathname을 ref로 관리해 소켓 핸들러에서 최신값 접근
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 메신저 진입 시 알림 초기화
  useEffect(() => {
    if (pathname.startsWith('/messenger')) {
      clearUnreadMessages();
    }
  }, [pathname, clearUnreadMessages]);

  // 앱 초기 로드 시 미읽은 메시지 수 계산
  useEffect(() => {
    if (!accessToken) return;
    api
      .get('/api/messenger/rooms')
      .then((res) => {
        const total = (res.data as Room[]).reduce(
          (s, r) => s + (r.unreadCount || 0),
          0,
        );
        setUnreadMessages(total);
      })
      .catch(() => {});
  }, [accessToken, setUnreadMessages]);

  // 결재 대기 수 재조회 함수 — 서버에서 inbox 조회 후, 내가 아직 안 읽은 건만 카운트
  const myId = user?.id;
  const refreshApprovalUnread = useCallback(() => {
    if (!accessToken) return;
    api
      .get('/api/approval/inbox')
      .then((res) => {
        const docs = (res.data as Array<{ readBy?: string[] }>) ?? [];
        const unread = myId
          ? docs.filter((d) => !(d.readBy ?? []).some((uid) => uid?.toString() === myId)).length
          : docs.length;
        setApprovalUnread(unread);
      })
      .catch(() => {});
  }, [accessToken, setApprovalUnread, myId]);

  // 앱 초기 로드 시 결재 대기 수 계산
  useEffect(() => {
    refreshApprovalUnread();
  }, [refreshApprovalUnread]);

  // 게시판 미열람 카운트 재조회
  const refreshBoardUnread = useCallback(() => {
    if (!accessToken) return;
    api
      .get<{ total: number; byChannel: Record<string, number> }>('/api/board/unread')
      .then((res) => {
        setBoardUnread(res.data.total || 0, res.data.byChannel || {});
      })
      .catch(() => {});
  }, [accessToken, setBoardUnread]);

  useEffect(() => {
    refreshBoardUnread();
  }, [refreshBoardUnread]);

  // 앱 초기 로드 + 30분마다 연차 만료 임박 체크 (90일 이내 & 잔여 > 0)
  useEffect(() => {
    if (!accessToken) return;

    const checkLeaveExpiry = () => {
      api
        .get('/api/users/me/annual-leave')
        .then((res) => {
          const d = res.data;
          if (
            d &&
            !d.notApplicable &&
            d.hireDate &&
            typeof d.daysUntilExpiry === 'number' &&
            d.daysUntilExpiry <= 90 &&
            d.remaining > 0
          ) {
            setLeaveExpiryWarning({
              daysUntilExpiry: d.daysUntilExpiry,
              remaining: d.remaining,
              periodEnd: d.periodEnd,
            });
          } else {
            setLeaveExpiryWarning(null);
          }
        })
        .catch(() => {});
    };

    checkLeaveExpiry();
    const iv = setInterval(checkLeaveExpiry, 30 * 60 * 1000); // 30분
    return () => clearInterval(iv);
  }, [accessToken, setLeaveExpiryWarning]);

  // 전역 소켓 연결 및 새 메시지 수신
  useEffect(() => {
    if (!accessToken) return;

    if (!notifSocket || !notifSocket.connected) {
      notifSocket = io(
        `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'}/messenger`,
        { auth: { token: accessToken }, transports: ['websocket'] },
      );
    }

    const handleNewMessage = (_msg: NewMessagePayload) => {
      // 메신저 페이지에 있을 땐 이미 읽고 있으므로 증가 안 함
      if (!pathnameRef.current.startsWith('/messenger')) {
        incrementUnread();
      }
    };

    // 결재 상태 변경 시 (상신/처리/취소/삭제 모두 포함) — 서버에서 실제 카운트 재조회
    const handleApprovalChanged = (data: { kind: string; id: string }) => {
      refreshApprovalUnread();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('approval:changed', { detail: data }));
      }
    };

    // 증빙 미제출 리마인더 — 브라우저 알림 없이 대시보드/사이드바 위젯 재조회만 유도
    const handleEvidenceReminder = (data: {
      id: string;
      title: string;
      label: string;
      deadline: string;
    }) => {
      if (typeof window === 'undefined') return;
      // 위젯들이 approval:changed에 걸려있으므로 이걸 그대로 쏴주면 즉시 재조회
      window.dispatchEvent(new CustomEvent('approval:changed', { detail: { kind: 'reminder', id: data.id } }));
      window.dispatchEvent(new CustomEvent('evidence:reminder', { detail: data }));
    };

    // 게시판 새 글 알림 — 본인이 보고 있는 채널이면 카운트 증가 안 함
    const handleBoardChanged = (data: {
      kind: string;
      postId: string;
      channelId: string;
      channelName: string;
      title: string;
      authorName: string;
    }) => {
      const inThisChannel =
        pathnameRef.current.startsWith('/board') &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('ch') === data.channelId;
      if (inThisChannel) {
        // 현재 보고 있는 채널이면 서버에서 자동 read 처리되므로 아무 것도 안 함
        return;
      }
      bumpBoardUnread(data.channelId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('board:changed', { detail: data }));
      }
    };

    notifSocket.on('newMessage', handleNewMessage);
    notifSocket.on('approvalChanged', handleApprovalChanged);
    notifSocket.on('evidenceReminder', handleEvidenceReminder);
    notifSocket.on('boardChanged', handleBoardChanged);

    return () => {
      notifSocket?.off('newMessage', handleNewMessage);
      notifSocket?.off('approvalChanged', handleApprovalChanged);
      notifSocket?.off('evidenceReminder', handleEvidenceReminder);
      notifSocket?.off('boardChanged', handleBoardChanged);
    };
  }, [accessToken, incrementUnread, refreshApprovalUnread, bumpBoardUnread]);

  return null;
}
