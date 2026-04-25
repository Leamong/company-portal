'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/lib/api';
import { cn, formatDateShort } from '@/lib/utils';

interface LeaveBalance {
  notApplicable: boolean;
  total: number;
  used: number;
  remaining: number;
  hireDate: string | null;
  adjustment: number;
  periodStart: string | null;
  periodEnd: string | null;
  daysUntilExpiry: number | null;
}

interface UpcomingLeave {
  _id: string;
  startDate?: string;
  endDate?: string;
  formData?: { startDate?: string; endDate?: string; vacationType?: string };
  vacationType?: string;
  status: string;
  title: string;
}

export default function LeaveDetailWidget() {
  const [leave, setLeave] = useState<LeaveBalance | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingLeave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      Promise.all([
        api.get('/api/users/me/annual-leave').catch(() => ({ data: null })),
        api.get('/api/approval/mine-pending').catch(() => ({ data: [] })),
        api.get('/api/approval/mine-done').catch(() => ({ data: [] })),
      ]).then(([balRes, pendingRes, doneRes]) => {
        setLeave(balRes.data);
        // 휴가 신청서이고 오늘 이후 시작일인 건만
        const today = dayjs().format('YYYY-MM-DD');
        const merged = [...(pendingRes.data as any[]), ...(doneRes.data as any[])]
          .filter((d) => {
            if (d.formType !== '휴가신청서') return false;
            if (d.status === '반려' || d.status === '취소') return false;
            const start = d.formData?.startDate ?? d.startDate;
            return start && start.slice(0, 10) >= today;
          })
          .sort((a, b) => {
            const aDate = a.formData?.startDate ?? a.startDate ?? '';
            const bDate = b.formData?.startDate ?? b.startDate ?? '';
            return aDate.localeCompare(bDate);
          })
          .slice(0, 3);
        setUpcoming(merged);
        setLoading(false);
      });
    };
    refresh();
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => window.removeEventListener('approval:changed', onChange);
  }, []);

  const todayLabel = dayjs().format('YY/MM/DD (ddd)');

  const isHireDateMissing = !leave || !leave.hireDate || leave.notApplicable;

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-semibold text-gray-800'>휴가</h2>
        <span className='text-[11px] text-gray-400'>{todayLabel}</span>
      </div>

      {/* 3-카드 잔여/사용/총 */}
      <div className='grid grid-cols-3 gap-2 mb-4'>
        <LeaveCard
          icon='🏖'
          label='잔여 연차'
          value={loading || isHireDateMissing ? '-' : `${leave!.remaining}일`}
          highlight
        />
        <LeaveCard
          icon='📅'
          label='사용 연차'
          value={loading || isHireDateMissing ? '-' : `${leave!.used}일`}
        />
        <LeaveCard
          icon='✈️'
          label='총 연차'
          value={loading || isHireDateMissing ? '-' : `${leave!.total}일`}
        />
      </div>

      {isHireDateMissing ? (
        <div className='text-center py-4 text-xs text-gray-400 bg-gray-50/60 rounded-md'>
          입사일이 설정되면 자동으로 연차가 산정됩니다
          <p className='text-[10px] text-gray-300 mt-0.5'>관리자에게 문의하세요</p>
        </div>
      ) : (
        <>
          {/* 예정된 휴가 */}
          <div className='border-t border-gray-50 pt-3'>
            <p className='text-[11px] font-medium text-gray-500 mb-2'>예정된 휴가</p>
            {upcoming.length === 0 ? (
              <p className='text-[11px] text-gray-400 text-center py-2'>예정된 휴가가 없습니다</p>
            ) : (
              <ul className='space-y-1.5'>
                {upcoming.map((doc) => {
                  const type = doc.formData?.vacationType ?? doc.vacationType ?? '휴가';
                  const start = (doc.formData?.startDate ?? doc.startDate ?? '').slice(0, 10);
                  const end = (doc.formData?.endDate ?? doc.endDate ?? start).slice(0, 10);
                  const startLabel = formatDateShort(start);
                  const endLabel = formatDateShort(end);
                  const range = start === end ? startLabel : `${startLabel} ~ ${endLabel}`;
                  return (
                    <li key={doc._id} className='flex items-center gap-2 text-[11px]'>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full font-semibold shrink-0',
                        doc.status === '승인' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {doc.status === '승인' ? '확정' : '대기'}
                      </span>
                      <span className='text-gray-600 shrink-0'>{type}</span>
                      <span className='text-gray-400 tabular-nums ml-auto'>{range}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href='/approval?form=휴가신청서'
            className='mt-3 block text-center py-2 rounded-md bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors'
          >
            휴가 바로가기 →
          </Link>
        </>
      )}
    </div>
  );
}

function LeaveCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-md p-3 flex flex-col items-start',
      highlight ? 'bg-blue-50' : 'bg-gray-50/60',
    )}>
      <span className='text-sm mb-1'>{icon}</span>
      <p className={cn('text-[10px] mb-0.5', highlight ? 'text-blue-600 font-medium' : 'text-gray-400')}>{label}</p>
      <p className={cn('text-lg font-bold tabular-nums leading-none', highlight ? 'text-blue-700' : 'text-gray-700')}>
        {value}
      </p>
    </div>
  );
}
