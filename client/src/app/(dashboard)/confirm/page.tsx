'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConfirmStatus = '컨펌대기' | '승인' | '반려' | '수정중';

interface Pin {
  _id: string;
  x: number;
  y: number;
  comment: string;
  author: string;
  resolved: boolean;
  createdAt: string;
}

interface ConfirmItem {
  _id: string;
  taskId?: string;
  title: string;
  designType: string;
  uploader: string;
  createdAt: string;
  status: ConfirmStatus;
  imageUrl: string;
  pins: Pin[];
  round: number;
  rejectionNote?: string;
}

// ─── Status Styles ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConfirmStatus, { label: string; bg: string; text: string; dot: string }> = {
  컨펌대기: { label: '컨펌 대기', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  승인: { label: '승인 완료', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  반려: { label: '반려됨', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  수정중: { label: '수정 중', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
};

// ─── Fallback Mock Data ───────────────────────────────────────────────────────

const MOCK_ITEMS: ConfirmItem[] = [
  {
    _id: 'mock-1',
    taskId: 'task-001',
    title: '봄 시즌 배너 v2',
    designType: '배너',
    uploader: '김디자인',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    status: '컨펌대기',
    imageUrl: '',
    round: 2,
    pins: [
      { _id: 'p1', x: 30, y: 25, comment: '로고 크기를 10% 키워주세요', author: '헤드어드민', resolved: false, createdAt: '2026-04-14 10:00' },
      { _id: 'p2', x: 70, y: 60, comment: '텍스트 색상이 배경과 대비가 부족합니다', author: '헤드어드민', resolved: false, createdAt: '2026-04-14 10:02' },
    ],
  },
  {
    _id: 'mock-2',
    taskId: 'task-002',
    title: '신제품 카탈로그 표지',
    designType: '카탈로그',
    uploader: '이디자인',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: '컨펌대기',
    imageUrl: '',
    round: 1,
    pins: [],
  },
  {
    _id: 'mock-3',
    taskId: 'task-003',
    title: 'SNS 카드뉴스 1편',
    designType: 'SNS',
    uploader: '박디자인',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    status: '승인',
    imageUrl: '',
    round: 1,
    pins: [],
  },
  {
    _id: 'mock-4',
    taskId: 'task-004',
    title: '브랜드 로고 시안',
    designType: '로고',
    uploader: '김디자인',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: '반려',
    imageUrl: '',
    round: 1,
    rejectionNote: '전체적인 색상 톤 수정 필요 — 더 밝고 세련된 느낌으로',
    pins: [
      { _id: 'p3', x: 50, y: 40, comment: '심볼 마크가 너무 복잡합니다. 단순화해주세요', author: '헤드어드민', resolved: false, createdAt: '2026-04-12 15:00' },
    ],
  },
  {
    _id: 'mock-5',
    taskId: 'task-005',
    title: '여름 프로모션 리플릿',
    designType: '인쇄물',
    uploader: '이디자인',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: '컨펌대기',
    imageUrl: '',
    round: 1,
    pins: [],
  },
];

// ─── Image Placeholder ────────────────────────────────────────────────────────

function ImagePlaceholder({ designType }: { designType: string }) {
  const colors: Record<string, string> = {
    배너: 'from-violet-100 to-purple-50',
    로고: 'from-blue-100 to-indigo-50',
    SNS: 'from-pink-100 to-rose-50',
    카탈로그: 'from-amber-100 to-yellow-50',
    인쇄물: 'from-green-100 to-emerald-50',
    기타: 'from-gray-100 to-slate-50',
  };
  return (
    <div className={`w-full h-full bg-linear-to-br ${colors[designType] ?? colors['기타']} flex flex-col items-center justify-center gap-2`}>
      <svg className='w-10 h-10 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
      </svg>
      <span className='text-xs text-gray-400'>{designType}</span>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

const DESIGN_TYPES = ['배너', '로고', 'SNS', '카탈로그', '인쇄물', '기타'];

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState('');
  const [designType, setDesignType] = useState('배너');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!file) { setError('이미지를 첨부해주세요.'); return; }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('designType', designType);
      formData.append('file', file);
      await api.post('/api/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
      onClose();
    } catch {
      setError('업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4'
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className='bg-white rounded-2xl shadow-2xl w-full max-w-lg'
      >
        {/* 헤더 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>결과물 업로드</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <div className='px-6 py-5 space-y-4'>
          {/* 제목 */}
          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1.5'>제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='예) 봄 시즌 배너 v2'
              className='w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'
            />
          </div>

          {/* 디자인 종류 */}
          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1.5'>디자인 종류 *</label>
            <div className='flex flex-wrap gap-2'>
              {DESIGN_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setDesignType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${designType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 파일 업로드 */}
          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1.5'>이미지 첨부 * (JPG, PNG, PDF / 최대 50MB)</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className='relative border-2 border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors overflow-hidden'
            >
              {preview ? (
                <img src={preview} alt='preview' className='w-full h-full object-cover' />
              ) : (
                <>
                  <svg className='w-8 h-8 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
                  </svg>
                  <p className='text-sm text-gray-400'>클릭하거나 파일을 여기에 드래그하세요</p>
                  <p className='text-xs text-gray-300'>JPG, PNG, PDF</p>
                </>
              )}
              {preview && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                  className='absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-black/70 transition-colors'
                >
                  <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type='file' accept='image/jpeg,image/png,application/pdf' onChange={handleFileChange} className='hidden' />
            {file && <p className='text-xs text-gray-500 mt-1.5'>📎 {file.name}</p>}
          </div>

          {error && <p className='text-xs text-red-500'>{error}</p>}
        </div>

        {/* 푸터 */}
        <div className='px-6 pb-5 flex gap-2'>
          <button onClick={onClose} className='flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors'>
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className='flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
          >
            {loading ? (
              <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
              </svg>
            ) : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
              </svg>
            )}
            {loading ? '업로드 중...' : '컨펌 요청'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConfirmPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [items, setItems] = useState<ConfirmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [reviewItem, setReviewItem] = useState<ConfirmItem | null>(null);

  const pending = items.filter((i) => i.status === '컨펌대기');
  const done = items.filter((i) => i.status !== '컨펌대기');

  // ── API 호출 ──────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/confirm');
      const real: ConfirmItem[] = res.data.data ?? res.data;
      // 실 데이터가 없으면 더미 데이터로 채워 UI 확인 가능하게
      setItems(real.length > 0 ? real : MOCK_ITEMS);
    } catch (e) {
      console.error(e);
      setItems(MOCK_ITEMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── 승인/반려 ─────────────────────────────────────────────
  const handleDecision = async (id: string, decision: '승인' | '반려', note?: string) => {
    try {
      if (decision === '승인') {
        await api.patch(`/api/confirm/${id}/approve`);
      } else {
        await api.patch(`/api/confirm/${id}/reject`, { rejectionNote: note ?? '' });
      }
      setItems((prev) =>
        prev.map((i) =>
          i._id === id
            ? { ...i, status: decision, rejectionNote: decision === '반려' ? note : undefined }
            : i,
        ),
      );
      setReviewItem(null);
    } catch (e) {
      console.error(e);
    }
  };

  // ── 핀 추가 ───────────────────────────────────────────────
  const handleAddPin = async (itemId: string, pin: Omit<Pin, '_id'>) => {
    try {
      const res = await api.post(`/api/confirm/${itemId}/pins`, {
        x: pin.x,
        y: pin.y,
        comment: pin.comment,
      });
      const updated: ConfirmItem = res.data.data ?? res.data;
      setItems((prev) => prev.map((i) => (i._id === itemId ? updated : i)));
      setReviewItem((prev) => (prev?._id === itemId ? updated : prev));
    } catch (e) {
      console.error(e);
    }
  };

  // ── 핀 해결 ───────────────────────────────────────────────
  const handleResolvePin = async (itemId: string, pinId: string) => {
    try {
      const res = await api.patch(`/api/confirm/${itemId}/pins/${pinId}/resolve`);
      const updated: ConfirmItem = res.data.data ?? res.data;
      setItems((prev) => prev.map((i) => (i._id === itemId ? updated : i)));
      setReviewItem((prev) => (prev?._id === itemId ? updated : prev));
    } catch (e) {
      console.error(e);
    }
  };

  // ── 핀 삭제 (로컬만) ─────────────────────────────────────
  const handleDeletePin = (itemId: string, pinId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i._id === itemId ? { ...i, pins: i.pins.filter((p) => p._id !== pinId) } : i,
      ),
    );
    setReviewItem((prev) =>
      prev ? { ...prev, pins: prev.pins.filter((p) => p._id !== pinId) } : prev,
    );
  };

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>컨펌 시스템</h1>
          <p className='text-sm text-gray-500 mt-1'>완성 결과물을 업로드하고 핀 피드백으로 최종 승인을 받습니다</p>
        </div>
        {/* 직원 안내: 업무 보드에서 업로드 */}
        {!isAdmin && (
          <Link
            href='/tasks'
            className='flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' />
            </svg>
            업무 보드에서 업로드
          </Link>
        )}
      </div>

      {/* 통계 바 (어드민용) */}
      {isAdmin && (
        <div className='grid grid-cols-4 gap-3'>
          {[
            { label: '대기 중', value: pending.length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '승인 완료', value: items.filter((i) => i.status === '승인').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '반려', value: items.filter((i) => i.status === '반려').length, color: 'text-red-600', bg: 'bg-red-50' },
            { label: '전체', value: items.length, color: 'text-gray-700', bg: 'bg-gray-50' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-xl px-4 py-3`}>
              <p className='text-xs text-gray-500 mb-1'>{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className='flex gap-1 bg-gray-100 p-1 rounded-xl w-fit'>
        {[
          { key: 'pending', label: `컨펌 대기 (${pending.length})` },
          { key: 'done', label: `처리 완료 (${done.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'pending' | 'done')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className='flex items-center justify-center py-16'>
          <svg className='w-6 h-6 animate-spin text-indigo-500' fill='none' viewBox='0 0 24 24'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
          </svg>
        </div>
      )}

      {/* 카드 그리드 */}
      {!loading && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          <AnimatePresence mode='popLayout'>
            {(tab === 'pending' ? pending : done).map((item) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className='bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group'
                onClick={() => setReviewItem(item)}
              >
                {/* 썸네일 */}
                <div className='relative h-44 overflow-hidden'>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className='w-full h-full object-cover' />
                  ) : (
                    <ImagePlaceholder designType={item.designType} />
                  )}
                  {/* 핀 카운트 뱃지 */}
                  {item.pins.length > 0 && (
                    <div className='absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full'>
                      <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                        <path fillRule='evenodd' d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' clipRule='evenodd' />
                      </svg>
                      {item.pins.filter((p) => !p.resolved).length}개 피드백
                    </div>
                  )}
                  {/* 수정 회차 */}
                  {item.round > 1 && (
                    <div className='absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-medium'>
                      {item.round}차 수정
                    </div>
                  )}
                  {/* 호버 오버레이 */}
                  <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center'>
                    <span className='opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg shadow transition-opacity'>
                      {isAdmin && item.status === '컨펌대기' ? '검토하기' : '자세히 보기'}
                    </span>
                  </div>
                </div>

                <div className='p-4'>
                  <div className='flex items-start justify-between gap-2 mb-2'>
                    <p className='text-sm font-semibold text-gray-800 leading-tight'>{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className='text-xs text-gray-400 mb-1'>
                    {item.uploader} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                  <p className='text-xs text-gray-400'>{item.designType}</p>

                  {item.rejectionNote && (
                    <div className='mt-3 flex gap-2 bg-red-50 rounded-lg px-3 py-2'>
                      <svg className='w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5' fill='currentColor' viewBox='0 0 20 20'>
                        <path fillRule='evenodd' d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
                      </svg>
                      <p className='text-xs text-red-600 line-clamp-2'>{item.rejectionNote}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {(tab === 'pending' ? pending : done).length === 0 && (
            <div className='col-span-3 text-center py-16 text-gray-400 text-sm'>
              {tab === 'pending' ? (
                <div className='space-y-3'>
                  <p>대기 중인 컨펌 항목이 없습니다.</p>
                  {!isAdmin && (
                    <Link
                      href='/tasks'
                      className='inline-flex items-center gap-1.5 text-indigo-500 hover:text-indigo-700 font-medium transition-colors'
                    >
                      업무 보드 → 컨펌대기 카드에서 업로드하세요
                    </Link>
                  )}
                </div>
              ) : '처리 완료된 항목이 없습니다.'}
            </div>
          )}
        </div>
      )}

      {/* 검토 오버레이 */}
      <AnimatePresence>
        {reviewItem && (
          <ReviewOverlay
            item={reviewItem}
            isAdmin={isAdmin}
            currentUser={user?.name ?? '어드민'}
            onClose={() => setReviewItem(null)}
            onDecision={handleDecision}
            onAddPin={handleAddPin}
            onResolvePin={handleResolvePin}
            onDeletePin={handleDeletePin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConfirmStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── ReviewOverlay ────────────────────────────────────────────────────────────

interface ReviewOverlayProps {
  item: ConfirmItem;
  isAdmin: boolean;
  currentUser: string;
  onClose: () => void;
  onDecision: (id: string, decision: '승인' | '반려', note?: string) => void;
  onAddPin: (itemId: string, pin: Omit<Pin, '_id'>) => void;
  onResolvePin: (itemId: string, pinId: string) => void;
  onDeletePin: (itemId: string, pinId: string) => void;
}

function ReviewOverlay({ item, isAdmin, currentUser, onClose, onDecision, onAddPin, onResolvePin, onDeletePin }: ReviewOverlayProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [pinMode, setPinMode] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [newPinPos, setNewPinPos] = useState<{ x: number; y: number } | null>(null);
  const [newPinComment, setNewPinComment] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showPins, setShowPins] = useState(true);

  const toggleShowPins = () => {
    setShowPins((v) => {
      if (v) setActivePinId(null);
      return !v;
    });
  };

  const canInteract = isAdmin && item.status === '컨펌대기';

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pinMode || !canInteract) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setNewPinPos({ x, y });
      setNewPinComment('');
      setActivePinId(null);
    },
    [pinMode, canInteract],
  );

  const handleSavePin = () => {
    if (!newPinPos || !newPinComment.trim()) return;
    onAddPin(item._id, {
      x: newPinPos.x,
      y: newPinPos.y,
      comment: newPinComment.trim(),
      author: currentUser,
      resolved: false,
      createdAt: new Date().toLocaleString('ko-KR'),
    });
    setNewPinPos(null);
    setNewPinComment('');
  };

  const handleApprove = () => {
    onDecision(item._id, '승인');
  };

  const handleReject = () => {
    if (!rejectionNote.trim()) {
      setShowRejectConfirm(true);
      return;
    }
    onDecision(item._id, '반려', rejectionNote);
  };

  const unresolvedPins = item.pins.filter((p) => !p.resolved);
  const resolvedPins = item.pins.filter((p) => p.resolved);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 bg-black/70 flex items-stretch'
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className='flex w-full max-w-6xl mx-auto my-4 bg-white rounded-2xl overflow-hidden shadow-2xl'
      >
        {/* ── 이미지 영역 ── */}
        <div className='flex-1 flex flex-col bg-gray-950 min-w-0'>
          {/* 툴바 */}
          <div className='flex items-center justify-between px-4 py-3 bg-gray-900'>
            <div className='flex items-center gap-3'>
              <button onClick={onClose} className='text-gray-400 hover:text-white transition-colors'>
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
              <div>
                <p className='text-white text-sm font-semibold'>{item.title}</p>
                <p className='text-gray-400 text-xs'>
                  {item.uploader} · {new Date(item.createdAt).toLocaleDateString('ko-KR')} · {item.round}차 제출
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <StatusBadge status={item.status} />
              {item.pins.length > 0 && (
                <button
                  onClick={toggleShowPins}
                  title={showPins ? '핀 숨기기' : '핀 보기'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${showPins ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                >
                  <svg className='w-3.5 h-4' viewBox='0 0 24 30' fill='currentColor'>
                    <path d='M12 0C7.58 0 4 3.58 4 8c0 5.25 8 18 8 18s8-12.75 8-18c0-4.42-3.58-8-8-8z' />
                    <circle cx='12' cy='8' r='3.2' fill='white' fillOpacity='0.35' />
                  </svg>
                  {showPins ? '핀 숨기기' : `핀 ${item.pins.length}개`}
                </button>
              )}
              {canInteract && (
                <button
                  onClick={() => { setPinMode((v) => !v); setNewPinPos(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${pinMode ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  <svg className='w-3.5 h-4' viewBox='0 0 24 30' fill='currentColor'>
                    <path d='M12 0C7.58 0 4 3.58 4 8c0 5.25 8 18 8 18s8-12.75 8-18c0-4.42-3.58-8-8-8z' />
                    <circle cx='12' cy='8' r='3.2' fill='white' fillOpacity='0.5' />
                  </svg>
                  {pinMode ? '핀 모드 ON' : '핀 추가'}
                </button>
              )}
            </div>
          </div>

          {/* 이미지 + 핀 */}
          <div className='flex-1 overflow-auto flex items-center justify-center p-4'>
            <div
              ref={imageRef}
              onClick={handleImageClick}
              className={`relative inline-block max-w-full max-h-full ${pinMode && canInteract ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{ minWidth: '400px', minHeight: '300px' }}
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className='max-w-full max-h-full object-contain' />
              ) : (
                <div className='w-150 h-100 bg-linear-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center gap-3 rounded-lg'>
                  <svg className='w-16 h-16 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                  </svg>
                  <p className='text-gray-400 text-sm'>이미지 미리보기</p>
                  {pinMode && <p className='text-blue-400 text-xs'>클릭하여 핀을 추가하세요</p>}
                </div>
              )}

              {/* 기존 핀들 */}
              <AnimatePresence>
                {showPins && item.pins.map((pin, idx) => (
                  <PinMarker
                    key={pin._id}
                    pin={pin}
                    index={idx + 1}
                    isActive={activePinId === pin._id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinId((prev) => (prev === pin._id ? null : pin._id));
                      setNewPinPos(null);
                    }}
                  />
                ))}
              </AnimatePresence>

              {/* 새 핀 위치 표시 */}
              {newPinPos && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className='absolute z-20 pointer-events-none'
                  style={{ left: `${newPinPos.x}%`, top: `${newPinPos.y}%`, transform: 'translate(-50%, -100%)' }}
                >
                  <svg width='32' height='40' viewBox='0 0 32 40' fill='none' style={{ filter: 'drop-shadow(0 0 8px #3b82f6aa)' }}>
                    <path d='M16 0C9.373 0 4 5.373 4 12c0 7.5 12 26 12 26S28 19.5 28 12c0-6.627-5.373-12-12-12z' fill='#3b82f6' />
                    <circle cx='16' cy='12' r='5.5' fill='white' />
                    <text x='16' y='12' textAnchor='middle' dominantBaseline='central' fontSize='9' fontWeight='700' fontFamily='system-ui' fill='#3b82f6'>+</text>
                  </svg>
                </motion.div>
              )}

              {/* 핀 말풍선 (활성) */}
              {activePinId && (() => {
                const pin = item.pins.find((p) => p._id === activePinId);
                if (!pin) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='absolute z-30 bg-white rounded-xl shadow-xl p-3 w-60'
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, calc(-100% - 44px))' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className='flex items-center justify-between mb-1'>
                      <p className='text-xs font-semibold text-gray-700'>{pin.author}</p>
                      <button
                        onClick={() => setActivePinId(null)}
                        className='w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors'
                      >
                        <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
                        </svg>
                      </button>
                    </div>
                    <p className='text-xs text-gray-600'>{pin.comment}</p>
                    <p className='text-xs text-gray-400 mt-1'>{pin.createdAt}</p>
                    {canInteract && !pin.resolved && (
                      <div className='mt-2 flex gap-1.5'>
                        <button
                          onClick={() => { onResolvePin(item._id, pin._id); setActivePinId(null); }}
                          className='flex-1 text-xs py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-medium'
                        >
                          해결됨
                        </button>
                        <button
                          onClick={() => { onDeletePin(item._id, pin._id); setActivePinId(null); }}
                          className='flex-1 text-xs py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium'
                        >
                          핀 삭제
                        </button>
                      </div>
                    )}
                    {pin.resolved && <span className='mt-1 text-xs text-emerald-500 block'>✓ 해결됨</span>}
                  </motion.div>
                );
              })()}
            </div>
          </div>

          {/* 새 핀 코멘트 입력 */}
          <AnimatePresence>
            {newPinPos && canInteract && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className='bg-gray-900 border-t border-gray-800 px-4 py-3 flex gap-2 items-center'
              >
                <div className='w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold leading-none shrink-0'>
                  {item.pins.length + 1}
                </div>
                <input
                  autoFocus
                  value={newPinComment}
                  onChange={(e) => setNewPinComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePin(); if (e.key === 'Escape') setNewPinPos(null); }}
                  placeholder='피드백을 입력하세요 (Enter 저장, Esc 취소)'
                  className='flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500'
                />
                <button onClick={handleSavePin} className='px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition'>저장</button>
                <button onClick={() => setNewPinPos(null)} className='px-3 py-2 bg-gray-700 text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-600 transition'>취소</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 우측 패널 ── */}
        <div className='w-80 flex flex-col border-l border-gray-100 bg-white'>
          <div className='px-5 py-4 border-b border-gray-100'>
            <h2 className='text-sm font-bold text-gray-900'>{item.title}</h2>
            <div className='flex gap-2 mt-2'>
              <span className='text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md'>{item.designType}</span>
              <span className='text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md'>{item.round}차 수정</span>
            </div>
          </div>

          {/* 핀 목록 */}
          <div className='flex-1 overflow-y-auto'>
            <div className='px-5 py-4'>
              <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'>
                핀 피드백 ({unresolvedPins.length}개 미해결)
              </p>

              {item.pins.length === 0 && (
                <div className='text-center py-8'>
                  <div className='w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-2'>
                    <svg className='w-5 h-5 text-gray-300' fill='currentColor' viewBox='0 0 20 20'>
                      <path fillRule='evenodd' d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' clipRule='evenodd' />
                    </svg>
                  </div>
                  <p className='text-xs text-gray-400'>
                    {canInteract ? '이미지를 클릭해 핀을 추가하세요' : '피드백 핀이 없습니다'}
                  </p>
                </div>
              )}

              <div className='space-y-2'>
                {unresolvedPins.map((pin, idx) => (
                  <PinCommentCard
                    key={pin._id}
                    pin={pin}
                    index={idx + 1}
                    isActive={activePinId === pin._id}
                    canResolve={canInteract}
                    onClick={() => setActivePinId((prev) => (prev === pin._id ? null : pin._id))}
                    onResolve={() => { onResolvePin(item._id, pin._id); setActivePinId(null); }}
                  />
                ))}
              </div>

              {resolvedPins.length > 0 && (
                <div className='mt-4'>
                  <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2'>해결됨 ({resolvedPins.length})</p>
                  <div className='space-y-2'>
                    {resolvedPins.map((pin, idx) => (
                      <PinCommentCard
                        key={pin._id}
                        pin={pin}
                        index={unresolvedPins.length + idx + 1}
                        isActive={false}
                        canResolve={false}
                        resolved
                        onClick={() => {}}
                        onResolve={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 반려 메모 */}
          {item.rejectionNote && item.status === '반려' && (
            <div className='px-5 py-4 border-t border-gray-100 bg-red-50'>
              <p className='text-xs font-semibold text-red-600 mb-1'>반려 사유</p>
              <p className='text-xs text-red-700'>{item.rejectionNote}</p>
            </div>
          )}

          {/* 승인/반려 액션 (어드민 전용) */}
          {canInteract && (
            <div className='px-5 py-4 border-t border-gray-100 space-y-3'>
              {showRejectConfirm ? (
                <div className='space-y-2'>
                  <p className='text-xs font-semibold text-gray-700'>반려 사유 입력</p>
                  <textarea
                    rows={3}
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    placeholder='수정 요청 사항을 입력하세요...'
                    className='w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none'
                  />
                  <div className='flex gap-2'>
                    <button onClick={() => setShowRejectConfirm(false)} className='flex-1 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50'>취소</button>
                    <button
                      onClick={() => onDecision(item._id, '반려', rejectionNote)}
                      disabled={!rejectionNote.trim()}
                      className='flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition'
                    >
                      반려 확정
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className='text-xs text-gray-500 text-center'>
                    {unresolvedPins.length > 0
                      ? `${unresolvedPins.length}개의 미해결 피드백이 있습니다`
                      : '검토를 완료하고 결정하세요'}
                  </p>
                  <button
                    onClick={handleApprove}
                    className='w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
                    </svg>
                    승인
                  </button>
                  <button
                    onClick={() => setShowRejectConfirm(true)}
                    className='w-full py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                    반려
                  </button>
                </>
              )}
            </div>
          )}

          {/* 승인/반려 결과 표시 (읽기 전용) */}
          {!canInteract && item.status !== '컨펌대기' && (
            <div className={`px-5 py-4 border-t border-gray-100 ${item.status === '승인' ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className='flex items-center gap-2'>
                {item.status === '승인' ? (
                  <svg className='w-5 h-5 text-emerald-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                ) : (
                  <svg className='w-5 h-5 text-red-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                )}
                <p className={`text-sm font-semibold ${item.status === '승인' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {item.status === '승인' ? '최종 승인 완료' : '반려됨'}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── PinMarker ────────────────────────────────────────────────────────────────

interface PinMarkerProps {
  pin: Pin;
  index: number;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function PinMarker({ pin, index, isActive, onClick }: PinMarkerProps) {
  const color = pin.resolved ? '#10b981' : isActive ? '#3b82f6' : '#ef4444';
  const scale = isActive ? 1.3 : 1;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: isActive ? 1.3 : 1.15 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className='absolute z-10 focus:outline-none drop-shadow-lg'
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -100%)',
        filter: isActive ? `drop-shadow(0 0 6px ${color}aa)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
      }}
      onClick={onClick}
      title={pin.comment}
    >
      <svg width='32' height='40' viewBox='0 0 32 40' fill='none'>
        <path d='M16 0C9.373 0 4 5.373 4 12c0 7.5 12 26 12 26S28 19.5 28 12c0-6.627-5.373-12-12-12z' fill={color} />
        <circle cx='16' cy='12' r='5.5' fill='white' />
        <text x='16' y='12' textAnchor='middle' dominantBaseline='central' fontSize='7' fontWeight='700' fontFamily='system-ui, sans-serif' fill={color}>
          {index}
        </text>
      </svg>
    </motion.button>
  );
}

// ─── PinCommentCard ───────────────────────────────────────────────────────────

interface PinCommentCardProps {
  pin: Pin;
  index: number;
  isActive: boolean;
  canResolve: boolean;
  resolved?: boolean;
  onClick: () => void;
  onResolve: () => void;
}

function PinCommentCard({ pin, index, isActive, canResolve, resolved, onClick, onResolve }: PinCommentCardProps) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all
        ${resolved ? 'border-gray-100 bg-gray-50 opacity-60' : isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
    >
      <div className='flex items-start gap-2'>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold leading-none shrink-0 mt-0.5
          ${resolved ? 'bg-emerald-400' : 'bg-red-500'}`}>
          {index}
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-xs text-gray-700 leading-relaxed'>{pin.comment}</p>
          <p className='text-xs text-gray-400 mt-1'>{pin.author} · {pin.createdAt}</p>
        </div>
      </div>
      {canResolve && !resolved && (
        <button
          onClick={(e) => { e.stopPropagation(); onResolve(); }}
          className='mt-2 w-full text-xs py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors font-medium'
        >
          해결됨
        </button>
      )}
      {resolved && <p className='mt-1 text-xs text-emerald-500 font-medium'>✓ 해결됨</p>}
    </motion.div>
  );
}
