'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import api from '@/lib/api';
import { formatDateShort } from '@/lib/utils';
import dayjs from 'dayjs';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type FormType =
  | '휴가신청서'
  | '연장근무신청서'
  | '결근계'
  | '지출결의서'
  | '업무추진비신청서'
  | '업무기안서'
  | '업무협조 요청서'
  | '국내출장신청서';

type FolderKey =
  | 'inbox-pending'
  | 'inbox-done'
  | 'my-pending'
  | 'my-drafts'
  | 'my-done'
  | 'dept-all'
  | string; // dept-marketing, dept-design ...

interface ChainStep {
  approverId: string;
  approverName: string;
  approverPosition: string;
  order: number;
  status: 'pending' | '승인' | '반려';
  stampData: { svg: string; color: string; approverName: string; approvedAt: string } | null;
  decidedAt: string | null;
}

interface ApprovalDoc {
  _id: string;
  formType: FormType | null;
  type: string;
  title: string;
  reason: string;
  formData: Record<string, any>;
  applicantId: string;
  applicantName: string;
  applicantDept: string;
  applicantPosition: string;
  approverId: string | null;
  approverName: string;
  approverPosition: string;
  status: '임시저장' | '검토중' | '승인' | '반려' | '취소';
  comment: string;
  docNumber: string;
  attachments: string[];
  stampData: { svg: string; color: string; approverName: string; approvedAt: string } | null;
  applicantStampData: { svg: string; color: string; applicantName: string; submittedAt: string } | null;
  approvalChain: ChainStep[];
  currentStep: number;
  readBy?: string[];
  evidenceDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
  // legacy
  startDate?: string;
  endDate?: string;
  amount?: number;
  vacationType?: string;
  overtimeDate?: string;
  overtimeStartTime?: string;
  overtimeEndTime?: string;
}

interface DeptInfo2 {
  _id: string;
  key: string;
  label: string;
}

interface Approver {
  id: string;
  name: string;
  position: string;
  role: string;
}

// 서버 LeaveCategory 와 동일 키
type LeaveCategory = '연차' | '반차' | '병가' | '경조사' | '공가' | '기타';

type EvidenceTiming = 'none' | 'pre' | 'post';

interface LeavePolicy {
  _id: string;
  category: LeaveCategory;
  maxDaysPerRequest: number;
  annualCap: number;
  evidenceTiming: EvidenceTiming;
  postEvidenceDays: number;
  requiresEvidence: boolean;
  deductFromAnnualLeave: boolean;
  active: boolean;
  description: string;
}

interface WorkSchedule {
  halfDayMorningStart: string;
  halfDayMorningEnd: string;
  halfDayAfternoonStart: string;
  halfDayAfternoonEnd: string;
}

interface LeaveBalance {
  notApplicable: boolean;
  total: number;
  used: number;
  remaining: number;
  hireDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

// vacationType (UI 값) → LeaveCategory (서버 정책) 매핑
function resolveLeaveCategory(vt: string | undefined): LeaveCategory | null {
  if (!vt) return null;
  if (vt === '연차') return '연차';
  if (vt.startsWith('반차')) return '반차';
  if (vt === '병가') return '병가';
  if (vt === '경조사') return '경조사';
  if (vt === '공가') return '공가';
  if (vt === '기타') return '기타';
  return null;
}

// 휴가 신청서 formData로부터 요청 일수 계산 (서버 computeLeaveDays와 동일 로직)
function computeRequestedDays(formData: Record<string, any>): number {
  const vt: string | undefined = formData?.vacationType;
  if (!vt) return 0;
  if (vt.includes('반차')) return 0.5;
  const start = formData?.startDate;
  const end = formData?.endDate || start;
  if (!start) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1);
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  today: number;
}

