'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { cn, formatDateShort } from '@/lib/utils';

interface Employee {
  _id: string;
  name: string;
  position: string;
  role: 'head-admin' | 'employee';
  isActive: boolean;
  leaveBalance?: {
    notApplicable?: boolean;
    hireDate?: string | null;
    total?: number;
    remaining?: number;
    periodEnd?: string | null;
    daysUntilExpiry?: number | null;
  };
}

const WARNING_THRESHOLD = 90;

function badgeStyle(days: number) {
  if (days <= 7) return { bg: 'bg-red-100', text: 'text-red-700' };
  if (days <= 30) return { bg: 'bg-orange-100', text: 'text-orange-700' };
  return { bg: 'bg-amber-100', text: 'text-amber-700' };
}

export default function LeaveExpiringWidget() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      api
        .get('/api/users')
        .then((res) => setEmployees(res.data))
        .catch(() => setEmployees([]))
        .finally(() => setLoading(false));
    };
    refresh();
    // 휴가 승인 시 잔여 연차가 바뀌므로 재조회
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => window.removeEventListener('approval:changed', onChange);
  }, []);

  const expiring = employees
    .filter(
      (e) =>
        e.isActive &&
        e.role === 'employee' &&
        e.leaveBalance &&
        !e.leaveBalance.notApplicable &&
        e.leaveBalance.hireDate &&
        typeof e.leaveBalance.daysUntilExpiry === 'number' &&
        e.leaveBalance.daysUntilExpiry <= WARNING_THRESHOLD &&
        (e.leaveBalance.remaining ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (a.leaveBalance!.daysUntilExpiry ?? 0) -
        (b.leaveBalance!.daysUntilExpiry ?? 0),
    )
    .slice(0, 5);

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <h2 className='text-sm font-semibold text-gray-800'>연차 만료 임박</h2>
          {expiring.length > 0 && (
            <span className='text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5'>
              {expiring.length}
            </span>
          )}
        </div>
        <Link
          href='/admin'
          className='text-[11px] text-blue-600 hover:text-blue-700 font-medium'
        >
          관리 →
        </Link>
      </div>

      {loading ? (
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : expiring.length === 0 ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center py-6'>
          <span className='text-2xl mb-2'>✅</span>
          <p className='text-xs text-gray-400'>3개월 내 만료 예정 없음</p>
          <p className='text-[11px] text-gray-300 mt-0.5'>
            잔여 연차가 있는 직원은 모두 여유있는 상태입니다
          </p>
        </div>
      ) : (
        <ul className='flex-1 space-y-1.5 overflow-y-auto -mr-1 pr-1'>
          {expiring.map((emp) => {
            const lb = emp.leaveBalance!;
            const days = lb.daysUntilExpiry ?? 0;
            const style = badgeStyle(days);
            const dLabel = days <= 0 ? '오늘 만료' : `D-${days}`;
            return (
              <li
                key={emp._id}
                className='flex items-center gap-2 p-2 rounded-md border border-gray-100'
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs font-semibold text-gray-800 truncate'>
                      {emp.name}
                    </span>
                    <span className='text-[10px] text-gray-400'>{emp.position}</span>
                  </div>
                  <p className='text-[10px] text-gray-400 mt-0.5 tabular-nums'>
                    잔여 {lb.remaining}일 · 만료 {formatDateShort(lb.periodEnd)}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full shrink-0 tabular-nums',
                    style.bg,
                    style.text,
                  )}
                >
                  {dLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
