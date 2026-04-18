'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

export default function AttendanceSettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('13:00');
  const [lateThreshold, setLateThreshold] = useState('10');
  const [weeklyMax, setWeeklyMax] = useState('52');
  const [annualDays, setAnnualDays] = useState('15');
  const [ipRestriction, setIpRestriction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (user?.role !== 'head-admin') {
    return (
      <div className='flex flex-col items-center justify-center h-96 gap-4'>
        <div className='w-16 h-16 rounded-full bg-red-50 flex items-center justify-center'>
          <svg className='w-8 h-8 text-red-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
          </svg>
        </div>
        <p className='text-gray-500 text-sm'>헤드 어드민만 접근 가능합니다.</p>
        <button onClick={() => router.back()} className='text-blue-600 text-sm hover:underline'>← 돌아가기</button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div>
        <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
          <Link href='/attendance' className='hover:text-blue-600 transition-colors'>출퇴근</Link>
          <span>›</span>
          <Link href='/attendance/team' className='hover:text-blue-600 transition-colors'>팀 현황</Link>
          <span>›</span>
          <span className='text-gray-700 font-medium'>근무 설정</span>
        </div>
        <h1 className='text-xl font-bold text-gray-900'>근무 설정</h1>
        <p className='text-sm text-gray-400 mt-0.5'>근무시간, 연차, 초과근무 정책을 설정합니다</p>
      </div>

      {saved && (
        <div className='p-3 bg-green-50 rounded-xl flex items-center gap-2 text-sm text-green-700'>
          <svg className='w-4 h-4 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
            <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
          </svg>
          설정이 저장되었습니다.
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>

        {/* 기본 근무 시간 */}
        <div className='bg-white rounded-2xl border border-gray-100 p-6'>
          <h2 className='text-base font-bold text-gray-900 mb-5 flex items-center gap-2'>
            <span className='text-xl'>🕐</span> 기본 근무 시간
          </h2>
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>출근 시간</label>
                <input
                  type='time'
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>퇴근 시간</label>
                <input
                  type='time'
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>점심 시작</label>
                <input
                  type='time'
                  value={lunchStart}
                  onChange={(e) => setLunchStart(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>점심 종료</label>
                <input
                  type='time'
                  value={lunchEnd}
                  onChange={(e) => setLunchEnd(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
            <div className='bg-blue-50 rounded-xl p-3 text-xs text-blue-600'>
              실 근무 시간: {workStart} ~ {workEnd} (점심 제외 {
                (() => {
                  const [sh, sm] = workStart.split(':').map(Number);
                  const [eh, em] = workEnd.split(':').map(Number);
                  const [lsh, lsm] = lunchStart.split(':').map(Number);
                  const [leh, lem] = lunchEnd.split(':').map(Number);
                  const total = (eh * 60 + em) - (sh * 60 + sm);
                  const lunch = (leh * 60 + lem) - (lsh * 60 + lsm);
                  const work = total - lunch;
                  return `${Math.floor(work / 60)}h ${work % 60}m`;
                })()
              })
            </div>
          </div>
        </div>

        {/* 지각/초과근무 기준 */}
        <div className='bg-white rounded-2xl border border-gray-100 p-6'>
          <h2 className='text-base font-bold text-gray-900 mb-5 flex items-center gap-2'>
            <span className='text-xl'>⚠️</span> 지각 · 초과근무 기준
          </h2>
          <div className='space-y-4'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1.5'>
                지각 기준 (출근 시간 +N분)
              </label>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  value={lateThreshold}
                  onChange={(e) => setLateThreshold(e.target.value)}
                  min='1' max='60'
                  className='w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <span className='text-sm text-gray-500'>분 초과 시 지각 처리</span>
              </div>
              <p className='text-xs text-gray-400 mt-1'>현재 {workStart} 기준 → {
                (() => {
                  const [h, m] = workStart.split(':').map(Number);
                  const total = h * 60 + m + Number(lateThreshold);
                  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })()
              } 이후 출근 시 지각</p>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1.5'>주 최대 근무시간</label>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  value={weeklyMax}
                  onChange={(e) => setWeeklyMax(e.target.value)}
                  min='40' max='68'
                  className='w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <span className='text-sm text-gray-500'>시간 (법정 최대 52h)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 연차 정책 */}
        <div className='bg-white rounded-2xl border border-gray-100 p-6'>
          <h2 className='text-base font-bold text-gray-900 mb-5 flex items-center gap-2'>
            <span className='text-xl'>🌴</span> 연차 정책
          </h2>
          <div className='space-y-4'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1.5'>기본 연차 일수 (연간)</label>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  value={annualDays}
                  onChange={(e) => setAnnualDays(e.target.value)}
                  min='10' max='30'
                  className='w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <span className='text-sm text-gray-500'>일</span>
              </div>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-600 mb-3'>사용 가능한 휴가 종류</label>
              <div className='space-y-2'>
                {['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '공가'].map((type) => (
                  <label key={type} className='flex items-center gap-2.5 cursor-pointer'>
                    <div className='w-4 h-4 rounded bg-blue-600 flex items-center justify-center shrink-0'>
                      <svg className='w-2.5 h-2.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                      </svg>
                    </div>
                    <span className='text-sm text-gray-700'>{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 출퇴근 체크 방식 */}
        <div className='bg-white rounded-2xl border border-gray-100 p-6'>
          <h2 className='text-base font-bold text-gray-900 mb-5 flex items-center gap-2'>
            <span className='text-xl'>📍</span> 출퇴근 체크 방식
          </h2>
          <div className='space-y-4'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-3'>허용 방식</label>
              <div className='space-y-2'>
                {[
                  { label: '웹 (포털 직접 체크)', checked: true, desc: '사내 포털에서 버튼 클릭' },
                  { label: 'IP 대역 제한', checked: ipRestriction, toggle: true, desc: '허용된 IP에서만 출근 가능' },
                ].map((opt) => (
                  <div key={opt.label} className='flex items-start gap-2.5'>
                    <button
                      type='button'
                      onClick={() => opt.toggle && setIpRestriction(!ipRestriction)}
                      className={`mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                        opt.checked || (opt.toggle && ipRestriction)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {(opt.checked || (opt.toggle && ipRestriction)) && (
                        <svg className='w-2.5 h-2.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                        </svg>
                      )}
                    </button>
                    <div>
                      <p className='text-sm text-gray-700'>{opt.label}</p>
                      <p className='text-xs text-gray-400'>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {ipRestriction && (
              <div className='bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700'>
                <p className='font-medium mb-1'>IP 제한 설정 안내</p>
                <p>허용 IP는 서버의 ALLOWED_IPS 환경변수 또는 어드민 IP 관리 페이지에서 설정하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={saving}
          className='px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors'
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
