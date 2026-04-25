'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  base: number;
  bonus: number;
  deduction: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────
function formatWon(amount: number) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `${Math.floor(amount / 10000).toLocaleString()}만`;
  return amount.toLocaleString();
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Data
// ────────────────────────────────────────────────────────────────────────────
const EMPLOYEES: Employee[] = [
  { id: '1', name: '김디자인', position: '대리', department: '디자인', base: 3200000, bonus: 200000, deduction: 320000 },
  { id: '2', name: '이디자인', position: '주임', department: '디자인', base: 2800000, bonus: 0, deduction: 280000 },
  { id: '3', name: '박마케팅', position: '과장', department: '마케팅', base: 3600000, bonus: 300000, deduction: 390000 },
  { id: '4', name: '최영업', position: '대리', department: '마케팅', base: 3000000, bonus: 150000, deduction: 315000 },
];

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const { user } = useAuthStore();
  const router = useRouter();
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

  const totalPayroll = EMPLOYEES.reduce((s, e) => s + e.base + e.bonus - e.deduction, 0);

  const toggleSelect = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () =>
    setSelected(selected.length === EMPLOYEES.length ? [] : EMPLOYEES.map((e) => e.id));

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h1 className='text-xl md:text-2xl font-bold text-gray-900'>급여 관리</h1>
          <p className='text-sm text-gray-500 mt-0.5'>직원별 급여를 관리하고 명세서를 발송합니다</p>
        </div>
        {selected.length > 0 && (
          <button className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition shrink-0'>
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
            </svg>
            {selected.length}명 명세서 발송
          </button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        <div className='bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>이번 달 급여 합계</p>
          <p className='text-xl font-bold text-purple-600'>₩{formatWon(totalPayroll)}</p>
          <p className='text-[10px] text-gray-400 mt-0.5'>₩{totalPayroll.toLocaleString()}</p>
        </div>
        <div className='bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>직원 수</p>
          <p className='text-xl font-bold text-blue-600'>{EMPLOYEES.length}명</p>
        </div>
        <div className='col-span-2 md:col-span-1 bg-white rounded-md border border-gray-100 p-4'>
          <p className='text-xs text-gray-400 mb-1'>총 수당</p>
          <p className='text-xl font-bold text-green-600'>
            +₩{formatWon(EMPLOYEES.reduce((s, e) => s + e.bonus, 0))}
          </p>
        </div>
      </div>

      {/* 선택 안내 */}
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm text-gray-500'>
          {selected.length > 0 ? `${selected.length}명 선택됨` : '명세서를 일괄 발송할 직원을 선택하세요'}
        </p>
      </div>

      {/* 모바일 카드 */}
      <div className='md:hidden space-y-2'>
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
              className={`bg-white rounded-md border p-4 cursor-pointer transition-colors ${
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
                      onClick={(e) => e.stopPropagation()}
                      className='text-xs text-blue-600 font-medium shrink-0'
                    >PDF</button>
                  </div>
                  <div className='grid grid-cols-3 gap-2 mt-3'>
                    <div className='text-center bg-gray-50 rounded-md py-2'>
                      <p className='text-[10px] text-gray-400 mb-0.5'>기본급</p>
                      <p className='text-xs font-semibold text-gray-700'>{formatWon(emp.base)}</p>
                    </div>
                    <div className='text-center bg-green-50 rounded-md py-2'>
                      <p className='text-[10px] text-gray-400 mb-0.5'>수당</p>
                      <p className='text-xs font-semibold text-green-600'>+{formatWon(emp.bonus)}</p>
                    </div>
                    <div className='text-center bg-red-50 rounded-md py-2'>
                      <p className='text-[10px] text-gray-400 mb-0.5'>공제</p>
                      <p className='text-xs font-semibold text-red-500'>-{formatWon(emp.deduction)}</p>
                    </div>
                  </div>
                  <div className='mt-3 pt-3 border-t border-gray-100 flex items-center justify-between'>
                    <span className='text-xs text-gray-400'>실지급액</span>
                    <span className='text-sm font-bold text-gray-900'>₩{net.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 데스크톱 테이블 */}
      <div className='hidden md:block bg-white rounded-md border border-gray-100 overflow-hidden'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-gray-50 border-b border-gray-100'>
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
          <tfoot>
            <tr className='border-t border-gray-100 bg-gray-50/70'>
              <td colSpan={7} className='px-5 py-3 text-xs font-semibold text-gray-500'>이번 달 총 지급 예정</td>
              <td className='px-5 py-3 font-bold text-gray-900'>₩{totalPayroll.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
