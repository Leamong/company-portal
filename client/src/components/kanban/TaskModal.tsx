'use client';

import { useState, useEffect } from 'react';
import { type Task } from './types';

const DESIGN_TYPES = ['배너', '로고', 'SNS', '카탈로그', '인쇄물', '기타'];
const DEPARTMENTS = [
  { value: 'marketing', label: '마케팅팀' },
  { value: 'design', label: '디자인팀' },
];

interface Props {
  mode: 'create' | 'edit';
  initial?: Task;
  onClose: () => void;
  onSubmit: (data: Partial<Task>) => Promise<void>;
}

export default function TaskModal({ mode, initial, onClose, onSubmit }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    client: '',
    assigneeName: '',
    department: 'design' as 'marketing' | 'design',
    dueDate: '',
    orderDate: today,
    quantity: '1',
    designType: '배너',
    priority: '일반' as '긴급' | '일반',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        client: initial.client,
        assigneeName: initial.assigneeName,
        department: initial.department,
        dueDate: initial.dueDate,
        orderDate: initial.orderDate,
        quantity: String(initial.quantity),
        designType: initial.designType,
        priority: initial.priority,
        notes: initial.notes,
      });
    }
  }, [initial]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ ...form, quantity: Number(form.quantity) });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white rounded-t-2xl flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {mode === 'create' ? '새 주문 등록' : '주문 수정'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === 'create' ? '주문 정보를 입력하세요' : '수정할 내용을 변경하세요'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 업무명 */}
          <Field label="업무명" required>
            <input
              type="text"
              required
              placeholder="예) 봄 시즌 배너 제작"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* 고객사 */}
          <Field label="고객사" required>
            <input
              type="text"
              required
              placeholder="예) (주)ABC마케팅"
              value={form.client}
              onChange={(e) => set('client', e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* 우선순위 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">우선순위</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('priority', '일반')}
                className={[
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                  form.priority === '일반'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-400 shadow-sm'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                일반
              </button>
              <button
                type="button"
                onClick={() => set('priority', '긴급')}
                className={[
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                  form.priority === '긴급'
                    ? 'bg-red-50 text-red-600 border-red-400 shadow-sm'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-400',
                ].join(' ')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                긴급
              </button>
            </div>
            {form.priority === '긴급' && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                긴급 업무로 등록됩니다. 카드에 빨간 뱃지가 표시됩니다.
              </p>
            )}
          </div>

          {/* 담당 부서 */}
          <Field label="담당 부서" required>
            <select value={form.department} onChange={(e) => set('department', e.target.value)} className={inputCls}>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>

          {/* 담당자 */}
          <Field label="담당자">
            <input
              type="text"
              placeholder="담당자 이름"
              value={form.assigneeName}
              onChange={(e) => set('assigneeName', e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* 디자인 종류 */}
          <Field label="디자인 종류" required>
            <div className="flex flex-wrap gap-2 pt-1">
              {DESIGN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('designType', t)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.designType === t
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          {/* 주문일 + 마감일 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="주문일" required>
              <input
                type="date"
                required
                value={form.orderDate}
                onChange={(e) => set('orderDate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="마감일" required>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* 수량 */}
          <Field label="수량 (장)" required>
            <input
              type="number"
              required
              min={1}
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* 특이사항 */}
          <Field label="특이사항">
            <textarea
              rows={2}
              placeholder="고객 요청사항, 참고사항 등"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </Field>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {loading ? '저장 중...' : mode === 'create' ? '등록하기' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
