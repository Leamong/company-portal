'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import dayjs from 'dayjs';

// ── Types ──────────────────────────────────────────────────
type ApprovalStatus = '검토중' | '승인' | '반려';
type ApprovalType = '휴가신청' | '지출결의' | '연장근무' | '기타';
type VacationType = '연차' | '반차(오전)' | '반차(오후)' | '병가' | '경조사' | '기타';

interface Approval {
  _id: string;
  type: ApprovalType;
  title: string;
  reason: string;
  applicantName: string;
  approverName: string;
  createdAt: string;
  status: ApprovalStatus;
  comment: string;
  amount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  vacationType?: string | null;
  overtimeDate?: string | null;
  overtimeStartTime?: string | null;
  overtimeEndTime?: string | null;
}

interface Approver {
  id: string;
  name: string;
  position: string;
  role: string;
}

// ── Constants ──────────────────────────────────────────────
const DEPT_LABELS: Record<string, string> = {
  marketing: '마케팅팀',
  design: '디자인팀',
  management: '경영팀',
};

const VACATION_TYPES: VacationType[] = [
  '연차', '반차(오전)', '반차(오후)', '병가', '경조사', '기타',
];

const DOC_FORM_LABEL: Record<ApprovalType, string> = {
  '휴가신청': '휴가 신청서',
  '지출결의': '지출 결의서',
  '연장근무': '연장근무 신청서',
  '기타': '업무기안',
};

const DOC_TITLE: Record<ApprovalType, string> = {
  '휴가신청': '휴  가  신  청  서',
  '지출결의': '지  출  결  의  서',
  '연장근무': '연  장  근  무  신  청  서',
  '기타': '기  안  서',
};

const TYPE_COLOR: Record<ApprovalType, { bg: string; text: string }> = {
  '휴가신청': { bg: 'bg-blue-100', text: 'text-blue-700' },
  '지출결의': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  '연장근무': { bg: 'bg-purple-100', text: 'text-purple-700' },
  '기타': { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const STATUS_BADGE: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  '검토중': { bg: 'bg-amber-100', text: 'text-amber-700', label: '진행중' },
  '승인': { bg: 'bg-green-100', text: 'text-green-700', label: '승인완료' },
  '반려': { bg: 'bg-red-100', text: 'text-red-600', label: '반려' },
};

// ── Helper ─────────────────────────────────────────────────
function calcVacDays(type: VacationType, start: string, end: string): number {
  if (!start) return 0;
  if (type === '반차(오전)' || type === '반차(오후)') return 0.5;
  if (!end) return 1;
  return dayjs(end).diff(dayjs(start), 'day') + 1;
}

// ── Main Page ─────────────────────────────────────────────
export default function ApprovalPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  const isApprover = isAdmin || user?.canApprove === true;

  if (isAdmin) return <AdminView />;
  if (isApprover) return <DelegatedApproverView />;
  return <EmployeeView />;
}

