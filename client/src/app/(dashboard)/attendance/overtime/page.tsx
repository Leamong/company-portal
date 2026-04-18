'use client';

import { useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth.store';

type OvertimeStatus = '승인' | '대기' | '반려';

interface OvertimeRequest {
  id: number;
  employeeName?: string;
  employeePosition?: string;
  department?: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  status: OvertimeStatus;
  requestedAt: string;
}

// ─── Mock 데이터 ──────────────────────────────────────────────
const myOvertimeHistory: OvertimeRequest[] = [
  { id: 1, date: '2026-04-14', startTime: '18:00', endTime: '20:30', hours: 2.5, reason: '클라이언트 납품 마감', status: '승인', requestedAt: '2026-04-14' },
  { id: 2, date: '2026-04-10', startTime: '18:00', endTime: '19:00', hours: 1,   reason: '디자인 수정 작업',   status: '승인', requestedAt: '2026-04-10' },
  { id: 3, date: '2026-04-15', startTime: '18:00', endTime: '21:00', hours: 3,   reason: '월말 정산 작업',     status: '대기', requestedAt: '2026-04-15' },
];

const allOvertimeRequests: OvertimeRequest[] = [
  { id: 1,  employeeName: '박지훈', employeePosition: '사원', department: 'design',     date: '2026-04-15', startTime: '18:00', endTime: '21:00', hours: 3,   reason: '월말 정산 작업',      status: '대기', requestedAt: '2026-04-15' },
  { id: 2,  employeeName: '이서연', employeePosition: '대리', department: 'marketing',  date: '2026-04-15', startTime: '18:00', endTime: '20:00', hours: 2,   reason: '캠페인 자료 제작',    status: '대기', requestedAt: '2026-04-15' },
  { id: 3,  employeeName: '윤소희', employeePosition: '과장', department: 'marketing',  date: '2026-04-14', startTime: '18:00', endTime: '19:30', hours: 1.5, reason: '보고서 작성',         status: '대기', requestedAt: '2026-04-14' },
  { id: 4,  employeeName: '김민준', employeePosition: '과장', department: 'design',     date: '2026-04-14', startTime: '18:00', endTime: '20:30', hours: 2.5, reason: '클라이언트 납품 마감', status: '승인', requestedAt: '2026-04-14' },
  { id: 5,  employeeName: '최유진', employeePosition: '팀장', department: 'management', date: '2026-04-12', startTime: '18:00', endTime: '19:00', hours: 1,   reason: '계약서 검토',         status: '승인', requestedAt: '2026-04-12' },
  { id: 6,  employeeName: '강도현', employeePosition: '사원', department: 'design',     date: '2026-04-10', startTime: '18:00', endTime: '20:00', hours: 2,   reason: '시안 수정',           status: '승인', requestedAt: '2026-04-10' },
  { id: 7,  employeeName: '정하은', employeePosition: '대리', department: 'marketing',  date: '2026-04-08', startTime: '18:00', endTime: '19:00', hours: 1,   reason: '광고 소재 제작',      status: '반려', requestedAt: '2026-04-08' },
  { id: 8,  employeeName: '임재원', employeePosition: '사원', department: 'design',     date: '2026-04-07', startTime: '18:00', endTime: '21:00', hours: 3,   reason: '촬영 후처리',         status: '승인', requestedAt: '2026-04-07' },
];

const STATUS_STYLE: Record<OvertimeStatus, string> = {
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
function EmployeeOvertimeView() {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [date, setDate]           = useState(dayjs().format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime]     = useState('');
  const [reason, setReason]       = useState('');
  const [title, setTitle]         = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [approvalType, setApprovalType] = useState<'전결' | '합의' | '병렬'>('전결');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const today     = dayjs().format('YYYY-MM-DD');
  const docNumber = `KP-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 90000 + 10000)).padStart(5, '0')}`;
  const deptLabel = user?.department === 'design' ? '디자인팀' : user?.department === 'marketing' ? '마케팅팀' : '경영팀';

  const calcHours = () => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return null;
    return diff / 60;
  };
  const hours = calcHours();
  const hoursLabel = hours !== null
    ? (() => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
      })()
    : '';

  const totalMonthOT  = myOvertimeHistory.filter((r) => r.status === '승인').reduce((s, r) => s + r.hours, 0);
  const approvedCount = myOvertimeHistory.filter((r) => r.status === '승인').length;
  const remaining52   = Math.max(0, 52 - 40 - totalMonthOT);

  const handleSubmit = async () => {
    if (!date || !startTime || !endTime || !hours || hours <= 0) {
      alert('날짜와 연장 시간을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setEndTime('');
    setReason('');
    setTitle('');
  };

  return (
    <div className='space-y-4'>
      {/* 브레드크럼 */}
      <div className='flex items-center gap-2 text-sm text-gray-400'>
        <Link href='/attendance' className='hover:text-blue-600 transition-colors'>출퇴근</Link>
        <span>›</span>
        <span className='text-gray-700 font-medium'>연장근무 신청</span>
      </div>

      {/* 이번 달 요약 카드 */}
      <div className='grid grid-cols-3 gap-3'>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs text-gray-400'>이번 달 초과</p>
          <p className='text-2xl font-bold text-purple-600 mt-1'>{totalMonthOT}<span className='text-sm font-normal text-gray-400 ml-1'>h</span></p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs text-gray-400'>승인 건수</p>
          <p className='text-2xl font-bold text-green-600 mt-1'>{approvedCount}<span className='text-sm font-normal text-gray-400 ml-1'>건</span></p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs text-gray-400'>주 52시간 잔여</p>
          <p className='text-2xl font-bold text-blue-600 mt-1'>{remaining52.toFixed(1)}<span className='text-sm font-normal text-gray-400 ml-1'>h</span></p>
        </div>
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
            {t === 'form' ? '연장근무 신청서' : '신청 내역'}
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
              <h1 className='text-2xl font-bold tracking-widest text-gray-900'>연장근무신청서</h1>
            </div>

            {/* 기안 정보 + 결재란 */}
            <div className='flex border-b border-gray-300'>
              <table className='flex-1 text-sm border-collapse'>
                <tbody>
                  <tr>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 w-24 whitespace-nowrap'>기안자</td>
                    <td className='border-r border-b border-gray-300 px-4 py-2.5 text-gray-800'>{user?.name ?? '-'}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 w-20 whitespace-nowrap'>소속</td>
                    <td className='border-b border-gray-300 px-4 py-2.5 text-gray-800'>{deptLabel}</td>
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
                placeholder={`${dayjs().format('M/D')}(${['일','월','화','수','목','금','토'][dayjs().day()]}) 연장근무 신청의 건`}
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
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-40'>{deptLabel}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-20 whitespace-nowrap'>사번</td>
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-32 font-mono text-xs'>-</td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-16 whitespace-nowrap'>성명</td>
                    <td className='border-r border-b border-gray-200 px-4 py-2.5 text-gray-800 w-28'>{user?.name ?? '-'}</td>
                    <td className='bg-gray-50 border-r border-b border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 w-16 whitespace-nowrap'>직위</td>
                    <td className='border-b border-gray-200 px-4 py-2.5 text-gray-800'>{user?.position ?? '-'}</td>
                  </tr>
                  <tr>
                    <td className='bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 whitespace-nowrap' colSpan={5}>
                      이번 달 초과: <span className='font-semibold text-purple-600'>{totalMonthOT}h</span>
                      <span className='mx-3 text-gray-300'>|</span>
                      승인 건수: <span className='font-semibold text-green-600'>{approvedCount}건</span>
                      <span className='mx-3 text-gray-300'>|</span>
                      주 52시간 잔여: <span className='font-semibold text-blue-600'>{remaining52.toFixed(1)}h</span>
                    </td>
                    <td className='border-gray-200 px-4 py-2.5 text-xs text-gray-400' colSpan={3}>
                      법정 근무 40시간 + 연장 최대 12시간
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
                    {['연장근무일', '시작시간', '종료시간', '연장시간(계)', '사유'].map((h) => (
                      <th key={h} className='border-r border-b border-gray-200 px-3 py-2.5 text-center text-xs font-medium text-gray-600 last:border-r-0'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {/* 연장근무일 */}
                    <td className='border-r border-b border-gray-200 px-2 py-2'>
                      <input
                        type='date'
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className='text-xs text-gray-700 outline-none bg-transparent w-full'
                      />
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
                    {/* 연장시간(계) */}
                    <td className='border-r border-b border-gray-200 px-2 py-2 text-center text-xs text-purple-600 font-semibold tabular-nums'>
                      {hoursLabel}
                    </td>
                    {/* 사유 */}
                    <td className='border-b border-gray-200 px-2 py-2'>
                      <input
                        type='text'
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder='연장근무 사유를 입력해주세요'
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
          {myOvertimeHistory.length === 0 ? (
            <div className='flex items-center justify-center py-16 text-sm text-gray-400'>신청 내역이 없습니다.</div>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 border-b border-gray-200'>
                  {['날짜', '시간대', '연장시간', '사유', '신청일', '상태'].map((h) => (
                    <th key={h} className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {myOvertimeHistory.map((req) => (
                  <tr key={req.id} className='hover:bg-gray-50/60 transition-colors'>
                    <td className='px-5 py-3.5 text-sm font-medium text-gray-800 tabular-nums whitespace-nowrap'>{req.date}</td>
                    <td className='px-5 py-3.5 text-sm text-gray-600 tabular-nums whitespace-nowrap'>{req.startTime} ~ {req.endTime}</td>
                    <td className='px-5 py-3.5 text-sm font-semibold text-purple-600 tabular-nums'>{req.hours}h</td>
                    <td className='px-5 py-3.5 text-sm text-gray-500'>{req.reason}</td>
                    <td className='px-5 py-3.5 text-xs text-gray-400 tabular-nums whitespace-nowrap'>{req.requestedAt}</td>
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
// 관리자용 뷰 (기존 유지)
// ══════════════════════════════════════════════════════════════
function AdminOvertimeView() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OvertimeStatus | 'all'>('all');
  const [requests, setRequests] = useState(allOvertimeRequests);

  const handleApprove = (id: number) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: '승인' as OvertimeStatus } : r));
  };
  const handleReject = (id: number) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: '반려' as OvertimeStatus } : r));
  };

  const pendingList = requests.filter((r) => r.status === '대기');
  const displayList = requests.filter((r) => {
    if (tab === 'pending' && r.status !== '대기') return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (tab === 'all' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const totalHours    = requests.filter((r) => r.status === '승인').reduce((s, r) => s + r.hours, 0);
  const pendingCount  = requests.filter((r) => r.status === '대기').length;
  const approvedCount = requests.filter((r) => r.status === '승인').length;
  const rejectedCount = requests.filter((r) => r.status === '반려').length;

  return (
    <div className='space-y-5'>
      <div>
        <div className='flex items-center gap-2 text-sm text-gray-400 mb-1'>
          <Link href='/attendance' className='hover:text-blue-600 transition-colors'>근태 대시보드</Link>
          <span>›</span>
          <span className='text-gray-700 font-medium'>연장근무 승인</span>
        </div>
        <h1 className='text-xl font-bold text-gray-900'>연장근무 승인</h1>
        <p className='text-sm text-gray-400 mt-0.5'>직원들의 연장근무 신청을 검토하고 승인·반려 처리합니다.</p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {[
          { label: '이번 달 총 시간', value: `${totalHours}h`,    color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '승인 대기',       value: `${pendingCount}건`,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '승인 완료',       value: `${approvedCount}건`, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: '반려',            value: `${rejectedCount}건`, color: 'text-red-600',    bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-gray-100 p-4 ${s.bg}`}>
            <p className='text-xs text-gray-500 font-medium'>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

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
                onChange={(e) => setStatusFilter(e.target.value as OvertimeStatus | 'all')}
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
            {tab === 'pending' ? '승인 대기 중인 연장근무 신청이 없습니다.' : '내역이 없습니다.'}
          </div>
        ) : (
          <>
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50'>
                    {['직원', '부서', '날짜', '시간대', '시간', '사유', '신청일', '상태', '처리'].map((h) => (
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
                      <td className='px-5 py-3.5 text-sm text-gray-700 tabular-nums whitespace-nowrap'>{req.date}</td>
                      <td className='px-5 py-3.5 text-xs text-gray-500 tabular-nums whitespace-nowrap'>{req.startTime} ~ {req.endTime}</td>
                      <td className='px-5 py-3.5'>
                        <span className='text-sm font-bold text-purple-600 tabular-nums'>{req.hours}h</span>
                      </td>
                      <td className='px-5 py-3.5 text-sm text-gray-500 max-w-36 truncate'>{req.reason}</td>
                      <td className='px-5 py-3.5 text-xs text-gray-400 tabular-nums whitespace-nowrap'>{req.requestedAt}</td>
                      <td className='px-5 py-3.5'>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                      </td>
                      <td className='px-5 py-3.5'>
                        {req.status === '대기' && (
                          <div className='flex gap-1.5'>
                            <button onClick={() => handleApprove(req.id)} className='px-2.5 py-1 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors'>승인</button>
                            <button onClick={() => handleReject(req.id)} className='px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors'>반려</button>
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
                        {req.date} · {req.startTime} ~ {req.endTime}
                        <span className='ml-1 font-bold text-purple-600'>{req.hours}h</span>
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
export default function OvertimePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  return isAdmin ? <AdminOvertimeView /> : <EmployeeOvertimeView />;
}
