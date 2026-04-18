// 페이지 권한 키 정의
// head-admin은 항상 모든 페이지에 접근 가능 (pagePermissions 무시)
// employee는 pagePermissions 배열에 포함된 키의 페이지만 접근 가능

export const PAGE_PERMISSIONS = [
  { key: 'attendance', label: '출퇴근 관리', href: '/attendance' },
  { key: 'tasks', label: '업무 보드', href: '/tasks' },
  { key: 'tasks-archive', label: '작업 기록', href: '/tasks/archive' },
  { key: 'confirm', label: '컨펌 시스템', href: '/confirm' },
  { key: 'messenger', label: '메신저', href: '/messenger' },
  { key: 'board', label: '게시판', href: '/board' },
  { key: 'approval', label: '전자결재', href: '/approval' },
  // 사내 메일 — 외부 하이웍스 링크, 권한 보유자에게만 노출
  { key: 'mail', label: '사내 메일', href: '/mail', external: true },
  { key: 'crm', label: '고객 관리', href: '/crm' },
  { key: 'calendar', label: '일정 관리', href: '/calendar' },
  { key: 'finance', label: '재무/급여', href: '/finance' },
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]['key'];

// 신규 직원 기본 권한
export const DEFAULT_EMPLOYEE_PERMISSIONS: PagePermissionKey[] = [
  'attendance',
  'tasks',
  'tasks-archive',
  'confirm',
  'messenger',
  'board',
  'approval',
];

// 라우트 경로 → 권한 키 매핑 (external 항목은 내부 라우트가 없으므로 제외)
export const ROUTE_PERMISSION_MAP: Record<string, PagePermissionKey> = {
  '/attendance': 'attendance',
  '/tasks': 'tasks',
  '/tasks/archive': 'tasks-archive',
  '/confirm': 'confirm',
  '/messenger': 'messenger',
  '/board': 'board',
  '/approval': 'approval',
  '/crm': 'crm',
  '/calendar': 'calendar',
  '/finance': 'finance',
};
