'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { ROUTE_PERMISSION_MAP } from '@/lib/permissions';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe, accessToken, hasHydrated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated && !accessToken) {
      router.replace('/login');
      return;
    }

    if (accessToken && !isAuthenticated) {
      fetchMe();
    }
  }, [hasHydrated, isAuthenticated, accessToken, router, fetchMe]);

  // 페이지 이동마다 최신 권한 갱신 — 어드민이 권한을 바꿔도 이동 시 즉시 반영
  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 리하이드레이션 전이거나 인증 확인 중이면 스피너
  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  // 페이지 권한 체크 (head-admin은 모든 페이지 접근 가능)
  if (user && user.role !== 'head-admin') {
    const requiredPermission = ROUTE_PERMISSION_MAP[pathname];
    if (requiredPermission && !user.pagePermissions?.includes(requiredPermission)) {
      return (
        <div className='flex flex-col items-center justify-center h-full gap-4 py-24'>
          <div className='w-16 h-16 rounded-full bg-red-50 flex items-center justify-center'>
            <svg className='w-8 h-8 text-red-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
            </svg>
          </div>
          <div className='text-center'>
            <p className='text-gray-800 font-semibold text-base'>접근 권한이 없습니다</p>
            <p className='text-gray-400 text-sm mt-1'>이 페이지에 대한 접근 권한이 없습니다.<br />관리자에게 권한을 요청하세요.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className='mt-2 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors'
          >
            대시보드로 이동
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
