'use client';

import { useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth.store';

type LeaveType = '연차' | '반차(오전)' | '반차(오후)' | '병가' | '경조사' | '공가';
type LeaveStatus = '승인' | '대기' | '반려';

interface LeaveRequest {
  id: number;
  employeeId?: string;
  employeeName?: string;
  employeePosition?: string;
  department?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approver: string;
  requestedAt: string;
}

// ─── Mock 데이터 ──────────────────────────────────────────────
const myLeaveHistory: LeaveRequest[] = [
  { id: 1, type: '연차',      startDate: '2026-04-10', endDate: '2026-04-11', days: 2,   reason: '개인 사유', status: '승인', approver: '김대표', requestedAt: '2026-04-07' },
  { id: 2, type: '반차(오전)', startDate: '2026-03-25', endDate: '2026-03-25', days: 0.5, reason: '병원 진료', status: '승인', approver: '김대표', requestedAt: '2026-03-24' },
  { id: 3, type: '연차',      startDate: '2026-05-02', endDate: '2026-05-02', days: 1,   reason: '가족 행사', status: '대기', approver: '김대표', requestedAt: '2026-04-14' },
];

const allLeaveRequests: LeaveRequest[] = [
  { id: 1,  employeeName: '이서연', employeePosition: '대리',   department: 'marketing',  type: '연차',       startDate: '2026-04-18', endDate: '2026-04-18', days: 1,   reason: '개인 사유',   status: '대기', approver: '김대표', requestedAt: '2026-04-14' },
  { id: 2,  employeeName: '강도현', employeePosition: '사원',   department: 'design',     type: '반차(오후)',  startDate: '2026-04-17', endDate: '2026-04-17', days: 0.5, reason: '병원 방문',   status: '대기', approver: '김대표', requestedAt: '2026-04-14' },
  { id: 3,  employeeName: '박지훈', employeePosition: '사원',   department: 'design',     type: '병가',       startDate: '2026-04-15', endDate: '2026-04-16', days: 2,   reason: '독감',        status: '대기', approver: '김대표', requestedAt: '2026-04-14' },
  { id: 4,  employeeName: '김민준', employeePosition: '과장',   department: 'design',     type: '연차',       startDate: '2026-04-10', endDate: '2026-04-11', days: 2,   reason: '여행',        status: '승인', approver: '김대표', requestedAt: '2026-04-07' },
  { id: 5,  employeeName: '정하은', employeePosition: '대리',   department: 'marketing',  type: '연차',       startDate: '2026-04-07', endDate: '2026-04-09', days: 3,   reason: '가족 행사',   status: '승인', approver: '김대표', requestedAt: '2026-04-03' },
  { id: 6,  employeeName: '최유진', employeePosition: '팀장',   department: 'management', type: '반차(오전)', startDate: '2026-03-28', endDate: '2026-03-28', days: 0.5, reason: '관공서 업무', status: '승인', approver: '김대표', requestedAt: '2026-03-27' },
  { id: 7,  employeeName: '임재원', employeePosition: '사원',   department: 'design',     type: '연차',       startDate: '2026-03-20', endDate: '2026-03-21', days: 2,   reason: '개인 사유',   status: '반려', approver: '김대표', requestedAt: '2026-03-17' },
  { id: 8,  employeeName: '윤소희', employeePosition: '과장',   department: 'marketing',  type: '경조사',     startDate: '2026-03-15', endDate: '2026-03-15', days: 1,   reason: '조부상',      status: '승인', approver: '김대표', requestedAt: '2026-03-14' },
];

const LEAVE_TYPES: LeaveType[] = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '공가'];

const STATUS_STYLE: Record<LeaveStatus, string> = {
  승인: 'bg-green-100 text-green-700',
  대기: 'bg-yellow-100 text-yellow-700',
  반려: 'bg-red-100 text-red-700',
};

const DEPT_LABEL: Record<string, string> = {
  design: '디자인',
  marketing: '마케팅',
  management: '경영지원',
};

