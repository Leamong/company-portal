'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

// ─── Mock 데이터 ──────────────────────────────────────────────────
const mockTeam = [
  { id: '1', name: '김민준', position: '과장', department: 'design', status: '출근' as const, checkIn: '09:02', workHours: '6h 30m' },
  { id: '2', name: '이서연', position: '대리', department: 'marketing', status: '출근' as const, checkIn: '08:55', workHours: '6h 37m' },
  { id: '3', name: '박지훈', position: '사원', department: 'design', status: '퇴근' as const, checkIn: '09:01', workHours: '8h 59m' },
  { id: '4', name: '최유진', position: '팀장', department: 'management', status: '출근' as const, checkIn: '09:10', workHours: '6h 22m' },
  { id: '5', name: '정하은', position: '대리', department: 'marketing', status: '휴가' as const, checkIn: '-', workHours: '-' },
  { id: '6', name: '강도현', position: '사원', department: 'design', status: '출근' as const, checkIn: '08:48', workHours: '6h 44m' },
  { id: '7', name: '윤소희', position: '과장', department: 'marketing', status: '지각' as const, checkIn: '09:35', workHours: '5h 57m' },
  { id: '8', name: '임재원', position: '사원', department: 'design', status: '결근' as const, checkIn: '-', workHours: '-' },
];

const mockPendingCorrection = [
  { id: '1', name: '박지훈', date: '4/14(월)', original: '미기록', requested: '09:05 출근', reason: '기기 오류' },
];

type TeamStatus = '출근' | '퇴근' | '휴가' | '지각' | '결근';

const STATUS_STYLE: Record<TeamStatus, string> = {
  출근: 'bg-green-100 text-green-700',
  퇴근: 'bg-gray-100 text-gray-500',
  휴가: 'bg-blue-100 text-blue-600',
  지각: 'bg-yellow-100 text-yellow-700',
  결근: 'bg-red-100 text-red-600',
};
const STATUS_DOT: Record<TeamStatus, string> = {
  출근: 'bg-green-500',
  퇴근: 'bg-gray-300',
  휴가: 'bg-blue-400',
  지각: 'bg-yellow-500',
  결근: 'bg-red-500',
};

const DEPT_LABEL: Record<string, string> = {
  design: '디자인',
  marketing: '마케팅',
  management: '경영지원',
};
const DEPT_AVATAR: Record<string, string> = {
  design: 'bg-purple-400',
  marketing: 'bg-blue-400',
  management: 'bg-gray-400',
};

