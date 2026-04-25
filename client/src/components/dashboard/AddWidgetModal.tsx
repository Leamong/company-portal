'use client';

import { WidgetDef } from './widgetRegistry';

// 위젯별 설명 + 아이콘 (카탈로그 UI용)
const WIDGET_META: Record<string, { icon: string; description: string }> = {
  'leave-detail':     { icon: '🏖',  description: '잔여·사용·총 연차와 예정된 휴가 표시' },
  'todo':             { icon: '✅', description: '개인 할 일 체크리스트' },
  'my-tasks':         { icon: '📋', description: '내가 담당자인 업무 중 마감 임박순' },
  'recent-board':     { icon: '📰', description: '최근 게시판 글 (공지 우선)' },
  'today-attendance': { icon: '⏱',  description: '전사 실시간 근태 현황' },
  'leave-expiring':   { icon: '⚠️', description: '3개월 내 연차 만료 임박 직원' },
  'mini-calendar':    { icon: '📅', description: '월간 캘린더 + 이번 달 일정' },
};

export default function AddWidgetModal({
  available,
  onAdd,
  onClose,
}: {
  available: WidgetDef[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden'>
        {/* 헤더 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 className='text-base font-bold text-gray-900'>위젯 추가</h2>
            <p className='text-xs text-gray-500 mt-0.5'>대시보드에 추가할 위젯을 선택하세요</p>
          </div>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 transition'
          >
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className='p-4 max-h-[60vh] overflow-y-auto'>
          {available.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <span className='text-3xl mb-2'>✨</span>
              <p className='text-sm font-semibold text-gray-700'>추가할 수 있는 위젯이 없습니다</p>
              <p className='text-xs text-gray-400 mt-1'>
                이미 모든 위젯이 대시보드에 추가되어 있어요
              </p>
            </div>
          ) : (
            <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              {available.map((w) => {
                const meta = WIDGET_META[w.id] ?? { icon: '🧩', description: '' };
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => onAdd(w.id)}
                      className='w-full text-left p-3 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group'
                    >
                      <div className='flex items-start gap-2.5'>
                        <span className='text-xl shrink-0 mt-0.5'>{meta.icon}</span>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors'>
                            {w.title}
                          </p>
                          <p className='text-[11px] text-gray-500 mt-0.5 leading-relaxed'>
                            {meta.description}
                          </p>
                        </div>
                        <span className='text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 4v16m8-8H4' />
                          </svg>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 푸터 */}
        <div className='px-6 py-3 border-t border-gray-100 flex justify-end'>
          <button
            onClick={onClose}
            className='px-4 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors'
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
