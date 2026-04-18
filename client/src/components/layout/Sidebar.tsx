'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useNotificationStore } from '@/store/notification.store';
import { cn } from '@/lib/utils';
import { PAGE_PERMISSIONS } from '@/lib/permissions';

// ─── 아이콘 ───────────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
    </svg>
  ),
  work: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
    </svg>
  ),
  communication: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
    </svg>
  ),
  messenger: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' />
    </svg>
  ),
  attendance: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
    </svg>
  ),
  tasks: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
    </svg>
  ),
  confirm: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
    </svg>
  ),
  board: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' />
    </svg>
  ),
  approval: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
    </svg>
  ),
  crm: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
    </svg>
  ),
  calendar: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
    </svg>
  ),
  finance: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    </svg>
  ),
  admin: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
    </svg>
  ),
  employees: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
    </svg>
  ),
  organization: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M3 7a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V7zm0 9a1 1 0 011-1h3a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm14-9a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V7zm-7 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V7zm3.5 6v2m0 0v2m0-2h-3m3 0h3' />
    </svg>
  ),
  departments: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
    </svg>
  ),
  permissions: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
    </svg>
  ),
  delegate: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
    </svg>
  ),
  mail: (
    <svg className='w-4.5 h-4.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
    </svg>
  ),
  chevron: (
    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M19 9l-7 7-7-7' />
    </svg>
  ),
};

// ─── 서브메뉴 정의 ─────────────────────────────────────────────
interface SubItem {
  label: string;
  href: string;
  adminOnly?: boolean;
  approverOnly?: boolean;
  /** head-admin 또는 canManageAttendance 위임 직원만 표시 */
  attendanceManagerOnly?: boolean;
  /** head-admin 에게는 숨김 (일반 직원 전용) */
  employeeOnly?: boolean;
  icon?: React.ReactNode;
  /** true 이면 Next.js Link 대신 window.open 으로 외부 URL 열기 */
  external?: boolean;
}

const ATTENDANCE_SUB: SubItem[] = [
  // ── 직원 전용 ──
  { label: '출퇴근 체크',    href: '/attendance',         employeeOnly: true },
  { label: '내 근무 기록',   href: '/attendance/history', employeeOnly: true },
  { label: '휴가 신청',      href: '/attendance/leave',   employeeOnly: true },
  { label: '연장근무 신청',  href: '/attendance/overtime', employeeOnly: true },
  // ── 관리자 전용 ──
  { label: '근태 대시보드',  href: '/attendance',         adminOnly: true },
  { label: '전체 근무 기록', href: '/attendance/history', adminOnly: true },
  { label: '휴가 승인 관리', href: '/attendance/leave',   adminOnly: true },
  { label: '연장근무 승인',  href: '/attendance/overtime', adminOnly: true },
  // ── 공통 (권한별) ──
  { label: '팀 근태 현황',   href: '/attendance/team',    attendanceManagerOnly: true },
  { label: '근무 설정',      href: '/attendance/settings', adminOnly: true },
];

const ADMIN_SUB: SubItem[] = [
  { label: '직원 관리', href: '/admin' },
  { label: '부서 / 직급', href: '/admin/departments' },
  { label: '권한 위임', href: '/admin/permissions' },
];

const SUB_MENU_MAP: Record<string, SubItem[]> = {
  attendance: ATTENDANCE_SUB,
  admin: ADMIN_SUB,
};

// ─── 그룹 네비게이션 정의 ──────────────────────────────────────
// 여러 독립 페이지를 하나의 폴더 메뉴로 묶는 구조
type NavEntry =
  | { type: 'item'; key: string }
  | { type: 'group'; key: string; label: string; iconKey: string; children: string[] };

const NAV_DISPLAY: NavEntry[] = [
  { type: 'item', key: 'attendance' },
  {
    type: 'group',
    key: 'work',
    label: '업무 관리',
    iconKey: 'work',
    children: ['tasks', 'confirm', 'tasks-archive'],
  },
  {
    type: 'group',
    key: 'communication',
    label: '소통 / 결재',
    iconKey: 'communication',
    children: ['messenger', 'board', 'approval', 'mail'],
  },
  { type: 'item', key: 'crm' },
  { type: 'item', key: 'calendar' },
  { type: 'item', key: 'finance' },
];

