'use client';

import { useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useAuthStore } from '@/store/auth.store';
dayjs.locale('ko');

// ══════════════════════════════════════════════════════════════
// 공통 타입 & 유틸
// ══════════════════════════════════════════════════════════════
type RecordStatus = '정상' | '지각' | '조퇴' | '결근' | '휴가' | '공휴일' | '주말';

interface DayRecord {
  date: string;
  day: string;
  checkIn: string;
  checkOut: string;
  workHours: string;
  overtime: string;
  status: RecordStatus;
}

interface MonthGroup {
  year: number;
  month: number;
  records: DayRecord[];
}

const STATUS_STYLE: Record<RecordStatus, string> = {
  정상: 'bg-green-100 text-green-700',
  지각: 'bg-yellow-100 text-yellow-700',
  조퇴: 'bg-orange-100 text-orange-700',
  결근: 'bg-red-100 text-red-700',
  휴가: 'bg-blue-100 text-blue-600',
  공휴일: 'bg-purple-100 text-purple-600',
  주말: 'bg-gray-100 text-gray-400',
};

function generateMonth(year: number, month: number): DayRecord[] {
  const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}`).daysInMonth();
  const records: DayRecord[] = [];
  const statuses: RecordStatus[] = ['정상', '정상', '정상', '정상', '지각', '정상', '정상', '조퇴'];
  let idx = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    const dow = date.day();
    const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][dow];
    const dateStr = date.format('YYYY-MM-DD');

    if (dow === 0 || dow === 6) {
      records.push({ date: dateStr, day: dayLabel, checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', status: '주말' });
      continue;
    }
    if (d === 5 || d === 15) {
      records.push({ date: dateStr, day: dayLabel, checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', status: '공휴일' });
      continue;
    }
    if (d === 10 || d === 11) {
      records.push({ date: dateStr, day: dayLabel, checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', status: '휴가' });
      continue;
    }
    if (date.isAfter(dayjs(), 'day')) {
      records.push({ date: dateStr, day: dayLabel, checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', status: '정상' });
      continue;
    }

    const s = statuses[idx % statuses.length];
    idx++;
    const checkIn = s === '지각' ? '09:18' : '08:58';
    const checkOut = s === '조퇴' ? '16:00' : '18:05';
    const workH = s === '조퇴' ? '7h 2m' : '9h 7m';
    const ot = s === '조퇴' ? '-' : d % 3 === 0 ? '1h 5m' : '-';
    records.push({ date: dateStr, day: dayLabel, checkIn, checkOut, workHours: workH, overtime: ot, status: s });
  }
  return records.reverse();
}

function buildMonthGroups(): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const now = dayjs();
  for (let i = 0; i < 12; i++) {
    const target = now.subtract(i, 'month');
    groups.push({ year: target.year(), month: target.month() + 1, records: generateMonth(target.year(), target.month() + 1) });
  }
  return groups;
}

function summarize(records: DayRecord[]) {
  const workdays = records.filter((r) => !['주말', '공휴일'].includes(r.status));
  const attended = workdays.filter((r) => r.checkIn !== '-').length;
  const late = records.filter((r) => r.status === '지각').length;
  const leave = records.filter((r) => r.status === '휴가').length;
  const overtimeDays = records.filter((r) => r.overtime !== '-').length;
  return { workdays: workdays.length, attended, late, leave, overtimeDays };
}

// ══════════════════════════════════════════════════════════════
// 직원용 뷰 컴포넌트
// ══════════════════════════════════════════════════════════════
function MonthAccordion({ group, defaultOpen }: { group: MonthGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const today = dayjs().format('YYYY-MM-DD');
  const { workdays, attended, late, leave, overtimeDays } = summarize(group.records);
  const label = `${group.year}년 ${String(group.month).padStart(2, '0')}월`;
  const isPast = dayjs(`${group.year}-${group.month}`).isBefore(dayjs(), 'month');

  return (
    <div className='border border-gray-100 rounded-xl overflow-hidden'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='w-full flex items-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50/80 transition-colors text-left'
      >
        <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M9 5l7 7-7 7' />
        </svg>
        <span className='text-sm font-semibold text-gray-800 w-28 shrink-0'>{label}</span>
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>출근 {attended}<span className='text-gray-300'>/{workdays}</span>일</span>
          {late > 0 && <span className='text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full'>지각 {late}회</span>}
          {leave > 0 && <span className='text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full'>휴가 {leave}일</span>}
          {overtimeDays > 0 && <span className='text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full'>초과 {overtimeDays}회</span>}
          {isPast && attended === workdays && late === 0 && <span className='text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full'>개근</span>}
        </div>
      </button>

      {open && (
        <div className='border-t border-gray-100'>
          <div className='hidden md:block overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50'>
                  {['날짜', '요일', '출근', '퇴근', '근무시간', '초과근무', '상태'].map((h) => (
                    <th key={h} className='px-5 py-2.5 text-left text-xs font-semibold text-gray-400'>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {group.records.map((r) => {
                  const isWeekend = r.status === '주말';
                  const isToday = r.date === today;
                  return (
                    <tr key={r.date} className={`transition-colors ${isWeekend ? 'bg-gray-50/40' : 'hover:bg-gray-50/60'} ${isToday ? 'bg-blue-50/40' : ''}`}>
                      <td className={`px-5 py-2.5 text-sm font-medium ${isWeekend ? 'text-gray-300' : isToday ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                        {r.date.slice(5)}
                        {isToday && <span className='ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full'>오늘</span>}
                      </td>
                      <td className={`px-5 py-2.5 text-sm ${r.day === '토' ? 'text-blue-400' : r.day === '일' ? 'text-red-400' : 'text-gray-500'}`}>{r.day}</td>
                      <td className={`px-5 py-2.5 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.checkIn}</td>
                      <td className={`px-5 py-2.5 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.checkOut}</td>
                      <td className={`px-5 py-2.5 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.workHours}</td>
                      <td className={`px-5 py-2.5 text-sm tabular-nums ${r.overtime !== '-' ? 'text-purple-600 font-medium' : 'text-gray-300'}`}>{r.overtime}</td>
                      <td className='px-5 py-2.5'>
                        {!isWeekend && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className='md:hidden divide-y divide-gray-50'>
            {group.records.filter((r) => r.status !== '주말').map((r) => {
              const isToday = r.date === today;
              return (
                <div key={r.date} className={`px-4 py-3 flex items-center gap-3 ${isToday ? 'bg-blue-50/30' : ''}`}>
                  <div className='w-10 text-center shrink-0'>
                    <p className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{r.date.slice(8)}</p>
                    <p className={`text-xs ${r.day === '토' ? 'text-blue-400' : r.day === '일' ? 'text-red-400' : 'text-gray-400'}`}>{r.day}</p>
                  </div>
                  <div className='flex-1'>
                    <p className='text-sm text-gray-700 tabular-nums'>{r.checkIn !== '-' ? `${r.checkIn} 출근 · ${r.checkOut} 퇴근` : '-'}</p>
                    <p className='text-xs text-gray-400 mt-0.5'>{r.workHours !== '-' ? r.workHours : ''}{r.overtime !== '-' ? ` · 초과 ${r.overtime}` : ''}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function YearSection({ year, groups, defaultOpen }: { year: number; groups: MonthGroup[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();

  return (
    <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
      <button type='button' onClick={() => setOpen((v) => !v)} className='w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left'>
        <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M9 5l7 7-7 7' />
        </svg>
        <span className='text-base font-bold text-gray-900'>{year}년</span>
        <span className='text-xs text-gray-400 font-normal'>{groups.length}개월</span>
      </button>
      {open && (
        <div className='border-t border-gray-100 px-4 py-3 space-y-2'>
          {groups.map((g) => (
            <MonthAccordion key={`${g.year}-${g.month}`} group={g} defaultOpen={g.year === currentYear && g.month === currentMonth} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeHistoryView() {
  const groups = buildMonthGroups();
  const currentYear = dayjs().year();
  const byYear = groups.reduce<Record<number, MonthGroup[]>>((acc, g) => { (acc[g.year] ??= []).push(g); return acc; }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className='space-y-5'>
      <div>
        <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
          <Link href='/attendance' className='hover:text-blue-600 transition-colors'>출퇴근</Link>
          <span>›</span>
          <span className='text-gray-700 font-medium'>내 근무 기록</span>
        </div>
        <h1 className='text-xl font-bold text-gray-900'>내 근무 기록</h1>
      </div>
      {years.map((y) => (
        <YearSection key={y} year={y} groups={byYear[y]} defaultOpen={y === currentYear} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 관리자용 뷰 — 전체 직원 근무 기록
// ══════════════════════════════════════════════════════════════
const DEPT_LABEL: Record<string, string> = {
  design: '디자인',
  marketing: '마케팅',
  management: '경영지원',
};

interface EmployeeSummary {
  id: string;
  name: string;
  position: string;
  department: string;
  workdays: number;
  attended: number;
  late: number;
  leave: number;
  absence: number;
  overtimeH: number;
  avgWorkH: string;
}

const MOCK_EMPLOYEES: EmployeeSummary[] = [
  { id: '1', name: '김민준', position: '과장',   department: 'design',      workdays: 22, attended: 22, late: 1, leave: 0, absence: 0, overtimeH: 8,  avgWorkH: '9h 12m' },
  { id: '2', name: '이서연', position: '대리',   department: 'marketing',   workdays: 22, attended: 21, late: 0, leave: 1, absence: 0, overtimeH: 3,  avgWorkH: '9h 05m' },
  { id: '3', name: '박지훈', position: '사원',   department: 'design',      workdays: 22, attended: 20, late: 2, leave: 0, absence: 2, overtimeH: 5,  avgWorkH: '8h 55m' },
  { id: '4', name: '최유진', position: '팀장',   department: 'management',  workdays: 22, attended: 22, late: 0, leave: 0, absence: 0, overtimeH: 12, avgWorkH: '9h 30m' },
  { id: '5', name: '정하은', position: '대리',   department: 'marketing',   workdays: 22, attended: 19, late: 0, leave: 3, absence: 0, overtimeH: 2,  avgWorkH: '9h 00m' },
  { id: '6', name: '강도현', position: '사원',   department: 'design',      workdays: 22, attended: 21, late: 1, leave: 0, absence: 1, overtimeH: 4,  avgWorkH: '8h 50m' },
  { id: '7', name: '윤소희', position: '과장',   department: 'marketing',   workdays: 22, attended: 22, late: 3, leave: 0, absence: 0, overtimeH: 6,  avgWorkH: '9h 08m' },
  { id: '8', name: '임재원', position: '사원',   department: 'design',      workdays: 22, attended: 18, late: 0, leave: 2, absence: 2, overtimeH: 0,  avgWorkH: '8h 40m' },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = dayjs().subtract(i, 'month');
  return { label: `${d.year()}년 ${String(d.month() + 1).padStart(2, '0')}월`, value: d.format('YYYY-MM') };
});

function DetailModal({ emp, onClose }: { emp: EmployeeSummary; onClose: () => void }) {
  const groups = buildMonthGroups();
  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();
  const currentGroup = groups.find((g) => g.year === currentYear && g.month === currentMonth);
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40' onClick={onClose}>
      <div className='bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col' onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center'>
              <span className='text-blue-600 text-sm font-bold'>{emp.name.charAt(0)}</span>
            </div>
            <div>
              <p className='text-sm font-bold text-gray-900'>{emp.name} <span className='text-gray-400 font-normal'>· {emp.position}</span></p>
              <p className='text-xs text-gray-400'>{DEPT_LABEL[emp.department] ?? emp.department}</p>
            </div>
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* 이번 달 일별 기록 */}
        <div className='flex-1 overflow-y-auto'>
          {currentGroup ? (
            <table className='w-full text-sm'>
              <thead className='sticky top-0 bg-gray-50 z-10'>
                <tr>
                  {['날짜', '요일', '출근', '퇴근', '근무시간', '초과', '상태'].map((h) => (
                    <th key={h} className='px-4 py-3 text-left text-xs font-semibold text-gray-400'>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {currentGroup.records.map((r) => {
                  const isWeekend = r.status === '주말';
                  const isToday = r.date === today;
                  return (
                    <tr key={r.date} className={`${isWeekend ? 'bg-gray-50/40' : ''} ${isToday ? 'bg-blue-50/40' : ''}`}>
                      <td className={`px-4 py-2 text-sm font-medium ${isWeekend ? 'text-gray-300' : isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                        {r.date.slice(5)}{isToday && <span className='ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full'>오늘</span>}
                      </td>
                      <td className={`px-4 py-2 text-sm ${r.day === '토' ? 'text-blue-400' : r.day === '일' ? 'text-red-400' : 'text-gray-500'}`}>{r.day}</td>
                      <td className={`px-4 py-2 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.checkIn}</td>
                      <td className={`px-4 py-2 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.checkOut}</td>
                      <td className={`px-4 py-2 text-sm tabular-nums ${isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>{r.workHours}</td>
                      <td className={`px-4 py-2 text-sm tabular-nums ${r.overtime !== '-' ? 'text-purple-600 font-medium' : 'text-gray-300'}`}>{r.overtime}</td>
                      <td className='px-4 py-2'>
                        {!isWeekend && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className='py-16 text-center text-sm text-gray-400'>데이터가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminHistoryView() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(MONTHS[0].value);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);

  const filtered = MOCK_EMPLOYEES.filter((e) => {
    if (deptFilter !== 'all' && e.department !== deptFilter) return false;
    if (search && !e.name.includes(search) && !e.position.includes(search)) return false;
    return true;
  });

  const totalAttended = filtered.reduce((s, e) => s + e.attended, 0);
  const totalAbsence = filtered.reduce((s, e) => s + e.absence, 0);
  const totalLate = filtered.reduce((s, e) => s + e.late, 0);
  const avgRate = filtered.length > 0
    ? Math.round((filtered.reduce((s, e) => s + e.attended / e.workdays, 0) / filtered.length) * 100)
    : 0;

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div>
        <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
          <Link href='/attendance' className='hover:text-blue-600 transition-colors'>근태 대시보드</Link>
          <span>›</span>
          <span className='text-gray-700 font-medium'>전체 근무 기록</span>
        </div>
        <h1 className='text-xl font-bold text-gray-900'>전체 근무 기록</h1>
        <p className='text-sm text-gray-400 mt-0.5'>모든 직원의 근태 현황을 한눈에 확인합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {[
          { label: '전체 직원',    value: `${filtered.length}명`,  color: 'text-gray-800',   bg: 'bg-gray-50' },
          { label: '평균 출근율',  value: `${avgRate}%`,           color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: '지각 건수',    value: `${totalLate}회`,        color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '결근 건수',    value: `${totalAbsence}일`,     color: 'text-red-600',    bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-gray-100 p-4 ${s.bg}`}>
            <p className='text-xs text-gray-500 font-medium'>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className='bg-white rounded-2xl border border-gray-100 px-5 py-4 flex flex-wrap gap-3 items-center'>
        {/* 월 선택 */}
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className='px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* 부서 필터 */}
        <div className='flex gap-1.5'>
          {[
            { key: 'all',        label: '전체' },
            { key: 'marketing',  label: '마케팅' },
            { key: 'design',     label: '디자인' },
            { key: 'management', label: '경영지원' },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDeptFilter(d.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                deptFilter === d.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* 직원 검색 */}
        <div className='relative ml-auto'>
          <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
          </svg>
          <input
            type='text'
            placeholder='이름 · 직급 검색'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40'
          />
        </div>
      </div>

      {/* 직원 근무 기록 테이블 */}
      <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
        {/* 데스크탑 테이블 */}
        <div className='hidden md:block overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 border-b border-gray-100'>
                {['직원', '부서', '출근일', '출근율', '지각', '결근', '휴가', '초과근무', '상세'].map((h) => (
                  <th key={h} className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filtered.map((emp) => {
                const rate = Math.round((emp.attended / emp.workdays) * 100);
                return (
                  <tr key={emp.id} className='hover:bg-gray-50/60 transition-colors'>
                    <td className='px-5 py-3.5'>
                      <div className='flex items-center gap-2.5'>
                        <div className='w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0'>
                          <span className='text-blue-600 text-xs font-bold'>{emp.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className='text-sm font-medium text-gray-800'>{emp.name}</p>
                          <p className='text-xs text-gray-400'>{emp.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className='px-5 py-3.5'>
                      <span className='text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full'>{DEPT_LABEL[emp.department] ?? emp.department}</span>
                    </td>
                    <td className='px-5 py-3.5 text-sm text-gray-700 tabular-nums'>{emp.attended}<span className='text-gray-300'>/{emp.workdays}</span>일</td>
                    <td className='px-5 py-3.5'>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 h-1.5 bg-gray-100 rounded-full w-16'>
                          <div className={`h-1.5 rounded-full ${rate >= 95 ? 'bg-green-500' : rate >= 85 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${rate >= 95 ? 'text-green-600' : rate >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>{rate}%</span>
                      </div>
                    </td>
                    <td className='px-5 py-3.5'>
                      {emp.late > 0
                        ? <span className='text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full'>{emp.late}회</span>
                        : <span className='text-xs text-gray-300'>-</span>}
                    </td>
                    <td className='px-5 py-3.5'>
                      {emp.absence > 0
                        ? <span className='text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full'>{emp.absence}일</span>
                        : <span className='text-xs text-gray-300'>-</span>}
                    </td>
                    <td className='px-5 py-3.5'>
                      {emp.leave > 0
                        ? <span className='text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full'>{emp.leave}일</span>
                        : <span className='text-xs text-gray-300'>-</span>}
                    </td>
                    <td className='px-5 py-3.5 text-sm tabular-nums'>
                      {emp.overtimeH > 0
                        ? <span className='text-purple-600 font-medium'>{emp.overtimeH}h</span>
                        : <span className='text-gray-300'>-</span>}
                    </td>
                    <td className='px-5 py-3.5'>
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        className='text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline'
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className='md:hidden divide-y divide-gray-50'>
          {filtered.map((emp) => {
            const rate = Math.round((emp.attended / emp.workdays) * 100);
            return (
              <div key={emp.id} className='px-4 py-4'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='flex items-center gap-2.5'>
                    <div className='w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center'>
                      <span className='text-blue-600 text-xs font-bold'>{emp.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className='text-sm font-medium text-gray-800'>{emp.name} <span className='text-gray-400 text-xs'>{emp.position}</span></p>
                      <p className='text-xs text-gray-400'>{DEPT_LABEL[emp.department] ?? emp.department}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEmp(emp)} className='text-xs text-blue-600 font-medium'>상세보기</button>
                </div>
                <div className='flex items-center gap-3 text-xs text-gray-500 flex-wrap'>
                  <span>출근 {emp.attended}/{emp.workdays}일</span>
                  <span className={`font-semibold ${rate >= 95 ? 'text-green-600' : rate >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>{rate}%</span>
                  {emp.late > 0 && <span className='text-yellow-600'>지각 {emp.late}회</span>}
                  {emp.absence > 0 && <span className='text-red-600'>결근 {emp.absence}일</span>}
                  {emp.overtimeH > 0 && <span className='text-purple-600'>초과 {emp.overtimeH}h</span>}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className='py-16 text-center text-sm text-gray-400'>검색 결과가 없습니다.</div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedEmp && <DetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 메인 페이지 — 역할에 따라 뷰 분기
// ══════════════════════════════════════════════════════════════
export default function AttendanceHistoryPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  return isAdmin ? <AdminHistoryView /> : <EmployeeHistoryView />;
}
