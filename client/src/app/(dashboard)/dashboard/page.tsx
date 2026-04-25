'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth.store';
import { useCalendarStore } from '@/store/calendar.store';
import { useNotificationStore } from '@/store/notification.store';
import { cn, formatDateShort } from '@/lib/utils';
import api from '@/lib/api';
import CustomizableDashboard from '@/components/dashboard/CustomizableDashboard';

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

      {/* 연차 만료 임박 경고 배너 (직원만) */}
      {!isAdmin && <LeaveExpiryBanner />}

      {/* 상단 고정 영역: 프로필 + 요약 스탯 + 매출(어드민) — 커스터마이징 불가 */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6'>
        <div className='lg:col-span-1'>
          <ProfileCard />
        </div>
        <div className='lg:col-span-3 space-y-4 md:space-y-6'>
          <DashboardStats />

          {isAdmin && (
            <div className='bg-white rounded-md border border-gray-100 p-4 md:p-6'>
              <h2 className='text-sm md:text-base font-semibold text-gray-800 mb-4'>이번 달 매출 현황</h2>
              <div className='grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100'>
                <RevenueItem label='총 매출' value='₩0' />
                <RevenueItem label='계약 건수' value='0건' />
                <RevenueItem label='급여 지급 예정' value='₩0' last />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 커스터마이징 가능한 위젯 그리드 (캘린더 포함) */}
      <CustomizableDashboard />
    </div>
  );
}

/* ───────────── 연차 만료 임박 경고 배너 ───────────── */

