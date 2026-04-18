'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMailNotification, type MailSummary } from '@/hooks/useMailNotification';
import { useNotificationStore } from '@/store/notification.store';

const MAIL_URL = process.env.NEXT_PUBLIC_MAIL_URL ?? '#';

/**
 * 사내 메일 알림 토스트 + SSE 구독 진입점.
 *
 * - Dashboard 레이아웃에 단 한 번 마운트합니다.
 * - 새 메일 도착 시 우측 하단에 framer-motion 토스트가 슬라이드인됩니다.
 * - 토스트 클릭 또는 '열기' 버튼 → 외부 메일 창을 새 탭으로 열기.
 * - 5초 후 자동 닫힘.
 */
export default function MailToast() {
  const setMailUnread = useNotificationStore((s) => s.setMailUnread);
  const [toast, setToast] = useState<MailSummary | null>(null);
  const [autoCloseId, setAutoCloseId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleNewMail = useCallback(
    (mail: MailSummary) => {
      if (autoCloseId) clearTimeout(autoCloseId);
      setToast(mail);
      const id = setTimeout(() => setToast(null), 5000);
      setAutoCloseId(id);
    },
    [autoCloseId],
  );

  const { unreadCount } = useMailNotification(handleNewMail);

  // notification store 에 미열람 수 동기화 (사이드바 배지용)
  useEffect(() => {
    setMailUnread(unreadCount);
  }, [unreadCount, setMailUnread]);

  const openMail = () => {
    window.open(MAIL_URL, '_blank', 'noopener,noreferrer');
    setToast(null);
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key='mail-toast'
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className='fixed bottom-6 right-6 z-50 w-80 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden'
        >
          {/* 상단 진행 바 (5초 애니메이션) */}
          <motion.div
            className='h-0.5 bg-blue-500'
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 5, ease: 'linear' }}
          />

          <div className='p-4'>
            {/* 헤더 */}
            <div className='flex items-start justify-between gap-3'>
              <div className='flex items-center gap-2.5 min-w-0'>
                <div className='w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0'>
                  {/* 메일 아이콘 */}
                  <svg className='w-4 h-4 text-blue-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8}
                      d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                  </svg>
                </div>
                <div className='min-w-0'>
                  <p className='text-[11px] text-blue-400 font-medium'>새 메일 도착</p>
                  <p className='text-sm text-white font-semibold truncate'>{toast.sender}님</p>
                </div>
              </div>

              <button
                onClick={() => setToast(null)}
                className='text-gray-500 hover:text-gray-300 transition-colors shrink-0 mt-0.5'
                aria-label='닫기'
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>

            {/* 제목 */}
            <p className='mt-2.5 text-sm text-gray-300 truncate pl-10.5'>{toast.subject}</p>
            <p className='text-[11px] text-gray-500 pl-10.5'>{toast.receivedAt}</p>

            {/* 열기 버튼 */}
            <button
              onClick={openMail}
              className='mt-3 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors'
            >
              메일함 열기
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
