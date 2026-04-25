'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Employee {
  _id: string;
  role: 'head-admin' | 'employee';
  status: '출근' | '퇴근';
  absenceStatus?: '휴가' | '부재' | null;
  isActive: boolean;
}

export default function TodayAttendanceWidget() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      api
        .get('/api/users')
        .then((res) => setEmployees((res.data as Employee[]).filter((e) => e.isActive)))
        .catch(() => setEmployees([]))
        .finally(() => setLoading(false));
    };
    refresh();
    // 결재(휴가) 상태 변동 시 휴가·부재 카운트가 바뀔 수 있어 재조회
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => window.removeEventListener('approval:changed', onChange);
  }, []);

  // 분류: 출근 / 퇴근 / 휴가·부재 (absenceStatus 가 있으면 우선)
  const total = employees.length;
  const onLeave = employees.filter((e) => e.absenceStatus).length;
  const working = employees.filter((e) => !e.absenceStatus && e.status === '출근').length;
  const off = employees.filter((e) => !e.absenceStatus && e.status === '퇴근').length;
  const workingPct = total > 0 ? Math.round((working / total) * 100) : 0;

  const stats = [
    { label: '전체', value: total, color: 'text-gray-700', dot: 'bg-gray-400' },
    { label: '출근', value: working, color: 'text-green-600', dot: 'bg-green-500' },
    { label: '퇴근', value: off, color: 'text-gray-500', dot: 'bg-gray-300' },
    { label: '휴가·부재', value: onLeave, color: 'text-blue-600', dot: 'bg-blue-400' },
  ];

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-semibold text-gray-800'>오늘 근태 현황</h2>
        <Link href='/attendance' className='text-[11px] text-blue-600 hover:text-blue-700 font-medium'>
          전체 →
        </Link>
      </div>

      {loading ? (
        <div className='flex items-center justify-center py-8'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : total === 0 ? (
        <p className='text-center text-xs text-gray-400 py-6'>활성 직원이 없습니다</p>
      ) : (
        <>
          <div className='grid grid-cols-4 gap-2 mb-3'>
            {stats.map((s) => (
              <div key={s.label} className='bg-gray-50/60 rounded-md p-3 text-center'>
                <div className='flex items-center justify-center gap-1 mb-1'>
                  <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
                  <span className='text-[10px] text-gray-400'>{s.label}</span>
                </div>
                <p className={cn('text-xl font-bold leading-none tabular-nums', s.color)}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* 출근율 바 */}
          <div>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-[11px] text-gray-500'>출근율</span>
              <span className='text-[11px] font-semibold text-green-600 tabular-nums'>{workingPct}%</span>
            </div>
            <div className='w-full h-1.5 bg-gray-100 rounded-full overflow-hidden'>
              <div
                className='h-full bg-green-500 rounded-full transition-all'
                style={{ width: `${workingPct}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
