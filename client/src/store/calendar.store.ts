import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CalEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (inclusive)
  startTime?: string; // HH:mm
  endTime?: string;
  colorClass: string;
  calendarId: string;
  allDay?: boolean;
}

export const INITIAL_EVENTS: CalEvent[] = [
  { id: 'e1', title: '기획팀 업무회의', date: '2026-04-14', startTime: '10:00', endTime: '11:00', colorClass: 'bg-blue-500', calendarId: 'my1' },
  { id: 'e2', title: 'CRM 파트 회의', date: '2026-04-14', startTime: '14:00', endTime: '15:00', colorClass: 'bg-teal-500', calendarId: 'my2' },
  { id: 'e3', title: '모바일팀 주간회의', date: '2026-04-14', startTime: '15:30', endTime: '16:30', colorClass: 'bg-violet-500', calendarId: 'dev' },
  { id: 'e4', title: '디자인 파트 회의', date: '2026-04-15', startTime: '09:00', endTime: '10:00', colorClass: 'bg-violet-500', calendarId: 'dev' },
  { id: 'e5', title: '고객사 미팅', date: '2026-04-15', startTime: '09:10', endTime: '10:10', colorClass: 'bg-orange-400', calendarId: 'sales' },
  { id: 'e6', title: '전체 회의', date: '2026-04-15', startTime: '14:10', endTime: '15:00', colorClass: 'bg-teal-500', calendarId: 'my2' },
  { id: 'e7', title: '디자인 리뷰', date: '2026-04-19', colorClass: 'bg-violet-500', calendarId: 'dev', allDay: true },
  { id: 'e8', title: '개발 이슈 확인', date: '2026-04-19', startTime: '10:00', colorClass: 'bg-teal-500', calendarId: 'dev' },
  { id: 'e9', title: '디자인 회의', date: '2026-04-19', startTime: '10:30', colorClass: 'bg-blue-500', calendarId: 'my1' },
  { id: 'e10', title: '[기획팀] 서비스 2차 리뉴얼 회의', date: '2026-04-20', endDate: '2026-04-21', colorClass: 'bg-teal-500', calendarId: 'dev', allDay: true },
  { id: 'e11', title: '디자인 작업 일정 논의', date: '2026-04-21', endDate: '2026-04-24', colorClass: 'bg-blue-500', calendarId: 'my1', allDay: true },
  { id: 'e12', title: '어린이날', date: '2026-05-05', colorClass: 'bg-red-500', calendarId: 'holiday', allDay: true },
  { id: 'e13', title: '부처님오신날', date: '2026-05-05', colorClass: 'bg-red-500', calendarId: 'holiday', allDay: true },
  { id: 'e14', title: '대체공휴일', date: '2026-05-06', colorClass: 'bg-red-500', calendarId: 'holiday', allDay: true },
  { id: 'e15', title: '월간 마케팅 리뷰', date: '2026-04-28', startTime: '14:00', endTime: '15:30', colorClass: 'bg-pink-400', calendarId: 'marketing' },
  { id: 'e16', title: '팀빌딩 행사', date: '2026-04-25', colorClass: 'bg-blue-500', calendarId: 'my1', allDay: true },
];

interface CalendarState {
  events: CalEvent[];
  saveEvent: (event: CalEvent) => void;
  deleteEvent: (id: string) => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: INITIAL_EVENTS,
      saveEvent: (event) =>
        set((s) => {
          const idx = s.events.findIndex((e) => e.id === event.id);
          if (idx >= 0) {
            const updated = [...s.events];
            updated[idx] = event;
            return { events: updated };
          }
          return { events: [...s.events, event] };
        }),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
    }),
    { name: 'calendar-events' },
  ),
);