// ─── 서브메뉴 아이템 ───────────────────────────────────────────
const MAIL_URL = process.env.NEXT_PUBLIC_MAIL_URL ?? '#';

function SubNavLink({
  href,
  label,
  active,
  badge,
  external,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={cn('w-1 h-1 rounded-full shrink-0', active ? 'bg-blue-400' : 'bg-gray-600')} />
      <span className='flex-1'>{label}</span>
      {badge != null && badge > 0 && (
        <span className='relative inline-flex'>
          <span className='animate-ping absolute inset-0 rounded-full bg-red-400 opacity-60' />
          <span className='relative text-[10px] bg-red-500 text-white rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1 leading-none font-bold'>
            {badge > 99 ? '99+' : badge}
          </span>
        </span>
      )}
      {external && (
        <svg className='w-3 h-3 text-gray-600 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
            d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />
        </svg>
      )}
    </>
  );

  const cls = cn(
    'flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-xs transition-colors',
    active ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800',
  );

  if (external) {
    return (
      <li>
        <button
          type='button'
          onClick={() => {
            window.open(MAIL_URL, '_blank', 'noopener,noreferrer');
            onClick?.();
          }}
          className={cn(cls, 'w-full text-left')}
        >
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    </li>
  );
}

// ─── 메인 메뉴 아이템 (서브메뉴 지원) ─────────────────────────
function NavItem({
  itemKey,
  href,
  icon,
  label,
  pathname,
  subItems,
  isAdmin,
  isApprover,
  isAttendanceManager,
  onClick,
  badge,
  subBadges,
}: {
  itemKey: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
  subItems?: SubItem[];
  isAdmin: boolean;
  isApprover?: boolean;
  isAttendanceManager?: boolean;
  onClick?: () => void;
  badge?: number;
  subBadges?: Record<string, number>;
}) {
  const visibleSubs = subItems?.filter((s) => {
    if (s.adminOnly && !isAdmin) return false;
    if (s.employeeOnly && isAdmin) return false;
    if (s.approverOnly && !isApprover && !isAdmin) return false;
    if (s.attendanceManagerOnly && !isAdmin && !isAttendanceManager) return false;
    return true;
  }) ?? [];
  const hasSubMenu = visibleSubs.length > 0;

  const isGroupActive =
    pathname === href ||
    (hasSubMenu && visibleSubs.some((s) => pathname === s.href)) ||
    (itemKey === 'admin' && pathname.startsWith('/admin'));

  const [open, setOpen] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) setOpen(true);
  }, [isGroupActive]);

  if (!hasSubMenu) {
    return (
      <li>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname === href
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white',
          )}
        >
          {icon}
          <span className='flex-1'>{label}</span>
          {badge != null && badge > 0 && (
            <span className='text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none'>
              {badge}
            </span>
          )}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isGroupActive
            ? 'text-white bg-gray-800'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white',
        )}
      >
        {icon}
        <span className='flex-1 text-left'>{label}</span>
        {/* 접혀있을 때만 그룹 버튼에 배지 표시 */}
        {!open && badge != null && badge > 0 && (
          <span className='relative inline-flex mr-1'>
            <span className='animate-ping absolute inset-0 rounded-full bg-red-400 opacity-60' />
            <span className='relative text-[10px] bg-red-500 text-white rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1 leading-none font-bold'>
              {badge > 99 ? '99+' : badge}
            </span>
          </span>
        )}
        <span className={cn('transition-transform duration-200 shrink-0', open ? 'rotate-180' : '')}>
          {ICONS.chevron}
        </span>
      </button>

      <ul
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-96 mt-0.5' : 'max-h-0',
        )}
      >
        {visibleSubs.map((sub) => (
          <SubNavLink
            key={sub.href}
            href={sub.href}
            label={sub.label}
            active={!sub.external && (pathname === sub.href || (sub.href === '/admin' && pathname === '/admin'))}
            badge={subBadges?.[sub.href]}
            external={sub.external}
            onClick={onClick}
          />
        ))}
      </ul>
    </li>
  );
}