// ─────────────────────────────────────────────────────────
// Employee View
// ─────────────────────────────────────────────────────────
function EmployeeView() {
  const [tab, setTab] = useState<'상신함' | '완료'>('상신함');
  const [allMine, setAllMine] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewItem, setViewItem] = useState<Approval | null>(null);

  const items = tab === '상신함'
    ? allMine.filter((a) => a.status === '검토중')
    : allMine.filter((a) => a.status !== '검토중');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/approval/mine');
      setAllMine(res.data);
    } catch { /* noop */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCancel = async (id: string) => {
    if (!confirm('기안을 취소하시겠습니까?')) return;
    try { await api.delete(`/api/approval/${id}`); fetchItems(); }
    catch { alert('취소에 실패했습니다.'); }
  };

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>전자결재</h1>
          <p className='text-sm text-gray-500 mt-1'>결재 요청을 작성하고 처리 현황을 확인하세요</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
          기안 작성
        </button>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={['상신함', '완료']}
        active={tab}
        onChange={(t) => setTab(t as '상신함' | '완료')}
      />

      {/* Empty state */}
      {!isLoading && tab === '상신함' && items.length === 0 && (
        <EmptyState
          icon='📋'
          message='아직 작성한 기안이 없습니다'
          sub='기안 작성 버튼을 눌러 휴가 신청, 지출결의 등을 제출하세요.'
        />
      )}
      {!isLoading && tab === '완료' && items.length === 0 && (
        <EmptyState
          icon='📂'
          message='처리된 결재가 없습니다'
          sub='승인 또는 반려된 결재가 여기에 표시됩니다.'
        />
      )}

      {/* List */}
      <ApprovalCardList
        items={items}
        isLoading={isLoading}
        onView={setViewItem}
        renderAction={(item) =>
          item.status === '검토중' ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(item._id); }}
              className='text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition'
            >
              취소
            </button>
          ) : null
        }
      />

      {showForm && (
        <DocumentFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchItems(); }}
        />
      )}
      {viewItem && (
        <DocumentViewModal item={viewItem} canDecide={false} onClose={() => setViewItem(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Delegated Approver View
// ─────────────────────────────────────────────────────────
function DelegatedApproverView() {
  const [tab, setTab] = useState<'결재함' | '상신함' | '완료'>('결재함');
  const [items, setItems] = useState<Approval[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Approval | null>(null);
  const [viewItem, setViewItem] = useState<Approval | null>(null);

  const fetchItems = useCallback(async (t: '결재함' | '상신함' | '완료') => {
    setIsLoading(true);
    try {
      const ep = t === '결재함' ? '/api/approval/inbox' : t === '상신함' ? '/api/approval/mine' : '/api/approval/done';
      const [res, inbox] = await Promise.all([api.get(ep), api.get('/api/approval/inbox')]);
      setItems(res.data);
      setInboxCount(inbox.data.length);
    } catch { /* noop */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(tab); }, [tab, fetchItems]);

  const handleDecide = async (id: string, decision: '승인' | '반려', comment: string) => {
    await api.patch(`/api/approval/${id}/decide`, { status: decision, comment });
    setSelectedItem(null);
    fetchItems(tab);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('기안을 취소하시겠습니까?')) return;
    try { await api.delete(`/api/approval/${id}`); fetchItems(tab); }
    catch { alert('취소에 실패했습니다.'); }
  };

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>전자결재</h1>
          <p className='text-sm text-gray-500 mt-1'>
            {inboxCount > 0
              ? <span className='text-orange-600 font-medium'>{inboxCount}건의 결재가 대기 중입니다</span>
              : '대기 중인 결재가 없습니다'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
          기안 작성
        </button>
      </div>

      <TabBar
        tabs={['결재함', '상신함', '완료']}
        active={tab}
        onChange={(t) => setTab(t as '결재함' | '상신함' | '완료')}
        badge={{ '결재함': inboxCount }}
      />

      <ApprovalCardList
        items={items}
        isLoading={isLoading}
        highlightPending={tab === '결재함'}
        onView={(item) => {
          if (tab === '결재함' && item.status === '검토중') setSelectedItem(item);
          else setViewItem(item);
        }}
        renderAction={(item) => {
          if (tab === '결재함' && item.status === '검토중')
            return (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                className='text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium'
              >
                결재
              </button>
            );
          if (tab === '상신함' && item.status === '검토중')
            return (
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel(item._id); }}
                className='text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition'
              >
                취소
              </button>
            );
          return null;
        }}
      />

      {selectedItem && (
        <DocumentViewModal
          item={selectedItem}
          canDecide={true}
          onDecide={handleDecide}
          onClose={() => setSelectedItem(null)}
        />
      )}
      {viewItem && !selectedItem && (
        <DocumentViewModal item={viewItem} canDecide={false} onClose={() => setViewItem(null)} />
      )}
      {showForm && (
        <DocumentFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchItems(tab); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Admin View
// ─────────────────────────────────────────────────────────
function AdminView() {
  const [tab, setTab] = useState<'결재함' | '완료'>('결재함');
  const [items, setItems] = useState<Approval[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [doneToday, setDoneToday] = useState({ approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Approval | null>(null);
  const [viewItem, setViewItem] = useState<Approval | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchItems = useCallback(async (t: '결재함' | '완료') => {
    setIsLoading(true);
    setPage(1);
    try {
      const ep = t === '결재함' ? '/api/approval/inbox' : '/api/approval/done';
      const [res, inboxRes, doneRes] = await Promise.all([
        api.get(ep),
        api.get('/api/approval/inbox'),
        api.get('/api/approval/done'),
      ]);
      setItems(res.data);
      setInboxCount(inboxRes.data.length);
      const today = new Date().toDateString();
      const todayDone = (doneRes.data as Approval[]).filter(
        (a) => new Date(a.createdAt).toDateString() === today,
      );
      setDoneToday({
        approved: todayDone.filter((a) => a.status === '승인').length,
        rejected: todayDone.filter((a) => a.status === '반려').length,
      });
    } catch { /* noop */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(tab); }, [tab, fetchItems]);

  const handleDecide = async (id: string, decision: '승인' | '반려', comment: string) => {
    await api.patch(`/api/approval/${id}/decide`, { status: decision, comment });
    setSelectedItem(null);
    fetchItems(tab);
  };

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>전자결재</h1>
        <p className='text-sm text-gray-500 mt-1'>직원들의 결재 요청을 검토하고 승인하세요</p>
      </div>

      {/* Summary cards */}
      <div className='grid grid-cols-3 gap-4'>
        {[
          { label: '대기 중', value: inboxCount, color: inboxCount > 0 ? 'text-orange-500' : 'text-gray-800', icon: '⏳' },
          { label: '오늘 승인', value: doneToday.approved, color: 'text-green-600', icon: '✅' },
          { label: '오늘 반려', value: doneToday.rejected, color: 'text-red-500', icon: '❌' },
        ].map((s) => (
          <div key={s.label} className='bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3'>
            <span className='text-2xl'>{s.icon}</span>
            <div>
              <p className='text-xs text-gray-500'>{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}<span className='text-sm font-normal text-gray-400 ml-1'>건</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <TabBar
        tabs={['결재함', '완료']}
        active={tab}
        onChange={(t) => setTab(t as '결재함' | '완료')}
        badge={{ '결재함': inboxCount }}
      />

      {/* Table */}
      <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : items.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-center px-6'>
            <span className='text-4xl mb-3'>📭</span>
            <p className='text-sm font-semibold text-gray-700'>
              {tab === '결재함' ? '대기 중인 결재가 없습니다' : '처리된 결재가 없습니다'}
            </p>
            <p className='text-xs text-gray-400 mt-1'>모든 결재 요청을 처리했습니다.</p>
          </div>
        ) : (
          <>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-100 bg-gray-50/70'>
                  <th className='text-left px-5 py-3 text-xs font-semibold text-gray-500 w-28'>기안일</th>
                  <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-28'>결재양식</th>
                  <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500'>제목</th>
                  <th className='text-left px-4 py-3 text-xs font-semibold text-gray-500 w-20'>기안자</th>
                  <th className='text-center px-4 py-3 text-xs font-semibold text-gray-500 w-16'>첨부</th>
                  <th className='text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24'>결재상태</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {paged.map((item) => {
                  const typeColor = TYPE_COLOR[item.type];
                  const isPending = item.status === '검토중' && tab === '결재함';
                  return (
                    <tr
                      key={item._id}
                      onClick={() => isPending ? setSelectedItem(item) : setViewItem(item)}
                      className='hover:bg-blue-50/30 cursor-pointer transition-colors group'
                    >
                      <td className='px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap'>
                        {dayjs(item.createdAt).format('YYYY-MM-DD')}
                      </td>
                      <td className='px-4 py-3.5'>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor.bg} ${typeColor.text}`}>
                          {DOC_FORM_LABEL[item.type]}
                        </span>
                      </td>
                      <td className='px-4 py-3.5 max-w-xs'>
                        <span className='text-sm font-medium text-gray-800 truncate block group-hover:text-blue-700 transition-colors'>
                          {item.title}
                        </span>
                      </td>
                      <td className='px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap'>
                        {item.applicantName}
                      </td>
                      <td className='px-4 py-3.5 text-center'>
                        <svg className='w-3.5 h-3.5 text-gray-300 mx-auto' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
                        </svg>
                      </td>
                      <td className='px-4 py-3.5 text-center'>
                        <AdminStatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className='flex items-center justify-center gap-1 px-5 py-3.5 border-t border-gray-100'>
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className='p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 19l-7-7 7-7m8 14l-7-7 7-7' />
                </svg>
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className='p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`e-${idx}`} className='px-1 text-gray-400 text-sm'>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                        page === p
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className='p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                </svg>
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className='p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 5l7 7-7 7M5 5l7 7-7 7' />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {selectedItem && (
        <DocumentViewModal
          item={selectedItem}
          canDecide={true}
          onDecide={handleDecide}
          onClose={() => setSelectedItem(null)}
        />
      )}
      {viewItem && !selectedItem && (
        <DocumentViewModal item={viewItem} canDecide={false} onClose={() => setViewItem(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Admin Status Badge
// ─────────────────────────────────────────────────────────
function AdminStatusBadge({ status }: { status: ApprovalStatus }) {
  if (status === '검토중') {
    return (
      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100'>
        상신
      </span>
    );
  }
  if (status === '승인') {
    return (
      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-600 border border-green-100'>
        승인
      </span>
    );
  }
  return (
    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-500 border border-red-100'>
      반려
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Approval Card List (employee / delegated view)
// ─────────────────────────────────────────────────────────
function ApprovalCardList({
  items,
  isLoading,
  highlightPending = false,
  onView,
  renderAction,
}: {
  items: Approval[];
  isLoading: boolean;
  highlightPending?: boolean;
  onView?: (item: Approval) => void;
  renderAction?: (item: Approval) => React.ReactNode;
}) {
  if (isLoading) return (
    <div className='flex items-center justify-center py-20'>
      <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  if (items.length === 0) return null;

  return (
    <div className='space-y-2.5'>
      {items.map((item) => {
        const typeColor = TYPE_COLOR[item.type];
        const statusBadge = STATUS_BADGE[item.status];
        return (
          <div
            key={item._id}
            onClick={() => onView?.(item)}
            className={`bg-white rounded-xl border p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-sm
              ${highlightPending && item.status === '검토중' ? 'border-blue-200 bg-blue-50/20' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${typeColor.bg} ${typeColor.text}`}>
              {item.type}
            </span>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-gray-800 truncate'>{item.title}</p>
              <p className='text-xs text-gray-400 mt-0.5'>
                {item.applicantName} → {item.approverName} · {dayjs(item.createdAt).format('MM/DD HH:mm')}
                {item.startDate && item.endDate && ` · ${dayjs(item.startDate).format('MM/DD')}~${dayjs(item.endDate).format('MM/DD')}`}
                {item.amount != null && ` · ₩${item.amount.toLocaleString()}`}
              </p>
              {item.comment && (
                <p className='text-xs text-gray-500 mt-1 italic truncate'>의견: {item.comment}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              {renderAction?.(item)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Document Form Modal  — daouoffice 스타일 HR 문서 양식
// ─────────────────────────────────────────────────────────
function DocumentFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [type, setType] = useState<ApprovalType>('휴가신청');
  const [docTitle, setDocTitle] = useState('');
  const [reason, setReason] = useState('');
  const [approverId, setApproverId] = useState('');
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApproverPanel, setShowApproverPanel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // 휴가신청
  const [vacationType, setVacationType] = useState<VacationType>('연차');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vacStartTime, setVacStartTime] = useState('');
  const [vacEndTime, setVacEndTime] = useState('');
  const [vacNote, setVacNote] = useState('');

  // 연장근무
  const [overtimeDate, setOvertimeDate] = useState('');
  const [overtimeStartTime, setOvertimeStartTime] = useState('');
  const [overtimeEndTime, setOvertimeEndTime] = useState('');

  // 지출결의
  const [amount, setAmount] = useState('');

  const todayKr = dayjs().format('YYYY-MM-DD');
  const deptLabel = DEPT_LABELS[user?.department || ''] || user?.department || '-';
  const isHalfDay = vacationType === '반차(오전)' || vacationType === '반차(오후)';
  const vacDays = calcVacDays(vacationType, startDate, isHalfDay ? startDate : endDate);
  const docNo = `(주)주주주-${type === '휴가신청' ? '휴가' : type === '지출결의' ? '지출' : type === '연장근무' ? '연장' : '기안'}-${dayjs().format('YYYY')}-${String(Math.floor(Math.random() * 90000 + 10000)).padStart(5, '0')}`;
  const selectedApprover = approvers.find((a) => a.id === approverId);

  useEffect(() => {
    api.get('/api/approval/approvers')
      .then((res) => {
        setApprovers(res.data);
        if (res.data.length > 0) setApproverId(res.data[0].id);
      })
      .catch(() => {});
  }, []);

  const handleTypeChange = (t: ApprovalType) => {
    setType(t);
    setReason(''); setDocTitle('');
    setStartDate(''); setEndDate('');
    setVacStartTime(''); setVacEndTime(''); setVacNote('');
    setOvertimeDate(''); setOvertimeStartTime(''); setOvertimeEndTime('');
    setAmount('');
  };

  const generateTitle = () => {
    if (docTitle.trim()) return docTitle.trim();
    if (type === '휴가신청') return `${user?.name} - ${vacationType} 신청`;
    if (type === '연장근무') return `${user?.name} - 연장근무 신청`;
    if (type === '지출결의') return `${user?.name} - 지출결의`;
    return `${user?.name} - 기안`;
  };

  const validate = () => {
    if (type === '휴가신청') {
      if (!startDate) { alert('휴가일을 입력해주세요.'); return false; }
      if (!isHalfDay && !endDate) { alert('종료일을 입력해주세요.'); return false; }
      if (!isHalfDay && dayjs(endDate).isBefore(dayjs(startDate))) { alert('종료일은 시작일 이후여야 합니다.'); return false; }
    }
    if (type === '연장근무') {
      if (!overtimeDate) { alert('연장근무일을 입력해주세요.'); return false; }
      if (!overtimeStartTime || !overtimeEndTime) { alert('연장근무 시간을 입력해주세요.'); return false; }
      if (!reason.trim()) { alert('업무 내용을 입력해주세요.'); return false; }
    }
    if (type === '지출결의' && !amount) { alert('금액을 입력해주세요.'); return false; }
    if (type === '지출결의' && !reason.trim()) { alert('사용 목적을 입력해주세요.'); return false; }
    if (type === '기타' && !reason.trim()) { alert('기안 내용을 입력해주세요.'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/approval', {
        type,
        title: generateTitle(),
        reason: reason.trim() || (type === '휴가신청' ? (vacNote.trim() || vacationType) : ''),
        approverId: approverId || undefined,
        startDate: type === '휴가신청' ? startDate : undefined,
        endDate: type === '휴가신청' ? (isHalfDay ? startDate : endDate) : undefined,
        vacationType: type === '휴가신청' ? vacationType : undefined,
        amount: type === '지출결의' ? parseInt(amount) : undefined,
        overtimeDate: type === '연장근무' ? overtimeDate : undefined,
        overtimeStartTime: type === '연장근무' ? overtimeStartTime : (type === '휴가신청' && isHalfDay ? vacStartTime : undefined),
        overtimeEndTime: type === '연장근무' ? overtimeEndTime : (type === '휴가신청' && isHalfDay ? vacEndTime : undefined),
      });
      onSuccess();
    } catch { alert('기안 제출에 실패했습니다.'); }
    finally { setIsSubmitting(false); }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachedFiles((prev) => [...prev, ...Array.from(files)]);
  };

  // cell styles
  const th = 'border border-gray-300 bg-[#f7f8fa] text-[11px] font-semibold text-gray-600 px-3 py-[7px] text-center whitespace-nowrap';
  const td = 'border border-gray-300 text-[13px] text-gray-800 px-3 py-[7px]';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto py-4'>
      <div
        className='w-full max-w-3xl mx-4 rounded-xl shadow-2xl overflow-hidden flex flex-col'
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* ════ 상단 툴바 ════ */}
        <div className='flex items-center justify-between bg-[#3d4049] px-4 py-0 shrink-0'>
          {/* 왼쪽: 문서 종류 선택 */}
          <div className='flex items-center'>
            <span className='text-[11px] font-semibold text-gray-300 mr-3 py-3 select-none'>업무기안</span>
            <div className='flex h-full'>
              {(['휴가신청', '지출결의', '연장근무', '기타'] as ApprovalType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`text-[11px] px-3 py-3 font-medium border-b-2 transition-colors ${
                    type === t
                      ? 'text-white border-blue-400'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div className='flex items-center gap-0.5'>
            {/* 결재요청 */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className='flex flex-col items-center gap-0.5 px-3 py-2 text-white hover:bg-blue-600 rounded transition disabled:opacity-60 group'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
              <span className='text-[10px]'>{isSubmitting ? '제출중' : '결재요청'}</span>
            </button>
            {/* 일시저장 */}
            <button className='flex flex-col items-center gap-0.5 px-3 py-2 text-gray-300 hover:bg-white/10 rounded transition'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' />
              </svg>
              <span className='text-[10px]'>일시저장</span>
            </button>
            {/* 미리보기 */}
            <button className='flex flex-col items-center gap-0.5 px-3 py-2 text-gray-300 hover:bg-white/10 rounded transition'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
              </svg>
              <span className='text-[10px]'>미리보기</span>
            </button>
            {/* 취소 */}
            <button
              onClick={onClose}
              className='flex flex-col items-center gap-0.5 px-3 py-2 text-gray-300 hover:bg-white/10 rounded transition'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
              <span className='text-[10px]'>취소</span>
            </button>
            {/* 결재정보 */}
            <button
              onClick={() => setShowApproverPanel((v) => !v)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded transition ${
                showApproverPanel ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
              <span className='text-[10px]'>결재정보</span>
            </button>
          </div>
        </div>

        {/* 결재정보 패널 (토글) */}
        {showApproverPanel && approvers.length > 0 && (
          <div className='bg-[#f0f2f5] border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0'>
            <span className='text-xs font-semibold text-gray-600 whitespace-nowrap'>결재자</span>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className='flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
            >
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.position ? ` (${a.position})` : ''}{a.role === 'head-admin' ? ' — 대표' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ════ 문서 본문 (스크롤) ════ */}
        <div className='bg-[#f0f2f5] overflow-y-auto flex-1'>
          <div className='bg-white mx-auto my-5 rounded shadow-sm' style={{ width: '680px', maxWidth: '100%', padding: '32px 40px' }}>

            {/* ─ 문서 제목 ─ */}
            <h2 className='text-[22px] font-bold text-center mb-6 tracking-widest text-gray-900'>
              {DOC_TITLE[type]}
            </h2>

            {/* ─ 기안 기본 정보 + 결재란 ─ */}
            <div className='flex items-start gap-4 mb-4'>
              {/* 기본 정보 테이블 */}
              <table className='flex-1 border-collapse text-[12px]'>
                <tbody>
                  <tr>
                    <td className={`${th} w-[72px]`}>기&emsp;안&emsp;자</td>
                    <td className={`${td} font-semibold`}>{user?.name}</td>
                    <td className={`${th} w-[56px]`}>소&emsp;속</td>
                    <td className={td}>{deptLabel}</td>
                  </tr>
                  <tr>
                    <td className={th}>기&emsp;안&emsp;일</td>
                    <td className={td}>{todayKr}</td>
                    <td className={th}>문서번호</td>
                    <td className={`${td} text-[11px] text-gray-500`}>{docNo}</td>
                  </tr>
                </tbody>
              </table>

              {/* 결재란 */}
              <div className='shrink-0'>
                <table className='border-collapse text-[11px]'>
                  <thead>
                    <tr>
                      <td
                        colSpan={2}
                        className='border border-gray-300 bg-[#f7f8fa] text-center px-4 py-[5px] font-semibold text-gray-600 tracking-widest text-[11px]'
                      >
                        결&nbsp;재
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className='border border-gray-300 text-center px-4 py-[5px] text-gray-500 w-12'>담당</td>
                      <td className='border border-gray-300 text-center px-4 py-[5px] text-gray-700 font-medium w-20'>
                        {selectedApprover
                          ? `${selectedApprover.name}${selectedApprover.position ? `(${selectedApprover.position})` : ''}`
                          : '대표'}
                      </td>
                    </tr>
                    <tr>
                      <td className='border border-gray-300 h-9 text-center text-gray-400 text-[10px]' />
                      <td className='border border-gray-300 h-9' />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─ 제목 ─ */}
            <table className='w-full border-collapse text-[12px] mb-4'>
              <tbody>
                <tr>
                  <td className={`${th} w-[72px]`}>제&emsp;&emsp;목</td>
                  <td className='border border-gray-300 px-3 py-[7px]'>
                    <input
                      type='text'
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={generateTitle()}
                      className='w-full text-[13px] outline-none placeholder-gray-300 bg-transparent'
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ════ 휴가신청 전용 섹션 ════ */}
            {type === '휴가신청' && (
              <>
                {/* 전결표 */}
                <div className='mb-1'>
                  <div className='border border-gray-300'>
                    {/* 섹션 헤더 */}
                    <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>
                      전결표
                    </div>
                    <table className='w-full border-collapse text-[12px]'>
                      <tbody>
                        <tr>
                          <td className={`${th} w-[72px]`}>부서명</td>
                          <td className={td}>{deptLabel}</td>
                          <td className={`${th} w-[56px]`}>사번</td>
                          <td className={td}>
                            <span className='text-gray-400'>-</span>
                          </td>
                        </tr>
                        <tr>
                          <td className={th}>성&emsp;명</td>
                          <td className={`${td} font-semibold`}>{user?.name}</td>
                          <td className={th}>직위</td>
                          <td className={td}>{user?.position || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className='px-3 py-2 text-[11px] text-gray-500 bg-[#fafbfc] border-t border-gray-200 flex gap-4'>
                      <span>잔여일수: <span className='text-gray-400 font-medium'>-</span></span>
                      <span>사용연차: <span className='text-blue-600 font-semibold'>{vacDays > 0 ? vacDays : '-'}</span></span>
                      <span>잔여연차: <span className='text-gray-400 font-medium'>-</span></span>
                    </div>
                  </div>
                </div>

                {/* 신청내용 */}
                <div className='mb-4 mt-3'>
                  <div className='border border-gray-300'>
                    <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>
                      신청내용
                    </div>
                    <table className='w-full border-collapse text-[12px]'>
                      <thead>
                        <tr>
                          <th className={`${th} w-[90px]`}>휴가형목</th>
                          <th className={th}>휴가일</th>
                          <th className={`${th} w-[70px]`}>시작시간</th>
                          <th className={`${th} w-[70px]`}>종료시간</th>
                          <th className={`${th} w-[58px]`}>신청일수</th>
                          <th className={`${th} w-[58px]`}>잔여일수</th>
                          <th className={th}>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {/* 휴가형목 */}
                          <td className='border border-gray-300 p-1'>
                            <select
                              value={vacationType}
                              onChange={(e) => { setVacationType(e.target.value as VacationType); setVacStartTime(''); setVacEndTime(''); }}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'
                            >
                              {VACATION_TYPES.map((vt) => <option key={vt} value={vt}>{vt}</option>)}
                            </select>
                          </td>
                          {/* 휴가일 */}
                          <td className='border border-gray-300 p-1'>
                            {isHalfDay ? (
                              <input type='date' value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400' />
                            ) : (
                              <div className='flex items-center gap-1'>
                                <input type='date' value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  className='text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400 w-[112px]' />
                                <span className='text-gray-400'>~</span>
                                <input type='date' value={endDate} min={startDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  className='text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400 w-[112px]' />
                              </div>
                            )}
                          </td>
                          {/* 시작시간 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='time' value={vacStartTime}
                              onChange={(e) => setVacStartTime(e.target.value)}
                              disabled={!isHalfDay}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-[#f7f8fa] disabled:text-gray-300' />
                          </td>
                          {/* 종료시간 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='time' value={vacEndTime}
                              onChange={(e) => setVacEndTime(e.target.value)}
                              disabled={!isHalfDay}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-[#f7f8fa] disabled:text-gray-300' />
                          </td>
                          {/* 신청일수 */}
                          <td className='border border-gray-300 text-center text-[13px] font-bold text-blue-600 py-[7px]'>
                            {vacDays > 0 ? vacDays : ''}
                          </td>
                          {/* 잔여일수 */}
                          <td className='border border-gray-300 text-center text-[12px] text-gray-400 py-[7px]'>
                            {vacDays > 0 ? vacDays : ''}
                          </td>
                          {/* 비고 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='text' value={vacNote}
                              onChange={(e) => setVacNote(e.target.value)}
                              placeholder='사유'
                              className='w-full text-[12px] outline-none placeholder-gray-300 bg-transparent' />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ════ 연장근무 ════ */}
            {type === '연장근무' && (
              <>
                {/* 전결표 */}
                <div className='mb-1'>
                  <div className='border border-gray-300'>
                    <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>
                      전결표
                    </div>
                    <table className='w-full border-collapse text-[12px]'>
                      <tbody>
                        <tr>
                          <td className={`${th} w-[72px]`}>부서명</td>
                          <td className={td}>{deptLabel}</td>
                          <td className={`${th} w-[56px]`}>사번</td>
                          <td className={td}>
                            <span className='text-gray-400'>-</span>
                          </td>
                        </tr>
                        <tr>
                          <td className={th}>성&emsp;명</td>
                          <td className={`${td} font-semibold`}>{user?.name}</td>
                          <td className={th}>직위</td>
                          <td className={td}>{user?.position || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 신청내용 */}
                <div className='mb-4 mt-3'>
                  <div className='border border-gray-300'>
                    <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>
                      신청내용
                    </div>
                    <table className='w-full border-collapse text-[12px]'>
                      <thead>
                        <tr>
                          <th className={`${th} w-[100px]`}>연장근무일</th>
                          <th className={`${th} w-[80px]`}>시작시간</th>
                          <th className={`${th} w-[80px]`}>종료시간</th>
                          <th className={`${th} w-[70px]`}>연장시간(계)</th>
                          <th className={th}>업무내용(사유)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {/* 연장근무일 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='date' value={overtimeDate}
                              onChange={(e) => setOvertimeDate(e.target.value)}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400' />
                          </td>
                          {/* 시작시간 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='time' value={overtimeStartTime}
                              onChange={(e) => setOvertimeStartTime(e.target.value)}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400' />
                          </td>
                          {/* 종료시간 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='time' value={overtimeEndTime}
                              onChange={(e) => setOvertimeEndTime(e.target.value)}
                              className='w-full text-[12px] border border-gray-200 rounded px-1 py-[3px] focus:outline-none focus:ring-1 focus:ring-blue-400' />
                          </td>
                          {/* 연장시간(계) */}
                          <td className='border border-gray-300 text-center text-[13px] font-bold text-blue-600 py-[7px]'>
                            {overtimeStartTime && overtimeEndTime ? (() => {
                              const [sh, sm] = overtimeStartTime.split(':').map(Number);
                              const [eh, em] = overtimeEndTime.split(':').map(Number);
                              const mins = (eh * 60 + em) - (sh * 60 + sm);
                              if (mins <= 0) return '-';
                              const h = Math.floor(mins / 60);
                              const m = mins % 60;
                              return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
                            })() : ''}
                          </td>
                          {/* 업무내용 */}
                          <td className='border border-gray-300 p-1'>
                            <input type='text' value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder='연장근무 사유 및 업무 내용'
                              className='w-full text-[12px] outline-none placeholder-gray-300 bg-transparent' />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ════ 지출결의 ════ */}
            {type === '지출결의' && (
              <div className='mb-4'>
                <div className='border border-gray-300'>
                  <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>신청내용</div>
                  <table className='w-full border-collapse text-[12px]'>
                    <tbody>
                      <tr>
                        <td className={`${th} w-[80px]`}>사용금액</td>
                        <td className='border border-gray-300 px-3 py-[7px]'>
                          <div className='flex items-center gap-2'>
                            <input type='number' value={amount} onChange={(e) => setAmount(e.target.value)}
                              placeholder='0'
                              className='text-[13px] border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500' />
                            <span className='text-[13px] text-gray-500'>원</span>
                            {amount && <span className='text-[12px] text-blue-600 font-semibold'>₩{parseInt(amount).toLocaleString()}</span>}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className={`${th} align-top pt-2`}>사용목적</td>
                        <td className='border border-gray-300 p-1'>
                          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder='사용 목적 및 지출 내역을 상세히 입력하세요'
                            className='w-full text-[13px] outline-none placeholder-gray-300 resize-none py-1 px-1' />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ════ 기타 ════ */}
            {type === '기타' && (
              <div className='mb-4'>
                <div className='border border-gray-300'>
                  <div className='bg-[#eef0f4] px-3 py-[5px] text-[11px] font-bold text-gray-600 tracking-widest border-b border-gray-300'>내용</div>
                  <div className='p-1'>
                    <textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder='기안 내용을 상세히 입력하세요'
                      className='w-full text-[13px] outline-none placeholder-gray-300 resize-none py-1 px-2' />
                  </div>
                </div>
              </div>
            )}

            {/* ─ 파일 첨부 ─ */}
            <div className='border border-gray-300'>
              <div className='flex items-center gap-2 bg-[#eef0f4] px-3 py-[5px] border-b border-gray-300'>
                <span className='text-[11px] font-bold text-gray-600 tracking-widest flex-1'>파일 첨부</span>
                <button
                  type='button'
                  onClick={() => fileRef.current?.click()}
                  className='text-[11px] px-2.5 py-[3px] border border-gray-400 rounded bg-white hover:bg-gray-50 text-gray-600 transition font-medium'
                >
                  PC 파일 선택
                </button>
                <button
                  type='button'
                  className='text-[11px] px-2.5 py-[3px] border border-gray-400 rounded bg-white hover:bg-gray-50 text-gray-600 transition font-medium'
                >
                  드라이브 파일 선택
                </button>
              </div>
              <input ref={fileRef} type='file' multiple className='hidden' onChange={(e) => addFiles(e.target.files)} />
              {/* 드롭존 */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); }}
                className={`min-h-[56px] px-4 py-3 transition-colors ${isDragOver ? 'bg-blue-50' : 'bg-white'}`}
              >
                {attachedFiles.length > 0 ? (
                  <div className='space-y-1'>
                    {attachedFiles.map((f, i) => (
                      <div key={i} className='flex items-center gap-2 text-[12px] text-gray-600'>
                        <svg className='w-3.5 h-3.5 text-blue-400 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
                        </svg>
                        <span className='truncate'>{f.name}</span>
                        <button
                          onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className='ml-auto text-gray-300 hover:text-red-500 text-base leading-none shrink-0'
                        >×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-[12px] text-gray-400 text-center py-2'>
                    파일을 여기에 드롭하도록 해요
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Document View Modal
// ─────────────────────────────────────────────────────────
function DocumentViewModal({
  item,
  canDecide,
  onDecide,
  onClose,
}: {
  item: Approval;
  canDecide: boolean;
  onDecide?: (id: string, decision: '승인' | '반려', comment: string) => Promise<void>;
  onClose: () => void;
}) {
  const [commentText, setCommentText] = useState(item.comment || '');
  const [isDeciding, setIsDeciding] = useState(false);

  const handleDecide = async (decision: '승인' | '반려') => {
    if (!onDecide) return;
    setIsDeciding(true);
    try { await onDecide(item._id, decision, commentText); }
    catch { alert('처리에 실패했습니다.'); }
    finally { setIsDeciding(false); }
  };

  const createdDate = dayjs(item.createdAt).format('YYYY년 MM월 DD일');
  const typeColor = TYPE_COLOR[item.type];
  const statusBadge = STATUS_BADGE[item.status];
  const isHalfDay = item.vacationType === '반차(오전)' || item.vacationType === '반차(오후)';

  const thCls = 'border border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600 px-3 py-2 text-center whitespace-nowrap';
  const tdCls = 'border border-gray-300 text-sm px-3 py-2';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-6'>
      <div className='bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden'>

        {/* Toolbar */}
        <div className='flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50'>
          <div className='flex items-center gap-2'>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColor.bg} ${typeColor.text}`}>
              {item.type}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
          </div>
          <button onClick={onClose}
            className='text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* Document */}
        <div className='px-8 py-7 bg-white overflow-y-auto max-h-[70vh]'>

          {/* Document title */}
          <h2 className='text-xl font-bold text-center mb-6 tracking-widest text-gray-900'>
            {DOC_TITLE[item.type]}
          </h2>

          {/* Header table */}
          <div className='flex items-start justify-between mb-5 gap-4'>
            <table className='flex-1 border-collapse text-xs'>
              <tbody>
                <tr>
                  <td className={`${thCls} w-16`}>기&emsp;안&emsp;자</td>
                  <td className={`${tdCls} font-medium`}>{item.applicantName}</td>
                  <td className={`${thCls} w-16`}>결&emsp;재&emsp;자</td>
                  <td className={tdCls}>{item.approverName}</td>
                </tr>
                <tr>
                  <td className={thCls}>기&emsp;안&emsp;일</td>
                  <td className={tdCls}>{createdDate}</td>
                  <td className={thCls}>결재양식</td>
                  <td className={tdCls}>{DOC_FORM_LABEL[item.type]}</td>
                </tr>
              </tbody>
            </table>
            {/* 결재란 stamp */}
            <div className='shrink-0'>
              <table className='border-collapse text-xs'>
                <thead>
                  <tr>
                    <td colSpan={3} className='border border-gray-300 bg-gray-50 text-center px-3 py-1 font-semibold text-gray-600 tracking-wider'>
                      결&nbsp;&nbsp;재&nbsp;&nbsp;란
                    </td>
                  </tr>
                  <tr>
                    {['담당', '팀장', '결재'].map((r) => (
                      <td key={r} className='border border-gray-300 text-center px-4 py-1 text-gray-500 text-[11px]'>{r}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className='border border-gray-300 h-10 w-12' />
                    <td className='border border-gray-300 h-10 w-12' />
                    <td className='border border-gray-300 h-10 w-12 relative'>
                      {item.status === '승인' && (
                        <div className='absolute inset-0 flex items-center justify-center'>
                          <span className='w-8 h-8 rounded-full border-2 border-red-500 text-red-500 flex items-center justify-center text-[9px] font-bold'>승인</span>
                        </div>
                      )}
                      {item.status === '반려' && (
                        <div className='absolute inset-0 flex items-center justify-center'>
                          <span className='w-8 h-8 rounded-full border-2 border-gray-400 text-gray-500 flex items-center justify-center text-[9px] font-bold'>반려</span>
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 제목 */}
          <table className='w-full border-collapse text-xs mb-5'>
            <tbody>
              <tr>
                <td className={`${thCls} w-16`}>제&emsp;&emsp;목</td>
                <td className={`${tdCls} font-medium`}>{item.title}</td>
              </tr>
            </tbody>
          </table>

          {/* ── 휴가신청 ── */}
          {item.type === '휴가신청' && (
            <>
              <div className='mb-4'>
                <p className='text-xs font-semibold text-gray-500 mb-2 tracking-wider'>신&nbsp;&nbsp;청&nbsp;&nbsp;내&nbsp;&nbsp;용</p>
                <table className='w-full border-collapse text-xs'>
                  <thead>
                    <tr>
                      <th className={`${thCls} w-24`}>휴가형목</th>
                      <th className={thCls}>휴가일</th>
                      {isHalfDay && <th className={`${thCls} w-20`}>시작시간</th>}
                      {isHalfDay && <th className={`${thCls} w-20`}>종료시간</th>}
                      <th className={`${thCls} w-16`}>신청일수</th>
                      <th className={`${thCls} w-16`}>잔여일수</th>
                      <th className={thCls}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${tdCls} text-center`}>{item.vacationType || '-'}</td>
                      <td className={`${tdCls} text-center`}>
                        {item.startDate ? dayjs(item.startDate).format('YYYY-MM-DD') : '-'}
                        {!isHalfDay && item.endDate && item.startDate !== item.endDate
                          ? ` ~ ${dayjs(item.endDate).format('YYYY-MM-DD')}` : ''}
                      </td>
                      {isHalfDay && (
                        <td className={`${tdCls} text-center`}>{item.overtimeStartTime || '-'}</td>
                      )}
                      {isHalfDay && (
                        <td className={`${tdCls} text-center`}>{item.overtimeEndTime || '-'}</td>
                      )}
                      <td className={`${tdCls} text-center font-semibold text-blue-600`}>
                        {item.vacationType ? calcVacDays(item.vacationType as VacationType,
                          item.startDate || '', item.endDate || '') : '-'}
                      </td>
                      <td className={`${tdCls} text-center text-gray-400`}>-</td>
                      <td className={`${tdCls} text-gray-500`}>{item.reason || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 연장근무 ── */}
          {item.type === '연장근무' && (
            <>
              {/* 전결표 */}
              <div className='mb-3'>
                <p className='text-xs font-semibold text-gray-500 mb-2 tracking-wider'>전&nbsp;&nbsp;결&nbsp;&nbsp;표</p>
                <table className='w-full border-collapse text-xs'>
                  <tbody>
                    <tr>
                      <td className={`${thCls} w-20`}>부서명</td>
                      <td className={tdCls}>{item.applicantName ? '-' : '-'}</td>
                      <td className={`${thCls} w-16`}>사번</td>
                      <td className={`${tdCls} text-gray-400`}>-</td>
                    </tr>
                    <tr>
                      <td className={thCls}>성&emsp;명</td>
                      <td className={`${tdCls} font-medium`}>{item.applicantName}</td>
                      <td className={thCls}>직위</td>
                      <td className={tdCls}>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* 신청내용 */}
              <div className='mb-4'>
                <p className='text-xs font-semibold text-gray-500 mb-2 tracking-wider'>신&nbsp;&nbsp;청&nbsp;&nbsp;내&nbsp;&nbsp;용</p>
                <table className='w-full border-collapse text-xs'>
                  <thead>
                    <tr>
                      <th className={`${thCls} w-28`}>연장근무일</th>
                      <th className={`${thCls} w-20`}>시작시간</th>
                      <th className={`${thCls} w-20`}>종료시간</th>
                      <th className={`${thCls} w-24`}>연장시간(계)</th>
                      <th className={thCls}>업무내용(사유)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${tdCls} text-center`}>
                        {item.overtimeDate ? dayjs(item.overtimeDate).format('YYYY-MM-DD') : '-'}
                      </td>
                      <td className={`${tdCls} text-center`}>{item.overtimeStartTime || '-'}</td>
                      <td className={`${tdCls} text-center`}>{item.overtimeEndTime || '-'}</td>
                      <td className={`${tdCls} text-center font-semibold text-blue-600`}>
                        {item.overtimeStartTime && item.overtimeEndTime ? (() => {
                          const [sh, sm] = item.overtimeStartTime!.split(':').map(Number);
                          const [eh, em] = item.overtimeEndTime!.split(':').map(Number);
                          const mins = (eh * 60 + em) - (sh * 60 + sm);
                          if (mins <= 0) return '-';
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
                        })() : '-'}
                      </td>
                      <td className={tdCls}>{item.reason || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 지출결의 ── */}
          {item.type === '지출결의' && (
            <table className='w-full border-collapse text-xs mb-4'>
              <tbody>
                <tr>
                  <td className={`${thCls} w-24`}>사용금액</td>
                  <td className={`${tdCls} font-semibold text-blue-600`} colSpan={3}>
                    {item.amount != null ? `₩ ${item.amount.toLocaleString()} 원` : '-'}
                  </td>
                </tr>
                <tr>
                  <td className={`${thCls} align-top py-3`}>사용목적</td>
                  <td className={tdCls} colSpan={3}>
                    <p className='whitespace-pre-wrap leading-relaxed'>{item.reason || '-'}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── 기타 ── */}
          {item.type === '기타' && (
            <table className='w-full border-collapse text-xs mb-4'>
              <tbody>
                <tr>
                  <td className={`${thCls} w-24 align-top py-3`}>내&emsp;용</td>
                  <td className={tdCls} colSpan={3}>
                    <p className='whitespace-pre-wrap leading-relaxed'>{item.reason || '-'}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div className='text-center py-4 border-t border-gray-100 space-y-1'>
            <p className='text-sm text-gray-600'>위와 같이 신청합니다.</p>
            <p className='text-sm text-gray-500'>{createdDate}</p>
            <p className='text-sm font-medium text-gray-800'>신청인: {item.applicantName} (인)</p>
          </div>

          {/* 기존 결재 의견 */}
          {item.status !== '검토중' && item.comment && (
            <div className='mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50'>
              <p className='text-xs font-semibold text-gray-500 mb-1'>결재 의견</p>
              <p className='text-sm text-gray-700'>{item.comment}</p>
            </div>
          )}
        </div>

        {/* ── Decide area (admin only) ── */}
        {canDecide && item.status === '검토중' && (
          <div className='px-8 pb-7 pt-4 border-t border-gray-100 space-y-3 bg-white'>
            <div>
              <label className='block text-xs font-semibold text-gray-500 mb-1.5'>
                결재 의견 <span className='text-gray-400 font-normal'>(선택)</span>
              </label>
              <textarea
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder='승인 또는 반려 사유를 입력하세요'
                className='w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => handleDecide('반려')}
                disabled={isDeciding}
                className='flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 transition'
              >
                반려
              </button>
              <button
                onClick={() => handleDecide('승인')}
                disabled={isDeciding}
                className='flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition shadow-sm'
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

// ─────────────────────────────────────────────────────────
// Shared UI components
// ─────────────────────────────────────────────────────────
function TabBar({
  tabs,
  active,
  onChange,
  badge = {},
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  badge?: Record<string, number>;
}) {
  return (
    <div className='flex gap-1 bg-gray-100 p-1 rounded-xl w-fit'>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${active === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {t}
          {badge[t] != null && badge[t]! > 0 && (
            <span className='ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold'>
              {badge[t]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className='bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6'>
      <span className='text-4xl mb-3'>{icon}</span>
      <p className='text-sm font-semibold text-gray-700'>{message}</p>
      <p className='text-xs text-gray-400 mt-1'>{sub}</p>
    </div>
  );
}
