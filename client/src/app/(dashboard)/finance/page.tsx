'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

type FinanceTab = '매출현황' | '급여관리';

const REVENUE = [
  { month: '1월', amount: 12800000 },
  { month: '2월', amount: 9500000 },
  { month: '3월', amount: 15200000 },
  { month: '4월', amount: 8100000 },
];

const EMPLOYEES = [
  { id: '1', name: '김디자인', position: '대리', department: '디자인', base: 3200000, bonus: 200000, deduction: 320000 },
  { id: '2', name: '이디자인', position: '주임', department: '디자인', base: 2800000, bonus: 0, deduction: 280000 },
  { id: '3', name: '박마케팅', position: '과장', department: '마케팅', base: 3600000, bonus: 300000, deduction: 390000 },
  { id: '4', name: '최영업', position: '대리', department: '마케팅', base: 3000000, bonus: 150000, deduction: 315000 },
];

// 만원 단위 축약 표시
function formatWon(amount: number) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `${Math.floor(amount / 10000).toLocaleString()}만`;
  return amount.toLocaleString();
}

export default function FinancePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<FinanceTab>('매출현황');
  const [selected, setSelected] = useState<string[]>([]);

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

  const totalRevenue = REVENUE.reduce((s, r) => s + r.amount, 0);
  const maxAmount = Math.max(...REVENUE.map((r) => r.amount));

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === EMPLOYEES.length ? [] : EMPLOYEES.map((e) => e.id));

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div>
        <h1 className='text-xl md:text-2xl font-bold text-gray-900'>재무 / 급여 관리</h1>
        <p className='text-sm text-gray-500 mt-0.5'>매출 현황 및 직원 급여를 관리합니다</p>
      </div>

      {/* 요약 카드 — 모바일 2열, 마지막 1개 full */}
      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        <SummaryCard
          label='올해 누적'
          subLabel='매출'
          value={formatWon(totalRevenue)}
          fullValue={`₩${totalRevenue.toLocaleString()}`}
          color='blue'
          icon={
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' />
            </svg>
          }
        />
        <SummaryCard
          label='이번 달'
          subLabel='계약 건수'
          value='4건'
          color='green'
          icon={
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
            </svg>
          }
        />
        {/* 모바일에서 2열 full-span */}
        <div className='col-span-2 md:col-span-1'>
          <SummaryCard
            label='이번 달'
            subLabel='급여 지급 예정'
            value={formatWon(38620000)}
            fullValue='₩38,620,000'
            color='purple'
            icon={
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' />
              </svg>
            }
            horizontal
          />
        </div>
      </div>

      {/* 탭 */}
      <div className='flex gap-1 bg-gray-100 p-1 rounded-xl w-fit'>
        {(['매출현황', '급여관리'] as FinanceTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 매출현황 */}
      {tab === '매출현황' && (
        <div className='bg-white rounded-2xl border border-gray-100 p-4 md:p-6'>
          <h2 className='text-sm md:text-base font-semibold text-gray-800 mb-5'>월별 매출 현황 (2026)</h2>
          <div className='flex items-end gap-2 md:gap-4 h-40 md:h-48'>
            {REVENUE.map((r) => {
              const height = (r.amount / maxAmount) * 100;
              return (
                <div key={r.month} className='flex-1 flex flex-col items-center gap-1.5'>
                  <span className='text-[11px] md:text-xs font-semibold text-gray-700 whitespace-nowrap'>
                    ₩{formatWon(r.amount)}
                  </span>
                  <div
                    className='w-full rounded-t-lg bg-blue-500 transition-all duration-500 hover:bg-blue-600'
                    style={{ height: `${height}%` }}
                  />
                  <span className='text-[11px] md:text-xs text-gray-400'>{r.month}</span>
                </div>
              );
            })}
          </div>
          <div className='mt-4 md:mt-6 pt-4 border-t border-gray-50 flex items-center justify-between gap-2'>
            <span className='text-xs md:text-sm text-gray-400'>2026년 1~4월 합계</span>
            <span className='text-base md:text-lg font-bold text-gray-900'>₩{totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 급여관리 */}
      {tab === '급여관리' && (
        <div className='space-y-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <p className='text-sm text-gray-500'>
              {selected.length > 0 ? `${selected.length}명 선택됨` : '명세서를 일괄 발송할 직원을 선택하세요'}
            </p>
            {selected.length > 0 && (
              <button className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition self-start sm:self-auto'>
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                </svg>
                {selected.length}명 명세서 발송
              </button>
            )}
          </div>

          {/* 데스크탑 테이블 */}
          <div className='hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50'>
                  <th className='px-5 py-3 text-left'>
                    <input type='checkbox' checked={selected.length === EMPLOYEES.length} onChange={toggleAll} className='rounded' />
                  </th>
                  {['이름', '직급', '부서', '기본급', '수당', '공제', '실지급액'].map((h) => (
                    <th key={h} className='px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider'>{h}</th>
                  ))}
                  <th className='px-5 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {EMPLOYEES.map((emp) => {
                  const net = emp.base + emp.bonus - emp.deduction;
                  return (
                    <tr key={emp.id} className='hover:bg-gray-50 transition-colors'>
                      <td className='px-5 py-4'>
                        <input type='checkbox' checked={selected.includes(emp.id)} onChange={() => toggleSelect(emp.id)} className='rounded' />
                      </td>
                      <td className='px-5 py-4 font-medium text-gray-800'>{emp.name}</td>
                      <td className='px-5 py-4 text-gray-500'>{emp.position}</td>
                      <td className='px-5 py-4 text-gray-500'>{emp.department}</td>
                      <td className='px-5 py-4 text-gray-700'>₩{emp.base.toLocaleString()}</td>
                      <td className='px-5 py-4 text-green-600'>+₩{emp.bonus.toLocaleString()}</td>
                      <td className='px-5 py-4 text-red-500'>-₩{emp.deduction.toLocaleString()}</td>
                      <td className='px-5 py-4 font-bold text-gray-900'>₩{net.toLocaleString()}</td>
                      <td className='px-5 py-4'>
                        <button className='text-xs text-blue-600 hover:text-blue-700 font-medium'>PDF</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className='md:hidden space-y-2'>
            {/* 전체 선택 */}
            <label className='flex items-center gap-2 px-1 py-1 text-xs text-gray-500 cursor-pointer'>
              <input type='checkbox' checked={selected.length === EMPLOYEES.length} onChange={toggleAll} className='rounded' />
              전체 선택
            </label>
            {EMPLOYEES.map((emp) => {
              const net = emp.base + emp.bonus - emp.deduction;
              const isChecked = selected.includes(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleSelect(emp.id)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-colors ${
                    isChecked ? 'border-blue-400 bg-blue-50/30' : 'border-gray-100'
                  }`}
                >
                  <div className='flex items-start gap-3'>
                    <input
                      type='checkbox'
                      checked={isChecked}
                      onChange={() => toggleSelect(emp.id)}
                      onClick={(e) => e.stopPropagation()}
                      className='rounded mt-0.5'
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <span className='font-semibold text-gray-800 text-sm'>{emp.name}</span>
                          <span className='text-xs text-gray-400'>{emp.position} · {emp.department}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className='text-xs text-blue-600 font-medium shrink-0'
                        >
                          PDF
                        </button>
                      </div>
                      <div className='grid grid-cols-3 gap-2 mt-3'>
                        <div className='text-center bg-gray-50 rounded-lg py-2'>
                          <p className='text-[10px] text-gray-400 mb-0.5'>기본급</p>
                          <p className='text-xs font-semibold text-gray-700'>{formatWon(emp.base)}</p>
                        </div>
                        <div className='text-center bg-green-50 rounded-lg py-2'>
                          <p className='text-[10px] text-gray-400 mb-0.5'>수당</p>
                          <p className='text-xs font-semibold text-green-600'>+{formatWon(emp.bonus)}</p>
                        </div>
                        <div className='text-center bg-red-50 rounded-lg py-2'>
                          <p className='text-[10px] text-gray-400 mb-0.5'>공제</p>
                          <p className='text-xs font-semibold text-red-500'>-{formatWon(emp.deduction)}</p>
                        </div>
                      </div>
                      <div className='flex items-center justify-between mt-3 pt-3 border-t border-gray-100'>
                        <span className='text-xs text-gray-400'>실지급액</span>
                        <span className='text-sm font-bold text-gray-900'>₩{net.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  subLabel,
  value,
  fullValue,
  color,
  icon,
  horizontal,
}: {
  label: string;
  subLabel: string;
  value: string;
  fullValue?: string;
  color: 'blue' | 'green' | 'purple';
  icon: React.ReactNode;
  horizontal?: boolean;
}) {
  const colorMap = {
    blue: { badge: 'bg-blue-50 text-blue-600', icon: 'bg-blue-100 text-blue-600' },
    green: { badge: 'bg-green-50 text-green-600', icon: 'bg-green-100 text-green-600' },
    purple: { badge: 'bg-purple-50 text-purple-600', icon: 'bg-purple-100 text-purple-600' },
  };
  const c = colorMap[color];

  if (horizontal) {
    return (
      <div className='bg-white rounded-2xl border border-gray-100 p-4 h-full flex items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
            {icon}
          </div>
          <div>
            <p className='text-[11px] text-gray-400 leading-none'>{label}</p>
            <p className='text-xs font-medium text-gray-500 mt-0.5'>{subLabel}</p>
          </div>
        </div>
        <div className='text-right'>
          <p className='text-lg font-bold text-gray-900 leading-none'>{value}</p>
          {fullValue && <p className='text-[10px] text-gray-400 mt-0.5'>{fullValue}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-2xl border border-gray-100 p-4'>
      <div className='flex items-center justify-between mb-3'>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className='text-xl md:text-2xl font-bold text-gray-900 leading-none'>{value}</p>
      {fullValue && <p className='text-[10px] text-gray-400 mt-0.5'>{fullValue}</p>}
      <p className='text-xs text-gray-400 mt-1.5'>
        <span className={`font-medium text-[11px] px-1.5 py-0.5 rounded ${c.badge}`}>{label}</span>
        <span className='ml-1'>{subLabel}</span>
      </p>
    </div>
  );
}
