'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import api from '@/lib/api';
import { getColorMeta } from '@/lib/dept-colors';
import { useCalendarStore } from '@/store/calendar.store';
import type { CalEvent } from '@/store/calendar.store';

dayjs.locale('ko');

// ─── Types ───────────────────────────────────────────────────────────────────

type CalView = 'month' | 'week' | 'day' | 'list';


interface CalGroup {
  id: string;
  name: string;
  colorClass: string;
  checked: boolean;
  type: 'my' | 'shared';
}

// ─── Initial Data ────────────────────────────────────────────────────────────

const INITIAL_GROUPS: CalGroup[] = [
  { id: 'my1', name: '나의 캘린더', colorClass: 'bg-blue-500', checked: true, type: 'my' },
  { id: 'my2', name: '나의 캘린더 02', colorClass: 'bg-teal-500', checked: true, type: 'my' },
  { id: 'holiday', name: '공휴일', colorClass: 'bg-red-500', checked: true, type: 'shared' },
  { id: 'dev', name: '개발팀', colorClass: 'bg-violet-500', checked: true, type: 'shared' },
  { id: 'sales', name: '영업팀', colorClass: 'bg-orange-400', checked: true, type: 'shared' },
  { id: 'marketing', name: '마케팅팀', colorClass: 'bg-pink-400', checked: true, type: 'shared' },
];


const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const TODAY_STR = dayjs().format('YYYY-MM-DD');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): Dayjs[] {
  const first = dayjs(new Date(year, month, 1));
  const startOffset = first.day();
  const daysInMonth = first.daysInMonth();
  const cells: Dayjs[] = [];

  for (let i = startOffset - 1; i >= 0; i--) cells.push(first.subtract(i + 1, 'day'));
  for (let d = 1; d <= daysInMonth; d++) cells.push(dayjs(new Date(year, month, d)));
  const rem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= rem; i++) cells.push(dayjs(new Date(year, month, daysInMonth + i)));
  if (cells.length < 42) {
    const extra = 42 - cells.length;
    const last = cells[cells.length - 1];
    for (let i = 1; i <= extra; i++) cells.push(last.add(i, 'day'));
  }
  return cells;
}

function getWeekDays(date: Dayjs): Dayjs[] {
  const sunday = date.startOf('week');
  return Array.from({ length: 7 }, (_, i) => sunday.add(i, 'day'));
}

