'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { formatDateShort } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface RevenueEntry {
  id: string;
  date: string;
  client: string;
  category: string;
  amount: number;
  memo: string;
  createdAt: string;
}

const CATEGORIES = ['디자인 제작', '마케팅 컨설팅', '브랜딩', '영상 제작', '인쇄물', '웹 개발', '기타'];

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────
function formatWon(amount: number) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `${Math.floor(amount / 10000).toLocaleString()}만`;
  return amount.toLocaleString();
}

// ────────────────────────────────────────────────────────────────────────────
// 수기입력 모달
// ────────────────────────────────────────────────────────────────────────────
function EntryModal({
  entry,
  onClose,
  onSave,
}: {
  entry?: RevenueEntry;
  onClose: () => void;
  onSave: (data: Omit<RevenueEntry, 'id' | 'createdAt'>) => void;
}) {
  const [form, setForm] = useState({
    date: entry?.date ?? dayjs().format('YYYY-MM-DD'),
    client: entry?.client ?? '',
    category: entry?.category ?? CATEGORIES[0],
    amount: entry?.amount ? String(entry.amount) : '',
    memo: entry?.memo ?? '',
  });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client.trim()) { setError('고객사명을 입력하세요'); return; }
    const amount = Number(form.amount.replace(/,/g, ''));
    if (!amount || amount <= 0) { setError('금액을 올바르게 입력하세요'); return; }
    onSave({ date: form.date, client: form.client.trim(), category: form.category, amount, memo: form.memo.trim() });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'>
      <div className='bg-white rounded-md shadow-xl w-full max-w-md'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>{entry ? '매출 수정' : '매출 수기입력'}</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className='p-5 space-y-4'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>날짜 *</label>
              <input
                type='date'
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className='w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>분류 *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className='w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>고객사명 *</label>
            <input
              type='text'
              placeholder='예: ㈜예시기업'
              value={form.client}
              onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
              className='w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>금액 (원) *</label>
            <input
              type='text'
              inputMode='numeric'
              placeholder='예: 3500000'
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, '') }))}
              className='w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            {form.amount && (
              <p className='text-[11px] text-blue-600 mt-1'>
                ₩{Number(form.amount).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>메모</label>
            <textarea
              placeholder='계약 내용, 비고 등 (선택)'
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              rows={2}
              className='w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
          {error && <p className='text-xs text-red-500'>{error}</p>}
          <div className='flex gap-2 pt-1'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition'
            >취소</button>
            <button
              type='submit'
              className='flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition'
            >{entry ? '수정 저장' : '입력 완료'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────
const INITIAL_ENTRIES: RevenueEntry[] = [
  { id: '1', date: '2026-01-15', client: '㈜예시기업A', category: '디자인 제작', amount: 3200000, memo: '', createdAt: '2026-01-15' },
  { id: '2', date: '2026-02-08', client: '예시스타트업', category: '마케팅 컨설팅', amount: 2800000, memo: '분기 계약', createdAt: '2026-02-08' },
  { id: '3', date: '2026-03-20', client: '㈜테스트컴퍼니', category: '브랜딩', amount: 5500000, memo: '', createdAt: '2026-03-20' },
  { id: '4', date: '2026-04-05', client: '샘플코리아', category: '인쇄물', amount: 1800000, memo: '리플렛 200부', createdAt: '2026-04-05' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '디자인 제작': 'bg-blue-100 text-blue-700',
  '마케팅 컨설팅': 'bg-purple-100 text-purple-700',
  '브랜딩': 'bg-pink-100 text-pink-700',
  '영상 제작': 'bg-orange-100 text-orange-700',
  '인쇄물': 'bg-amber-100 text-amber-700',
  '웹 개발': 'bg-cyan-100 text-cyan-700',
  '기타': 'bg-gray-100 text-gray-600',
};

export default function RevenuePage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [entries, setEntries] = useState<RevenueEntry[]>(INITIAL_ENTRIES);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<RevenueEntry | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState('');

  if (user?.role !== 'head-admin') {
    return (
      <div className='flex flex-col items-center justify-center h-96 gap-4'>
        <div className='w-16 h-16 rounded-full bg-red-50 flex items-center justify-center'>
          <svg className='w-8 h-8 text-red-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
          </svg>
        </div>
        <p className='text-gray-500 text-sm'>접근 권한이 없습니다.</p>
        <button onClick={() => router.back()} className='text-blue-600 text-sm hover:underline'>← 돌아가기</button>
      </div>
    );
  }

  const filtered = filterMonth
    ? entries.filter((e) => e.date.startsWith(filterMonth))
    : entries;

  const totalAll = entries.reduce((s, e) => s + e.amount, 0);
  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  // 월별 집계 (차트용)
  const monthlyMap: Record<string, number> = {};
  entries.forEach((e) => {
    const m = e.date.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] ?? 0) + e.amount;
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month: month.slice(5) + '월', amount }));
  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);

  const handleSave = (data: Omit<RevenueEntry, 'id' | 'createdAt'>) => {
    if (editTarget) {
      setEntries((p) => p.map((e) => e.id === editTarget.id ? { ...e, ...data } : e));
    } else {
      const newEntry: RevenueEntry = {
        ...data,
        id: String(Date.now()),
        createdAt: dayjs().format('YYYY-MM-DD'),
      };
      setEntries((p) => [newEntry, ...p].sort((a, b) => b.date.localeCompare(a.date)));
    }
    setShowModal(false);
    setEditTarget(undefined);
  };

  const handleEdit = (entry: RevenueEntry) => {
    setEditTarget(entry);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setEntries((p) => p.filter((e) => e.id !== id));
    setDeleteId(null);
  };

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h1 className='text-xl md:text-2xl font-bold text-gray-900'>매출 관리</h1>
          <p className='text-sm text-gray-500 mt-0.5'>매출 내역을 직접 입력하고 현황을 확인합니다</p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setShowModal(true); }}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition shrink-0'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
          <span className='hidden sm:inline'>수기입력</span>
          <span className='sm:hidden'>입력</span>
        </button>
      </div>

      {/* 요약 카드 */}
      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        <div className='bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>올해 누적 매출</p>
          <p className='text-xl font-bold text-blue-600'>₩{formatWon(totalAll)}</p>
          <p className='text-[10px] text-gray-400 mt-0.5'>₩{totalAll.toLocaleString()}</p>
        </div>
        <div className='bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>총 계약 건수</p>
          <p className='text-xl font-bold text-green-600'>{entries.length}건</p>
          <p className='text-[10px] text-gray-400 mt-0.5'>수기 입력 포함</p>
        </div>
        <div className='col-span-2 md:col-span-1 bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>이번 달 매출</p>
          <p className='text-xl font-bold text-purple-600'>
            ₩{formatWon(entries.filter((e) => e.date.startsWith(dayjs().format('YYYY-MM'))).reduce((s, e) => s + e.amount, 0))}
          </p>
          <p className='text-[10px] text-gray-400 mt-0.5'>{dayjs().format('YYYY년 M월')}</p>
        </div>
      </div>

      {/* 월별 차트 */}
      {monthlyData.length > 0 && (
        <div className='bg-white rounded-md border border-gray-100 p-4 md:p-6'>
          <h2 className='text-sm font-semibold text-gray-800 mb-5'>월별 매출 현황</h2>
          <div className='flex items-end gap-2 md:gap-4 h-36 md:h-44'>
            {monthlyData.map((d) => {
              const height = (d.amount / maxAmount) * 100;
              return (
                <div key={d.month} className='flex-1 flex flex-col items-center gap-1.5'>
                  <span className='text-[10px] md:text-xs font-semibold text-gray-700 whitespace-nowrap'>
                    {formatWon(d.amount)}
                  </span>
                  <div
                    className='w-full rounded-t-lg bg-blue-500 transition-all duration-500 hover:bg-blue-600'
                    style={{ height: `${height}%` }}
                  />
                  <span className='text-[10px] md:text-xs text-gray-400'>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 매출 내역 테이블 */}
      <div className='bg-white rounded-md border border-gray-100'>
        {/* 내역 헤더 */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100'>
          <div className='flex items-center gap-2'>
            <h2 className='text-sm font-semibold text-gray-800'>매출 내역</h2>
            <span className='text-xs text-gray-400'>
              {filterMonth ? `${filtered.length}건 · ₩${totalFiltered.toLocaleString()}` : `전체 ${entries.length}건`}
            </span>
          </div>
          <input
            type='month'
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className='border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {filtered.length === 0 ? (
          <div className='py-16 flex flex-col items-center gap-2 text-gray-400'>
            <span className='text-3xl'>📭</span>
            <p className='text-sm'>해당 월의 매출 내역이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 모바일 카드 */}
            <div className='md:hidden divide-y divide-gray-100'>
              {filtered.map((entry) => (
                <div key={entry.id} className='p-4'>
                  <div className='flex items-start justify-between gap-2 mb-2'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {entry.category}
                      </span>
                      <span className='text-[11px] text-gray-400'>{formatDateShort(entry.date)}</span>
                    </div>
                    <div className='flex items-center gap-1 shrink-0'>
                      <button
                        onClick={() => handleEdit(entry)}
                        className='text-[11px] px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition'
                      >수정</button>
                      <button
                        onClick={() => setDeleteId(entry.id)}
                        className='text-[11px] px-2 py-1 text-red-500 hover:bg-red-50 rounded transition'
                      >삭제</button>
                    </div>
                  </div>
                  <p className='text-sm font-semibold text-gray-800'>{entry.client}</p>
                  {entry.memo && <p className='text-xs text-gray-400 mt-0.5'>{entry.memo}</p>}
                  <p className='text-base font-bold text-gray-900 mt-2'>₩{entry.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* 데스크톱 테이블 */}
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50/70 border-b border-gray-100'>
                    <th className='text-left px-5 py-3 text-xs font-semibold text-gray-500 w-28'>날짜</th>
                    <th className='text-left px-5 py-3 text-xs font-semibold text-gray-500'>고객사</th>
                    <th className='text-left px-5 py-3 text-xs font-semibold text-gray-500 w-32'>분류</th>
                    <th className='text-right px-5 py-3 text-xs font-semibold text-gray-500 w-36'>금액</th>
                    <th className='text-left px-5 py-3 text-xs font-semibold text-gray-500'>메모</th>
                    <th className='text-center px-5 py-3 text-xs font-semibold text-gray-500 w-24'>작업</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className='hover:bg-gray-50/50 transition-colors'>
                      <td className='px-5 py-3 text-xs text-gray-500 whitespace-nowrap'>{formatDateShort(entry.date)}</td>
                      <td className='px-5 py-3 font-medium text-gray-800'>{entry.client}</td>
                      <td className='px-5 py-3'>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {entry.category}
                        </span>
                      </td>
                      <td className='px-5 py-3 text-right font-semibold text-gray-900'>
                        ₩{entry.amount.toLocaleString()}
                      </td>
                      <td className='px-5 py-3 text-xs text-gray-400 max-w-xs truncate'>{entry.memo || '-'}</td>
                      <td className='px-5 py-3 text-center'>
                        <div className='flex items-center justify-center gap-1'>
                          <button
                            onClick={() => handleEdit(entry)}
                            className='text-[11px] px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition'
                          >수정</button>
                          <button
                            onClick={() => setDeleteId(entry.id)}
                            className='text-[11px] px-2 py-1 text-red-500 hover:bg-red-50 rounded transition'
                          >삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className='border-t border-gray-100 bg-gray-50/70'>
                    <td colSpan={3} className='px-5 py-3 text-xs font-semibold text-gray-500'>
                      {filterMonth ? `${filterMonth} 합계` : '전체 합계'}
                    </td>
                    <td className='px-5 py-3 text-right font-bold text-gray-900'>
                      ₩{totalFiltered.toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 수기입력 모달 */}
      {showModal && (
        <EntryModal
          entry={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
          onSave={handleSave}
        />
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'>
          <div className='bg-white rounded-md shadow-xl w-full max-w-xs p-6 text-center'>
            <p className='text-sm font-semibold text-gray-800 mb-1'>매출 내역을 삭제할까요?</p>
            <p className='text-xs text-gray-400 mb-5'>삭제 후 복구할 수 없습니다</p>
            <div className='flex gap-2'>
              <button
                onClick={() => setDeleteId(null)}
                className='flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition'
              >취소</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className='flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition'
              >삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