// ══════════════════════════════════════════════════════════════
// 직원용 뷰
// ══════════════════════════════════════════════════════════════
function EmployeeLeaveView() {
  const { user } = useAuthStore();
  const [type, setType] = useState<LeaveType>('연차');
  const [leaveDate, setLeaveDate] = useState('');
  const [endDate, setEndDate]   = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime]     = useState('18:00');
  const [title, setTitle]   = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile]     = useState<File | null>(null);
  const [approvalType, setApprovalType] = useState<'전결' | '합의' | '병렬'>('전결');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'form' | 'history'>('form');

  const today      = dayjs().format('YYYY-MM-DD');
  const docNumber  = `KP-${dayjs().format('YYYYMMDD')}-00851`;
  const isHalfDay  = type.includes('반차');
  const days       = isHalfDay ? 0.5 : (leaveDate && endDate ? Math.max(1, dayjs(endDate).diff(dayjs(leaveDate), 'day') + 1) : 1);

  const handleSubmit = async () => {
    if (!leaveDate || !title) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className='space-y-4'>
      {/* 브레드크럼 */}
      <div className='flex items-center gap-2 text-sm text-gray-400'>
        <Link href='/attendance' className='hover:text-blue-600 transition-colors'>출퇴근</Link>
        <span>›</span>
        <span className='text-gray-700 font-medium'>휴가 신청</span>
      </div>

      {/* 탭 */}
      <div className='flex gap-1 border-b border-gray-200'>
        {(['form', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'form' ? '휴가 신청서' : '신청 내역'}
          </button>
        ))}
      </div>

      {activeTab === 'form' ? (
        <>
          {/* ── 상단 액션 툴바 ── */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className='flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-60 transition-colors'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
              {submitting ? '처리 중...' : '결재요청'}
            </button>
            <button className='flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' />
              </svg>
              임시저장
            </button>
            <button className='flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
              </svg>
              미리보기
            </button>
            <button className='flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
              취소
            </button>
            <button className='flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
              결재정보
            </button>
          </div>

          {submitted && (
            <div className='flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded text-sm text-green-700'>
              <svg className='w-4 h-4 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
              </svg>
              결재 요청이 완료됐습니다. 승인을 기다려주세요.
            </div>
          )}

          {/* ── 문서 본문 ── */}
          <div className='bg-white border border-gray-300 shadow-sm max-w-4xl mx-auto'>
            {/* 문서 제목 */}
            <div className='text-center py-6 border-b border-gray-300'>
              <h1 className='text-2xl font-bold tracking-widest text-gray-900'>휴가신청서</h1>
            </div>

            {/* 기안 정보 + 결재란 */}
            <div className='flex border-b border-gray-300'>
              {/* 기안 정보 */}
              <table className='flex-1 text-sm border-collapse'>
                <tbody>
                  <tr>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 w-24 whitespace-nowrap'>기안자</td>
                    <td className='border-r border-b border-gray-300 px-4 py-2.5 text-gray-800'>{user?.name ?? '김소아'}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 w-20 whitespace-nowrap'>소속</td>
                    <td className='border-b border-gray-300 px-4 py-2.5 text-gray-800'>{user?.department === 'design' ? '디자인팀' : '마케팅팀'}</td>
                  </tr>
                  <tr>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 whitespace-nowrap'>기안일</td>
                    <td className='border-r border-b border-gray-300 px-4 py-2.5 text-gray-800'>{today}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 whitespace-nowrap'>문서번호</td>
                    <td className='border-b border-gray-300 px-4 py-2.5 text-gray-500 text-xs font-mono'>{docNumber}</td>
                  </tr>
                </tbody>
              </table>

              {/* 결재란 */}
              <div className='border-l border-gray-300 flex shrink-0'>
                {['팀장', '대표'].map((approver, idx) => (
                  <div key={approver} className={`w-24 ${idx > 0 ? 'border-l border-gray-300' : ''}`}>
                    <div className='bg-gray-50 border-b border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-600'>
                      {approver}
                      {approver === '대표' && <span className='block text-[10px] text-gray-400 font-normal'>(최우선)</span>}
                    </div>
                    <div className='h-16 flex items-center justify-center text-xs text-gray-300'>
                      {approver === '대표' && <span className='text-gray-400 font-medium text-sm'>대우</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 제목 행 */}
            <div className='flex border-b border-gray-300'>
              <div className='bg-gray-50 border-r border-gray-300 px-4 py-3 text-xs font-medium text-gray-600 flex items-center w-24 shrink-0'>제목</div>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${dayjs().format('M/D')}(${['일','월','화','수','목','금','토'][dayjs().day()]}) ${type} 신청의 건`}
                className='flex-1 px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-300 bg-white'
              />
            </div>

            {/* 선택정보 섹션 */}
            <div className='border-b border-gray-300'>
              <div className='bg-gray-100 border-b border-gray-300 px-4 py-2'>
                <span className='text-xs font-semibold text-gray-600 tracking-wide'>선택정보</span>
              </div>
              <table className='w-full text-sm border-collapse'>
                <tbody>
                  <tr>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-24 whitespace-nowrap'>부서명</td>
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-40'>
                      {user?.department === 'design' ? '디자인팀' : '마케팅팀'}
                    </td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-20 whitespace-nowrap'>사번</td>
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-32 font-mono text-xs'>246052</td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-16 whitespace-nowrap'>성명</td>
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-28'>{user?.name ?? '김소아'}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-16 whitespace-nowrap'>직위</td>
                    <td className='border-b border-gray-200 px-4 py-2.5 text-gray-800'>대리</td>
                  </tr>
                  <tr>
                    <td className='bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 whitespace-nowrap' colSpan={5}>
                      발생연차: <span className='font-semibold text-gray-800'>14.75</span>
                      <span className='mx-3 text-gray-300'>|</span>
                      사용연차: <span className='font-semibold text-orange-600'>1.00</span>
                      <span className='mx-3 text-gray-300'>|</span>
                      잔여연차: <span className='font-semibold text-blue-600'>13.75</span>
                    </td>
                    <td className='border-gray-200 px-4 py-2.5 text-xs text-gray-400' colSpan={3}>
                      발생연차: 14.75 사용연차: 1.00 잔여연차: 13.75
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 신청내용 섹션 */}
            <div className='border-b border-gray-300'>
              <div className='bg-gray-100 border-b border-gray-300 px-4 py-2'>
                <span className='text-xs font-semibold text-gray-600 tracking-wide'>신청내용</span>
              </div>
              <table className='w-full text-sm border-collapse'>
                <thead>
                  <tr className='bg-gray-50'>
                    {['휴가종류', '휴가일', '시작시간', '종료시간', '신청일수', '반차일수', '비고'].map((h) => (
                      <th key={h} className='border-r border-b border-gray-200 px-3 py-2.5 text-center text-xs font-medium text-gray-600 last:border-r-0'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {/* 휴가종류 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2'>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as LeaveType)}
                        className='w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer'
                      >
                        {LEAVE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    {/* 휴가일 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2'>
                      <div className='flex items-center gap-1'>
                        <input
                          type='date'
                          value={leaveDate}
                          onChange={(e) => { setLeaveDate(e.target.value); if (isHalfDay) setEndDate(e.target.value); }}
                          min={today}
                          className='text-xs text-gray-700 outline-none bg-transparent w-full'
                        />
                        {!isHalfDay && (
                          <>
                            <span className='text-gray-300 text-xs shrink-0'>~</span>
                            <input
                              type='date'
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              min={leaveDate || today}
                              className='text-xs text-gray-700 outline-none bg-transparent w-full'
                            />
                          </>
                        )}
                      </div>
                    </td>
                    {/* 시작시간 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2'>
                      <input
                        type='time'
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className='text-xs text-gray-700 outline-none bg-transparent w-full text-center'
                      />
                    </td>
                    {/* 종료시간 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2'>
                      <input
                        type='time'
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className='text-xs text-gray-700 outline-none bg-transparent w-full text-center'
                      />
                    </td>
                    {/* 신청일수 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-700 tabular-nums'>{days.toFixed(2)}</td>
                    {/* 반차일수 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-700 tabular-nums'>
                      {isHalfDay ? '0.50' : '0.00'}
                    </td>
                    {/* 비고 */}
                    <td className='border-b border-gray-200 px-2 py-2'>
                      <input
                        type='text'
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder='사유 입력'
                        className='w-full text-xs text-gray-700 outline-none bg-transparent placeholder:text-gray-300'
                      />
                    </td>
                  </tr>
                  {/* 빈 행 1개 여유 */}
                  <tr>
                    <td className='border-r border-gray-200 px-2 py-2.5 text-xs text-gray-200'>-</td>
                    <td className='border-r border-gray-200 px-2 py-2.5'></td>
                    <td className='border-r border-gray-200 px-2 py-2.5'></td>
                    <td className='border-r border-gray-200 px-2 py-2.5'></td>
                    <td className='border-r border-gray-200 px-2 py-2.5'></td>
                    <td className='border-r border-gray-200 px-2 py-2.5'></td>
                    <td className='px-2 py-2.5'></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 파일 첨부 섹션 */}
            <div className='border-b border-gray-300'>
              <div className='flex'>
                <div className='bg-gray-50 border-r border-gray-300 px-4 py-3 text-xs font-medium text-gray-600 flex items-start w-24 shrink-0 pt-3.5'>파일 첨부</div>
                <div className='flex-1 px-4 py-3 space-y-2'>
                  <div className='flex gap-2'>
                    <label className='px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded cursor-pointer hover:bg-gray-50 transition-colors'>
                      PC 파일 선택
                      <input type='file' className='hidden' onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <button className='px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors'>
                      드라이브 파일 선택
                    </button>
                  </div>
                  {file ? (
                    <div className='flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700'>
                      <svg className='w-3.5 h-3.5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
                      </svg>
                      {file.name}
                      <button onClick={() => setFile(null)} className='ml-auto text-blue-400 hover:text-blue-600'>✕</button>
                    </div>
                  ) : (
                    <p className='text-xs text-gray-300'>파일을 드래그하거나 위 버튼으로 선택하세요</p>
                  )}
                </div>
              </div>
            </div>

            {/* 결재방식 섹션 */}
            <div>
              <div className='flex'>
                <div className='bg-gray-50 border-r border-gray-300 px-4 py-3 text-xs font-medium text-gray-600 flex items-center w-24 shrink-0'>결재방식</div>
                <div className='flex-1 px-4 py-3 flex gap-4'>
                  {(['전결', '합의', '병렬'] as const).map((v) => (
                    <label key={v} className='flex items-center gap-1.5 cursor-pointer'>
                      <input
                        type='radio'
                        name='approvalType'
                        value={v}
                        checked={approvalType === v}
                        onChange={() => setApprovalType(v)}
                        className='accent-blue-600'
                      />
                      <span className='text-sm text-gray-700'>{v}</span>
                    </label>
                  ))}
                  <span className='ml-4 text-xs text-gray-400 flex items-center'>
                    ※ 폰서결재 진행 시 전결로 처리됩니다.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── 신청 내역 탭 ── */
        <div className='bg-white border border-gray-200 rounded-lg overflow-hidden max-w-4xl mx-auto'>
          {myLeaveHistory.length === 0 ? (
            <div className='flex items-center justify-center py-16 text-sm text-gray-400'>신청 내역이 없습니다.</div>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 border-b border-gray-200'>
                  {['종류', '기간', '일수', '사유', '신청일', '결재자', '상태'].map((h) => (
                    <th key={h} className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {myLeaveHistory.map((req) => (
                  <tr key={req.id} className='hover:bg-gray-50/60 transition-colors'>
                    <td className='px-5 py-3.5 text-sm font-medium text-gray-800 whitespace-nowrap'>{req.type}</td>
                    <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums whitespace-nowrap'>
                      {req.startDate}{req.startDate !== req.endDate && ` ~ ${req.endDate}`}
                    </td>
                    <td className='px-5 py-3.5 text-sm text-gray-700 tabular-nums'>{req.days}일</td>
                    <td className='px-5 py-3.5 text-sm text-gray-500'>{req.reason}</td>
                    <td className='px-5 py-3.5 text-xs text-gray-400 tabular-nums whitespace-nowrap'>{req.requestedAt}</td>
                    <td className='px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap'>{req.approver}</td>
                    <td className='px-5 py-3.5'>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 관리자용 뷰
// ══════════════════════════════════════════════════════════════
function AdminLeaveView() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [requests, setRequests] = useState(allLeaveRequests);

  const handleApprove = (id: number) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: '승인' as LeaveStatus } : r));
  };
  const handleReject = (id: number) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: '반려' as LeaveStatus } : r));
  };

  const pendingList = requests.filter((r) => r.status === '대기');
  const displayList = requests.filter((r) => {
    if (tab === 'pending' && r.status !== '대기') return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (tab === 'all' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const totalCount    = requests.length;
  const pendingCount  = requests.filter((r) => r.status === '대기').length;
  const approvedCount = requests.filter((r) => r.status === '승인').length;
  const rejectedCount = requests.filter((r) => r.status === '반려').length;

  return (
    <div className='space-y-5'>
      {/* 헤더 */}
      <div>
        <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
          <Link href='/attendance' className='hover:text-blue-600 transition-colors'>근태 대시보드</Link>
          <span>›</span>
          <span className='text-gray-700 font-medium'>휴가 승인 관리</span>
        </div>
        <h1 className='text-xl font-bold text-gray-900'>휴가 승인 관리</h1>
        <p className='text-sm text-gray-400 mt-0.5'>직원들의 휴가 신청을 검토하고 승인·반려 처리합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {[
          { label: '이번 달 총 신청', value: totalCount,    unit: '건', color: 'text-gray-700',   bg: 'bg-gray-50' },
          { label: '승인 대기',       value: pendingCount,  unit: '건', color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '승인 완료',       value: approvedCount, unit: '건', color: 'text-green-600',  bg: 'bg-green-50' },
          { label: '반려',            value: rejectedCount, unit: '건', color: 'text-red-600',    bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-gray-100 p-4 ${s.bg}`}>
            <p className='text-xs text-gray-500 font-medium'>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}<span className='text-sm font-normal text-gray-400 ml-1'>{s.unit}</span></p>
          </div>
        ))}
      </div>

      {/* 탭 + 필터 */}
      <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
        <div className='flex items-center justify-between px-5 pt-4 pb-0 border-b border-gray-100 flex-wrap gap-3'>
          <div className='flex gap-1'>
            <button
              onClick={() => setTab('pending')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              승인 대기
              {pendingList.length > 0 && (
                <span className='ml-1.5 text-[10px] bg-yellow-500 text-white rounded-full px-1.5 py-0.5 leading-none'>{pendingList.length}</span>
              )}
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              전체 내역
            </button>
          </div>

          <div className='flex gap-2 flex-wrap pb-3'>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className='px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='all'>전체 부서</option>
              <option value='marketing'>마케팅</option>
              <option value='design'>디자인</option>
              <option value='management'>경영지원</option>
            </select>
            {tab === 'all' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeaveStatus | 'all')}
                className='px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='all'>전체 상태</option>
                <option value='대기'>대기</option>
                <option value='승인'>승인</option>
                <option value='반려'>반려</option>
              </select>
            )}
          </div>
        </div>

        {displayList.length === 0 ? (
          <div className='py-16 text-center text-sm text-gray-400'>
            {tab === 'pending' ? '승인 대기 중인 휴가 신청이 없습니다.' : '내역이 없습니다.'}
          </div>
        ) : (
          <>
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50'>
                    {['직원', '부서', '종류', '기간', '일수', '사유', '신청일', '상태', '처리'].map((h) => (
                      <th key={h} className='px-5 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {displayList.map((req) => (
                    <tr key={req.id} className='hover:bg-gray-50/60 transition-colors'>
                      <td className='px-5 py-3.5'>
                        <div>
                          <p className='text-sm font-medium text-gray-800'>{req.employeeName}</p>
                          <p className='text-xs text-gray-400'>{req.employeePosition}</p>
                        </div>
                      </td>
                      <td className='px-5 py-3.5'>
                        <span className='text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap'>
                          {DEPT_LABEL[req.department ?? ''] ?? req.department}
                        </span>
                      </td>
                      <td className='px-5 py-3.5 text-sm text-gray-700 whitespace-nowrap'>{req.type}</td>
                      <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums whitespace-nowrap'>
                        {req.startDate}{req.startDate !== req.endDate && <><br /><span className='text-gray-400'>~ {req.endDate}</span></>}
                      </td>
                      <td className='px-5 py-3.5 text-sm text-gray-700 tabular-nums'>{req.days}일</td>
                      <td className='px-5 py-3.5 text-sm text-gray-500 max-w-36 truncate'>{req.reason}</td>
                      <td className='px-5 py-3.5 text-xs text-gray-400 tabular-nums whitespace-nowrap'>{req.requestedAt}</td>
                      <td className='px-5 py-3.5'>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                      </td>
                      <td className='px-5 py-3.5'>
                        {req.status === '대기' && (
                          <div className='flex gap-1.5'>
                            <button
                              onClick={() => handleApprove(req.id)}
                              className='px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors'
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className='px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors'
                            >
                              반려
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='md:hidden divide-y divide-gray-50'>
              {displayList.map((req) => (
                <div key={req.id} className='px-4 py-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span className='text-sm font-semibold text-gray-800'>{req.employeeName}</span>
                        <span className='text-xs text-gray-400'>{req.employeePosition}</span>
                        <span className='text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full'>{DEPT_LABEL[req.department ?? ''] ?? req.department}</span>
                      </div>
                      <p className='text-sm text-gray-600 mt-1'>
                        {req.type} · {req.startDate}{req.startDate !== req.endDate && ` ~ ${req.endDate}`} ({req.days}일)
                      </p>
                      <p className='text-xs text-gray-400 mt-0.5'>사유: {req.reason}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                  </div>
                  {req.status === '대기' && (
                    <div className='flex gap-2'>
                      <button onClick={() => handleApprove(req.id)} className='flex-1 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors'>승인</button>
                      <button onClick={() => handleReject(req.id)} className='flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors'>반려</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 메인 페이지 — 역할 분기
// ══════════════════════════════════════════════════════════════
export default function LeavePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  return isAdmin ? <AdminLeaveView /> : <EmployeeLeaveView />;
}
