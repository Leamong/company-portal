'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  position: string;
  department: 'marketing' | 'design' | 'management';
  role: 'head-admin' | 'employee';
  status: '출근' | '퇴근';
  /** 대표 전용: 부재 상태 (결재 없이 직접 토글) */
  absenceStatus: '휴가' | '부재' | null;
  profileImage: string | null;
  phone: string;
  birthDate: string | null;
  pagePermissions: string[];
  canApprove: boolean;
  canManageAttendance: boolean;
  /** 저장된 결재 도장 SVG 원본 (자동 생성 또는 업로드) */
  stampSvg: string | null;
  /** 도장 색상 (자동 생성 시 stroke/text 색으로 사용) */
  stampColor: string;
  /** 개인별 대시보드 커스텀 레이아웃 (react-grid-layout 형식) */
  dashboardLayout: Array<{ i: string; x: number; y: number; w: number; h: number; hidden?: boolean }>;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/api/auth/login', { email, password });
          const { accessToken, user } = res.data;
          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),

      fetchMe: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        try {
          const res = await api.get('/api/auth/me');
          set({ user: res.data, isAuthenticated: true });
        } catch {
          set({ user: null, accessToken: null, isAuthenticated: false });
          localStorage.removeItem('accessToken');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
