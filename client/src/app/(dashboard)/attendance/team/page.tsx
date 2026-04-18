'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

type TeamStatus = '출근' | '퇴근' | '휴가' | '지각' | '결근';
type Dept = 'all' | 'design' | 'marketing' | 'management';

interface TeamMember {
  id: string;
  name: string;
  position: string;
  department: 'design' | 'marketing' | 'management';
  status: TeamStatus;
  checkIn: string;
  checkOut: string;
  workHours: string;
  overtime: string;
  lateCount: number;
}

const mockTeam: TeamMember[] = [
  { id: '1', name: '김민준', position: '과장', department: 'design', status: '출근', checkIn: '09:02', checkOut: '-', workHours: '6h 30m', overtime: '-', lateCount: 0 },
  { id: '2', name: '이서연', position: '대리', department: 'marketing', status: '출근', checkIn: '08:55', checkOut: '-', workHours: '6h 37m', overtime: '-', lateCount: 1 },
  { id: '3', name: '박지훈', position: '사원', department: 'design', status: '퇴근', checkIn: '09:01', checkOut: '18:00', workHours: '8h 59m', overtime: '-', lateCount: 0 },
  { id: '4', name: '최유진', position: '팀장', department: 'management', status: '출근', checkIn: '09:10', checkOut: '-', workHours: '6h 22m', overtime: '-', lateCount: 2 },
  { id: '5', name: '정하은', position: '대리', department: 'marketing', status: '휴가', checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', lateCount: 0 },
  { id: '6', name: '강도현', position: '사원', department: 'design', status: '출근', checkIn: '08:48', checkOut: '-', workHours: '6h 44m', overtime: '-', lateCount: 0 },
  { id: '7', name: '윤소희', position: '과장', department: 'marketing', status: '지각', checkIn: '09:35', checkOut: '-', workHours: '5h 57m', overtime: '-', lateCount: 3 },
  { id: '8', name: '임재원', position: '사원', department: 'design', status: '결근', checkIn: '-', checkOut: '-', workHours: '-', overtime: '-', lateCount: 1 },
];

const DEPT_LABEL: Record<string, string> = { design: '디자인', marketing: '마케팅', management: '경영지원' };
const DEPT_COLOR: Record<string, string> = { design: 'bg-purple-100 text-purple-700', marketing: 'bg-blue-100 text-blue-700', management: 'bg-gray-100 text-gray-600' };
const DEPT_AVATAR: Record<string, string> = { design: 'bg-purple-400', marketing: 'bg-blue-400', management: 'bg-gray-400' };

const STATUS_STYLE: Record<TeamStatus, string> = {
  출근: 'bg-green-100 text-green-700',
  퇴근: 'bg-gray-100 text-gray-500',
  휴가: 'bg-blue-100 text-blue-600',
  지각: 'bg-yellow-100 text-yellow-700',
  결근: 'bg-red-100 text-red-600',
};
const STATUS_DOT: Record<TeamStatus, string> = {
  출근: 'bg-green-500',
  퇴근: 'bg-gray-300',
  휴가: 'bg-blue-400',
  지각: 'bg-yellow-500',
  결근: 'bg-red-500',
};

export default function TeamAttendancePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [deptFilter, setDeptFilter] = useState<Dept>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isManager = user?.role === 'head-admin' || user?.canManageAttendance === true;

  if (!isManager) {
    return (
      <div className='flex flex-col items-center justify-center h-96 gap-4'>
        <div className='w-16 h-16 rounded-full bg-red-50 flex items-center justify-center'>
          <svg className='w-8 h-8 text-red-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
          </svg>
        </div>
        <p className='text-gray-500 text-sm'>근태 관리 권한이 없습니다.</p>
        <button onClick={() => router.back()} className='text-blue-600 text-sm hover:underline'>← 돌아가기</button>
      </div>
    );
  }

  const filtered = mockTeam.filter((m) => {
    const matchDept = deptFilter === 'all' || m.department === deptFilter;
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchDept && matchStatus;
  });

  const stats = {
    total: mockTeam.length,
    in: mockTeam.filter(m => m.status === '출근').length,
    late: mockTeam.filter(m => m.status === '지각').length,
    leave: mockTeam.filter(m => m.status === '휴가').length,
    absent: mockTeam.filter(m => m.status === '결근').length,
    out: mockTeam.filter(m => m.status === '퇴근').length,
  };

  const depts: { key: Dept; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'marketing', label: '마케팅' },
    { key: 'design', label: '디자인' },
    { key: 'management', label: '경영지원' },
  ];

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
            <Link href='/attendance' className='hover:text-blue-600 transition-colors'>출퇴근</Link>
            <span>›</span>
            <span className='text-gray-700 font-medium'>팀 근태 현황</span>
          </div>
          <h1 className='text-xl font-bold text-gray-900'>팀 근태 현황</h1>
          <p className='text-sm text-gray-400 mt-0.5'>실시간 팀원 출퇴근 현황</p>
        </div>
        <Link href='/attendance/settings' className='text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors'>
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
          </svg>
          근무 설정
        </Link>
      </div>

      {/* 현황 요약 카드 */}
      <div className='grid grid-cols-3 sm:grid-cols-6 gap-3'>
        {[
          { label: '전체', value: stats.total, color: 'text-gray-700', dot: 'bg-gray-400' },
          { label: '출근', value: stats.in, color: 'text-green-600', dot: 'bg-green-500' },
          { label: '지각', value: stats.late, color: 'text-yellow-600', dot: 'bg-yellow-500' },
          { label: '휴가', value: stats.leave, color: 'text-blue-600', dot: 'bg-blue-400' },
          { label: '결근', value: stats.absent, color: 'text-red-600', dot: 'bg-red-500' },
          { label: '퇴근', value: stats.out, color: 'text-gray-400', dot: 'bg-gray-300' },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(statusFilter === s.label && s.label !== '전체' ? 'all' : s.label === '전체' ? 'all' : s.label)}
            className={`bg-white rounded-2xl border p-3.5 text-left transition-colors hover:border-blue-200 ${
              (s.label === '전체' && statusFilter === 'all') || statusFilter === s.label
                ? 'border-blue-300 bg-blue-50/30'
                : 'border-gray-100'
            }`}
          >
            <div className='flex items-center gap-1.5 mb-1'>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className='text-xs text-gray-400'>{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* 부서 탭 */}
      <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
        <div className='px-5 py-3 border-b border-gray-100 flex items-center gap-1'>
          {depts.map((d) => (
            <button
              key={d.key}
              onClick={() => setDeptFilter(d.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                deptFilter === d.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {d.label}
              <span className={`ml-1.5 text-xs ${deptFilter === d.key ? 'text-blue-200' : 'text-gray-400'}`}>
                {d.key === 'all' ? mockTeam.length : mockTeam.filter(m => m.department === d.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* 데스크탑 테이블 */}
        <div className='hidden md:block overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 border-b border-gray-100'>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>직원</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>부서</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>상태</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>출근</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>퇴근</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>근무시간</th>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>이번 달 지각</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filtered.map((m) => (
                <tr key={m.id} className='hover:bg-gray-50/60 transition-colors'>
                  <td className='px-5 py-3.5'>
                    <div className='flex items-center gap-3'>
                      <div className={`w-8 h-8 rounded-full ${DEPT_AVATAR[m.department]} flex items-center justify-center shrink-0`}>
                        <span className='text-white text-xs font-semibold'>{m.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className='font-medium text-gray-800 text-sm'>{m.name}</p>
                        <p className='text-xs text-gray-400'>{m.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className='px-5 py-3.5'>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_COLOR[m.department]}`}>
                      {DEPT_LABEL[m.department]}
                    </span>
                  </td>
                  <td className='px-5 py-3.5'>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[m.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[m.status]}`} />
                      {m.status}
                    </span>
                  </td>
                  <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums'>{m.checkIn}</td>
                  <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums'>{m.checkOut}</td>
                  <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums'>{m.workHours}</td>
                  <td className='px-5 py-3.5'>
                    {m.lateCount > 0 ? (
                      <span className='text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full'>
                        {m.lateCount}회
                      </span>
                    ) : (
                      <span className='text-xs text-gray-300'>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className='md:hidden divide-y divide-gray-50'>
          {filtered.map((m) => (
            <div key={m.id} className='px-4 py-3.5 flex items-center gap-3'>
              <div className={`w-10 h-10 rounded-full ${DEPT_AVATAR[m.department]} flex items-center justify-center shrink-0`}>
                <span className='text-white text-sm font-semibold'>{m.name.charAt(0)}</span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium text-gray-800 text-sm'>{m.name}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${DEPT_COLOR[m.department]}`}>{DEPT_LABEL[m.department]}</span>
                </div>
                <p className='text-xs text-gray-400 mt-0.5'>{m.position}</p>
                <p className='text-xs text-gray-400 tabular-nums mt-0.5'>
                  {m.checkIn !== '-' ? `${m.checkIn} 출근${m.checkOut !== '-' ? ` · ${m.checkOut} 퇴근` : ''}` : '-'}
                  {m.workHours !== '-' ? ` · ${m.workHours}` : ''}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[m.status]}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className='flex items-center justify-center py-12 text-sm text-gray-400'>
            해당하는 직원이 없습니다.
          </div>
        )}

        <div className='px-5 py-3 border-t border-gray-50 text-xs text-gray-400'>
          {deptFilter === 'all' ? '전체' : DEPT_LABEL[deptFilter]} {filtered.length}명 표시 중
        </div>
      </div>
    </div>
  );
}
