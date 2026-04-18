'use client';

import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useAuthStore } from '@/store/auth.store';
import { useCalendarStore } from '@/store/calendar.store';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  return (
    <div className='space-y-4 md:space-y-6'>
      {/* 인사 헤더 */}
      <div>
        <h1 className='text-xl md:text-2xl font-bold text-gray-900'>
          안녕하세요, {user?.name}님 👋
        </h1>
        <p className='text-gray-500 text-sm mt-0.5'>오늘도 좋은 하루 되세요.</p>
      </div>

      {/* 요약 위젯 — 모바일 2열, lg 4열 */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatCard label='진행 중인 업무' value='12' color='blue' icon='📋' />
        <StatCard label='컨펌 대기' value='3' color='yellow' icon='⏳' />
        <StatCard label='미결 결재' value='2' color='red' icon='📝' />
        <StatCard label='이번 달 완료' value='28' color='green' icon='✅' />
      </div>

      {/* 어드민 전용 매출 요약 */}
      {isAdmin && (
        <div className='bg-white rounded-2xl border border-gray-100 p-4 md:p-6'>
          <h2 className='text-sm md:text-base font-semibold text-gray-800 mb-4'>이번 달 매출 현황</h2>
          <div className='grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100'>
            <RevenueItem label='총 매출' value='₩0' />
            <RevenueItem label='계약 건수' value='0건' />
            <RevenueItem label='급여 지급 예정' value='₩0' last />
          </div>
        </div>
      )}

      {/* 하단 2-컬럼: 최근 업무 + 캘린더 */}
      <div className='grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6'>
        {/* 최근 업무 */}
        <div className='lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-4 md:p-6'>
          <h2 className='text-sm md:text-base font-semibold text-gray-800 mb-4'>최근 업무</h2>
          <div className='text-sm text-gray-400 text-center py-8'>
            등록된 업무가 없습니다.
          </div>
        </div>

        {/* 미니 캘린더 */}
        <div className='lg:col-span-2'>
          <MiniCalendar />
        </div>
      </div>
    </div>
  );
}

/* ───────────── 미니 캘린더 ───────────── */

function MiniCalendar() {
  const today = dayjs();
  const [current, setCurrent] = useState<Dayjs>(today.startOf('month'));
  const { events } = useCalendarStore();

  const prevMonth = () => setCurrent((d) => d.subtract(1, 'month'));
  const nextMonth = () => setCurrent((d) => d.add(1, 'month'));
  const goToday = () => setCurrent(today.startOf('month'));

  const startOfMonth = current.startOf('month');
  const endOfMonth = current.endOf('month');
  const startDow = startOfMonth.day();
  const daysInMonth = endOfMonth.date();

  // 이번 달에 속하는 이벤트 (date 또는 endDate 범위 포함)
  const monthStr = current.format('YYYY-MM');
  const monthEvents = events
    .filter((e) => {
      const start = e.date.slice(0, 7);
      const end = (e.endDate ?? e.date).slice(0, 7);
      return start <= monthStr && end >= monthStr;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // 날짜별 이벤트 유무 맵
  const eventDates = new Set(
    events.flatMap((e) => {
      if (!e.endDate || e.endDate === e.date) return [e.date];
      const days: string[] = [];
      let d = dayjs(e.date);
      const end = dayjs(e.endDate);
      while (!d.isAfter(end)) {
        days.push(d.format('YYYY-MM-DD'));
        d = d.add(1, 'day');
      }
      return days;
    }),
  );

  // 6주 × 7일 그리드
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const isToday = (day: number | null) =>
    day !== null &&
    current.year() === today.year() &&
    current.month() === today.month() &&
    day === today.date();

  const isSameMonth = current.year() === today.year() && current.month() === today.month();

  return (
    <div className='bg-white rounded-2xl border border-gray-100 p-4 md:p-5 h-full'>
      {/* 헤더 */}
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <h2 className='text-sm font-semibold text-gray-800'>
            {current.format('YYYY년 MM월')}
          </h2>
          {!isSameMonth && (
            <button
              onClick={goToday}
              className='text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors'
            >
              오늘
            </button>
          )}
        </div>
        <div className='flex items-center gap-1'>
          <button
            onClick={prevMonth}
            className='w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
            </svg>
          </button>
          <button
            onClick={nextMonth}
            className='w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
            </svg>
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className='grid grid-cols-7 mb-1'>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div
            key={d}
            className={cn(
              'text-center text-xs font-medium py-1',
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className='grid grid-cols-7 gap-y-0.5'>
        {cells.map((day, idx) => {
          const col = idx % 7;
          const dateKey =
            day !== null
              ? `${current.year()}-${String(current.month() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : '';
          const hasEvent = dateKey ? eventDates.has(dateKey) : false;

          return (
            <div key={idx} className='flex flex-col items-center py-0.5'>
              {day !== null ? (
                <>
                  <span
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition-colors',
                      isToday(day)
                        ? 'bg-blue-600 text-white font-bold'
                        : col === 0
                          ? 'text-red-400 hover:bg-red-50'
                          : col === 6
                            ? 'text-blue-400 hover:bg-blue-50'
                            : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {day}
                  </span>
                  {hasEvent && (
                    <span className='w-1 h-1 rounded-full bg-blue-400 mt-0.5' />
                  )}
                </>
              ) : (
                <span className='w-7 h-7' />
              )}
            </div>
          );
        })}
      </div>

      {/* 이번 달 일정 요약 */}
      <div className='mt-4 pt-4 border-t border-gray-100'>
        <p className='text-xs font-medium text-gray-500 mb-2'>
          이번 달 일정
          {monthEvents.length > 0 && (
            <span className='ml-1.5 text-blue-500'>{monthEvents.length}건</span>
          )}
        </p>
        {monthEvents.length === 0 ? (
          <p className='text-xs text-gray-400 text-center py-2'>등록된 일정이 없습니다.</p>
        ) : (
          <ul className='space-y-1 max-h-32 overflow-y-auto'>
            {monthEvents.map((e) => (
              <li key={e.id} className='flex items-center gap-2'>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.colorClass}`} />
                <span className='text-[11px] text-gray-500 shrink-0'>{e.date.slice(5)}</span>
                <span className='text-[11px] text-gray-700 truncate'>{e.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───────────── 서브 컴포넌트 ───────────── */

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: 'blue' | 'yellow' | 'red' | 'green';
  icon: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50',
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    green: 'bg-green-50',
  };

  return (
    <div className='bg-white rounded-2xl border border-gray-100 p-4'>
      <div className={`w-9 h-9 rounded-xl ${colorMap[color]} flex items-center justify-center mb-3 text-lg`}>
        {icon}
      </div>
      <p className='text-2xl font-bold text-gray-900 leading-none'>{value}</p>
      <p className='text-xs text-gray-500 mt-1.5 leading-tight'>{label}</p>
    </div>
  );
}

function RevenueItem({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex sm:flex-col items-center sm:items-start justify-between sm:justify-start py-3 sm:py-0 sm:px-6 gap-1 ${last ? '' : ''}`}>
      <p className='text-xs text-gray-400'>{label}</p>
      <p className='text-lg md:text-xl font-bold text-gray-900'>{value}</p>
    </div>
  );
}