// ─── 개인 출퇴근 카드 (직원/관리자 공통, 크기 변형 가능) ───────────
function CheckInCard({
  compact = false,
  status,
  checkInTime,
  now,
  loading,
  onToggle,
}: {
  compact?: boolean;
  status: '출근' | '퇴근';
  checkInTime: string | null;
  now: ReturnType<typeof dayjs>;
  loading: boolean;
  onToggle: () => void;
}) {
  const workDuration = () => {
    if (status !== '출근' || !checkInTime) return '-';
    const [h, m] = checkInTime.split(':').map(Number);
    const start = dayjs().hour(h).minute(m);
    const diff = now.diff(start, 'minute');
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  if (compact) {
    return (
      <div className='bg-white rounded-md border border-gray-100 p-4 flex items-center gap-4'>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
          ${status === '출근' ? 'bg-green-50 ring-2 ring-green-200' : 'bg-gray-50 ring-2 ring-gray-200'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${status === '출근' ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <span className={`text-sm font-semibold ${status === '출근' ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
            {status === '출근' && checkInTime && (
              <span className='text-xs text-gray-400 tabular-nums'>{checkInTime} 출근 · {workDuration()} 경과</span>
            )}
          </div>
          <p className='text-xs text-gray-400 tabular-nums'>{now.format('HH:mm:ss')}</p>
        </div>
        <button
          onClick={onToggle}
          disabled={loading}
          className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            status === '퇴근'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
          } disabled:opacity-50`}
        >
          {loading ? '...' : status === '퇴근' ? '출근' : '퇴근'}
        </button>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-md border border-gray-100 p-6 flex flex-col items-center gap-5'>
      <div className={`relative w-28 h-28 rounded-full flex items-center justify-center
        ${status === '출근' ? 'bg-green-50 ring-4 ring-green-200' : 'bg-gray-50 ring-4 ring-gray-200'}`}>
        <div className='text-center'>
          <p className='text-2xl font-bold text-gray-900 tabular-nums leading-none'>{now.format('HH:mm')}</p>
          <p className='text-xs text-gray-400 mt-0.5 tabular-nums'>{now.format('ss')}초</p>
        </div>
        <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white
          ${status === '출근' ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      <div className='w-full space-y-2'>
        <div className='flex justify-between text-sm'>
          <span className='text-gray-400'>현재 상태</span>
          <span className={`font-semibold ${status === '출근' ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
        </div>
        <div className='flex justify-between text-sm'>
          <span className='text-gray-400'>출근 시간</span>
          <span className='font-medium text-gray-700 tabular-nums'>{checkInTime ?? '-'}</span>
        </div>
        <div className='flex justify-between text-sm'>
          <span className='text-gray-400'>근무 중</span>
          <span className='font-medium text-gray-700 tabular-nums'>{workDuration()}</span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={loading}
        className={`w-full py-3 rounded-md text-sm font-semibold transition-all ${
          status === '퇴근'
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200'
            : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
        } disabled:opacity-50`}
      >
        {loading ? '처리 중...' : status === '퇴근' ? '출근하기' : '퇴근하기'}
      </button>
    </div>
  );
}

// ─── 통계 카드 ─────────────────────────────────────────────────────
function StatCard({
  icon, label, value, unit, sub, color,
}: {
  icon: string; label: string; value: string; unit: string; sub: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'teal' | 'orange';
}) {
  const colorMap = {
    blue: 'text-blue-600', green: 'text-green-600', yellow: 'text-yellow-600',
    purple: 'text-purple-600', teal: 'text-teal-600', orange: 'text-orange-600',
  };
  return (
    <div className='bg-white rounded-md border border-gray-100 p-4'>
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-lg'>{icon}</span>
        <span className='text-xs font-medium text-gray-400'>{label}</span>
      </div>
      <div className='flex items-baseline gap-1'>
        <span className={`text-2xl font-bold ${colorMap[color]}`}>{value}</span>
        <span className='text-xs font-medium text-gray-400'>{unit}</span>
      </div>
      <p className='text-xs text-gray-300 mt-0.5'>{sub}</p>
    </div>
  );
}

// ─── 관리자 뷰 ─────────────────────────────────────────────────────
function ManagerView({
  status, checkInTime, now, loading, onToggle,
}: {
  status: '출근' | '퇴근';
  checkInTime: string | null;
  now: ReturnType<typeof dayjs>;
  loading: boolean;
  onToggle: () => void;
}) {
  const [deptFilter, setDeptFilter] = useState('all');

  const stats = {
    total: mockTeam.length,
    in: mockTeam.filter(m => m.status === '출근').length,
    late: mockTeam.filter(m => m.status === '지각').length,
    leave: mockTeam.filter(m => m.status === '휴가').length,
    absent: mockTeam.filter(m => m.status === '결근').length,
    out: mockTeam.filter(m => m.status === '퇴근').length,
  };

  const filtered = deptFilter === 'all'
    ? mockTeam
    : mockTeam.filter(m => m.department === deptFilter);

  const depts = [
    { key: 'all', label: '전체', count: mockTeam.length },
    { key: 'marketing', label: '마케팅', count: mockTeam.filter(m => m.department === 'marketing').length },
    { key: 'design', label: '디자인', count: mockTeam.filter(m => m.department === 'design').length },
    { key: 'management', label: '경영지원', count: mockTeam.filter(m => m.department === 'management').length },
  ];

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl md:text-2xl font-bold text-gray-900'>근태 관리</h1>
          <p className='text-sm text-gray-400 mt-0.5'>{now.format('YYYY년 MM월 DD일 (ddd)')} · 실시간 현황</p>
        </div>
        <Link
          href='/attendance/settings'
          className='text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors'
        >
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
          </svg>
          근무 설정
        </Link>
      </div>

      {/* 오늘 현황 요약 바 */}
      <div className='grid grid-cols-3 sm:grid-cols-6 gap-3'>
        {[
          { label: '전체 인원', value: stats.total, color: 'text-gray-700', dot: 'bg-gray-400', bg: 'bg-white' },
          { label: '출근', value: stats.in, color: 'text-green-600', dot: 'bg-green-500', bg: 'bg-green-50/50' },
          { label: '지각', value: stats.late, color: 'text-yellow-600', dot: 'bg-yellow-500', bg: 'bg-yellow-50/50' },
          { label: '휴가', value: stats.leave, color: 'text-blue-600', dot: 'bg-blue-400', bg: 'bg-blue-50/50' },
          { label: '결근', value: stats.absent, color: 'text-red-600', dot: 'bg-red-500', bg: 'bg-red-50/50' },
          { label: '퇴근', value: stats.out, color: 'text-gray-400', dot: 'bg-gray-300', bg: 'bg-white' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-md border border-gray-100 p-3.5`}>
            <div className='flex items-center gap-1.5 mb-1'>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className='text-xs text-gray-400'>{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}
              <span className='text-xs font-normal text-gray-400 ml-0.5'>명</span>
            </p>
          </div>
        ))}
      </div>

      {/* 메인 그리드 */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>

        {/* 왼쪽: 미결 처리 + 내 출퇴근 */}
        <div className='space-y-4'>

          {/* 내 출퇴근 (compact) */}
          <CheckInCard
            compact
            status={status}
            checkInTime={checkInTime}
            now={now}
            loading={loading}
            onToggle={onToggle}
          />


          {/* 근태 수정 요청 */}
          <div className='bg-white rounded-md border border-gray-100 overflow-hidden'>
            <div className='px-4 py-3 border-b border-gray-50 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-semibold text-gray-800'>근태 수정 요청</span>
                {mockPendingCorrection.length > 0 && (
                  <span className='text-xs bg-yellow-100 text-yellow-600 font-semibold px-1.5 py-0.5 rounded-full'>
                    {mockPendingCorrection.length}
                  </span>
                )}
              </div>
            </div>
            {mockPendingCorrection.length === 0 ? (
              <div className='px-4 py-6 text-center text-xs text-gray-300'>대기 중인 수정 요청이 없습니다</div>
            ) : (
              <div className='divide-y divide-gray-50'>
                {mockPendingCorrection.map((req) => (
                  <div key={req.id} className='px-4 py-3'>
                    <div className='flex items-center justify-between mb-1'>
                      <span className='text-xs font-medium text-gray-700'>{req.name} · {req.date}</span>
                      <div className='flex gap-1.5'>
                        <button className='text-[11px] px-2 py-1 rounded-md bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors'>승인</button>
                        <button className='text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors'>반려</button>
                      </div>
                    </div>
                    <p className='text-[11px] text-gray-400'>
                      <span className='line-through'>{req.original}</span>
                      {' → '}
                      <span className='text-blue-600 font-medium'>{req.requested}</span>
                    </p>
                    <p className='text-[11px] text-gray-400 mt-0.5'>사유: {req.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 빠른 메뉴 */}
          <div className='grid grid-cols-2 gap-2'>
            {[
              { href: '/attendance/team', icon: '👥', label: '전체 현황' },
              { href: '/attendance/history', icon: '📊', label: '근무 기록' },
              { href: '/attendance/settings', icon: '⚙️', label: '근무 설정' },
              { href: '/finance', icon: '💰', label: '급여 관리' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className='bg-white rounded-md border border-gray-100 p-3 flex items-center gap-2.5 hover:border-blue-200 hover:shadow-sm transition-all group'
              >
                <span className='text-base'>{item.icon}</span>
                <span className='text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors'>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 오른쪽: 실시간 팀 현황 */}
        <div className='lg:col-span-2 bg-white rounded-md border border-gray-100 overflow-hidden'>
          <div className='px-5 py-3.5 border-b border-gray-100 flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-gray-800'>오늘 팀 현황</h2>
            <div className='flex items-center gap-1'>
              {depts.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDeptFilter(d.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    deptFilter === d.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 데스크탑 테이블 */}
          <div className='hidden md:block overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 border-b border-gray-100'>
                  <th className='px-5 py-2.5 text-left text-xs font-semibold text-gray-400'>직원</th>
                  <th className='px-4 py-2.5 text-left text-xs font-semibold text-gray-400'>상태</th>
                  <th className='px-4 py-2.5 text-left text-xs font-semibold text-gray-400'>출근 시각</th>
                  <th className='px-4 py-2.5 text-left text-xs font-semibold text-gray-400'>근무 중</th>
                  <th className='px-4 py-2.5'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {filtered.map((m) => (
                  <tr key={m.id} className='hover:bg-gray-50/50 transition-colors'>
                    <td className='px-5 py-3'>
                      <div className='flex items-center gap-2.5'>
                        <div className={`w-7 h-7 rounded-full ${DEPT_AVATAR[m.department]} flex items-center justify-center shrink-0`}>
                          <span className='text-white text-xs font-semibold'>{m.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className='text-sm font-medium text-gray-800'>{m.name}</p>
                          <p className='text-xs text-gray-400'>{m.position} · {DEPT_LABEL[m.department]}</p>
                        </div>
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[m.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[m.status]}`} />
                        {m.status}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-xs text-gray-600 tabular-nums'>{m.checkIn}</td>
                    <td className='px-4 py-3 text-xs text-gray-600 tabular-nums'>{m.workHours}</td>
                    <td className='px-4 py-3'>
                      {(m.status === '결근' || m.status === '지각') && (
                        <button className='text-[11px] text-blue-600 hover:text-blue-700 font-medium hover:underline'>
                          수정 요청
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 목록 */}
          <div className='md:hidden divide-y divide-gray-50'>
            {filtered.map((m) => (
              <div key={m.id} className='flex items-center gap-3 px-4 py-3'>
                <div className={`w-8 h-8 rounded-full ${DEPT_AVATAR[m.department]} flex items-center justify-center shrink-0`}>
                  <span className='text-white text-xs font-semibold'>{m.name.charAt(0)}</span>
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-gray-800'>{m.name}
                    <span className='text-xs text-gray-400 ml-1.5'>{m.position}</span>
                  </p>
                  <p className='text-xs text-gray-400'>{DEPT_LABEL[m.department]} · {m.checkIn !== '-' ? `${m.checkIn} 출근` : '-'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[m.status]}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>

          <div className='px-5 py-3 border-t border-gray-50 flex items-center justify-between'>
            <span className='text-xs text-gray-400'>
              {deptFilter === 'all' ? '전체' : DEPT_LABEL[deptFilter]} {filtered.length}명
            </span>
            <Link href='/attendance/team' className='text-xs text-blue-600 hover:text-blue-700 font-medium'>
              상세 현황 보기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 직원 뷰 ───────────────────────────────────────────────────────
function EmployeeView({
  status, checkInTime, now, loading, onToggle,
}: {
  status: '출근' | '퇴근';
  checkInTime: string | null;
  now: ReturnType<typeof dayjs>;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl md:text-2xl font-bold text-gray-900'>출퇴근 체크</h1>
          <p className='text-sm text-gray-400 mt-0.5'>{now.format('YYYY년 MM월 DD일 (ddd)')}</p>
        </div>
        <Link
          href='/attendance/history'
          className='text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1'
        >
          근무 기록 보기
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
        </Link>
      </div>

      {/* 상단 그리드 */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        {/* 출퇴근 카드 */}
        <CheckInCard
          status={status}
          checkInTime={checkInTime}
          now={now}
          loading={loading}
          onToggle={onToggle}
        />

        {/* 이번 달 통계 */}
        <div className='lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3'>
          <StatCard icon='📅' label='출근일' value='14' unit='일' sub='/ 22일' color='blue' />
          <StatCard icon='⏱' label='총 근무시간' value='126' unit='h' sub='이번 달' color='green' />
          <StatCard icon='🕐' label='초과 근무' value='8' unit='h' sub='이번 달' color='purple' />
          <StatCard icon='⚠️' label='지각' value='1' unit='회' sub='이번 달' color='yellow' />
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {[
          { href: '/attendance/history', icon: '📊', label: '근무 기록', desc: '월별 출퇴근 내역' },
          { href: '/approval', icon: '📝', label: '결재함', desc: '진행 중인 결재' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className='bg-white rounded-md border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all group'
          >
            <div className='text-2xl mb-2'>{item.icon}</div>
            <p className='text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors'>{item.label}</p>
            <p className='text-xs text-gray-400 mt-0.5'>{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* 이번 주 내 근무 */}
      <div className='bg-white rounded-md border border-gray-100 overflow-hidden'>
        <div className='px-5 py-4 border-b border-gray-50 flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-gray-800'>이번 주 내 근무</h2>
          <Link href='/attendance/history' className='text-xs text-blue-600 hover:text-blue-700 font-medium'>
            전체 보기 →
          </Link>
        </div>
        <div className='p-5'>
          <div className='grid grid-cols-5 gap-2'>
            {['월', '화', '수', '목', '금'].map((day, i) => {
              const data = [
                { in: '09:02', out: '18:05', status: '정상' },
                { in: '08:58', out: '18:00', status: '정상' },
                { in: '09:00', out: '17:30', status: '정상' },
                { in: '09:15', out: '18:20', status: '지각' },
                { in: '-', out: '-', status: '오늘' },
              ][i];
              return (
                <div key={day} className='flex flex-col items-center gap-1.5'>
                  <span className='text-xs font-medium text-gray-400'>{day}</span>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                    ${data.status === '오늘' ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
                      data.status === '정상' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'}`}>
                    {data.status === '오늘' ? '오늘' : data.status === '정상' ? '✓' : '지각'}
                  </div>
                  <span className='text-[10px] text-gray-400 tabular-nums'>{data.in}</span>
                </div>
              );
            })}
          </div>
          <div className='mt-4 pt-4 border-t border-gray-50 grid grid-cols-3 gap-3 text-center'>
            <div>
              <p className='text-xs text-gray-400'>총 근무</p>
              <p className='text-sm font-bold text-gray-800 mt-0.5'>36h 40m</p>
            </div>
            <div>
              <p className='text-xs text-gray-400'>초과 근무</p>
              <p className='text-sm font-bold text-purple-600 mt-0.5'>+1h 40m</p>
            </div>
            <div>
              <p className='text-xs text-gray-400'>지각</p>
              <p className='text-sm font-bold text-yellow-600 mt-0.5'>1회</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'head-admin' || user?.canManageAttendance === true;
  const [status, setStatus] = useState<'출근' | '퇴근'>(user?.status ?? '퇴근');
  const [loading, setLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>('09:00');
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    if (status === '퇴근') {
      setCheckInTime(now.format('HH:mm'));
      setStatus('출근');
    } else {
      setStatus('퇴근');
    }
    setLoading(false);
  };

  if (isManager) {
    return (
      <ManagerView
        status={status}
        checkInTime={checkInTime}
        now={now}
        loading={loading}
        onToggle={handleToggle}
      />
    );
  }

  return (
    <EmployeeView
      status={status}
      checkInTime={checkInTime}
      now={now}
      loading={loading}
      onToggle={handleToggle}
    />
  );
}
