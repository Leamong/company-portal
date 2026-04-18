'use client';

import { useEffect, useRef } from 'react';
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
  const { accessToken } = useAuthStore();
  const pathname = usePathname();
  const { incrementUnread, setUnreadMessages, clearUnreadMessages } = useNotificationStore();

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

    notifSocket.on('newMessage', handleNewMessage);

    return () => {
      notifSocket?.off('newMessage', handleNewMessage);
    };
  }, [accessToken, incrementUnread]);

  return null;
}