interface DeptInfo {
  key: string;
  label: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────
const FORM_CATEGORIES = [
  {
    label: '인사',
    forms: ['휴가신청서', '연장근무신청서', '결근계'] as FormType[],
  },
  {
    label: '회계',
    forms: ['지출결의서', '업무추진비신청서'] as FormType[],
  },
  {
    label: '일반',
    forms: ['업무기안서', '업무협조 요청서'] as FormType[],
  },
  {
    label: '출장',
    forms: ['국내출장신청서'] as FormType[],
  },
];

const FORM_TITLE_DISPLAY: Record<string, string> = {
  '휴가신청서': '휴가 신청서',
  '연장근무신청서': '연장근무 신청서',
  '결근계': '결근계',
  '지출결의서': '지출 결의서',
  '업무추진비신청서': '업무추진비 신청서',
  '업무기안서': '업무 기안서',
  '업무협조 요청서': '업무협조 요청서',
  '국내출장신청서': '국내출장 신청서',
};

const FORM_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  '휴가신청서': { bg: 'bg-blue-100', text: 'text-blue-700' },
  '연장근무신청서': { bg: 'bg-purple-100', text: 'text-purple-700' },
  '결근계': { bg: 'bg-orange-100', text: 'text-orange-700' },
  '지출결의서': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  '업무추진비신청서': { bg: 'bg-teal-100', text: 'text-teal-700' },
  '업무기안서': { bg: 'bg-gray-100', text: 'text-gray-600' },
  '업무협조 요청서': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  '국내출장신청서': { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const STATUS_STYLE = {
  '임시저장': { bg: 'bg-gray-100', text: 'text-gray-500', label: '임시저장' },
  '검토중': { bg: 'bg-amber-100', text: 'text-amber-700', label: '검토중' },
  '승인': { bg: 'bg-green-100', text: 'text-green-700', label: '승인완료' },
  '반려': { bg: 'bg-red-100', text: 'text-red-600', label: '반려' },
  '취소': { bg: 'bg-gray-200', text: 'text-gray-500', label: '취소됨' },
};

const FOLDER_LABELS: Record<string, string> = {
  'inbox-pending': '결재 대기 문서',
  'inbox-done': '결재 수신 문서',
  'my-pending': '기안 문서함',
  'my-drafts': '임시 저장함',
  'my-done': '결재 문서함',
  'dept-all': '전체 문서함',
};

const DEPT_API_MAP: Record<FolderKey, string> = {
  'inbox-pending': '/api/approval/inbox',
  'inbox-done': '/api/approval/inbox-done',
  'my-pending': '/api/approval/mine-pending',
  'my-drafts': '/api/approval/drafts',
  'my-done': '/api/approval/mine-done',
  'dept-all': '/api/approval/dept/all',
};

const DEPT_LIST: DeptInfo[] = [
  { key: 'marketing', label: '마케팅팀' },
  { key: 'design', label: '디자인팀' },
  { key: 'management', label: '경영팀' },
];

// ────────────────────────────────────────────────────────────────────────────
// Stamp SVG Generator
// ────────────────────────────────────────────────────────────────────────────
function generateStampSvg(name: string, position: string, color = '#e11d48'): string {
  const line1 = name.length > 4 ? name.slice(0, 4) : name;
  const line2 = position ? (position.length > 4 ? position.slice(0, 4) : position) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
  <circle cx="36" cy="36" r="34" fill="none" stroke="${color}" stroke-width="3" opacity="0.85"/>
  <circle cx="36" cy="36" r="29" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
  <text x="36" y="${line2 ? '31' : '41'}" text-anchor="middle" font-size="16" font-weight="800" fill="${color}" font-family="serif" opacity="0.9">${line1}</text>
  ${line2 ? `<text x="36" y="49" text-anchor="middle" font-size="13" font-weight="700" fill="${color}" font-family="serif" opacity="0.9">${line2}</text>` : ''}
</svg>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────
const VALID_FORM_TYPES: FormType[] = [
  '휴가신청서',
  '연장근무신청서',
  '결근계',
  '지출결의서',
  '업무추진비신청서',
  '업무기안서',
  '업무협조 요청서',
  '국내출장신청서',
];

export default function ApprovalPage() {
  const { user } = useAuthStore();
  const { setApprovalUnread } = useNotificationStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === 'head-admin';
  const isApprover = isAdmin || user?.canApprove === true;

  const [folder, setFolder] = useState<FolderKey>('my-pending');
  const [docs, setDocs] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApprovalDoc[] | null>(null);

  const [depts, setDepts] = useState<DeptInfo2[]>([]);
  const [showChainSettings, setShowChainSettings] = useState(false);

  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');

  const [showFormSelect, setShowFormSelect] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState<FormType | null>(null);
  const [editDraft, setEditDraft] = useState<ApprovalDoc | null>(null);
  const [viewDoc, setViewDoc] = useState<ApprovalDoc | null>(null);
  const [decideDoc, setDecideDoc] = useState<ApprovalDoc | null>(null);

  useEffect(() => {
    api.get('/api/departments').then((r) => setDepts(r.data)).catch(() => {});
  }, []);


  // ?form=휴가신청서 등으로 진입 시 해당 양식 자동 오픈
  useEffect(() => {
    const formParam = searchParams.get('form');
    if (!formParam || !VALID_FORM_TYPES.includes(formParam as FormType)) return;

    // 대표는 인사(휴가·연장·결근) 양식 상신 대상이 아님
    const blockedForHeadAdmin: FormType[] = ['휴가신청서', '연장근무신청서', '결근계'];
    if (isAdmin && blockedForHeadAdmin.includes(formParam as FormType)) {
      router.replace(pathname, { scroll: false });
      return;
    }

    setSelectedFormType(formParam as FormType);
    setEditDraft(null);
    setMobileView('content');
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname, isAdmin]);

  const fetchDocs = useCallback(async (f: FolderKey) => {
    setIsLoading(true);
    try {
      let url = DEPT_API_MAP[f];
      if (!url) {
        const dept = f.replace('dept-', '');
        url = `/api/approval/dept/${dept}`;
      }
      const res = await api.get(url);
      setDocs(res.data);
    } catch {
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const myId = user?.id;
  const fetchInboxCount = useCallback(async () => {
    try {
      const res = await api.get('/api/approval/inbox');
      const docs = res.data as ApprovalDoc[];
      setInboxCount(docs.length); // 결재 대기 문서함 탭 숫자: pending 전체
      const unread = myId
        ? docs.filter((d) => !(d.readBy ?? []).some((uid) => uid?.toString() === myId)).length
        : docs.length;
      setApprovalUnread(unread); // 사이드바 뱃지: 안 읽은 것만
    } catch { /* noop */ }
  }, [setApprovalUnread, myId]);

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/api/approval/stats');
      setStats(res.data);
    } catch { /* noop */ }
  }, [isAdmin]);

  useEffect(() => {
    fetchDocs(folder);
    fetchInboxCount();
    fetchStats();
  }, [folder, fetchDocs, fetchInboxCount, fetchStats]);

  // 실시간 결재 이벤트 (상신/처리/취소/삭제) 수신 시 목록/카운트/통계 즉시 갱신
  useEffect(() => {
    const refresh = () => {
      fetchDocs(folder);
      fetchInboxCount();
      fetchStats();
    };
    window.addEventListener('approval:changed', refresh);
    return () => {
      window.removeEventListener('approval:changed', refresh);
    };
  }, [folder, fetchDocs, fetchInboxCount, fetchStats]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const res = await api.get(`/api/approval/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data);
    } catch { /* noop */ }
  };

  const handleSelectFolder = (f: FolderKey) => {
    setFolder(f);
    setSearchResults(null);
    setSearchQuery('');
    setMobileView('content');
  };

  const handleFormTypeSelect = (ft: FormType) => {
    setSelectedFormType(ft);
    setShowFormSelect(false);
    setEditDraft(null);
  };

  const handleDocumentSaved = () => {
    setSelectedFormType(null);
    setEditDraft(null);
    fetchDocs(folder);
    fetchInboxCount();
    fetchStats();
  };

  const handleDecide = async (id: string, decision: '승인' | '반려', comment: string) => {
    const stampColor = user?.stampColor ?? '#e11d48';
    // 사용자가 도장 관리에서 저장한 도장이 있으면 그대로 사용, 없으면 이름+직위 기반 자동 생성
    const stampSvg =
      user?.stampSvg ?? generateStampSvg(user?.name ?? '', user?.position ?? '', stampColor);
    await api.patch(`/api/approval/${id}/decide`, {
      status: decision,
      comment,
      stampData: {
        svg: stampSvg,
        color: stampColor,
        approverName: user?.name ?? '',
      },
    });
    setDecideDoc(null);
    setViewDoc(null);
    fetchDocs(folder);
    fetchInboxCount();
    fetchStats();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('기안을 취소하시겠습니까?')) return;
    try {
      await api.delete(`/api/approval/${id}`);
      fetchDocs(folder);
      fetchInboxCount();
      fetchStats();
    } catch { alert('취소 실패'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('문서를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await api.delete(`/api/approval/admin/${id}`);
      fetchDocs(folder);
      fetchInboxCount();
      fetchStats();
    } catch { alert('삭제 실패'); }
  };

  const handleSubmitDraft = async (id: string) => {
    if (!confirm('임시저장 문서를 상신하시겠습니까?')) return;
    try {
      await api.patch(`/api/approval/${id}/submit`);
      fetchDocs(folder);
      fetchInboxCount();
    } catch { alert('상신 실패'); }
  };

  const displayDocs = searchResults ?? docs;

  return (
    <div className='md:h-[calc(100vh-7.5rem)] flex bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm'>
      {/* ── Print: 사이드바/헤더 숨김 CSS ───────────────────────── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-area { display: block !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ═══════════════════ 좌측 패널 ═══════════════════ */}
      <aside className={`no-print bg-gray-50/60 border-r border-gray-100 flex flex-col overflow-y-auto
        md:w-56 md:shrink-0
        ${mobileView === 'sidebar' ? 'flex w-full' : 'hidden md:flex'}
      `}>
        {/* 페이지 제목 */}
        <div className='px-4 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between'>
          <h1 className='text-base font-bold text-gray-900'>전자결재</h1>
          {/* 모바일: 콘텐츠 보기 버튼 */}
          <button
            onClick={() => setMobileView('content')}
            className='md:hidden flex items-center gap-1 text-xs text-blue-600 font-medium'
          >
            문서 보기
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
            </svg>
          </button>
        </div>

        {/* 새 결재 진행 */}
        <div className='px-3 py-3 border-b border-gray-100'>
          <button
            onClick={() => { setShowFormSelect(true); setMobileView('content'); }}
            className='w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition shadow-sm'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            새 결재 진행
          </button>
        </div>

        {/* 어드민: 요약 위젯 */}
        {isAdmin && stats && (
          <div className='px-3 py-3 border-b border-gray-100 grid grid-cols-3 gap-1.5'>
            {[
              { label: '결재 대기', value: stats.pending, color: stats.pending > 0 ? 'text-orange-500' : 'text-gray-700' },
              { label: '승인', value: stats.approved, color: 'text-green-600' },
              { label: '반려', value: stats.rejected, color: 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className='bg-gray-50 rounded-md p-2 text-center'>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className='text-[10px] text-gray-500'>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 어드민: 검색 */}
        {isAdmin && (
          <div className='px-3 py-2 border-b border-gray-100'>
            <div className='flex gap-1'>
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='기안 검색'
                className='flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
              <button
                onClick={handleSearch}
                className='px-2 py-1.5 bg-gray-100 rounded-md text-gray-500 hover:bg-gray-200 transition'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className='flex-1 py-2 px-2 space-y-0.5 overflow-y-auto'>
          {/* 결재하기 (결재권한 보유자만) */}
          {isApprover && (
            <>
              <p className='text-[10px] font-semibold text-gray-400 px-2 pt-3 pb-1 uppercase tracking-wider'>결재하기</p>
              <FolderItem label='결재 대기 문서' folderKey='inbox-pending' current={folder} onClick={handleSelectFolder} badge={inboxCount} icon='⏳' />
              <FolderItem label='결재 수신 문서' folderKey='inbox-done' current={folder} onClick={handleSelectFolder} icon='✅' />
            </>
          )}

          {/* 개인 문서함 */}
          <p className='text-[10px] font-semibold text-gray-400 px-2 pt-3 pb-1 uppercase tracking-wider'>개인 문서함</p>
          <FolderItem label='기안 문서함' folderKey='my-pending' current={folder} onClick={handleSelectFolder} icon='📤' />
          <FolderItem label='임시 저장함' folderKey='my-drafts' current={folder} onClick={handleSelectFolder} icon='📝' />
          <FolderItem label='결재 문서함' folderKey='my-done' current={folder} onClick={handleSelectFolder} icon='📁' />

          {/* 어드민: 부서 문서함 */}
          {isAdmin && (
            <>
              <p className='text-[10px] font-semibold text-gray-400 px-2 pt-3 pb-1 uppercase tracking-wider'>부서 문서함</p>
              <FolderItem label='전체' folderKey='dept-all' current={folder} onClick={handleSelectFolder} icon='🏢' />
              {DEPT_LIST.map((d) => (
                <FolderItem
                  key={d.key}
                  label={d.label}
                  folderKey={`dept-${d.key}`}
                  current={folder}
                  onClick={handleSelectFolder}
                  icon='📂'
                />
              ))}
            </>
          )}

          {/* 어드민: 결재 체인 설정 */}
          {isAdmin && (
            <>
              <p className='text-[10px] font-semibold text-gray-400 px-2 pt-3 pb-1 uppercase tracking-wider'>설정</p>
              <button
                onClick={() => setShowChainSettings(true)}
                className='w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition'
              >
                <span className='shrink-0'>⚙️</span>
                <span className='flex-1 text-left'>결재 체인 설정</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* ═══════════════════ 우측 패널 ═══════════════════ */}
      <main className={`flex-1 flex flex-col min-w-0 overflow-y-auto p-5
        ${mobileView === 'content' ? 'flex' : 'hidden md:flex'}
      `}>
        {/* 헤더 */}
        <div className='flex items-center justify-between mb-5 no-print'>
          <div className='flex items-center gap-2'>
            {/* 모바일: 사이드바로 돌아가기 */}
            <button
              onClick={() => setMobileView('sidebar')}
              className='md:hidden flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
              </svg>
            </button>
            <div>
              <h1 className='text-xl font-bold text-gray-900'>
                {searchResults ? `검색 결과: "${searchQuery}"` : (FOLDER_LABELS[folder] ?? folder.replace('dept-', '') + ' 문서함')}
              </h1>
              <p className='text-xs text-gray-500 mt-0.5'>{displayDocs.length}건</p>
            </div>
          </div>
          {searchResults && (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className='text-xs text-blue-600 hover:underline'
            >
              검색 초기화
            </button>
          )}
        </div>

        {/* 문서 목록 */}
        <DocList
          docs={displayDocs}
          isLoading={isLoading}
          folder={folder}
          onView={(doc) => {
            // 본인이 아직 안 읽은 문서면 서버에 읽음 처리 요청 후 카운트 동기화
            const alreadyRead = (doc.readBy ?? []).some(
              (uid) => uid?.toString() === user?.id,
            );
            if (!alreadyRead && user?.id) {
              api.patch(`/api/approval/${doc._id}/read`).then(() => {
                fetchInboxCount();
              }).catch(() => {});
            }
            if (folder === 'inbox-pending' && doc.status === '검토중') {
              const chain = doc.approvalChain ?? [];
              const mySlot = chain.find((s) => s.approverId === user?.id);
              const canDecideThis = chain.length === 0
                ? doc.approverId === user?.id
                : mySlot?.status === 'pending';
              if (canDecideThis) setDecideDoc(doc);
              else setViewDoc(doc);
            } else {
              setViewDoc(doc);
            }
          }}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onSubmitDraft={handleSubmitDraft}
          onEditDraft={(doc) => {
            setEditDraft(doc);
            setSelectedFormType(doc.formType ?? '업무기안서');
          }}
          isAdmin={isAdmin}
          isApprover={isApprover}
        />
      </main>

      {/* ═══════════════════ 모달들 ═══════════════════ */}
      {showChainSettings && (
        <ChainSettingsModal onClose={() => setShowChainSettings(false)} />
      )}

      {showFormSelect && (
        <FormSelectModal
          onSelect={handleFormTypeSelect}
          onClose={() => setShowFormSelect(false)}
        />
      )}

      {selectedFormType && (
        <DocumentFormModal
          formType={selectedFormType}
          draft={editDraft}
          depts={depts}
          onClose={() => { setSelectedFormType(null); setEditDraft(null); }}
          onSaved={handleDocumentSaved}
        />
      )}

      {viewDoc && !decideDoc && (
        <DocumentViewModal
          doc={viewDoc}
          canDecide={false}
          onClose={() => setViewDoc(null)}
          onEvidenceUploaded={() => {
            fetchDocs(folder);
            fetchInboxCount();
            fetchStats();
          }}
        />
      )}

      {decideDoc && (
        <DocumentViewModal
          doc={decideDoc}
          canDecide={true}
          onDecide={handleDecide}
          onClose={() => setDecideDoc(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Folder Item
// ────────────────────────────────────────────────────────────────────────────
function FolderItem({
  label, folderKey, current, onClick, badge, icon,
}: {
  label: string; folderKey: FolderKey; current: FolderKey;
  onClick: (f: FolderKey) => void; badge?: number; icon?: string;
}) {
  const isActive = current === folderKey;
  return (
    <button
      onClick={() => onClick(folderKey)}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {icon && <span className='shrink-0 text-sm'>{icon}</span>}
      <span className='flex-1 text-left truncate'>{label}</span>
      {badge != null && badge > 0 && (
        <span className='ml-auto text-[10px] bg-red-500 text-white rounded-full min-w-4 h-4 flex items-center justify-center px-1 font-bold'>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Document List
// ────────────────────────────────────────────────────────────────────────────
function DocList({
  docs, isLoading, folder, onView, onCancel, onDelete, onSubmitDraft, onEditDraft, isAdmin, isApprover,
}: {
  docs: ApprovalDoc[];
  isLoading: boolean;
  folder: FolderKey;
  onView: (doc: ApprovalDoc) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onSubmitDraft: (id: string) => void;
  onEditDraft: (doc: ApprovalDoc) => void;
  isAdmin: boolean;
  isApprover: boolean;
}) {
  if (isLoading) return (
    <div className='flex items-center justify-center py-20'>
      <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  if (docs.length === 0) return (
    <div className='bg-white rounded-md border border-gray-100 flex flex-col items-center justify-center py-16 text-center'>
      <span className='text-4xl mb-3'>📭</span>
      <p className='text-sm font-semibold text-gray-700'>문서가 없습니다</p>
      <p className='text-xs text-gray-400 mt-1'>해당 문서함에 기안이 없습니다.</p>
    </div>
  );

  return (
    <div className='bg-white rounded-md border border-gray-100'>
      {/* 모바일 카드 뷰 */}
      <div className='md:hidden divide-y divide-gray-100'>
        {docs.map((doc) => {
          const ft = doc.formType ?? (doc.type as FormType) ?? '업무기안서';
          const ftColor = FORM_TYPE_COLOR[ft] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
          const statusStyle = STATUS_STYLE[doc.status] ?? STATUS_STYLE['검토중'];
          const isPending = doc.status === '검토중' && folder === 'inbox-pending';
          return (
            <div
              key={doc._id}
              onClick={() => onView(doc)}
              className='p-4 cursor-pointer hover:bg-blue-50/30 transition-colors'
            >
              <div className='flex items-start justify-between gap-2 mb-2'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ftColor.bg} ${ftColor.text}`}>
                    {ft}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>
                <span className='text-[11px] text-gray-400 whitespace-nowrap shrink-0'>
                  {formatDateShort(doc.createdAt)}
                </span>
              </div>
              <p className='text-sm font-medium text-gray-800 mb-1 line-clamp-1'>{doc.title}</p>
              {doc.docNumber && <p className='text-[10px] text-gray-400 mb-2'>{doc.docNumber}</p>}
              <div className='flex items-center justify-between mt-2'>
                <div className='flex items-center gap-3 text-xs text-gray-500'>
                  <span>기안자 <span className='font-medium text-gray-700'>{doc.applicantName}</span></span>
                  <span>결재자 <span className='font-medium text-gray-700'>{doc.approverName}</span></span>
                </div>
                <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
                  {doc.status === '임시저장' && (
                    <>
                      <button
                        onClick={() => onEditDraft(doc)}
                        className='text-[11px] px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition'
                      >수정</button>
                      <button
                        onClick={() => onSubmitDraft(doc._id)}
                        className='text-[11px] px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition'
                      >상신</button>
                    </>
                  )}
                  {doc.status === '검토중' && !isPending && (
                    <button
                      onClick={() => onCancel(doc._id)}
                      className='text-[11px] px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 transition'
                    >취소</button>
                  )}
                  {isPending && (
                    <button
                      onClick={() => onView(doc)}
                      className='text-[11px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium'
                    >결재</button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => onDelete(doc._id)}
                      className='text-[11px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition font-medium'
                    >삭제</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* 데스크톱 테이블 뷰 */}
      <div className='hidden md:block overflow-x-auto'>
        <table className='w-full text-sm min-w-[600px]'>
          <thead>
            <tr className='border-b border-gray-100 bg-gray-50/70'>
              <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-28'>기안일</th>
              <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-32'>양식</th>
              <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500'>제목</th>
              <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-20'>기안자</th>
              <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-20'>결재자</th>
              <th className='text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24'>상태</th>
              <th className='text-center px-4 py-3 text-xs font-semibold text-gray-500 w-36'>작업</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-50'>
            {docs.map((doc) => {
              const ft = doc.formType ?? (doc.type as FormType) ?? '업무기안서';
              const ftColor = FORM_TYPE_COLOR[ft] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
              const statusStyle = STATUS_STYLE[doc.status] ?? STATUS_STYLE['검토중'];
              const isPending = doc.status === '검토중' && folder === 'inbox-pending';
              return (
                <tr
                  key={doc._id}
                  onClick={() => onView(doc)}
                  className='hover:bg-blue-50/30 cursor-pointer transition-colors group'
                >
                  <td className='px-4 py-3 text-xs text-gray-500 whitespace-nowrap'>
                    {formatDateShort(doc.createdAt)}
                  </td>
                  <td className='px-4 py-3'>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ftColor.bg} ${ftColor.text}`}>
                      {ft}
                    </span>
                  </td>
                  <td className='px-4 py-3 max-w-xs'>
                    <span className='text-sm font-medium text-gray-800 truncate block group-hover:text-blue-700 transition-colors'>
                      {doc.title}
                    </span>
                    {doc.docNumber && (
                      <span className='text-[10px] text-gray-400'>{doc.docNumber}</span>
                    )}
                  </td>
                  <td className='px-4 py-3 text-xs text-gray-600 whitespace-nowrap'>{doc.applicantName}</td>
                  <td className='px-4 py-3 text-xs text-gray-600 whitespace-nowrap'>{doc.approverName}</td>
                  <td className='px-4 py-3 text-center'>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-center' onClick={(e) => e.stopPropagation()}>
                    <div className='flex items-center justify-center gap-1 flex-nowrap'>
                      {doc.status === '임시저장' && (
                        <>
                          <button
                            onClick={() => onEditDraft(doc)}
                            className='text-[11px] px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition'
                          >수정</button>
                          <button
                            onClick={() => onSubmitDraft(doc._id)}
                            className='text-[11px] px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition'
                          >상신</button>
                        </>
                      )}
                      {doc.status === '검토중' && !isPending && (
                        <button
                          onClick={() => onCancel(doc._id)}
                          className='text-[11px] px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 transition'
                        >취소</button>
                      )}
                      {isPending && (
                        <button
                          onClick={() => onView(doc)}
                          className='text-[11px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium'
                        >결재</button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => onDelete(doc._id)}
                          className='text-[11px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition font-medium'
                          title='영구 삭제 (관리자)'
                        >삭제</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Form Select Modal
// ────────────────────────────────────────────────────────────────────────────
function FormSelectModal({ onSelect, onClose }: { onSelect: (ft: FormType) => void; onClose: () => void }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  // 대표는 법적 근로자가 아니므로 인사(휴가/연장/결근) 양식 상신 대상 제외
  const visibleCategories = isAdmin
    ? FORM_CATEGORIES.filter((c) => c.label !== '인사')
    : FORM_CATEGORIES;
  const [expanded, setExpanded] = useState<string | null>(visibleCategories[0]?.label ?? null);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='bg-white rounded-md shadow-2xl w-96 overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>결재 양식 선택</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='p-4 space-y-1'>
          {isAdmin && (
            <div className='mb-2 p-3 rounded-md bg-amber-50 border border-amber-100 text-[11px] text-amber-800 leading-relaxed'>
              대표는 인사(휴가·연장근무·결근) 결재 상신 대상이 아닙니다.
              부재 시에는 대시보드의 `현재 상태`에서 직접 설정하세요.
            </div>
          )}
          {visibleCategories.map((cat) => (
            <div key={cat.label}>
              <button
                onClick={() => setExpanded(expanded === cat.label ? null : cat.label)}
                className='w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-gray-50 transition'
              >
                <span className='text-sm font-semibold text-gray-700'>{cat.label}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expanded === cat.label ? 'rotate-180' : ''}`}
                  fill='none' stroke='currentColor' viewBox='0 0 24 24'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                </svg>
              </button>
              {expanded === cat.label && (
                <div className='ml-3 pl-3 border-l-2 border-gray-100 space-y-0.5 mb-1'>
                  {cat.forms.map((ft) => (
                    <button
                      key={ft}
                      onClick={() => onSelect(ft)}
                      className='w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition'
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Document Form Modal  (8종 양식)
// ────────────────────────────────────────────────────────────────────────────
function DocumentFormModal({
  formType, draft, depts, onClose, onSaved,
}: {
  formType: FormType;
  draft: ApprovalDoc | null;
  depts: DeptInfo2[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuthStore();
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);
  const [docTitle, setDocTitle] = useState(draft?.title ?? '');
  const [formData, setFormData] = useState<Record<string, any>>(draft?.formData ?? {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // 기존 첨부 URL (임시저장본에서 복구)
  const [existingAttachments, setExistingAttachments] = useState<string[]>(
    (draft?.formData?.attachments as string[] | undefined) ?? draft?.attachments ?? [],
  );
  // 잔여 연차 (휴가신청서 전용)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  // 전체 정책 (UI 힌트/검증용)
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  // 반차 기본 시간대 (관리자가 정책 페이지에서 설정)
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);

  const todayKr = dayjs().format('YYYY-MM-DD');
  const deptLabel = depts.find((d) => d.key === user?.department || d._id === user?.department)?.label ?? user?.department ?? '-';
  const docNo = draft?.docNumber ?? '';

  const fd = (key: string) => formData[key] ?? '';
  const setFd = (key: string, val: any) => setFormData((prev) => ({ ...prev, [key]: val }));

  // 휴가신청서일 때 잔여 연차 + 전체 정책 + 반차 시간대 로드
  useEffect(() => {
    if (formType !== '휴가신청서') return;
    api.get('/api/users/me/annual-leave').then((r) => setLeaveBalance(r.data)).catch(() => {});
    api.get('/api/leave-policies').then((r) => setPolicies(r.data)).catch(() => {});
    api.get('/api/work-schedule').then((r) => setWorkSchedule(r.data)).catch(() => {});
  }, [formType]);

  const currentPolicy = (() => {
    const cat = resolveLeaveCategory(fd('vacationType'));
    return cat ? policies.find((p) => p.category === cat) ?? null : null;
  })();
  const requestedDays = computeRequestedDays(formData);

  useEffect(() => {
    if (draft?.approvalChain?.length) {
      setChainSteps(draft.approvalChain);
    } else {
      Promise.all([
        api.get('/api/approval/chain-settings'),
        api.get('/api/approval/approvers'),
      ]).then(([chainRes, apRes]) => {
        const approverMap = new Map((apRes.data as Approver[]).map((a: Approver) => [a.id, a]));
        const steps = (chainRes.data as any[]).map((s) => {
          const a = approverMap.get(s.approverId);
          return {
            ...s,
            approverPosition: a ? (a.position || (a.role === 'head-admin' ? '대표' : '사원')) : (s.approverPosition || '결재자'),
            status: 'pending' as const,
            stampData: null,
            decidedAt: null,
          };
        });
        setChainSteps(steps);
      }).catch(() => {});
    }
  }, []);

  const generateTitle = () => {
    if (docTitle.trim()) return docTitle.trim();
    return `${user?.name} - ${formType}`;
  };

  const validate = () => {
    const str = (v: any) => (typeof v === 'string' ? v.trim() : v);
    if (formType === '휴가신청서') {
      if (!fd('startDate')) { alert('휴가 시작일을 입력하세요.'); return false; }
      const isHalfDay = fd('vacationType') === '반차(오전)' || fd('vacationType') === '반차(오후)';
      if (!isHalfDay && !fd('endDate')) { alert('휴가 종료일을 입력하세요.'); return false; }
      if (isHalfDay && (!fd('startTime') || !fd('endTime'))) { alert('반차 시간을 입력하세요.'); return false; }
      if (!str(fd('reason'))) { alert('휴가 사유를 입력하세요.'); return false; }

      // 정책 기반 검증
      const days = requestedDays;
      if (currentPolicy) {
        if (currentPolicy.maxDaysPerRequest > 0 && days > currentPolicy.maxDaysPerRequest) {
          alert(`'${fd('vacationType')}'는 1건당 최대 ${currentPolicy.maxDaysPerRequest}일까지 신청할 수 있습니다. (요청 ${days}일)`);
          return false;
        }
        // 'pre' timing 에서만 신청 시점에 증빙 강제
        if (
          currentPolicy.evidenceTiming === 'pre' &&
          attachedFiles.length === 0 &&
          existingAttachments.length === 0
        ) {
          alert(`'${fd('vacationType')}'는 신청 시점에 증빙 서류 첨부가 필수입니다.`);
          return false;
        }
        if (currentPolicy.deductFromAnnualLeave && leaveBalance && !leaveBalance.notApplicable) {
          if (days > leaveBalance.remaining) {
            alert(`잔여 연차 ${leaveBalance.remaining}일을 초과합니다. (요청 ${days}일)`);
            return false;
          }
        }
      }
    }
    if (formType === '연장근무신청서') {
      if (!fd('overtimeDate')) { alert('연장근무일을 입력하세요.'); return false; }
      if (!fd('startTime') || !fd('endTime')) { alert('연장근무 시간을 입력하세요.'); return false; }
      if (!str(fd('reason'))) { alert('연장근무 업무 내용을 입력하세요.'); return false; }
    }
    if (formType === '결근계') {
      if (!fd('absenceDate')) { alert('결근일을 입력하세요.'); return false; }
      if (!str(fd('absenceReason'))) { alert('결근 사유를 입력하세요.'); return false; }
    }
    if (formType === '지출결의서') {
      const items = fd('items') || [];
      // 행의 "작성된" 기준: 품명이 있고 수량·금액이 모두 0보다 큰 것
      const validRows = items.filter((it: any) =>
        str(it.name) && Number(it.qty) > 0 && Number(it.amount) > 0,
      );
      // 일부만 적다 만 행이 섞여있는지 (예: 품명만 적고 금액 미입력) 확인
      const partial = items.find((it: any) => {
        const hasAny =
          str(it.name) ||
          Number(it.qty) > 0 ||
          Number(it.amount) > 0 ||
          !!it.date;
        const hasAll =
          str(it.name) && Number(it.qty) > 0 && Number(it.amount) > 0;
        return hasAny && !hasAll;
      });
      if (validRows.length === 0) {
        alert('지출 내역(지출일·품명·수량·금액)을 1건 이상 모두 입력하세요.');
        return false;
      }
      if (partial) {
        alert('작성 중인 지출 내역 행이 있습니다. 품명·수량·금액을 모두 채우거나 지워주세요.');
        return false;
      }
      if (!str(fd('purpose'))) { alert('사용 목적을 입력하세요.'); return false; }
    }
    if (formType === '업무추진비신청서') {
      if (!fd('amount') || Number(fd('amount')) <= 0) { alert('신청 금액을 입력하세요.'); return false; }
      if (!fd('plannedDate')) { alert('사용예정일을 입력하세요.'); return false; }
      if (!(fd('categories') || []).length) { alert('항목을 1개 이상 선택하세요.'); return false; }
      if (!str(fd('purpose'))) { alert('사용 목적을 입력하세요.'); return false; }
    }
    if (formType === '업무기안서') {
      if (!str(fd('receiver'))) { alert('수신처를 입력하세요.'); return false; }
      if (!str(fd('content'))) { alert('기안 내용을 입력하세요.'); return false; }
    }
    if (formType === '업무협조 요청서') {
      if (!str(fd('targetDept'))) { alert('수신 부서를 입력하세요.'); return false; }
      if (!str(fd('requestTitle'))) { alert('요청 제목을 입력하세요.'); return false; }
      if (!str(fd('requestContent'))) { alert('요청 내용을 입력하세요.'); return false; }
      if (!fd('dueDate')) { alert('완료요청일을 입력하세요.'); return false; }
    }
    if (formType === '국내출장신청서') {
      if (!str(fd('destination'))) { alert('출장지를 입력하세요.'); return false; }
      if (!fd('startDate') || !fd('endDate')) { alert('출장 기간을 입력하세요.'); return false; }
      if (!str(fd('purpose'))) { alert('출장 목적을 입력하세요.'); return false; }
    }
    return true;
  };

  // 로컬에 있는 첨부 파일을 서버에 업로드하고 URL 배열 반환
  const uploadAttachments = async (): Promise<string[]> => {
    if (attachedFiles.length === 0) return existingAttachments;
    const uploaded: string[] = [];
    for (const f of attachedFiles) {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/api/approval/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      uploaded.push(res.data.url);
    }
    return [...existingAttachments, ...uploaded];
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const attachmentUrls = await uploadAttachments();
      const applicantStampSvg = generateStampSvg(user?.name ?? '', user?.position ?? '', '#1d4ed8');
      const applicantStampData = {
        svg: applicantStampSvg,
        color: '#1d4ed8',
        applicantName: user?.name ?? '',
        submittedAt: new Date().toISOString(),
      };
      const payload = {
        formType,
        title: generateTitle(),
        formData: { ...formData, attachments: attachmentUrls },
        applicantStampData,
        deptLabel,
      };
      if (draft?._id && draft.status === '임시저장') {
        await api.patch(`/api/approval/${draft._id}/draft`, payload);
        await api.patch(`/api/approval/${draft._id}/submit`);
      } else {
        await api.post('/api/approval', payload);
      }
      setAttachedFiles([]);
      setExistingAttachments(attachmentUrls);
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message || '기안 제출에 실패했습니다.');
    }
    finally { setIsSubmitting(false); }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const attachmentUrls = await uploadAttachments();
      const payload = {
        formType,
        title: generateTitle(),
        formData: { ...formData, attachments: attachmentUrls },
        deptLabel,
      };
      if (draft?._id && draft.status === '임시저장') {
        await api.patch(`/api/approval/${draft._id}/draft`, payload);
      } else {
        await api.post('/api/approval/draft', payload);
      }
      setAttachedFiles([]);
      setExistingAttachments(attachmentUrls);
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message || '임시저장에 실패했습니다.');
    }
    finally { setIsSaving(false); }
  };

  // Cell styles
  const th = 'border border-gray-300 bg-[#f7f8fa] text-[11px] font-semibold text-gray-600 px-3 py-[7px] text-center whitespace-nowrap';
  const td = 'border border-gray-300 text-[13px] text-gray-800 px-3 py-[7px]';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto py-4'>
      <div className='w-full max-w-[900px] mx-4 rounded-md shadow-2xl overflow-hidden flex flex-col' style={{ maxHeight: 'calc(100vh - 2rem)' }}>

        {/* ── 상단 툴바 ── */}
        <div className='flex items-center justify-between bg-[#3d4049] px-4 py-0 shrink-0'>
          <span className='text-[11px] font-semibold text-gray-300 py-3'>{formType}</span>
          <div className='flex items-center gap-0.5'>
            <ToolbarBtn icon='submit' label={isSubmitting ? '제출중' : '결재요청'} onClick={handleSubmit} disabled={isSubmitting} highlight />
            <ToolbarBtn icon='save' label={isSaving ? '저장중' : '일시저장'} onClick={handleSaveDraft} disabled={isSaving} />
            <ToolbarBtn icon='close' label='취소' onClick={onClose} />
          </div>
        </div>

        {/* ── 문서 본문 ── */}
        <div className='bg-[#f0f2f5] overflow-y-auto flex-1'>
          <div className='bg-white mx-auto my-5 rounded shadow-md' style={{ width: '794px', maxWidth: '100%', minHeight: '1123px', padding: '48px 56px' }}>

            {/* 문서 제목 + 결재란 */}
            <div className='flex items-start mb-8'>
              <div style={{ flex: 1 }} />
              <h2 className='text-[28px] font-bold tracking-[0.15em] text-gray-900 flex-shrink-0 pt-2'>
                {FORM_TITLE_DISPLAY[formType] ?? formType}
              </h2>
              <div style={{ flex: 1 }} className='flex justify-end'>
                <MultiStampBox steps={chainSteps} />
              </div>
            </div>

            {/* ─── 양식별 본문 (전통 A4 서식) ─── */}
            <table className='w-full border-collapse text-[13px] mb-4'>
              <tbody>
                <tr>
                  <td className='border border-gray-800 bg-[#f0f0f0] text-[12px] font-semibold text-gray-700 px-3 py-2 text-center whitespace-nowrap' style={{ width: '80px' }}>제목</td>
                  <td className='border border-gray-800 px-3 py-2' colSpan={3}>
                    <input type='text' value={docTitle} onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={generateTitle()} className='w-full text-[13px] outline-none bg-transparent placeholder-gray-300' />
                  </td>
                </tr>
                {formType === '휴가신청서' && <VacationFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} balance={leaveBalance} policy={currentPolicy} requestedDays={requestedDays} workSchedule={workSchedule} />}
                {formType === '연장근무신청서' && <OvertimeFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '결근계' && <AbsenceFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '지출결의서' && <ExpenseFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '업무추진비신청서' && <BusinessExpenseFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '업무기안서' && <GeneralFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '업무협조 요청서' && <CooperationFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
                {formType === '국내출장신청서' && <TripFormRows fd={fd} setFd={setFd} user={user} deptLabel={deptLabel} />}
              </tbody>
            </table>
            <div className='text-[12px] text-gray-500 flex justify-between mb-1'>
              <span>기안일: {todayKr}</span>
              <span>문서번호: {docNo || '제출 시 자동 생성'}</span>
            </div>

            {/* 신청인 섹션 */}
            <div className='mt-8'>
              <p className='text-[13px] text-gray-700 text-center'>위와 같이 신청하오니 허락하여 주시기 바랍니다.</p>
              <div className='flex items-center justify-end gap-3 mt-6'>
                <span className='text-[14px] font-semibold text-gray-800'>신청인: {user?.name}</span>
                <div style={{ width: '72px', height: '72px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                  <div dangerouslySetInnerHTML={{ __html: generateStampSvg(user?.name ?? '', user?.position ?? '', '#1d4ed8') }} />
                </div>
              </div>
              <p className='text-[11px] text-gray-400 text-right mt-0.5'>(제출 시 도장이 자동 날인됩니다)</p>
            </div>

            {/* 파일 첨부 */}
            <div className='border border-gray-300 mt-4'>
              <div className='flex items-center gap-2 bg-[#eef0f4] px-3 py-[5px] border-b border-gray-300'>
                <span className='text-[11px] font-bold text-gray-600 tracking-widest flex-1'>
                  파일 첨부
                  {currentPolicy?.evidenceTiming === 'pre' && (
                    <span className='text-orange-600 ml-2'>* 사전 필수</span>
                  )}
                  {currentPolicy?.evidenceTiming === 'post' && (
                    <span className='text-blue-600 ml-2'>· 사후 제출 가능</span>
                  )}
                </span>
                <button type='button' onClick={() => fileRef.current?.click()}
                  className='text-[11px] px-2.5 py-[3px] border border-gray-400 rounded bg-white hover:bg-gray-50 text-gray-600 transition font-medium'>
                  PC 파일 선택
                </button>
              </div>
              <input ref={fileRef} type='file' multiple
                accept='image/*,application/pdf'
                className='hidden'
                onChange={(e) => { if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
              <div className='min-h-[48px] px-4 py-3 bg-white'>
                {existingAttachments.length === 0 && attachedFiles.length === 0 ? (
                  <p className='text-[12px] text-gray-400 text-center py-1'>파일을 여기에 드롭하거나 위 버튼을 클릭하세요 (이미지·PDF, 최대 10MB)</p>
                ) : (
                  <div className='space-y-1'>
                    {existingAttachments.map((url, i) => (
                      <div key={`e-${i}`} className='flex items-center gap-2 text-[12px] text-gray-600'>
                        <span className='text-green-600'>●</span>
                        <a href={url} target='_blank' rel='noreferrer' className='truncate flex-1 hover:underline'>
                          {url.startsWith('data:') ? `업로드된 파일 #${i + 1}` : url.split('/').pop()}
                        </a>
                        <button type='button' onClick={() => setExistingAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className='text-gray-300 hover:text-red-500'>×</button>
                      </div>
                    ))}
                    {attachedFiles.map((f, i) => (
                      <div key={`n-${i}`} className='flex items-center gap-2 text-[12px] text-gray-600'>
                        <span className='text-blue-600'>○</span>
                        <span className='truncate flex-1'>{f.name} <span className='text-gray-400'>({(f.size / 1024).toFixed(1)} KB)</span></span>
                        <button type='button' onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className='text-gray-300 hover:text-red-500'>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Toolbar Button
// ────────────────────────────────────────────────────────────────────────────
function ToolbarBtn({ icon, label, onClick, disabled, highlight, active }: {
  icon: string; label: string; onClick: () => void; disabled?: boolean; highlight?: boolean; active?: boolean;
}) {
  const iconEl = {
    submit: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />,
    save: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' />,
    close: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />,
    approver: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />,
  }[icon];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded transition disabled:opacity-60
        ${highlight ? 'text-white hover:bg-blue-600' : active ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}
    >
      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        {iconEl}
      </svg>
      <span className='text-[10px]'>{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stamp Box (단일 결재란, 하위 호환)
// ────────────────────────────────────────────────────────────────────────────
function StampBox({ approverPosition, stampSvg, approvedAt }: {
  approverPosition: string;
  stampSvg?: string | null;
  approvedAt?: string | null;
}) {
  return (
    <div className='shrink-0'>
      <table className='border-collapse text-[12px]' style={{ minWidth: '90px' }}>
        <thead>
          <tr>
            <td className='border-2 border-gray-700 bg-[#f0f0f0] text-center px-3 py-[6px] font-bold text-gray-700 tracking-[0.3em] text-[12px]' colSpan={1}>
              결&nbsp;&nbsp;재
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className='border-2 border-gray-700 text-center px-2 py-[6px] text-gray-700 font-semibold text-[12px]' style={{ width: '90px' }}>
              {approverPosition}
            </td>
          </tr>
          <tr>
            <td className='border-2 border-gray-700 text-center' style={{ height: '100px', width: '90px', position: 'relative' }}>
              {stampSvg ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div dangerouslySetInnerHTML={{ __html: stampSvg }} />
                </div>
              ) : (
                <span className='text-[11px] text-gray-300'>미결</span>
              )}
            </td>
          </tr>
          <tr>
            <td className='border-2 border-gray-700 text-center px-1 py-[5px] text-[11px] text-gray-500'>
              {approvedAt ?? ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Multi Stamp Box (다단계 결재란)
// ────────────────────────────────────────────────────────────────────────────
function MultiStampBox({ steps }: { steps: ChainStep[] }) {
  if (!steps || steps.length === 0) {
    return <StampBox approverPosition='대표' />;
  }
  const hasDecision = steps.some((s) => !!s.decidedAt);
  return (
    <div className='shrink-0'>
      <table className='border-collapse text-[12px]'>
        <thead>
          <tr>
            <td
              colSpan={steps.length}
              className='border-2 border-gray-700 bg-[#f0f0f0] text-center px-3 py-[6px] font-bold text-gray-700 tracking-[0.3em] text-[12px]'
            >
              결&nbsp;&nbsp;재
            </td>
          </tr>
          <tr>
            {steps.map((s, i) => (
              <td key={i} className='border-2 border-gray-700 text-center px-2 py-[6px] text-gray-700 font-semibold text-[12px]' style={{ width: '90px' }}>
                {s.approverPosition || '결재자'}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {steps.map((s, i) => (
              <td key={i} className='border-2 border-gray-700 text-center' style={{ height: '100px', width: '90px', position: 'relative' }}>
                {s.stampData?.svg ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div dangerouslySetInnerHTML={{ __html: s.stampData.svg }} />
                  </div>
                ) : (
                  <span className={`text-[11px] ${s.status === 'pending' ? 'text-gray-300' : s.status === '반려' ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                    {s.status === 'pending' ? '미결' : s.status === '반려' ? '반려' : ''}
                  </span>
                )}
              </td>
            ))}
          </tr>
          {hasDecision && (
            <tr>
              {steps.map((s, i) => (
                <td key={i} className='border-2 border-gray-700 text-center px-1 py-[5px] text-[11px] text-gray-500'>
                  {s.decidedAt ? formatDateShort(s.decidedAt) : ''}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 공통 셀 스타일
// ────────────────────────────────────────────────────────────────────────────
const FTH = 'border border-gray-800 bg-[#f0f0f0] text-[12px] font-semibold text-gray-700 px-3 py-2 text-center whitespace-nowrap';
const FTD = 'border border-gray-800 text-[13px] text-gray-800 px-3 py-2';
const RoDate = ({ val }: { val: string }) => (
  <span className='text-[13px] whitespace-nowrap'>{val ? formatDateShort(val) : '-'}</span>
);
const RoTime = ({ val }: { val: string }) => (
  <span className='text-[13px] whitespace-nowrap'>{val || '-'}</span>
);

// ────────────────────────────────────────────────────────────────────────────
// 양식 1: 휴가신청서
// ────────────────────────────────────────────────────────────────────────────
function VacationFormRows({ fd, setFd, user, deptLabel, readOnly, balance, policy, requestedDays, workSchedule }: any) {
  const isHalfDay = fd('vacationType') === '반차(오전)' || fd('vacationType') === '반차(오후)';
  const vacDays = () => {
    if (!fd('startDate')) return 0;
    if (isHalfDay) return 0.5;
    if (!fd('endDate')) return 1;
    return dayjs(fd('endDate')).diff(dayjs(fd('startDate')), 'day') + 1;
  };
  const VAC_TYPES = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '기타'];
  // 반차 기본 시간대 (관리자 설정 우선, 없으면 표준값)
  const HALFDAY_HOURS: Record<string, { start: string; end: string }> = {
    '반차(오전)': {
      start: workSchedule?.halfDayMorningStart ?? '09:00',
      end: workSchedule?.halfDayMorningEnd ?? '13:00',
    },
    '반차(오후)': {
      start: workSchedule?.halfDayAfternoonStart ?? '14:00',
      end: workSchedule?.halfDayAfternoonEnd ?? '18:00',
    },
  };
  const handleVacationTypeChange = (v: string) => {
    if (readOnly) return;
    setFd('vacationType', v);
    const preset = HALFDAY_HOURS[v];
    if (preset) {
      // 반차 선택 시 시작/종료 시간 자동 채움 (이미 입력된 값도 표준값으로 맞춤)
      setFd('startTime', preset.start);
      setFd('endTime', preset.end);
    } else {
      // 반차가 아니면 시간 필드 초기화
      setFd('startTime', '');
      setFd('endTime', '');
    }
  };
  const ro = readOnly ? { readOnly: true } : {};
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>종류</td>
        <td className={FTD} colSpan={3}>
          <div className='flex flex-wrap gap-5'>
            {VAC_TYPES.map((v) => (
              <label key={v} className='flex items-center gap-1 cursor-pointer text-[13px]'>
                <input type='radio' name='vacationType' value={v}
                  checked={(fd('vacationType') || '연차') === v}
                  onChange={() => handleVacationTypeChange(v)}
                  readOnly={readOnly}
                  className='accent-gray-700' />
                {v}
              </label>
            ))}
          </div>
        </td>
      </tr>
      <tr>
        <td className={FTH}>사유</td>
        <td className={FTD} colSpan={3} style={{ height: '100px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={4} value={fd('reason') || ''} onChange={(e) => setFd('reason', e.target.value)}
            placeholder='휴가 사유를 입력하세요' readOnly={readOnly}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300 resize-none' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>기간</td>
        <td className={FTD} colSpan={3}>
          <div className='flex items-center gap-2 flex-wrap'>
            {readOnly
              ? <RoDate val={fd('startDate')} />
              : <input type='date' value={fd('startDate') || ''} onChange={(e) => setFd('startDate', e.target.value)}
                  className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
            }
            {!isHalfDay && (
              <>
                <span className='text-gray-500'>~</span>
                {readOnly
                  ? <RoDate val={fd('endDate')} />
                  : <input type='date' value={fd('endDate') || ''} min={fd('startDate')} onChange={(e) => setFd('endDate', e.target.value)}
                      className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                }
              </>
            )}
            <span className='text-[13px] text-gray-600'>({vacDays()}일간)</span>
            {isHalfDay && (
              <div className='flex items-center gap-1 ml-1'>
                {readOnly
                  ? <RoTime val={fd('startTime')} />
                  : <input type='time' value={fd('startTime') || ''} onChange={(e) => setFd('startTime', e.target.value)}
                      className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                }
                <span className='text-gray-500'>~</span>
                {readOnly
                  ? <RoTime val={fd('endTime')} />
                  : <input type='time' value={fd('endTime') || ''} onChange={(e) => setFd('endTime', e.target.value)}
                      className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                }
              </div>
            )}
          </div>
        </td>
      </tr>
      <tr>
        <td className={FTH}>신청일수</td>
        <td className={FTD}>{vacDays() || '-'}일</td>
        <td className={FTH}>잔여연차</td>
        <td className={FTD}>
          {balance?.notApplicable
            ? '해당 없음'
            : balance
              ? (() => {
                  const rem = balance.remaining ?? 0;
                  const deduct = policy?.deductFromAnnualLeave ? (requestedDays || 0) : 0;
                  const after = Math.max(0, rem - deduct);
                  const over = deduct > rem;
                  return (
                    <span className={over ? 'text-red-600 font-semibold' : ''}>
                      {deduct > 0
                        ? `${rem}일 → ${after}일 (차감 ${deduct}일)`
                        : `${rem}일`}
                      {over && ' — 초과!'}
                    </span>
                  );
                })()
              : '조회 중…'}
        </td>
      </tr>
      {policy && !policy.deductFromAnnualLeave && (
        <tr>
          <td className={FTH}>정책 안내</td>
          <td className={FTD} colSpan={3}>
            <div className='text-[12px] text-gray-600 space-y-0.5'>
              {policy.maxDaysPerRequest > 0 && (
                <div>• 1건당 최대 <b>{policy.maxDaysPerRequest}일</b></div>
              )}
              {policy.annualCap > 0 && (
                <div>• 연간 누적 상한 <b>{policy.annualCap}일</b></div>
              )}
              {policy.evidenceTiming === 'pre' && (
                <div className='text-orange-600'>• 증빙 서류 <b>사전 첨부 필수</b> (신청 시)</div>
              )}
              {policy.evidenceTiming === 'post' && (
                <div className='text-blue-600'>
                  • 증빙은 <b>휴가 종료 후 {policy.postEvidenceDays}일 이내</b>에 업로드하세요. 지금은 비워두고 제출 가능합니다.
                </div>
              )}
              {policy.description && <div className='text-gray-500 mt-1'>{policy.description}</div>}
            </div>
          </td>
        </tr>
      )}
      <tr>
        <td className={FTH}>업무대행</td>
        <td className={FTD} colSpan={3} style={{ height: '48px' }}>
          <input type='text' value={fd('delegate') || ''} onChange={(e) => setFd('delegate', e.target.value)}
            placeholder='업무 대행자 성명 (선택)' {...ro}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>비상연락</td>
        <td className={FTD} colSpan={3} style={{ height: '48px' }}>
          <input type='text' value={fd('emergencyPhone') || ''} onChange={(e) => setFd('emergencyPhone', e.target.value)}
            placeholder='비상 연락처 (선택)' {...ro}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>비고</td>
        <td className={FTD} colSpan={3} style={{ height: '100px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={4} value={fd('note') || ''} onChange={(e) => setFd('note', e.target.value)}
            placeholder='기타 사항 (선택)' readOnly={readOnly}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300 resize-none' />
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 2: 연장근무신청서
// ────────────────────────────────────────────────────────────────────────────
function OvertimeFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  const calcOt = () => {
    if (!fd('startTime') || !fd('endTime')) return '';
    const [sh, sm] = fd('startTime').split(':').map(Number);
    const [eh, em] = fd('endTime').split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return '-';
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  };
  const ro = readOnly ? { readOnly: true } : {};
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>연장근무일</td>
        <td className={FTD} colSpan={3}>
          {readOnly
            ? <RoDate val={fd('overtimeDate')} />
            : <input type='date' value={fd('overtimeDate') || ''} onChange={(e) => setFd('overtimeDate', e.target.value)}
                className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
          }
        </td>
      </tr>
      <tr>
        <td className={FTH}>근무시간</td>
        <td className={FTD} colSpan={3}>
          {readOnly
            ? <span className='text-[13px]'>
                <RoTime val={fd('startTime')} />
                <span className='mx-2 text-gray-500'>~</span>
                <RoTime val={fd('endTime')} />
                {calcOt() && <span className='text-[13px] text-blue-700 font-semibold ml-2'>({calcOt()})</span>}
              </span>
            : <div className='flex items-center gap-2'>
                <input type='time' value={fd('startTime') || ''} onChange={(e) => setFd('startTime', e.target.value)}
                  className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                <span className='text-gray-500'>~</span>
                <input type='time' value={fd('endTime') || ''} onChange={(e) => setFd('endTime', e.target.value)}
                  className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                {calcOt() && <span className='text-[13px] text-blue-700 font-semibold ml-2'>({calcOt()})</span>}
              </div>
          }
        </td>
      </tr>
      <tr>
        <td className={FTH}>업무내용</td>
        <td className={FTD} colSpan={3} style={{ height: '180px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={7} value={fd('reason') || ''} onChange={(e) => setFd('reason', e.target.value)}
            placeholder='연장근무 업무 내용 및 사유' readOnly={readOnly}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300 resize-none' />
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 3: 결근계
// ────────────────────────────────────────────────────────────────────────────
function AbsenceFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  const ro = readOnly ? { readOnly: true } : {};
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>결근일</td>
        <td className={FTD} colSpan={3}>
          {readOnly
            ? <RoDate val={fd('absenceDate')} />
            : <input type='date' value={fd('absenceDate') || ''} onChange={(e) => setFd('absenceDate', e.target.value)}
                className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
          }
        </td>
      </tr>
      <tr>
        <td className={FTH}>결근사유</td>
        <td className={FTD} colSpan={3} style={{ height: '140px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={5} value={fd('absenceReason') || ''} onChange={(e) => setFd('absenceReason', e.target.value)}
            placeholder='결근 사유를 입력하세요' readOnly={readOnly}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300 resize-none' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>증빙서류</td>
        <td className={FTD} colSpan={3} style={{ height: '100px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={3} value={fd('evidence') || ''} onChange={(e) => setFd('evidence', e.target.value)}
            placeholder='첨부 파일명 또는 종류 (없음 입력 가능)' readOnly={readOnly}
            className='w-full outline-none bg-transparent text-[13px] placeholder-gray-300 resize-none' />
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 4: 지출결의서
// ────────────────────────────────────────────────────────────────────────────
const EXPENSE_ROW_COUNT = 6;
const EMPTY_EXPENSE_ROW = () => ({ date: '', name: '', unit: '', qty: 0, amount: 0 });

function ExpenseFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  const raw: any[] = fd('items') || [];
  const items: any[] = Array.from({ length: EXPENSE_ROW_COUNT }, (_, i) => raw[i] ?? EMPTY_EXPENSE_ROW());
  const total = items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
  const setItem = (idx: number, key: string, val: any) => {
    const next = items.map((it: any, i: number) => i === idx ? { ...it, [key]: val } : it);
    setFd('items', next);
  };
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH} colSpan={4} style={{ textAlign: 'left', padding: '6px 12px', background: '#e8e8e8', fontWeight: 700 }}>지출 내역</td>
      </tr>
      <tr>
        <td className={FTH}>지출일</td>
        <td className={FTH}>품명/내역</td>
        <td className={FTH}>수량</td>
        <td className={FTH}>금액(원)</td>
      </tr>
      {items.map((item: any, i: number) => (
        <tr key={i}>
          <td className={FTD}>
            {readOnly
              ? <RoDate val={item.date} />
              : <input type='date' value={item.date} onChange={(e) => setItem(i, 'date', e.target.value)}
                  className='w-full text-[13px] border-0 focus:outline-none bg-transparent' />
            }
          </td>
          <td className={FTD}>
            <input type='text' value={item.name} readOnly={readOnly} onChange={(e) => setItem(i, 'name', e.target.value)}
              placeholder='품명' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
          </td>
          <td className={FTD}>
            <div className='flex items-center gap-1'>
              <input
                type='number'
                min={0}
                value={Number(item.qty) > 0 ? item.qty : ''}
                readOnly={readOnly}
                onChange={(e) => setItem(i, 'qty', e.target.value === '' ? 0 : Number(e.target.value))}
                placeholder='0'
                className='w-12 text-[13px] outline-none bg-transparent text-center placeholder-gray-300'
              />
              <input type='text' value={item.unit} readOnly={readOnly} onChange={(e) => setItem(i, 'unit', e.target.value)}
                placeholder='개' className='w-10 text-[13px] outline-none bg-transparent placeholder-gray-300' />
            </div>
          </td>
          <td className={FTD + ' text-right'}>
            <input
              type='number'
              min={0}
              value={Number(item.amount) > 0 ? item.amount : ''}
              readOnly={readOnly}
              onChange={(e) => setItem(i, 'amount', e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder='0'
              className='w-full text-[13px] outline-none bg-transparent text-right placeholder-gray-300'
            />
          </td>
        </tr>
      ))}
      <tr>
        <td className={FTH} colSpan={3} style={{ textAlign: 'right' }}>합계</td>
        <td className={FTD + ' text-right font-bold text-blue-700'}>{total.toLocaleString()}원</td>
      </tr>
      <tr>
        <td className={FTH}>사용목적</td>
        <td className={FTD} colSpan={3} style={{ height: '120px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={5} value={fd('purpose') || ''} readOnly={readOnly} onChange={(e) => setFd('purpose', e.target.value)}
            placeholder='사용 목적을 입력하세요'
            className='w-full text-[13px] outline-none placeholder-gray-300 resize-none bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>지급방법</td>
        <td className={FTD} colSpan={3}>
          <select value={fd('payMethod') || '계좌이체'} disabled={readOnly} onChange={(e) => setFd('payMethod', e.target.value)}
            className='text-[13px] border border-gray-300 rounded px-2 py-[3px] bg-white focus:outline-none'>
            {['계좌이체', '법인카드', '현금', '기타'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 5: 업무추진비신청서
// ────────────────────────────────────────────────────────────────────────────
function BusinessExpenseFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  const CATEGORIES = ['식대', '교통비', '접대비', '회의비', '기타'];
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>신청금액</td>
        <td className={FTD} colSpan={3}>
          <div className='flex items-center gap-2'>
            <input type='number' value={fd('amount') || ''} readOnly={readOnly} onChange={(e) => setFd('amount', e.target.value)}
              placeholder='0' className='text-[13px] border border-gray-300 rounded px-2 py-1 w-36 focus:outline-none' />
            <span className='text-[13px] text-gray-500'>원</span>
            {fd('amount') && <span className='text-[13px] text-blue-600 font-semibold'>₩{Number(fd('amount')).toLocaleString()}</span>}
          </div>
        </td>
      </tr>
      <tr>
        <td className={FTH}>사용예정일</td>
        <td className={FTD} colSpan={3}>
          {readOnly
            ? <RoDate val={fd('plannedDate')} />
            : <input type='date' value={fd('plannedDate') || ''} onChange={(e) => setFd('plannedDate', e.target.value)}
                className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
          }
        </td>
      </tr>
      <tr>
        <td className={FTH}>항목</td>
        <td className={FTD} colSpan={3}>
          <div className='flex flex-wrap gap-4'>
            {CATEGORIES.map((c) => (
              <label key={c} className='flex items-center gap-1 text-[13px] cursor-pointer'>
                <input type='checkbox' checked={(fd('categories') || []).includes(c)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const cur = fd('categories') || [];
                    setFd('categories', e.target.checked ? [...cur, c] : cur.filter((x: string) => x !== c));
                  }} />
                {c}
              </label>
            ))}
          </div>
        </td>
      </tr>
      <tr>
        <td className={FTH}>사용목적</td>
        <td className={FTD} colSpan={3} style={{ height: '160px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={6} value={fd('purpose') || ''} readOnly={readOnly} onChange={(e) => setFd('purpose', e.target.value)}
            placeholder='사용 목적을 입력하세요'
            className='w-full text-[13px] outline-none placeholder-gray-300 resize-none bg-transparent' />
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 6: 업무기안서
// ────────────────────────────────────────────────────────────────────────────
function GeneralFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>수신</td>
        <td className={FTD} colSpan={3} style={{ height: '48px' }}>
          <input type='text' value={fd('receiver') || ''} readOnly={readOnly} onChange={(e) => setFd('receiver', e.target.value)}
            placeholder='수신처' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>경유</td>
        <td className={FTD} colSpan={3} style={{ height: '48px' }}>
          <input type='text' value={fd('via') || ''} readOnly={readOnly} onChange={(e) => setFd('via', e.target.value)}
            placeholder='경유 (없을 경우 생략)' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>본문</td>
        <td className={FTD} colSpan={3} style={{ height: '280px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={11} value={fd('content') || ''} readOnly={readOnly} onChange={(e) => setFd('content', e.target.value)}
            placeholder='기안 내용을 입력하세요'
            className='w-full text-[13px] outline-none placeholder-gray-300 resize-none bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>붙임</td>
        <td className={FTD} colSpan={3} style={{ height: '80px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={3} value={fd('attachNote') || ''} readOnly={readOnly} onChange={(e) => setFd('attachNote', e.target.value)}
            placeholder='붙임 파일 목록 (없을 경우 "없음")'
            className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent resize-none' />
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 7: 업무협조 요청서
// ────────────────────────────────────────────────────────────────────────────
function CooperationFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '80px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>수신부서</td>
        <td className={FTD} colSpan={3}>
          <input type='text' value={fd('targetDept') || ''} readOnly={readOnly} onChange={(e) => setFd('targetDept', e.target.value)}
            placeholder='요청 대상 부서' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>요청제목</td>
        <td className={FTD} colSpan={3}>
          <input type='text' value={fd('requestTitle') || ''} readOnly={readOnly} onChange={(e) => setFd('requestTitle', e.target.value)}
            placeholder='요청 제목' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>요청내용</td>
        <td className={FTD} colSpan={3} style={{ height: '200px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea rows={8} value={fd('requestContent') || ''} readOnly={readOnly} onChange={(e) => setFd('requestContent', e.target.value)}
            placeholder='협조 요청 내용을 상세히 입력하세요'
            className='w-full text-[13px] outline-none placeholder-gray-300 resize-none bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>완료요청일</td>
        <td className={FTD} colSpan={3}>
          {readOnly
            ? <RoDate val={fd('dueDate')} />
            : <input type='date' value={fd('dueDate') || ''} onChange={(e) => setFd('dueDate', e.target.value)}
                className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
          }
        </td>
      </tr>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 양식 8: 국내출장신청서
// ────────────────────────────────────────────────────────────────────────────
function TripFormRows({ fd, setFd, user, deptLabel, readOnly }: any) {
  const costs = fd('costs') || { transport: 0, accommodation: 0, meal: 0, other: 0 };
  const total = Object.values(costs).reduce((s: number, v: any) => s + Number(v || 0), 0);
  const COST_LABELS: Record<string, string> = { transport: '교통비', accommodation: '숙박비', meal: '식비', other: '기타' };
  return (
    <>
      <tr>
        <td className={FTH} style={{ width: '100px' }}>소속</td>
        <td className={FTD} colSpan={3}>{deptLabel}</td>
      </tr>
      <tr>
        <td className={FTH}>성명</td>
        <td className={FTD}>{user?.name}</td>
        <td className={FTH} style={{ width: '80px' }}>직위</td>
        <td className={FTD}>{user?.position || '-'}</td>
      </tr>
      <tr>
        <td className={FTH}>출장지</td>
        <td className={FTD} colSpan={3}>
          <input type='text' value={fd('destination') || ''} readOnly={readOnly} onChange={(e) => setFd('destination', e.target.value)}
            placeholder='출장지 (시/도 또는 상세주소)' className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent' />
        </td>
      </tr>
      <tr>
        <td className={FTH}>출장 기간</td>
        <td className={FTD} colSpan={3}>
          <div className='flex items-center gap-2'>
            {readOnly
              ? <><RoDate val={fd('startDate')} /><span className='text-gray-500 mx-1'>~</span><RoDate val={fd('endDate')} /></>
              : <>
                  <input type='date' value={fd('startDate') || ''} onChange={(e) => setFd('startDate', e.target.value)}
                    className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                  <span className='text-gray-500'>~</span>
                  <input type='date' value={fd('endDate') || ''} min={fd('startDate')} onChange={(e) => setFd('endDate', e.target.value)}
                    className='text-[13px] border border-gray-300 rounded px-1 py-[2px] focus:outline-none' />
                </>
            }
          </div>
        </td>
      </tr>
      <tr>
        <td className={FTH}>출장 목적</td>
        <td className={FTD} colSpan={3} style={{ height: '160px', verticalAlign: 'top', paddingTop: '10px' }}>
          <textarea
            value={fd('purpose') || ''}
            readOnly={readOnly}
            onChange={(e) => setFd('purpose', e.target.value)}
            placeholder='출장 목적을 입력하세요'
            className='w-full h-full text-[13px] outline-none placeholder-gray-300 resize-none bg-transparent text-left'
            style={{ minHeight: '150px' }}
          />
        </td>
      </tr>
      <tr>
        <td className={FTH} colSpan={4} style={{ textAlign: 'left', padding: '8px 14px', background: '#e8e8e8', fontWeight: 700, fontSize: '13px' }}>예상 경비</td>
      </tr>
      <tr>
        {(['transport', 'accommodation', 'meal', 'other'] as const).map((k) => (
          <td key={k} className={FTH}>{COST_LABELS[k]}</td>
        ))}
      </tr>
      <tr>
        {(['transport', 'accommodation', 'meal', 'other'] as const).map((k) => (
          <td key={k} className={FTD + ' text-right'} style={{ height: '48px' }}>
            {readOnly
              ? <span className='text-[13px]'>{Number(costs[k] || 0).toLocaleString()}</span>
              : <input type='number' value={costs[k] || ''} onChange={(e) => setFd('costs', { ...costs, [k]: e.target.value })}
                  placeholder='0' className='w-full text-[13px] outline-none bg-transparent text-right' />
            }
          </td>
        ))}
      </tr>
      <tr>
        <td className={FTH} colSpan={3} style={{ textAlign: 'right', paddingRight: '16px' }}>합 계</td>
        <td className={FTD + ' text-right font-bold text-blue-700'}>{total.toLocaleString()}원</td>
      </tr>
    </>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// Document View Modal
// ────────────────────────────────────────────────────────────────────────────
function DocumentViewModal({
  doc, canDecide, onDecide, onClose, onEvidenceUploaded,
}: {
  doc: ApprovalDoc;
  canDecide: boolean;
  onDecide?: (id: string, decision: '승인' | '반려', comment: string) => Promise<void>;
  onClose: () => void;
  onEvidenceUploaded?: () => void;
}) {
  const { user } = useAuthStore();
  const [comment, setComment] = useState(doc.comment || '');
  const [isDeciding, setIsDeciding] = useState(false);
  const [docZoom, setDocZoom] = useState(1);
  const [enrichedChain, setEnrichedChain] = useState<ChainStep[]>(doc.approvalChain ?? []);
  const [policyForDoc, setPolicyForDoc] = useState<LeavePolicy | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // 휴가신청서일 때 해당 정책 로드 (사후 증빙 UI 표시용)
  useEffect(() => {
    if (doc.formType !== '휴가신청서') return;
    const vt = doc.formData?.vacationType;
    const cat = resolveLeaveCategory(vt);
    if (!cat) return;
    api.get('/api/leave-policies')
      .then((r) => setPolicyForDoc((r.data as LeavePolicy[]).find((p) => p.category === cat) ?? null))
      .catch(() => {});
  }, [doc]);

  const isMyDoc = doc.applicantId === user?.id;
  const isApproved = doc.status === '승인';
  const existingAttachments: string[] =
    (doc.formData?.attachments as string[] | undefined)?.length
      ? (doc.formData!.attachments as string[])
      : (doc.attachments ?? []);
  const needsPostEvidence =
    isMyDoc &&
    isApproved &&
    policyForDoc?.evidenceTiming === 'post' &&
    existingAttachments.length === 0;
  const deadline = doc.evidenceDeadline ? dayjs(doc.evidenceDeadline) : null;
  const daysUntilDeadline = deadline
    ? deadline.startOf('day').diff(dayjs().startOf('day'), 'day')
    : null;
  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;

  const handleEvidenceUpload = async () => {
    if (evidenceFiles.length === 0) return;
    setIsUploadingEvidence(true);
    try {
      const urls: string[] = [];
      for (const f of evidenceFiles) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await api.post('/api/approval/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        urls.push(res.data.url);
      }
      await api.patch(`/api/approval/${doc._id}/evidence`, { urls });
      setEvidenceFiles([]);
      alert('증빙 서류가 업로드되었습니다.');
      onEvidenceUploaded?.();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || '업로드에 실패했습니다.');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  useEffect(() => {
    if (!doc.approvalChain?.length) return;
    api.get('/api/approval/approvers').then((res) => {
      const posMap = new Map((res.data as Approver[]).map((a: Approver) => [a.id, a]));
      setEnrichedChain(doc.approvalChain.map((s) => ({
        ...s,
        approverPosition: (() => { const a = posMap.get(s.approverId); return a ? (a.position || (a.role === 'head-admin' ? '대표' : '사원')) : (s.approverPosition || '결재자'); })(),
      })));
    }).catch(() => {});
  }, [doc]);

  useEffect(() => {
    const update = () => {
      if (!bgRef.current) return;
      const w = bgRef.current.clientWidth - 32;
      setDocZoom(w < 794 ? w / 794 : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    if (bgRef.current) ro.observe(bgRef.current);
    return () => ro.disconnect();
  }, []);

  const ft = doc.formType ?? '업무기안서';
  const statusStyle = STATUS_STYLE[doc.status] ?? STATUS_STYLE['검토중'];
  const fd = (key: string) => doc.formData?.[key] ?? '';
  const noop = () => {};
  const docUser = { name: doc.applicantName, position: doc.applicantPosition };
  const docDeptLabel = doc.applicantDept || '-';

  const th = 'border border-gray-300 bg-[#f7f8fa] text-[11px] font-semibold text-gray-600 px-3 py-[7px] text-center whitespace-nowrap';
  const td = 'border border-gray-300 text-[13px] text-gray-800 px-3 py-[7px]';
  const createdAt = formatDateShort(doc.createdAt);

  const handleDecide = async (decision: '승인' | '반려') => {
    if (!onDecide) return;
    setIsDeciding(true);
    try { await onDecide(doc._id, decision, comment); }
    catch { alert('처리에 실패했습니다.'); }
    finally { setIsDeciding(false); }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto sm:py-4 sm:items-center'>
      <div id='print-area' className='w-full max-w-[900px] sm:mx-4 sm:rounded-md shadow-2xl overflow-hidden flex flex-col' style={{ maxHeight: '100dvh', minHeight: 0 }}>

        {/* 상단 툴바 — FormEditor와 동일한 스타일 */}
        <div className='no-print flex items-center justify-between bg-[#3d4049] px-4 py-0 shrink-0'>
          <div className='flex items-center gap-2 py-3'>
            <span className='text-[11px] font-semibold text-gray-300'>{ft}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>
          <div className='flex items-center gap-0.5'>
            <button
              onClick={() => window.print()}
              className='flex items-center gap-1 text-[11px] text-gray-400 hover:text-white hover:bg-white/10 px-3 py-3 transition'
            >
              <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z' />
              </svg>
              인쇄
            </button>
            <button
              onClick={onClose}
              className='flex items-center gap-1 text-[11px] text-gray-400 hover:text-white hover:bg-white/10 px-3 py-3 transition'
            >
              <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
              닫기
            </button>
          </div>
        </div>

        {/* 문서 본문 */}
        <div ref={bgRef} className='bg-[#f0f2f5] overflow-y-auto flex-1'>
          <div className='bg-white mx-auto my-5 rounded shadow-md' style={{ width: '794px', minHeight: '1123px', padding: '48px 56px', zoom: docZoom }}>

            {/* 문서 제목 + 결재란 */}
            <div className='flex items-start mb-8'>
              <div style={{ flex: 1 }} />
              <h2 className='text-[28px] font-bold tracking-[0.15em] text-gray-900 flex-shrink-0 pt-2'>
                {FORM_TITLE_DISPLAY[ft] ?? ft}
              </h2>
              <div style={{ flex: 1 }} className='flex justify-end'>
                {enrichedChain.length > 0
                  ? <MultiStampBox steps={enrichedChain} />
                  : <StampBox
                      approverPosition={doc.approverPosition || '대표'}
                      stampSvg={doc.stampData?.svg}
                      approvedAt={doc.stampData?.approvedAt ? formatDateShort(doc.stampData.approvedAt) : null}
                    />
                }
              </div>
            </div>

            {/* 양식별 본문 (전통 A4 서식) — readOnly */}
            <table className='w-full border-collapse text-[13px] mb-4'>
              <tbody>
                <tr>
                  <td className='border border-gray-800 bg-[#f0f0f0] text-[12px] font-semibold text-gray-700 px-3 py-2 text-center whitespace-nowrap' style={{ width: '80px' }}>제목</td>
                  <td className='border border-gray-800 px-3 py-2 font-medium text-gray-800' colSpan={3}>{doc.title}</td>
                </tr>
                {ft === '휴가신청서' && <VacationFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '연장근무신청서' && <OvertimeFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '결근계' && <AbsenceFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '지출결의서' && <ExpenseFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '업무추진비신청서' && <BusinessExpenseFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '업무기안서' && <GeneralFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '업무협조 요청서' && <CooperationFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
                {ft === '국내출장신청서' && <TripFormRows fd={fd} setFd={noop} user={docUser} deptLabel={docDeptLabel} readOnly />}
              </tbody>
            </table>
            <div className='text-[12px] text-gray-500 flex justify-between mb-1'>
              <span>기안일: {createdAt}</span>
              <span>문서번호: {doc.docNumber || '-'}</span>
            </div>
            <div className='mt-6 text-center text-[13px] text-gray-700'>
              위와 같이 신청하오니 허락하여 주시기 바랍니다.
            </div>

            {/* 레거시 (구 버전 데이터) */}
            {!doc.formType && doc.reason && (
              <table className='w-full border-collapse text-[12px] mb-4'>
                <tbody>
                  <tr>
                    <td className={`${th} w-[72px] align-top py-3`}>내용</td>
                    <td className={td}><p className='whitespace-pre-wrap'>{doc.reason}</p></td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 증빙 첨부: 기존 첨부 + 사후 업로드 UI */}
            {(existingAttachments.length > 0 || needsPostEvidence) && (
              <div className='border border-gray-300 mt-4'>
                <div className='flex items-center justify-between bg-[#eef0f4] px-3 py-[5px] border-b border-gray-300'>
                  <span className='text-[11px] font-bold text-gray-600 tracking-widest'>증빙 첨부</span>
                  {needsPostEvidence && deadline && (
                    <span className={`text-[11px] font-semibold ${
                      isOverdue ? 'text-red-600' : daysUntilDeadline !== null && daysUntilDeadline <= 1 ? 'text-orange-600' : 'text-blue-600'
                    }`}>
                      {isOverdue
                        ? `기한 초과 (D+${Math.abs(daysUntilDeadline!)})`
                        : `제출 기한 ${formatDateShort(deadline.toDate())} (D-${daysUntilDeadline})`}
                    </span>
                  )}
                </div>
                <div className='px-4 py-3 bg-white space-y-2'>
                  {existingAttachments.length > 0 && (
                    <div className='space-y-1'>
                      {existingAttachments.map((url, i) => (
                        <a key={i} href={url} target='_blank' rel='noopener noreferrer'
                          download={url.startsWith('data:') ? `evidence-${i + 1}` : undefined}
                          className='block text-[12px] text-blue-600 hover:underline truncate'>
                          {url.startsWith('data:') ? `증빙 파일 #${i + 1}` : url.split('/').pop()}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 사후 증빙 업로드 (본인 + 승인됨 + post 정책 + 아직 증빙 없음) */}
                  {needsPostEvidence && (
                    <div className='no-print border-t border-dashed border-gray-200 pt-3'>
                      <p className='text-[12px] text-gray-600 mb-2'>
                        이 문서는 <b>사후 증빙 제출</b> 대상입니다.
                        {deadline && ` ${formatDateShort(deadline.toDate())}까지`} 진단서·청첩장 등 증빙을 업로드하세요.
                      </p>
                      <input
                        ref={evidenceRef}
                        type='file'
                        multiple
                        accept='image/*,application/pdf'
                        className='hidden'
                        onChange={(e) => {
                          if (e.target.files) {
                            setEvidenceFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                          }
                        }}
                      />
                      <div className='flex items-center gap-2 flex-wrap'>
                        <button
                          type='button'
                          onClick={() => evidenceRef.current?.click()}
                          className='text-[11px] px-2.5 py-[4px] border border-gray-400 rounded bg-white hover:bg-gray-50 text-gray-700 font-medium'
                        >
                          파일 선택
                        </button>
                        <button
                          type='button'
                          disabled={evidenceFiles.length === 0 || isUploadingEvidence}
                          onClick={handleEvidenceUpload}
                          className={`text-[11px] px-3 py-[4px] rounded font-semibold ${
                            evidenceFiles.length > 0 && !isUploadingEvidence
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isUploadingEvidence ? '업로드 중…' : `증빙 제출 (${evidenceFiles.length})`}
                        </button>
                      </div>
                      {evidenceFiles.length > 0 && (
                        <div className='mt-2 space-y-1'>
                          {evidenceFiles.map((f, i) => (
                            <div key={i} className='flex items-center gap-2 text-[11px] text-gray-600'>
                              <span className='text-blue-600'>○</span>
                              <span className='truncate flex-1'>{f.name} <span className='text-gray-400'>({(f.size / 1024).toFixed(1)} KB)</span></span>
                              <button
                                type='button'
                                onClick={() => setEvidenceFiles((prev) => prev.filter((_, j) => j !== i))}
                                className='text-gray-300 hover:text-red-500'
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 신청인 섹션 */}
            <div className='mt-8 border-t border-gray-200 pt-6'>
              <p className='text-[13px] text-gray-700 text-center'>위와 같이 신청합니다.</p>
              <div className='flex items-center justify-end gap-3 mt-6'>
                <span className='text-[14px] font-semibold text-gray-800'>신청인: {doc.applicantName}</span>
                <div style={{ width: '72px', height: '72px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {doc.applicantStampData?.svg
                    ? <div dangerouslySetInnerHTML={{ __html: doc.applicantStampData.svg }} />
                    : <div dangerouslySetInnerHTML={{ __html: generateStampSvg(doc.applicantName, doc.applicantPosition, '#1d4ed8') }} style={{ opacity: 0.25 }} />
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 반려/결재 의견 표시 (인쇄 제외) */}
        {!canDecide && doc.comment && doc.status !== '검토중' && (
          <div className='no-print bg-white px-4 sm:px-8 py-4 border-t border-gray-200 shrink-0'>
            <div className={`flex items-start gap-3 p-3 rounded-md border ${doc.status === '반려' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <span className='text-lg shrink-0'>{doc.status === '반려' ? '🚫' : '✅'}</span>
              <div>
                <p className={`text-xs font-semibold mb-0.5 ${doc.status === '반려' ? 'text-red-600' : 'text-green-700'}`}>
                  {doc.status === '반려' ? '반려 사유' : '결재 의견'}
                </p>
                <p className='text-sm text-gray-700'>{doc.comment}</p>
              </div>
            </div>
          </div>
        )}

        {/* 결재 처리 영역 */}
        {canDecide && doc.status === '검토중' && (
          <div className='no-print bg-white px-4 sm:px-8 pb-7 pt-4 border-t border-gray-200 space-y-3 shrink-0'>
            <div>
              <label className='block text-xs font-semibold text-gray-500 mb-1.5'>
                결재 의견 <span className='text-gray-400 font-normal'>(선택)</span>
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder='승인 또는 반려 사유를 입력하세요'
                className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => handleDecide('반려')}
                disabled={isDeciding}
                className='flex-1 py-2.5 rounded-md border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 transition'
              >
                반려
              </button>
              <button
                onClick={() => handleDecide('승인')}
                disabled={isDeciding}
                className='flex-1 py-2.5 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition shadow-sm'
              >
                승인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chain Settings Modal (결재 체인 설정 — 어드민 전용)
// ────────────────────────────────────────────────────────────────────────────
function ChainSettingsModal({ onClose }: { onClose: () => void }) {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [chain, setChain] = useState<Array<{ approverId: string; approverName: string; approverPosition: string; order: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/approval/approvers'),
      api.get('/api/approval/chain-settings'),
    ]).then(([apRes, chainRes]) => {
      const approverMap = new Map((apRes.data as Approver[]).map((a) => [a.id, a]));
      setApprovers(apRes.data);
      setChain((chainRes.data as any[]).map((s, i) => {
        const a = approverMap.get(s.approverId);
        return {
          ...s,
          order: i,
          approverPosition: a ? (a.position || (a.role === 'head-admin' ? '대표' : '사원')) : (s.approverPosition || '결재자'),
        };
      }));
    }).catch(() => {});
  }, []);

  const addStep = (a: Approver) => {
    if (chain.find((s) => s.approverId === a.id)) return;
    setChain((prev) => [
      ...prev,
      {
        approverId: a.id,
        approverName: a.name,
        approverPosition: a.position || (a.role === 'head-admin' ? '대표' : '사원'),
        order: prev.length,
      },
    ]);
  };

  const removeStep = (idx: number) => {
    setChain((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setChain((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const moveDown = (idx: number) => {
    setChain((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/api/approval/chain-settings', { chain });
      alert('결재 체인이 저장되었습니다.');
      onClose();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const inChain = new Set(chain.map((s) => s.approverId));

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='bg-white rounded-md shadow-2xl w-[540px] max-h-[80vh] flex flex-col overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 className='text-base font-bold text-gray-900'>결재 체인 설정</h2>
            <p className='text-xs text-gray-400 mt-0.5'>결재자를 순서대로 추가하세요. 모든 결재자가 승인해야 최종 승인됩니다.</p>
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <div className='flex flex-1 overflow-hidden'>
          {/* 결재자 목록 */}
          <div className='w-48 border-r border-gray-100 p-3 overflow-y-auto'>
            <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2'>결재 가능 인원</p>
            {approvers.map((a) => (
              <button
                key={a.id}
                onClick={() => addStep(a)}
                disabled={inChain.has(a.id)}
                className='w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <div className='w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0'>
                  {a.name[0]}
                </div>
                <div className='min-w-0'>
                  <p className='font-semibold text-gray-800 truncate'>{a.name}</p>
                  <p className='text-gray-400 truncate'>{a.position || (a.role === 'head-admin' ? '대표' : '직원')}</p>
                </div>
              </button>
            ))}
          </div>

          {/* 현재 체인 */}
          <div className='flex-1 p-4 overflow-y-auto'>
            <p className='text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3'>결재 순서 ({chain.length}명)</p>
            {chain.length === 0 ? (
              <div className='text-center py-8 text-gray-400 text-xs'>
                <p>왼쪽에서 결재자를 추가하세요.</p>
                <p className='mt-1'>추가된 순서대로 결재가 진행됩니다.</p>
              </div>
            ) : (
              <div className='space-y-2'>
                {chain.map((s, i) => (
                  <div key={s.approverId} className='flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2.5'>
                    <span className='w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0'>
                      {i + 1}
                    </span>
                    <div className='flex-1 min-w-0'>
                      <p className='text-xs font-semibold text-gray-800'>{s.approverName}</p>
                      <p className='text-[11px] text-gray-400'>{s.approverPosition || '직급 미등록'}</p>
                    </div>
                    <div className='flex items-center gap-1'>
                      <button onClick={() => moveUp(i)} disabled={i === 0} className='w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30 text-sm'>
                        ↑
                      </button>
                      <button onClick={() => moveDown(i)} disabled={i === chain.length - 1} className='w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30 text-sm'>
                        ↓
                      </button>
                      <button onClick={() => removeStep(i)} className='w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-400 text-base leading-none'>
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className='px-6 py-4 border-t border-gray-100 flex gap-3'>
          <button onClick={onClose} className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition'>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className='flex-1 py-2.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm'
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