function eventOnDay(event: CalEvent, dateStr: string): boolean {
  if (!event.endDate || event.endDate === event.date) return event.date === dateStr;
  return dateStr >= event.date && dateStr <= event.endDate;
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ current, onSelect }: { current: Dayjs; onSelect: (d: Dayjs) => void }) {
  const [mini, setMini] = useState(current);
  const grid = useMemo(() => getMonthGrid(mini.year(), mini.month()), [mini]);

  return (
    <div className='p-3 select-none'>
      <div className='flex items-center justify-between mb-2'>
        <button
          onClick={() => setMini((d) => d.subtract(1, 'month'))}
          className='p-1 rounded hover:bg-gray-100 text-gray-500'
        >
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
        </button>
        <span className='text-xs font-semibold text-gray-700'>{mini.format('YYYY.MM')}</span>
        <button
          onClick={() => setMini((d) => d.add(1, 'month'))}
          className='p-1 rounded hover:bg-gray-100 text-gray-500'
        >
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
        </button>
      </div>
      <div className='grid grid-cols-7 mb-1'>
        {DAYS_KO.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] font-medium py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7'>
        {grid.map((d, i) => {
          const str = d.format('YYYY-MM-DD');
          const isCurMonth = d.month() === mini.month();
          const isToday = str === TODAY_STR;
          const isSelected = str === current.format('YYYY-MM-DD');
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className={[
                'w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors mx-auto',
                isToday ? 'bg-orange-500 text-white' : '',
                isSelected && !isToday ? 'bg-orange-100 text-orange-600' : '',
                !isToday && !isSelected
                  ? isCurMonth
                    ? d.day() === 0
                      ? 'text-red-400 hover:bg-red-50'
                      : d.day() === 6
                        ? 'text-blue-400 hover:bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-100'
                    : 'text-gray-300'
                  : '',
              ].join(' ')}
            >
              {d.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  date?: string;
  event?: CalEvent;
  groups: CalGroup[];
  onClose: () => void;
  onSave: (e: CalEvent) => void;
  onDelete?: (id: string) => void;
}

function EventModal({ date, event, groups, onClose, onSave, onDelete }: ModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [startDate, setStartDate] = useState(event?.date ?? date ?? TODAY_STR);
  const [endDate, setEndDate] = useState(event?.endDate ?? '');
  const [startTime, setStartTime] = useState(event?.startTime ?? '');
  const [endTime, setEndTime] = useState(event?.endTime ?? '');
  const [calId, setCalId] = useState(event?.calendarId ?? groups[0]?.id ?? 'my1');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);

  const selectedGroup = groups.find((g) => g.id === calId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: event?.id ?? `evt-${Date.now()}`,
      title: title.trim(),
      date: startDate,
      endDate: endDate || undefined,
      startTime: allDay ? undefined : startTime || undefined,
      endTime: allDay ? undefined : endTime || undefined,
      colorClass: selectedGroup?.colorClass ?? 'bg-blue-500',
      calendarId: calId,
      allDay: allDay || (!startTime && !endTime),
    });
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div
        className='bg-white rounded-2xl shadow-2xl w-full max-w-md p-6'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between mb-5'>
          <h3 className='text-lg font-bold text-gray-900'>{event ? '일정 수정' : '일정 쓰기'}</h3>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <input
            type='text'
            placeholder='제목을 입력하세요'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className='w-full border-b-2 border-gray-200 pb-2 text-base font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:border-orange-400 transition-colors'
          />

          <label className='flex items-center gap-2 text-sm text-gray-600 cursor-pointer'>
            <input
              type='checkbox'
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className='rounded border-gray-300 text-orange-500 focus:ring-orange-300'
            />
            종일
          </label>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-xs text-gray-400 mb-1 block'>시작일</label>
              <input
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className='w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300'
              />
            </div>
            <div>
              <label className='text-xs text-gray-400 mb-1 block'>종료일</label>
              <input
                type='date'
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className='w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300'
              />
            </div>
          </div>

          {!allDay && (
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='text-xs text-gray-400 mb-1 block'>시작 시간</label>
                <input
                  type='time'
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className='w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300'
                />
              </div>
              <div>
                <label className='text-xs text-gray-400 mb-1 block'>종료 시간</label>
                <input
                  type='time'
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className='w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300'
                />
              </div>
            </div>
          )}

          <div>
            <label className='text-xs text-gray-400 mb-1 block'>캘린더</label>
            <select
              value={calId}
              onChange={(e) => setCalId(e.target.value)}
              className='w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300'
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className='flex items-center gap-2 pt-1'>
            {event && onDelete && (
              <button
                type='button'
                onClick={() => { onDelete(event.id); onClose(); }}
                className='px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors'
              >
                삭제
              </button>
            )}
            <div className='ml-auto flex gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors'
              >
                취소
              </button>
              <button
                type='submit'
                className='px-5 py-2 text-sm font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors'
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
// 배너(allDay/멀티데이) 이벤트는 주(week) 단위로 레이아웃을 계산해
// 셀 경계를 넘어도 같은 행(row)에 연속으로 표시합니다.

const BANNER_H = 22;   // px — 배너 이벤트 높이
const BANNER_GAP = 2;  // px — 배너 간격
const DAY_NUM_H = 30;  // px — 날짜 숫자 영역 높이
const BANNER_TOP_PAD = 4; // px — 날짜 숫자 아래 여백

interface WeekEventSlot {
  event: CalEvent;
  row: number;
  startCol: number; // 0-6
  endCol: number;   // 0-6
  showTitle: boolean;
  roundLeft: boolean;
  roundRight: boolean;
}

/** 한 주(week)에 표시할 배너 이벤트 레이아웃을 계산 */
function computeWeekBanners(
  week: Dayjs[],
  events: CalEvent[],
): { slots: WeekEventSlot[]; rowCount: number } {
  const weekStart = week[0].format('YYYY-MM-DD');
  const weekEnd = week[6].format('YYYY-MM-DD');

  // allDay 이벤트 + 멀티데이 이벤트만 배너로 처리
  const banners = events.filter((e) => {
    const isBanner = e.allDay || (!!e.endDate && e.endDate > e.date);
    if (!isBanner) return false;
    const eEnd = e.endDate || e.date;
    return eEnd >= weekStart && e.date <= weekEnd;
  });

  // 시작일 기준 정렬, 길이 긴 것 우선
  banners.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const aEnd = a.endDate || a.date;
    const bEnd = b.endDate || b.date;
    return bEnd.localeCompare(aEnd);
  });

  // 행(row) 점유 배열로 겹침 없이 배치
  const occupancy: boolean[][] = [];
  const slots: WeekEventSlot[] = [];

  for (const evt of banners) {
    const eEnd = evt.endDate || evt.date;
    const effStart = evt.date < weekStart ? weekStart : evt.date;
    const effEnd = eEnd > weekEnd ? weekEnd : eEnd;

    const sc = week.findIndex((d) => d.format('YYYY-MM-DD') === effStart);
    const ec = week.findIndex((d) => d.format('YYYY-MM-DD') === effEnd);
    if (sc === -1 || ec === -1) continue;

    // 비어 있는 가장 낮은 행 탐색
    let row = 0;
    while (true) {
      if (!occupancy[row]) occupancy[row] = Array(7).fill(false);
      if (!occupancy[row].slice(sc, ec + 1).some(Boolean)) {
        for (let c = sc; c <= ec; c++) occupancy[row][c] = true;
        break;
      }
      row++;
    }

    slots.push({
      event: evt,
      row,
      startCol: sc,
      endCol: ec,
      // 이 주의 첫 번째 칸이거나 이벤트 시작일이 이 주 안이면 제목 표시
      showTitle: evt.date >= weekStart || sc === 0,
      roundLeft: evt.date >= weekStart,
      roundRight: eEnd <= weekEnd,
    });
  }

  return { slots, rowCount: occupancy.length };
}

interface WeekRowProps {
  week: Dayjs[];
  currentMonth: number;
  visibleEvents: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onDayClick: (dateStr: string) => void;
  onMoreClick: (dateStr: string) => void;
}

function WeekRow({ week, currentMonth, visibleEvents, onEventClick, onDayClick, onMoreClick }: WeekRowProps) {
  const weekStartStr = week[0].format('YYYY-MM-DD');

  const { slots, rowCount } = useMemo(
    () => computeWeekBanners(week, visibleEvents),
    [week, visibleEvents],
  );

  // 배너 영역 총 높이 (px)
  const bannerAreaH = rowCount > 0
    ? BANNER_TOP_PAD + rowCount * (BANNER_H + BANNER_GAP)
    : BANNER_TOP_PAD;

  return (
    <div className='flex-1 relative' style={{ minHeight: 90 }}>
      {/* ── 날짜 셀 (클릭 영역 + 날짜 숫자 + 시간 이벤트) ── */}
      <div className='grid grid-cols-7 absolute inset-0'>
        {week.map((day, di) => {
          const dateStr = day.format('YYYY-MM-DD');
          const isCurrentMonth = day.month() === currentMonth;
          const isToday = dateStr === TODAY_STR;
          const isSun = day.day() === 0;
          const isSat = day.day() === 6;

          // 시간 기반 이벤트(non-allDay, non-spanning)만 셀 하단에 표시
          const timedEvts = visibleEvents.filter((e) => {
            if (e.allDay) return false;
            if (e.endDate && e.endDate > e.date) return false;
            return e.date === dateStr;
          });

          // 이 날짜에 배너 이벤트가 몇 개인지 세어 "+N 더보기" 계산
          const dayBannerCount = slots.filter(
            (s) => s.startCol <= di && s.endCol >= di,
          ).length;
          const MAX_TIMED = 2;
          const timedOverflow = Math.max(0, timedEvts.length - MAX_TIMED);

          return (
            <div
              key={di}
              className={[
                'border-r border-b border-gray-100 flex flex-col overflow-hidden',
                'cursor-pointer transition-colors hover:bg-orange-50/30',
                !isCurrentMonth ? 'bg-gray-50/60' : 'bg-white',
              ].join(' ')}
              onClick={() => onDayClick(dateStr)}
            >
              {/* 날짜 숫자 */}
              <div
                className='px-1.5 pt-1.5 shrink-0'
                style={{ height: DAY_NUM_H + 'px' }}
              >
                <span
                  className={[
                    'w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-semibold',
                    isToday ? 'bg-orange-500 text-white' : '',
                    !isToday && isSun ? 'text-red-400' : '',
                    !isToday && isSat ? 'text-blue-400' : '',
                    !isToday && !isSun && !isSat
                      ? isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      : '',
                  ].join(' ')}
                >
                  {day.date()}
                </span>
              </div>

              {/* 배너 영역 여백 (배너는 절대 위치로 오버레이) */}
              <div className='shrink-0' style={{ height: bannerAreaH + 'px' }} />

              {/* 시간 기반 이벤트 */}
              <div className='flex-1 overflow-hidden px-1 pb-1 space-y-0.5'>
                {timedEvts.slice(0, MAX_TIMED).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                    className={[
                      evt.colorClass,
                      'text-white text-[11px] px-1.5 py-0.5 rounded-full truncate cursor-pointer hover:opacity-80',
                    ].join(' ')}
                  >
                    {evt.startTime ? `${evt.startTime} ` : ''}{evt.title}
                  </div>
                ))}
                {(timedOverflow > 0 || dayBannerCount > rowCount) && (
                  <button
                    className='text-[11px] text-blue-500 hover:text-blue-700 px-1 leading-tight'
                    onClick={(e) => { e.stopPropagation(); onMoreClick(dateStr); }}
                  >
                    <span className='sm:hidden'>+{timedOverflow + Math.max(0, dayBannerCount - rowCount)}</span>
                    <span className='hidden sm:inline'>+{timedOverflow + Math.max(0, dayBannerCount - rowCount)}개 더보기</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 배너 이벤트 오버레이 (절대 위치, 주 단위 연속 렌더링) ── */}
      {slots.map((slot) => {
        const top = DAY_NUM_H + BANNER_TOP_PAD + slot.row * (BANNER_H + BANNER_GAP);
        return (
          <div
            key={`${slot.event.id}-${weekStartStr}`}
            className='absolute z-10 pointer-events-none'
            style={{
              top: top + 'px',
              left: `calc(${(slot.startCol / 7) * 100}% + 2px)`,
              width: `calc(${((slot.endCol - slot.startCol + 1) / 7) * 100}% - 4px)`,
              height: BANNER_H + 'px',
            }}
          >
            <div
              className={[
                slot.event.colorClass,
                'h-full text-white text-[11px] flex items-center px-2',
                'cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto overflow-hidden',
                // 좌우 둥근 처리
                slot.roundLeft && slot.roundRight ? 'rounded-full' :
                slot.roundLeft ? 'rounded-l-full' :
                slot.roundRight ? 'rounded-r-full' : '',
              ].join(' ')}
              onClick={(e) => { e.stopPropagation(); onEventClick(slot.event); }}
            >
              {slot.showTitle && (
                <span className='truncate'>{slot.event.title}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MonthViewProps {
  currentDate: Dayjs;
  visibleEvents: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onDayClick: (dateStr: string) => void;
  onMoreClick: (dateStr: string) => void;
}

function MonthView({ currentDate, visibleEvents, onEventClick, onDayClick, onMoreClick }: MonthViewProps) {
  const grid = useMemo(
    () => getMonthGrid(currentDate.year(), currentDate.month()),
    [currentDate],
  );

  // 42셀을 6주로 분할
  const weeks = useMemo<Dayjs[][]>(
    () => Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7)),
    [grid],
  );

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* 요일 헤더 */}
      <div className='grid grid-cols-7 border-b border-gray-100 shrink-0'>
        {DAYS_KO.map((d, i) => (
          <div
            key={d}
            className={`py-2.5 text-center text-xs font-semibold tracking-wide ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 주(week) 행 */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            currentMonth={currentDate.month()}
            visibleEvents={visibleEvents}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onMoreClick={onMoreClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  currentDate: Dayjs;
  visibleEvents: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onDayClick: (dateStr: string) => void;
}

function WeekView({ currentDate, visibleEvents, onEventClick, onDayClick }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className='flex-1 overflow-auto'>
      {/* Sticky header */}
      <div className='sticky top-0 z-10 bg-white grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-100'>
        <div className='border-r border-gray-100' />
        {weekDays.map((d, i) => {
          const isToday = d.format('YYYY-MM-DD') === TODAY_STR;
          return (
            <div
              key={i}
              className='py-2 text-center border-r border-gray-100 cursor-pointer hover:bg-gray-50'
              onClick={() => onDayClick(d.format('YYYY-MM-DD'))}
            >
              <div className={`text-xs font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
                {DAYS_KO[d.day()]}
              </div>
              <div
                className={`text-base font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-orange-500 text-white' : 'text-gray-700'}`}
              >
                {d.date()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time rows */}
      {hours.map((h) => (
        <div key={h} className='grid grid-cols-[56px_repeat(7,1fr)]'>
          <div className='text-[11px] text-gray-400 text-right pr-2 pt-1 h-14 border-r border-b border-gray-100 shrink-0'>
            {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
          </div>
          {weekDays.map((d, di) => {
            const dateStr = d.format('YYYY-MM-DD');
            const slotEvts = visibleEvents.filter((e) => {
              if (e.allDay || !e.startTime) return false;
              const [eh] = e.startTime.split(':').map(Number);
              return e.date === dateStr && eh === h;
            });
            return (
              <div
                key={di}
                className='border-r border-b border-gray-100 h-14 p-0.5 cursor-pointer hover:bg-orange-50/30'
                onClick={() => onDayClick(dateStr)}
              >
                {slotEvts.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                    className={`${evt.colorClass} text-white text-[11px] rounded-lg px-1.5 py-0.5 mb-0.5 truncate cursor-pointer hover:opacity-80`}
                  >
                    {evt.startTime} {evt.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

interface DayViewProps {
  currentDate: Dayjs;
  visibleEvents: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}

function DayView({ currentDate, visibleEvents, onEventClick }: DayViewProps) {
  const dateStr = currentDate.format('YYYY-MM-DD');
  const isToday = dateStr === TODAY_STR;
  const todayEvents = visibleEvents.filter((e) => eventOnDay(e, dateStr));
  const allDayEvts = todayEvents.filter((e) => e.allDay);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className='flex-1 overflow-auto'>
      <div className='px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10'>
        <div className={`text-4xl font-bold ${isToday ? 'text-orange-500' : 'text-gray-800'}`}>
          {currentDate.date()}
        </div>
        <div className='text-sm text-gray-500 mt-0.5'>
          {currentDate.format('YYYY년 MM월')} {DAYS_KO[currentDate.day()]}요일
        </div>
      </div>

      {allDayEvts.length > 0 && (
        <div className='px-4 py-2 border-b border-gray-100 space-y-1.5 bg-gray-50/50'>
          <div className='text-xs text-gray-400 font-medium mb-1'>종일</div>
          {allDayEvts.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onEventClick(evt)}
              className={`${evt.colorClass} text-white text-sm px-3 py-1.5 rounded-xl cursor-pointer hover:opacity-80 transition-opacity`}
            >
              {evt.title}
            </div>
          ))}
        </div>
      )}

      {hours.map((h) => {
        const slotEvts = todayEvents.filter((e) => {
          if (e.allDay || !e.startTime) return false;
          const [eh] = e.startTime.split(':').map(Number);
          return eh === h;
        });
        return (
          <div key={h} className='grid grid-cols-[60px_1fr]'>
            <div className='text-xs text-gray-400 text-right pr-3 pt-2 h-16 border-b border-gray-50 border-r'>
              {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
            <div className='border-b border-gray-50 h-16 px-2 py-1 space-y-0.5'>
              {slotEvts.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => onEventClick(evt)}
                  className={`${evt.colorClass} text-white text-sm px-3 py-1 rounded-xl cursor-pointer hover:opacity-80 transition-opacity`}
                >
                  <span className='font-semibold'>{evt.startTime}</span>
                  {evt.endTime ? ` ~ ${evt.endTime}` : ''} {evt.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

interface ListViewProps {
  visibleEvents: CalEvent[];
  groups: CalGroup[];
  onEventClick: (e: CalEvent) => void;
}

function ListView({ visibleEvents, groups, onEventClick }: ListViewProps) {
  const grouped = useMemo(() => {
    const sorted = [...visibleEvents].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    );
    const map: Record<string, CalEvent[]> = {};
    for (const e of sorted) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [visibleEvents]);

  const entries = Object.entries(grouped);

  if (entries.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center gap-3 text-gray-400'>
        <svg className='w-12 h-12 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
        </svg>
        <p className='text-sm'>등록된 일정이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-auto divide-y divide-gray-50'>
      {entries.map(([dateStr, dateEvents]) => {
        const d = dayjs(dateStr);
        const isToday = dateStr === TODAY_STR;
        return (
          <div key={dateStr} className='flex gap-4 px-4 py-3 hover:bg-gray-50/50'>
            <div className='w-14 shrink-0 text-center pt-0.5'>
              <div className={`text-[11px] font-medium ${d.day() === 0 ? 'text-red-400' : d.day() === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                {DAYS_KO[d.day()]}
              </div>
              <div className={`text-2xl font-bold leading-tight ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                {d.date()}
              </div>
              <div className='text-[11px] text-gray-400'>{d.format('M월')}</div>
            </div>
            <div className='flex-1 space-y-1.5 min-w-0'>
              {dateEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => onEventClick(evt)}
                  className='flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer'
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${evt.colorClass}`} />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-gray-800 truncate'>{evt.title}</p>
                    {(evt.startTime || evt.endDate) && (
                      <p className='text-xs text-gray-400 mt-0.5'>
                        {evt.allDay
                          ? '종일'
                          : `${evt.startTime ?? ''}${evt.endTime ? ` ~ ${evt.endTime}` : ''}`}
                        {evt.endDate && evt.endDate !== evt.date
                          ? ` ~ ${dayjs(evt.endDate).format('MM.DD')}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <span className='text-xs text-gray-400 shrink-0'>
                    {groups.find((g) => g.id === evt.calendarId)?.name ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar Group Toggle ────────────────────────────────────────────────────

function GroupList({
  label,
  items,
  onToggle,
}: {
  label: string;
  items: CalGroup[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className='mb-4'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='flex items-center justify-between w-full px-1 mb-1.5 group'
      >
        <span className='text-[11px] font-semibold text-gray-400 uppercase tracking-wider'>{label}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      {open &&
        items.map((g) => (
          <button
            key={g.id}
            type='button'
            onClick={() => onToggle(g.id)}
            className='flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 cursor-pointer w-full text-left'
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors ${g.checked ? g.colorClass : 'bg-gray-200'}`}
            >
              {g.checked && (
                <svg className='w-2.5 h-2.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                </svg>
              )}
            </div>
            <span className='text-xs text-gray-600 flex-1'>{g.name}</span>
          </button>
        ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [view, setView] = useState<CalView>('month');
  const { events, saveEvent: storeSave, deleteEvent: storeDelete } = useCalendarStore();
  const [groups, setGroups] = useState<CalGroup[]>(INITIAL_GROUPS);
  const [modal, setModal] = useState<{ open: boolean; date?: string; event?: CalEvent }>({
    open: false,
  });

  // 부서 목록 로드 → 공유 캘린더 그룹 동적 생성
  const loadDeptGroups = useCallback(async () => {
    try {
      const res = await api.get('/api/departments');
      const depts: { _id: string; key: string; label: string; color: string }[] = res.data;
      if (!depts.length) return;

      const deptGroups: CalGroup[] = depts.map((d) => ({
        id: d.key,
        name: d.label,
        colorClass: getColorMeta(d.color).calBg,
        checked: true,
        type: 'shared' as const,
      }));

      // 공휴일은 유지, 나의 캘린더는 유지, 부서 그룹만 교체
      setGroups((prev) => [
        ...prev.filter((g) => g.type === 'my' || g.id === 'holiday'),
        ...deptGroups,
      ]);
    } catch {
      // API 실패 시 하드코딩 유지
    }
  }, []);

  useEffect(() => {
    loadDeptGroups();
  }, [loadDeptGroups]);

  const visibleEvents = useMemo(
    () => events.filter((e) => groups.find((g) => g.id === e.calendarId)?.checked),
    [events, groups],
  );

  // Navigation
  const prev = () =>
    setCurrentDate((d) =>
      view === 'month' ? d.subtract(1, 'month') : view === 'week' ? d.subtract(1, 'week') : d.subtract(1, 'day'),
    );
  const next = () =>
    setCurrentDate((d) =>
      view === 'month' ? d.add(1, 'month') : view === 'week' ? d.add(1, 'week') : d.add(1, 'day'),
    );
  const goToday = () => setCurrentDate(dayjs());

  const headerTitle =
    view === 'month'
      ? currentDate.format('YYYY-MM')
      : view === 'week'
        ? `${getWeekDays(currentDate)[0].format('YYYY.MM.DD')} ~ ${getWeekDays(currentDate)[6].format('MM.DD')}`
        : currentDate.format('YYYY년 MM월 DD일');

  const saveEvent = (e: CalEvent) => storeSave(e);
  const deleteEvent = (id: string) => storeDelete(id);

  const toggleGroup = (id: string) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)));

  const openCreate = (dateStr?: string) => setModal({ open: true, date: dateStr });
  const openEdit = (evt: CalEvent) => setModal({ open: true, event: evt });
  const switchToDay = (dateStr: string) => {
    setCurrentDate(dayjs(dateStr));
    setView('day');
  };

  return (
    <div className='flex h-full min-h-0 -m-4 md:-m-6 overflow-hidden'>
      {/* ── Left Sidebar (desktop only) ── */}
      <aside className='hidden md:flex flex-col w-56 border-r border-gray-100 bg-white shrink-0'>
        {/* Create button */}
        <div className='p-4 shrink-0'>
          <button
            onClick={() => openCreate(TODAY_STR)}
            className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors shadow-sm'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            일정 쓰기
          </button>
        </div>

        {/* Mini calendar */}
        <div className='shrink-0'>
          <MiniCalendar
            current={currentDate}
            onSelect={(d) => { setCurrentDate(d); setView('day'); }}
          />
        </div>

        {/* Calendar groups */}
        <div className='flex-1 overflow-y-auto px-3 py-2'>
          <GroupList
            label='내 캘린더'
            items={groups.filter((g) => g.type === 'my')}
            onToggle={toggleGroup}
          />
          <GroupList
            label='공유 캘린더'
            items={groups.filter((g) => g.type === 'shared')}
            onToggle={toggleGroup}
          />
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className='flex-1 flex flex-col min-w-0 overflow-hidden bg-white'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <button
              onClick={goToday}
              className='hidden sm:block px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 shrink-0'
            >
              오늘
            </button>
            <div className='flex items-center shrink-0'>
              <button onClick={prev} className='p-1.5 hover:bg-gray-100 rounded-lg transition-colors'>
                <svg className='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                </svg>
              </button>
              <button onClick={next} className='p-1.5 hover:bg-gray-100 rounded-lg transition-colors'>
                <svg className='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                </svg>
              </button>
            </div>
            <h2 className='text-base sm:text-lg font-bold text-gray-800 truncate'>{headerTitle}</h2>
          </div>

          <div className='flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0'>
            {(['month', 'week', 'day', 'list'] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-2 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {v === 'month' ? '월간' : v === 'week' ? '주간' : v === 'day' ? '일간' : '목록'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: create button */}
        <div className='md:hidden px-4 py-2 border-b border-gray-100 shrink-0'>
          <button
            onClick={() => openCreate(TODAY_STR)}
            className='flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            일정 쓰기
          </button>
        </div>

        {/* View content */}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            visibleEvents={visibleEvents}
            onEventClick={openEdit}
            onDayClick={(dateStr) => openCreate(dateStr)}
            onMoreClick={switchToDay}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            visibleEvents={visibleEvents}
            onEventClick={openEdit}
            onDayClick={switchToDay}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            visibleEvents={visibleEvents}
            onEventClick={openEdit}
          />
        )}
        {view === 'list' && (
          <ListView
            visibleEvents={visibleEvents}
            groups={groups}
            onEventClick={openEdit}
          />
        )}
      </div>

      {/* Event Modal */}
      {modal.open && (
        <EventModal
          date={modal.date}
          event={modal.event}
          groups={groups}
          onClose={() => setModal({ open: false })}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
    </div>
  );
}
