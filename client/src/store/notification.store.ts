'use client';

import { create } from 'zustand';

interface NotificationState {
  // 메신저 미열람 메시지 수
  unreadMessages: number;
  incrementUnread: () => void;
  setUnreadMessages: (count: number) => void;
  clearUnreadMessages: () => void;

  // 사내 메일 미열람 수 (SSE 로 실시간 동기화)
  mailUnread: number;
  setMailUnread: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadMessages: 0,
  incrementUnread: () => set((s) => ({ unreadMessages: s.unreadMessages + 1 })),
  setUnreadMessages: (count) => set({ unreadMessages: count }),
  clearUnreadMessages: () => set({ unreadMessages: 0 }),

  mailUnread: 0,
  setMailUnread: (count) => set({ mailUnread: count }),
}));
