'use client';

import { create } from 'zustand';

// 연차 만료 임박 경고 상태
// - daysUntilExpiry: 남은 일수 (만료일까지). null 이면 경고 대상 아님.
// - remaining: 잔여 연차 일수 (0이면 경고 불필요)
// - periodEnd: 만료일 YYYY-MM-DD
export interface LeaveExpiryWarning {
  daysUntilExpiry: number;
  remaining: number;
  periodEnd: string;
}

interface NotificationState {
  // 메신저 미열람 메시지 수
  unreadMessages: number;
  incrementUnread: () => void;
  setUnreadMessages: (count: number) => void;
  clearUnreadMessages: () => void;

  // 사내 메일 미열람 수 (SSE 로 실시간 동기화)
  mailUnread: number;
  setMailUnread: (count: number) => void;

  // 게시판 미열람 (전체 + 채널별)
  boardUnread: number;
  boardUnreadByChannel: Record<string, number>;
  setBoardUnread: (total: number, byChannel: Record<string, number>) => void;
  bumpBoardUnread: (channelId: string) => void;
  clearBoardUnreadFor: (channelId: string) => void;

  // 전자결재 미처리 수 (결재 대기)
  approvalUnread: number;
  incrementApprovalUnread: () => void;
  setApprovalUnread: (count: number) => void;
  clearApprovalUnread: () => void;

  // 연차 만료 임박 경고 (90일 이내) — null 이면 경고 없음
  leaveExpiryWarning: LeaveExpiryWarning | null;
  setLeaveExpiryWarning: (w: LeaveExpiryWarning | null) => void;
  // 대시보드 배너를 이번 세션에서 닫았는지
  leaveBannerDismissed: boolean;
  dismissLeaveBanner: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadMessages: 0,
  incrementUnread: () => set((s) => ({ unreadMessages: s.unreadMessages + 1 })),
  setUnreadMessages: (count) => set({ unreadMessages: count }),
  clearUnreadMessages: () => set({ unreadMessages: 0 }),

  mailUnread: 0,
  setMailUnread: (count) => set({ mailUnread: count }),

  boardUnread: 0,
  boardUnreadByChannel: {},
  setBoardUnread: (total, byChannel) =>
    set({ boardUnread: total, boardUnreadByChannel: byChannel }),
  bumpBoardUnread: (channelId) =>
    set((s) => {
      const next = { ...s.boardUnreadByChannel };
      next[channelId] = (next[channelId] ?? 0) + 1;
      return {
        boardUnreadByChannel: next,
        boardUnread: s.boardUnread + 1,
      };
    }),
  clearBoardUnreadFor: (channelId) =>
    set((s) => {
      if (!s.boardUnreadByChannel[channelId]) return {};
      const removed = s.boardUnreadByChannel[channelId];
      const next = { ...s.boardUnreadByChannel };
      delete next[channelId];
      return {
        boardUnreadByChannel: next,
        boardUnread: Math.max(0, s.boardUnread - removed),
      };
    }),

  approvalUnread: 0,
  incrementApprovalUnread: () => set((s) => ({ approvalUnread: s.approvalUnread + 1 })),
  setApprovalUnread: (count) => set({ approvalUnread: count }),
  clearApprovalUnread: () => set({ approvalUnread: 0 }),

  leaveExpiryWarning: null,
  setLeaveExpiryWarning: (w) => set({ leaveExpiryWarning: w }),
  leaveBannerDismissed: false,
  dismissLeaveBanner: () => set({ leaveBannerDismissed: true }),
}));