// ─── 위임 업무 섹션 (canApprove 직원 전용) ─────────────────────
function DelegatedSection({
  pathname,
  onClick,
}: {
  pathname: string;
  onClick?: () => void;
}) {
  return (
    <>
      <p className='text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 pt-4 pb-1'>
        위임 업무
      </p>
      <ul className='space-y-0.5'>
        <li>
          <Link
            href='/approval'
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/approval'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white',
            )}
          >
            {ICONS.delegate}
            <span className='flex-1'>결재 처리</span>
            <span className='text-[10px] bg-blue-500/30 text-blue-300 rounded px-1.5 py-0.5 leading-none font-medium'>
              위임
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}

// ─── 사이드바 ──────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { unreadMessages, mailUnread } = useNotificationStore();
  const isAdmin = user?.role === 'head-admin';
  const isApprover = !isAdmin && user?.canApprove === true;
  const isAttendanceManager = !isAdmin && user?.canManageAttendance === true;

  const closeSidebar = () => setSidebarOpen(false);
  const handleNavClick = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  useEffect(() => {
    const init = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    init();
  }, [setSidebarOpen]);

  const visibleNavItems = PAGE_PERMISSIONS.filter((item) => {
    if (isAdmin) return true;
    return user?.pagePermissions?.includes(item.key);
  });

  const deptLabel =
    user?.department === 'marketing'
      ? '마케팅팀'
      : user?.department === 'design'
        ? '디자인팀'
        : '경영지원';

  const delegationLabel = [
    isApprover ? '결재위임' : '',
    isAttendanceManager ? '근태위임' : '',
  ].filter(Boolean).join('·');

  const roleLabel = isAdmin
    ? '헤드 어드민'
    : delegationLabel
      ? `${user?.position || ''} · ${delegationLabel}`
      : `${user?.position || ''} · ${deptLabel}`;

  return (
    <>
      {isSidebarOpen && (
        <div className='fixed inset-0 z-30 bg-black/50 md:hidden' onClick={handleNavClick} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-gray-900 flex flex-col transition-all duration-300 ease-in-out',
          'md:relative md:z-auto md:shrink-0',
          'w-64',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isSidebarOpen
            ? 'md:w-60 md:overflow-visible'
            : 'md:w-0 md:overflow-hidden',
        )}
      >
        {/* 로고 */}
        <div className='h-14 flex items-center justify-between px-4 border-b border-gray-800 shrink-0'>
          <div className='flex items-center gap-2.5'>
            <div className='w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center'>
              <span className='text-white text-xs font-bold'>C</span>
            </div>
            <span className='text-white font-semibold text-sm'>Company Portal</span>
          </div>
          <button onClick={closeSidebar} className='md:hidden text-gray-500 hover:text-white transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* 유저 프로필 카드 (상단 — 세로 중앙 정렬) */}
        <div className='flex flex-col items-center px-4 pt-5 pb-3 border-b border-gray-800 shrink-0'>
          {/* 아바타 */}
          <div className='relative mb-2'>
            <div className='w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-gray-600'>
              {user?.profileImage ? (
                <img src={user.profileImage} alt={user.name} className='w-full h-full object-cover' />
              ) : (
                <span className='text-white text-lg font-semibold'>{user?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            {/* 역할 뱃지 (아바타 우하단) */}
            {(isAdmin || isApprover || isAttendanceManager) && (
              <span className={cn(
                'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-gray-900',
                isAdmin ? 'bg-blue-500' : isAttendanceManager ? 'bg-emerald-500' : 'bg-amber-500',
              )}>
                <svg className='w-2.5 h-2.5 text-white' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z' />
                </svg>
              </span>
            )}
          </div>

          {/* 이름 + 직급·부서 */}
          <p className='text-white text-sm font-semibold truncate w-full text-center'>{user?.name || '사용자'}</p>
          <p className='text-gray-500 text-xs truncate w-full text-center mt-0.5'>{roleLabel}</p>

          {/* 내 프로필 서브 링크 */}
          <Link
            href='/profile'
            onClick={handleNavClick}
            className={cn(
              'mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] transition-colors',
              pathname === '/profile'
                ? 'bg-blue-600/20 text-blue-400'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700',
            )}
          >
            <svg className='w-3 h-3 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 2.828L11.828 13.828A2 2 0 0111 14H9v-2a2 2 0 01.172-.768z' />
            </svg>
            내 프로필 수정
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className='flex-1 overflow-y-auto sidebar-scroll py-3 px-3 space-y-0.5'>
          {/* 대시보드 + 조직도 */}
          <ul className='space-y-0.5'>
            <NavItem
              itemKey='dashboard'
              href='/dashboard'
              icon={ICONS.dashboard}
              label='대시보드'
              pathname={pathname}
              isAdmin={isAdmin}
              onClick={handleNavClick}
            />
            <NavItem
              itemKey='organization'
              href='/organization'
              icon={ICONS.organization}
              label='조직도'
              pathname={pathname}
              isAdmin={isAdmin}
              onClick={handleNavClick}
            />
          </ul>

          {/* 일반 메뉴 */}
          {visibleNavItems.length > 0 && (
            <>
              <p className='text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 pt-4 pb-1'>
                메뉴
              </p>
              <ul className='space-y-0.5'>
                {NAV_DISPLAY.map((entry) => {
                  if (entry.type === 'item') {
                    const item = visibleNavItems.find((i) => i.key === entry.key);
                    if (!item) return null;
                    return (
                      <NavItem
                        key={item.key}
                        itemKey={item.key}
                        href={item.href}
                        icon={ICONS[item.key]}
                        label={item.label}
                        pathname={pathname}
                        subItems={SUB_MENU_MAP[item.key]}
                        isAdmin={isAdmin}
                        isApprover={isApprover}
                        isAttendanceManager={isAttendanceManager}
                        onClick={handleNavClick}
                      />
                    );
                  }

                  // 그룹: 권한 있는 자식만 추출
                  const visibleChildren = entry.children
                    .map((key) => visibleNavItems.find((i) => i.key === key) ?? null)
                    .filter((i): i is (typeof visibleNavItems)[number] => i != null);
                  if (visibleChildren.length === 0) return null;

                  const groupSubItems: SubItem[] = visibleChildren.map((i) => ({
                    label: i.label,
                    href: i.href,
                    // PAGE_PERMISSIONS 에 external 필드가 있으면 그대로 전달
                    external: (i as { external?: boolean }).external,
                  }));

                  // communication 그룹: 메신저 + 메일 알림 배지 연결
                  const isCommunication = entry.key === 'communication';
                  const messengerHref = visibleChildren.find((c) => c.key === 'messenger')?.href;
                  const mailHref = visibleChildren.find((c) => c.key === 'mail')?.href;
                  const totalCommBadge = isCommunication
                    ? (unreadMessages || 0) + (mailUnread || 0)
                    : undefined;

                  const subBadgesMap: Record<string, number> = {};
                  if (isCommunication) {
                    if (messengerHref && unreadMessages > 0) subBadgesMap[messengerHref] = unreadMessages;
                    if (mailHref && mailUnread > 0) subBadgesMap[mailHref] = mailUnread;
                  }

                  return (
                    <NavItem
                      key={entry.key}
                      itemKey={entry.key}
                      href={visibleChildren[0].href}
                      icon={ICONS[entry.iconKey]}
                      label={entry.label}
                      pathname={pathname}
                      subItems={groupSubItems}
                      isAdmin={isAdmin}
                      isApprover={isApprover}
                      onClick={handleNavClick}
                      badge={totalCommBadge && totalCommBadge > 0 ? totalCommBadge : undefined}
                      subBadges={Object.keys(subBadgesMap).length > 0 ? subBadgesMap : undefined}
                    />
                  );
                })}
              </ul>
            </>
          )}

          {/* 위임 업무 섹션 (canApprove 직원 전용) */}
          {isApprover && (
            <DelegatedSection pathname={pathname} onClick={handleNavClick} />
          )}

          {/* 어드민 전용 */}
          {isAdmin && (
            <>
              <p className='text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 pt-4 pb-1'>
                관리자
              </p>
              <ul className='space-y-0.5'>
                <NavItem
                  itemKey='admin'
                  href='/admin'
                  icon={ICONS.admin}
                  label='인사 관리'
                  pathname={pathname}
                  subItems={ADMIN_SUB}
                  isAdmin={isAdmin}
                  onClick={handleNavClick}
                />
              </ul>
            </>
          )}
        </nav>

        {/* 하단: 로그아웃 */}
        <div className='px-3 py-2.5 border-t border-gray-800 shrink-0'>
          <button
            onClick={logout}
            className='w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors'
          >
            <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
            </svg>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  );
}
