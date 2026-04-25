'use client';

import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useCalendarStore } from '@/store/calendar.store';
import { cn } from '@/lib/utils';

export default function MiniCalendarWidget() {
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

  const monthStr = current.format('YYYY-MM');
  const monthEvents = events
    .filter((e) => {
      const start = e.date.slice(0, 7);
      const end = (e.endDate ?? e.date).slice(0, 7);
      return start <= monthStr && end >= monthStr;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

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
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col min-h-0'>
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
            className='w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
            </svg>
          </button>
          <button
            onClick={nextMonth}
            className='w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
            </svg>
          </button>
        </div>
      </div>

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

      {/* 이번 달 일정 요약 — 높이 남으면 자동으로 늘어남 */}
      <div className='mt-4 pt-4 border-t border-gray-100 flex-1 min-h-0 flex flex-col'>
        <p className='text-xs font-medium text-gray-500 mb-2 shrink-0'>
          이번 달 일정
          {monthEvents.length > 0 && (
            <span className='ml-1.5 text-blue-500'>{monthEvents.length}건</span>
          )}
        </p>
        {monthEvents.length === 0 ? (
          <p className='text-xs text-gray-400 text-center py-2'>등록된 일정이 없습니다.</p>
        ) : (
          <ul className='space-y-1 overflow-y-auto flex-1'>
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
