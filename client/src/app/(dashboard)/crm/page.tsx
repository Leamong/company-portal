'use client';

import { useState, useEffect, useCallback } from 'react';
import { fromNow } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface Client {
  _id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  industry: string;
  status: '활성' | '대기' | '종료';
  notes: string;
  totalOrders: number;
  updatedAt: string;
  createdAt: string;
}

interface Consultation {
  _id: string;
  clientId: string;
  date: string;
  type: '미팅' | '전화' | '이메일' | '기타';
  memo: string;
  createdAt: string;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<Client['status'], string> = {
  활성: 'bg-green-100 text-green-700',
  대기: 'bg-yellow-100 text-yellow-700',
  종료: 'bg-gray-100 text-gray-500',
};

const CONSULT_ICON: Record<Consultation['type'], string> = {
  미팅: 'M',
  전화: 'T',
  이메일: 'E',
  기타: 'O',
};

const CONSULT_COLOR: Record<Consultation['type'], string> = {
  미팅: 'bg-blue-100 text-blue-600',
  전화: 'bg-green-100 text-green-600',
  이메일: 'bg-purple-100 text-purple-600',
  기타: 'bg-gray-100 text-gray-500',
};

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function CrmPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [consultLoading, setConsultLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [showClientModal, setShowClientModal] = useState<{ open: boolean; mode: 'create' | 'edit'; client?: Client }>({
    open: false,
    mode: 'create',
  });
  const [showConsultModal, setShowConsultModal] = useState(false);

  // ── 고객사 목록 불러오기 ─────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/crm/clients', { params: search ? { search } : {} });
      setClients(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // ── 선택된 고객사의 상담 히스토리 불러오기 ──────────────────────────────
  const fetchConsultations = useCallback(async (clientId: string) => {
    setConsultLoading(true);
    try {
      const res = await api.get(`/api/crm/clients/${clientId}/consultations`);
      setConsultations(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setConsultLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) fetchConsultations(selected._id);
    else setConsultations([]);
  }, [selected, fetchConsultations]);

  // ── 고객사 선택 ──────────────────────────────────────────────────────────
  const handleSelect = (client: Client) => {
    setSelected((prev) => (prev?._id === client._id ? null : client));
  };

  // ── 고객사 저장 (생성/수정) ───────────────────────────────────────────────
  const handleClientSubmit = async (data: Partial<Client>) => {
    if (showClientModal.mode === 'create') {
      const res = await api.post('/api/crm/clients', data);
      setClients((prev) => [res.data, ...prev]);
    } else if (showClientModal.client) {
      const res = await api.patch(`/api/crm/clients/${showClientModal.client._id}`, data);
      setClients((prev) => prev.map((c) => (c._id === showClientModal.client!._id ? res.data : c)));
      if (selected?._id === showClientModal.client._id) setSelected(res.data);
    }
    setShowClientModal({ open: false, mode: 'create' });
  };

  // ── 고객사 삭제 ──────────────────────────────────────────────────────────
  const handleClientDelete = async (id: string) => {
    if (!confirm('고객사와 모든 상담 기록을 삭제할까요?')) return;
    await api.delete(`/api/crm/clients/${id}`);
    setClients((prev) => prev.filter((c) => c._id !== id));
    if (selected?._id === id) setSelected(null);
  };

  // ── 상담 기록 추가 ────────────────────────────────────────────────────────
  const handleConsultSubmit = async (data: { date: string; type: Consultation['type']; memo: string }) => {
    if (!selected) return;
    const res = await api.post('/api/crm/consultations', { ...data, clientId: selected._id });
    setConsultations((prev) => [res.data, ...prev]);
    setShowConsultModal(false);
  };

  // ── 상담 기록 삭제 ────────────────────────────────────────────────────────
  const handleConsultDelete = async (id: string) => {
    await api.delete(`/api/crm/consultations/${id}`);
    setConsultations((prev) => prev.filter((c) => c._id !== id));
  };

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>고객 관리 (CRM)</h1>
          <p className='text-sm text-gray-500 mt-1'>
            고객사 정보와 상담 히스토리를 관리합니다
          </p>
        </div>
        <button
          onClick={() => setShowClientModal({ open: true, mode: 'create' })}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
          고객사 등록
        </button>
      </div>

      <div className='flex gap-4'>
        {/* 고객사 목록 */}
        <div className={`${selected ? 'w-1/2' : 'w-full'} transition-all duration-200 space-y-3`}>
          {/* 검색 */}
          <div className='relative'>
            <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='고객사명, 담당자, 업종 검색'
              className='w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {/* 목록 */}
          {loading ? (
            <div className='flex items-center justify-center py-16 text-sm text-gray-400'>불러오는 중...</div>
          ) : clients.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 gap-2 text-gray-400'>
              <svg className='w-10 h-10 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
              <p className='text-sm'>등록된 고객사가 없습니다.</p>
            </div>
          ) : (
            <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
              {clients.map((client, i) => (
                <button
                  key={client._id}
                  onClick={() => handleSelect(client)}
                  className={[
                    'w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors',
                    selected?._id === client._id ? 'bg-blue-50' : '',
                    i !== 0 ? 'border-t border-gray-50' : '',
                  ].join(' ')}
                >
                  <div className='w-10 h-10 rounded-xl bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0'>
                    <span className='text-white text-sm font-bold'>{client.name.charAt(0)}</span>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <p className='text-sm font-semibold text-gray-800 truncate'>{client.name}</p>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[client.status]}`}>
                        {client.status}
                      </span>
                    </div>
                    <p className='text-xs text-gray-400 mt-0.5'>
                      {[client.contact, client.industry, `총 ${client.totalOrders}건`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className='text-xs text-gray-400 hidden sm:block shrink-0'>
                    {fromNow(client.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className='w-1/2 space-y-4'>
            {/* 고객사 정보 카드 */}
            <div className='bg-white rounded-2xl border border-gray-100 p-5'>
              <div className='flex items-start justify-between mb-4'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0'>
                    <span className='text-white text-sm font-bold'>{selected.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h2 className='text-base font-bold text-gray-900'>{selected.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status]}`}>
                      {selected.status}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-1'>
                  <button
                    onClick={() => setShowClientModal({ open: true, mode: 'edit', client: selected })}
                    className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition'
                    title='수정'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                    </svg>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleClientDelete(selected._id)}
                      className='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition'
                      title='삭제'
                    >
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className='p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>
              </div>

              <div className='space-y-2 text-sm'>
                {[
                  ['담당자', selected.contact],
                  ['연락처', selected.phone],
                  ['이메일', selected.email],
                  ['업종', selected.industry],
                  ['총 주문', `${selected.totalOrders}건`],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className='flex justify-between'>
                      <span className='text-gray-400'>{k}</span>
                      <span className='text-gray-800 font-medium'>{v}</span>
                    </div>
                  ))}
                {selected.notes && (
                  <div className='pt-2 border-t border-gray-50'>
                    <p className='text-xs text-gray-400 mb-1'>메모</p>
                    <p className='text-xs text-gray-600 leading-relaxed whitespace-pre-wrap'>{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 상담 히스토리 */}
            <div className='bg-white rounded-2xl border border-gray-100 p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-sm font-semibold text-gray-800'>상담 히스토리</h3>
                <span className='text-xs text-gray-400'>{consultations.length}건</span>
              </div>

              {consultLoading ? (
                <div className='text-center py-6 text-sm text-gray-400'>불러오는 중...</div>
              ) : (
                <div className='space-y-4'>
                  {consultations.map((h, idx) => (
                    <div key={h._id} className='flex gap-3 group'>
                      <div className='flex flex-col items-center'>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${CONSULT_COLOR[h.type]}`}>
                          <span className='text-xs font-bold'>{CONSULT_ICON[h.type]}</span>
                        </div>
                        {idx < consultations.length - 1 && (
                          <div className='w-px flex-1 bg-gray-100 mt-1' />
                        )}
                      </div>
                      <div className={`pb-4 flex-1 min-w-0 ${idx === consultations.length - 1 ? 'pb-0' : ''}`}>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='text-xs font-semibold text-gray-700'>{h.type}</span>
                          <span className='text-xs text-gray-400'>{h.date}</span>
                          <button
                            onClick={() => handleConsultDelete(h._id)}
                            className='ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-0.5 rounded'
                          >
                            <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                            </svg>
                          </button>
                        </div>
                        <p className='text-xs text-gray-600 leading-relaxed'>{h.memo}</p>
                      </div>
                    </div>
                  ))}
                  {consultations.length === 0 && (
                    <p className='text-xs text-gray-400 text-center py-4'>상담 기록이 없습니다.</p>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowConsultModal(true)}
                className='w-full mt-4 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition flex items-center justify-center gap-1'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                </svg>
                상담 기록 추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 고객사 등록/수정 모달 */}
      {showClientModal.open && (
        <ClientModal
          mode={showClientModal.mode}
          initial={showClientModal.client}
          onClose={() => setShowClientModal({ open: false, mode: 'create' })}
          onSubmit={handleClientSubmit}
        />
      )}

      {/* 상담 기록 추가 모달 */}
      {showConsultModal && (
        <ConsultationModal
          onClose={() => setShowConsultModal(false)}
          onSubmit={handleConsultSubmit}
        />
      )}
    </div>
  );
}

// ─── 고객사 등록/수정 모달 ──────────────────────────────────────────────────────

function ClientModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: Client;
  onClose: () => void;
  onSubmit: (data: Partial<Client>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    contact: initial?.contact ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    industry: initial?.industry ?? '',
    status: initial?.status ?? '활성' as Client['status'],
    notes: initial?.notes ?? '',
    totalOrders: initial?.totalOrders ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('회사명을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ ...form, totalOrders: Number(form.totalOrders) });
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>
            {mode === 'create' ? '고객사 등록' : '고객사 수정'}
          </h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='px-6 py-5 space-y-3.5'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>회사명 *</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder='(주)회사명'
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>담당자</label>
              <input
                value={form.contact}
                onChange={set('contact')}
                placeholder='홍길동'
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>연락처</label>
              <input
                value={form.phone}
                onChange={set('phone')}
                placeholder='010-0000-0000'
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>이메일</label>
              <input
                value={form.email}
                onChange={set('email')}
                placeholder='example@company.com'
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>업종</label>
              <input
                value={form.industry}
                onChange={set('industry')}
                placeholder='예) 마케팅, IT'
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>상태</label>
              <select
                value={form.status}
                onChange={set('status')}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
              >
                <option value='활성'>활성</option>
                <option value='대기'>대기</option>
                <option value='종료'>종료</option>
              </select>
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>총 주문 수</label>
              <input
                type='number'
                min={0}
                value={form.totalOrders}
                onChange={set('totalOrders')}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>메모</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder='특이사항, 계약 조건 등'
              rows={3}
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>

          {error && <p className='text-xs text-red-500'>{error}</p>}

          <div className='flex gap-3 pt-1'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition'
            >
              취소
            </button>
            <button
              type='submit'
              disabled={loading}
              className='flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition'
            >
              {loading ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 상담 기록 추가 모달 ──────────────────────────────────────────────────────

function ConsultationModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { date: string; type: Consultation['type']; memo: string }) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    type: '미팅' as Consultation['type'],
    memo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memo.trim()) { setError('내용을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(form);
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>상담 기록 추가</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='px-6 py-5 space-y-3.5'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>날짜</label>
              <input
                type='date'
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>유형</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Consultation['type'] }))}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
              >
                <option value='미팅'>미팅</option>
                <option value='전화'>전화</option>
                <option value='이메일'>이메일</option>
                <option value='기타'>기타</option>
              </select>
            </div>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>내용</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder='상담 내용을 입력하세요'
              rows={4}
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>

          {error && <p className='text-xs text-red-500'>{error}</p>}

          <div className='flex gap-3 pt-1'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition'
            >
              취소
            </button>
            <button
              type='submit'
              disabled={loading}
              className='flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition'
            >
              {loading ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
