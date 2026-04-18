import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AuthGuard from '@/components/layout/AuthGuard';
import NotificationProvider from '@/components/layout/NotificationProvider';
import MailToast from '@/components/layout/MailToast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <NotificationProvider />
      {/* 사내 메일 SSE 구독 + 토스트 알림 (권한 있는 유저에게만 활성화) */}
      <MailToast />
      <div className='flex h-screen bg-gray-50 overflow-hidden'>
        <Sidebar />
        <div className='flex-1 flex flex-col min-w-0'>
          <Header />
          <main className='flex-1 overflow-y-auto p-4 md:p-6'>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
