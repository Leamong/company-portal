'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn, formatDateShort } from '@/lib/utils';

interface MissingDoc {
  _id: string;
  title: string;
  applicantId: string;
  applicantName: string;
  applicantDept: string;
  formType: string;
  formData?: { vacationType?: string };
  evidenceDeadline: string;
}

export default function MissingEvidenceWidget() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  const [docs, setDocs] = useState<MissingDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      const scope = isAdmin ? 'all' : 'mine';
      api
        .get(`/api/approval/missing-evidence?scope=${scope}`)
        .then((r) => setDocs(r.data))
        .catch(() => setDocs([]))
        .finally(() => setLoading(false));
    };
    refresh();
    const onChange = () => refresh();
    window.addEventListener('approval:changed', onChange);
    return () => window.removeEventListener('approval:changed', onChange);
  }, [isAdmin]);

  const today = dayjs().startOf('day');
  const sorted = [...docs].sort((a, b) => (a.evidenceDeadline || '').localeCompare(b.evidenceDeadline || ''));
  const overdueCount = sorted.filter((d) => dayjs(d.evidenceDeadline).startOf('day').diff(today, 'day') < 0).length;

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <h2 className='text-sm font-semibold text-gray-800'>
            {isAdmin ? '증빙 미제출 현황' : '내 증빙 제출 현황'}
          </h2>
          {sorted.length > 0 && (
            <span className={cn(
              'text-[10px] font-semibold rounded-full px-1.5 py-0.5',
              overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
            )}>
              {overdueCount > 0 ? `${overdueCount}건 초과` : `${sorted.length}건`}
            </span>
          )}
        </div>
        <Link
          href='/approval?folder=my-done'
          className='text-[11px] text-blue-600 hover:text-blue-700 font-medium'
        >
          전체 →
        </Link>
      </div>

      {loading ? (
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : sorted.length === 0 ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center py-6'>
          <span className='text-2xl mb-2'>✅</span>
          <p className='text-xs text-gray-400'>증빙 미제출 없음</p>
          <p className='text-[11px] text-gray-300 mt-0.5'>
            {isAdmin ? '모든 사후 증빙이 제출됐습니다' : '잘 정리되어 있습니다'}
          </p>
        </div>
      ) : (
        <ul className='flex-1 space-y-1.5 overflow-y-auto -mr-1 pr-1'>
          {sorted.slice(0, 5).map((d) => {
            const diff = dayjs(d.evidenceDeadline).startOf('day').diff(today, 'day');
            const isOverdue = diff < 0;
            const isDueSoon = diff >= 0 && diff <= 3;
            const label = isOverdue
              ? `D+${Math.abs(diff)}`
              : diff === 0
                ? 'D-Day'
                : `D-${diff}`;
            const style = isOverdue
              ? { bg: 'bg-red-100', text: 'text-red-700' }
              : isDueSoon
                ? { bg: 'bg-orange-100', text: 'text-orange-700' }
                : { bg: 'bg-blue-50', text: 'text-blue-700' };
            const vt = d.formData?.vacationType ?? d.formType;
            return (
              <li
                key={d._id}
                className='flex items-center gap-2 p-2 rounded-md border border-gray-100'
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-1.5'>
                    {isAdmin && (
                      <span className='text-[10px] text-gray-400'>{d.applicantName}</span>
                    )}
                    <span className='text-xs font-semibold text-gray-800 truncate'>
                      {d.title}
                    </span>
                  </div>
                  <p className='text-[10px] text-gray-400 mt-0.5 tabular-nums'>
                    {vt} · 기한 {formatDateShort(d.evidenceDeadline)}
                  </p>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full shrink-0 tabular-nums', style.bg, style.text)}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