function LeaveExpiryBanner() {
  const { leaveExpiryWarning, leaveBannerDismissed, dismissLeaveBanner } = useNotificationStore();
  if (!leaveExpiryWarning || leaveBannerDismissed) return null;

  const { daysUntilExpiry, remaining, periodEnd } = leaveExpiryWarning;
  const tone =
    daysUntilExpiry <= 7
      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-500', btn: 'bg-red-600 hover:bg-red-700' }
      : daysUntilExpiry <= 30
        ? { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: 'text-orange-500', btn: 'bg-orange-600 hover:bg-orange-700' }
        : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-500', btn: 'bg-amber-600 hover:bg-amber-700' };

  const dLabel = daysUntilExpiry <= 0 ? '오늘 만료' : `D-${daysUntilExpiry}`;

  return (
    <div className={cn('rounded-md border p-4 md:p-5 flex items-start gap-3', tone.bg, tone.border)}>
      <svg className={cn('w-5 h-5 shrink-0 mt-0.5', tone.icon)} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
      </svg>
      <div className='flex-1 min-w-0'>
        <p className={cn('text-sm font-semibold', tone.text)}>
          연차 {remaining}일이 <span className='tabular-nums'>{formatDateShort(periodEnd)}</span>에 만료됩니다 <span className='ml-1 tabular-nums'>({dLabel})</span>
        </p>
        <p className='text-xs text-gray-600 mt-1 leading-relaxed'>
          근로기준법상 연차는 발생일로부터 1년 내 사용해야 하며, 미사용 시 원칙적으로 소멸합니다.
          사용자 귀책사유로 미사용한 경우에는 연차 미사용 수당으로 전환될 수 있습니다.
        </p>
        <div className='flex items-center gap-2 mt-3'>
          <Link
            href='/approval?form=휴가신청서'
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors', tone.btn)}
          >
            휴가 신청하기
            <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M9 5l7 7-7 7' />
            </svg>
          </Link>
          <button
            onClick={dismissLeaveBanner}
            className='px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors'
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 내 프로필 카드 ───────────── */

interface AnnualLeaveBalance {
  notApplicable: boolean;
  total: number;
  used: number;
  remaining: number;
  hireDate: string | null;
  adjustment: number;
  periodStart: string | null;
  periodEnd: string | null;
  daysUntilExpiry: number | null;
}

// 근로기준법 소멸 경고 임계치 (3개월)
const LEAVE_EXPIRY_WARNING_DAYS = 90;

function pickExpiryBadge(daysUntilExpiry: number | null, remaining: number) {
  if (daysUntilExpiry == null || remaining <= 0) return null;
  if (daysUntilExpiry <= 7) return { bg: 'bg-red-100', text: 'text-red-700' };
  if (daysUntilExpiry <= 30) return { bg: 'bg-orange-100', text: 'text-orange-700' };
  if (daysUntilExpiry <= LEAVE_EXPIRY_WARNING_DAYS) return { bg: 'bg-amber-50', text: 'text-amber-700' };
  return null;
}

function ProfileCard() {
  const { user, updateUser } = useAuthStore();
  const { events } = useCalendarStore();
  const isAdmin = user?.role === 'head-admin';
  const [inboxPending, setInboxPending] = useState(0);
  const [inboxDone, setInboxDone] = useState(0);
  const [leave, setLeave] = useState<AnnualLeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [absenceSaving, setAbsenceSaving] = useState(false);

  const todayStr = dayjs().format('YYYY-MM-DD');
  const todaySchedule = events.filter((e) => {
    const start = e.date;
    const end = e.endDate ?? e.date;
    return start <= todayStr && end >= todayStr;
  }).length;

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      const leavePromise = isAdmin
        ? Promise.resolve({ data: null })
        : api.get('/api/users/me/annual-leave').catch(() => ({ data: null }));
      Promise.all([
        api.get('/api/approval/inbox').catch(() => ({ data: [] })),
        api.get('/api/approval/inbox-done').catch(() => ({ data: [] })),
        leavePromise,
      ]).then(([pendingRes, doneRes, leaveRes]) => {
        if (!mounted) return;
        setInboxPending(Array.isArray(pendingRes.data) ? pendingRes.data.length : 0);
        setInboxDone(Array.isArray(doneRes.data) ? doneRes.data.length : 0);
        setLeave(leaveRes.data);
        setLoading(false);
      });
    };
    refresh();
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => {
      mounted = false;
      window.removeEventListener('approval:changed', onChange);
    };
  }, [isAdmin]);

  const remainingLabel =
    !leave || leave.notApplicable
      ? '해당 없음'
      : !leave.hireDate
        ? '입사일 미설정'
        : `${leave.remaining}일`;

  const changeAbsence = async (next: '휴가' | '부재' | null) => {
    if (!isAdmin) return;
    setAbsenceSaving(true);
    try {
      const res = await api.patch('/api/users/me/absence-status', { absenceStatus: next });
      updateUser({ absenceStatus: res.data.absenceStatus });
    } catch {
      alert('부재 상태 변경에 실패했습니다.');
    } finally {
      setAbsenceSaving(false);
    }
  };

  return (
    <div className='bg-white rounded-md border border-gray-100 p-5 md:p-6'>
      {/* 아바타 + 이름 */}
      <div className='flex flex-col items-center text-center'>
        <div className='w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-3'>
          {user?.profileImage ? (
            <img src={user.profileImage} alt={user.name} className='w-full h-full object-cover' />
          ) : (
            <span className='text-gray-500 text-xl font-semibold'>{user?.name?.charAt(0) ?? 'U'}</span>
          )}
        </div>
        <p className='text-sm font-bold text-gray-900'>{user?.name ?? '사용자'}</p>
        {isAdmin && user?.absenceStatus && (
          <span className={cn(
            'mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            user.absenceStatus === '휴가'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700',
          )}>
            {user.absenceStatus} 중
          </span>
        )}

        {/* 오늘의 일정 */}
        <div className='mt-4 mb-2'>
          <p className='text-3xl font-bold text-blue-500 leading-none tabular-nums'>{todaySchedule}</p>
          <p className='text-[11px] text-gray-400 mt-1.5'>오늘의 일정</p>
        </div>
      </div>

      {/* 구분선 */}
      <div className='border-t border-gray-100 my-4' />

      {/* 항목 리스트 */}
      <ul className='space-y-2.5'>
        <ProfileItem
          label='결재할 문서'
          value={loading ? '-' : String(inboxPending)}
          href='/approval'
          highlight={inboxPending > 0}
        />
        <ProfileItem
          label='결재 수신 문서'
          value={loading ? '-' : String(inboxDone)}
          href='/approval'
        />
        {!isAdmin && (() => {
          const badge = leave?.hireDate && !leave.notApplicable
            ? pickExpiryBadge(leave.daysUntilExpiry, leave.remaining)
            : null;
          const badgeLabel = badge && leave?.daysUntilExpiry != null
            ? (leave.daysUntilExpiry <= 0 ? '오늘 만료' : `D-${leave.daysUntilExpiry}`)
            : null;
          return (
            <ProfileItem
              label='내 잔여 연차'
              value={loading ? '-' : remainingLabel}
              href='/approval?form=휴가신청서'
              highlight={!!leave?.hireDate && !leave?.notApplicable && leave.remaining > 0}
              badge={badge && badgeLabel ? { label: badgeLabel, ...badge } : undefined}
              tooltip={
                leave?.hireDate && !leave.notApplicable
                  ? `총 ${leave.total}일 · 사용 ${leave.used}일 · 만료 ${formatDateShort(leave.periodEnd)}${leave.adjustment ? ` (보정 ${leave.adjustment > 0 ? '+' : ''}${leave.adjustment})` : ''}`
                  : '관리자가 입사일을 설정하면 자동 산정됩니다'
              }
            />
          );
        })()}
      </ul>

      {/* 대표 전용: 부재 상태 토글 */}
      {isAdmin && (
        <div className='mt-4 pt-4 border-t border-gray-100'>
          <p className='text-xs font-medium text-gray-500 mb-2'>현재 상태</p>
          <div className='grid grid-cols-3 gap-1.5'>
            {([
              { value: null, label: '정상', active: 'bg-green-500 text-white', idle: 'bg-gray-50 text-gray-500 hover:bg-gray-100' },
              { value: '휴가' as const, label: '휴가', active: 'bg-blue-500 text-white', idle: 'bg-gray-50 text-gray-500 hover:bg-gray-100' },
              { value: '부재' as const, label: '부재', active: 'bg-amber-500 text-white', idle: 'bg-gray-50 text-gray-500 hover:bg-gray-100' },
            ] as const).map((opt) => {
              const isActive = (user?.absenceStatus ?? null) === opt.value;
              return (
                <button
                  key={opt.label}
                  type='button'
                  disabled={absenceSaving}
                  onClick={() => changeAbsence(opt.value)}
                  className={cn(
                    'py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-60',
                    isActive ? opt.active : opt.idle,
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className='text-[10px] text-gray-400 mt-2 leading-relaxed'>
            대표는 결재 절차 없이 부재 상태를 직접 설정합니다.
          </p>
        </div>
      )}
    </div>
  );
}

function ProfileItem({
  label,
  value,
  href,
  highlight,
  tooltip,
  badge,
}: {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
  tooltip?: string;
  badge?: { label: string; bg: string; text: string };
}) {
  const content = (
    <div
      className='flex items-center justify-between py-0.5 group gap-1.5'
      title={tooltip}
    >
      <span className='text-xs text-gray-500 group-hover:text-gray-700 transition-colors'>{label}</span>
      <span className='flex items-center gap-1.5'>
        {badge && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', badge.bg, badge.text)}>
            {badge.label}
          </span>
        )}
        <span className={cn(
          'text-xs tabular-nums',
          highlight ? 'font-semibold text-blue-600' : 'text-gray-400',
        )}>
          {value}
        </span>
      </span>
    </div>
  );
  return <li>{href ? <Link href={href}>{content}</Link> : content}</li>;
}


/* ───────────── 서브 컴포넌트 ───────────── */

function StatCard({
  label,
  value,
  color,
  icon,
  href,
  highlight,
}: {
  label: string;
  value: string | number;
  color: 'blue' | 'yellow' | 'red' | 'green' | 'gray';
  icon: string;
  href?: string;
  highlight?: boolean;
}) {
  const colorMap = {
    blue: 'bg-blue-50',
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    green: 'bg-green-50',
    gray: 'bg-gray-50',
  };

  const card = (
    <div
      className={cn(
        'bg-white rounded-md border p-4 transition',
        href ? 'hover:border-blue-200 hover:shadow-sm cursor-pointer' : '',
        highlight ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100',
      )}
    >
      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center mb-3 text-lg', colorMap[color])}>
        {icon}
      </div>
      <p className={cn('text-2xl font-bold leading-none tabular-nums', highlight ? 'text-red-600' : 'text-gray-900')}>
        {value}
      </p>
      <p className='text-xs text-gray-500 mt-1.5 leading-tight'>{label}</p>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

/* ───────────── 대시보드 상단 스탯 카드 (역할별 + 실시간) ───────────── */

interface OverdueEvidenceBucket {
  overdue: number;
  dueSoon: number;
}

function DashboardStats() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  // 공통 상태
  const [inboxPending, setInboxPending] = useState<number | null>(null);      // 내가 결재해야 할 건 (inbox)
  const [minePending, setMinePending] = useState<number | null>(null);        // 내가 올린 대기 건
  const [approvedThisMonth, setApprovedThisMonth] = useState<number | null>(null); // 이번 달 승인 (role별)
  const [rejectedThisMonth, setRejectedThisMonth] = useState<number | null>(null); // 이번 달 반려 (내 기안 기준)
  const [evidence, setEvidence] = useState<OverdueEvidenceBucket | null>(null); // 증빙 미제출 / 임박

  const refresh = () => {
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

    // 공통 inbox/mine-pending
    api.get('/api/approval/inbox').then((r) => setInboxPending((r.data as any[]).length)).catch(() => setInboxPending(0));
    api.get('/api/approval/mine-pending').then((r) => setMinePending((r.data as any[]).length)).catch(() => setMinePending(0));

    // 관리자: inbox-done, 직원: mine-done 에서 이번달 승인/반려 집계
    const doneEndpoint = isAdmin ? '/api/approval/inbox-done' : '/api/approval/mine-done';
    api.get(doneEndpoint)
      .then((r) => {
        const docs = (r.data as any[]) ?? [];
        const thisMonth = docs.filter((d) => (d.updatedAt ?? d.createdAt ?? '').slice(0, 10) >= monthStart);
        setApprovedThisMonth(thisMonth.filter((d) => d.status === '승인').length);
        setRejectedThisMonth(thisMonth.filter((d) => d.status === '반려').length);
      })
      .catch(() => { setApprovedThisMonth(0); setRejectedThisMonth(0); });

    // 증빙 미제출 집계 (내가 올린 승인 문서 중 evidenceDeadline 있고 첨부 없음)
    api.get('/api/approval/mine-done')
      .then((r) => {
        const docs = (r.data as any[]) ?? [];
        const today = dayjs().startOf('day');
        let overdue = 0, dueSoon = 0;
        for (const d of docs) {
          if (d.status !== '승인') continue;
          const hasEvidence = (d.attachments?.length ?? 0) > 0 ||
            (d.formData?.attachments?.length ?? 0) > 0;
          if (hasEvidence) continue;
          if (!d.evidenceDeadline) continue;
          const diff = dayjs(d.evidenceDeadline).startOf('day').diff(today, 'day');
          if (diff < 0) overdue += 1;
          else if (diff <= 3) dueSoon += 1;
        }
        setEvidence({ overdue, dueSoon });
      })
      .catch(() => setEvidence({ overdue: 0, dueSoon: 0 }));
  };

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => window.removeEventListener('approval:changed', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fmt = (n: number | null) => (n === null ? '-' : String(n));

  if (isAdmin) {
    return (
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatCard
          label='미결 결재'
          value={fmt(inboxPending)}
          color='red'
          icon='📝'
          href='/approval?folder=inbox-pending'
          highlight={(inboxPending ?? 0) > 0}
        />
        <StatCard
          label='이번 달 승인'
          value={fmt(approvedThisMonth)}
          color='green'
          icon='✅'
          href='/approval?folder=inbox-done'
        />
        <StatCard
          label='내 기안 대기'
          value={fmt(minePending)}
          color='yellow'
          icon='⏳'
          href='/approval?folder=my-pending'
        />
        <StatCard
          label='증빙 미제출'
          value={evidence ? evidence.overdue + evidence.dueSoon : '-'}
          color={evidence && evidence.overdue > 0 ? 'red' : 'gray'}
          icon='📎'
          href='/approval?folder=my-done'
          highlight={!!evidence && evidence.overdue > 0}
        />
      </div>
    );
  }

  // 일반 직원
  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
      <StatCard
        label='내 기안 대기'
        value={fmt(minePending)}
        color='yellow'
        icon='⏳'
        href='/approval?folder=my-pending'
      />
      <StatCard
        label='이번 달 승인'
        value={fmt(approvedThisMonth)}
        color='green'
        icon='✅'
        href='/approval?folder=my-done'
      />
      <StatCard
        label='이번 달 반려'
        value={fmt(rejectedThisMonth)}
        color='gray'
        icon='↩️'
        href='/approval?folder=my-done'
      />
      <StatCard
        label='증빙 미제출'
        value={evidence ? evidence.overdue + evidence.dueSoon : '-'}
        color={evidence && evidence.overdue > 0 ? 'red' : 'blue'}
        icon='📎'
        href='/approval?folder=my-done'
        highlight={!!evidence && evidence.overdue > 0}
      />
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
