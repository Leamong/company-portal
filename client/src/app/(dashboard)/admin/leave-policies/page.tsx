'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

type LeaveCategory = '연차' | '반차' | '병가' | '경조사' | '공가' | '기타';
type EvidenceTiming = 'none' | 'pre' | 'post';

interface LeavePolicy {
  _id: string;
  category: LeaveCategory;
  maxDaysPerRequest: number;
  annualCap: number;
  evidenceTiming: EvidenceTiming;
  postEvidenceDays: number;
  requiresEvidence: boolean;
  deductFromAnnualLeave: boolean;
  active: boolean;
  description: string;
}

interface WorkSchedule {
  halfDayMorningStart: string;
  halfDayMorningEnd: string;
  halfDayAfternoonStart: string;
  halfDayAfternoonEnd: string;
}

const TIMING_LABEL: Record<EvidenceTiming, string> = {
  none: '불필요',
  pre: '사전(신청 시)',
  post: '사후(기한 내)',
};

const CATEGORY_HINT: Record<LeaveCategory, string> = {
  연차: '법정 연차 유급휴가 — 사용자별 잔여 일수로 자동 제한됩니다.',
  반차: '반차(오전/오후) — 1건당 0.5일 고정.',
  병가: '질병 휴가 — 연간 누적 상한 및 증빙 요구 설정 권장.',
  경조사: '경조 휴가 — 사유별 다양하므로 관리자 판단 여지를 두는 편이 일반적.',
  공가: '예비군·투표·법원 출석 등 법정 공가.',
  기타: '위 분류에 해당하지 않는 사유 — 관리자 재량.',
};

export default function LeavePoliciesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<LeaveCategory | null>(null);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'head-admin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const load = () => {
    setIsLoading(true);
    Promise.all([
      api.get('/api/leave-policies'),
      api.get('/api/work-schedule'),
    ])
      .then(([pRes, sRes]) => {
        setPolicies(pRes.data);
        setSchedule(sRes.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updatePolicy = async (category: LeaveCategory, patch: Partial<LeavePolicy>) => {
    setSavingCategory(category);
    try {
      await api.patch(`/api/leave-policies/${encodeURIComponent(category)}`, patch);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSavingCategory(null);
    }
  };

  const saveSchedule = async (patch: Partial<WorkSchedule>) => {
    setScheduleSaving(true);
    try {
      const res = await api.patch('/api/work-schedule', patch);
      setSchedule(res.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setScheduleSaving(false);
    }
  };

  if (user?.role !== 'head-admin') return null;

  return (
    <div className='p-6 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>휴가 정책</h1>
        <p className='text-sm text-gray-500 mt-1'>
          휴가 유형별 상한 일수·증빙 제출 시점, 반차 기준 시간대를 설정합니다. 직원이 신청할 때 자동 검증되고 폼에 반영됩니다.
        </p>
      </div>

      {/* 반차 시간대 */}
      <HalfDayScheduleSection
        schedule={schedule}
        saving={scheduleSaving}
        onSave={saveSchedule}
      />

      {/* 휴가 정책 테이블 */}
      <div className='bg-white rounded-md border border-gray-200 overflow-hidden'>
        <div className='px-5 py-3 border-b border-gray-100 bg-gray-50'>
          <h2 className='text-sm font-bold text-gray-800'>휴가 유형별 정책</h2>
        </div>
        {isLoading ? (
          <div className='p-8 text-center text-sm text-gray-400'>불러오는 중…</div>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-white text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-100'>
                <th className='px-4 py-3'>유형</th>
                <th className='px-4 py-3'>1건당 최대</th>
                <th className='px-4 py-3'>연간 누적</th>
                <th className='px-4 py-3'>증빙 시점</th>
                <th className='px-4 py-3'>사후 기한</th>
                <th className='px-4 py-3'>연차 차감</th>
                <th className='px-4 py-3'>활성</th>
                <th className='px-4 py-3'></th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {policies.map((p) => (
                <PolicyRow
                  key={p._id}
                  policy={p}
                  saving={savingCategory === p.category}
                  onSave={(patch) => updatePolicy(p.category, patch)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className='bg-blue-50 border border-blue-100 rounded-md p-4 text-xs text-gray-700 space-y-1'>
        <p><b>1건당 최대</b>: 0은 무제한. 경조사 5일·병가 3일처럼 1회 신청 시 허용 최대 일수입니다.</p>
        <p><b>연간 누적</b>: 0은 무제한. 예: 병가 연간 10일 한도.</p>
        <p><b>증빙 시점</b>: <b>사전</b>=신청할 때 반드시 첨부, <b>사후</b>=휴가 종료 후 기한 내 업로드 허용, <b>불필요</b>=첨부 안 해도 됨.</p>
        <p><b>사후 기한</b>: 증빙 시점이 <b>사후</b>일 때, 휴가 종료일 + N일까지 업로드 유예.</p>
      </div>
    </div>
  );
}

// ── 반차 시간대 섹션 ───────────────────────────────────────────────────────
function HalfDayScheduleSection({
  schedule,
  saving,
  onSave,
}: {
  schedule: WorkSchedule | null;
  saving: boolean;
  onSave: (patch: Partial<WorkSchedule>) => void | Promise<void>;
}) {
  const [local, setLocal] = useState<WorkSchedule | null>(schedule);
  useEffect(() => { setLocal(schedule); }, [schedule]);

  if (!local) {
    return (
      <div className='bg-white rounded-md border border-gray-200 p-5'>
        <p className='text-sm text-gray-400'>반차 시간대 불러오는 중…</p>
      </div>
    );
  }

  const dirty =
    !schedule ||
    local.halfDayMorningStart !== schedule.halfDayMorningStart ||
    local.halfDayMorningEnd !== schedule.halfDayMorningEnd ||
    local.halfDayAfternoonStart !== schedule.halfDayAfternoonStart ||
    local.halfDayAfternoonEnd !== schedule.halfDayAfternoonEnd;

  const row = (
    label: string,
    startKey: keyof WorkSchedule,
    endKey: keyof WorkSchedule,
  ) => (
    <div className='flex items-center gap-3'>
      <span className='w-24 text-sm font-semibold text-gray-700'>{label}</span>
      <input
        type='time'
        value={local[startKey]}
        onChange={(e) => setLocal({ ...local, [startKey]: e.target.value })}
        className='px-2 py-1 border border-gray-300 rounded text-sm'
      />
      <span className='text-gray-400'>~</span>
      <input
        type='time'
        value={local[endKey]}
        onChange={(e) => setLocal({ ...local, [endKey]: e.target.value })}
        className='px-2 py-1 border border-gray-300 rounded text-sm'
      />
    </div>
  );

  return (
    <div className='bg-white rounded-md border border-gray-200'>
      <div className='px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between'>
        <h2 className='text-sm font-bold text-gray-800'>반차 기준 시간대</h2>
        <button
          disabled={!dirty || saving}
          onClick={() => local && onSave(local)}
          className={`text-xs px-3 py-1.5 rounded font-semibold ${
            dirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
      <div className='p-5 space-y-3'>
        {row('반차(오전)', 'halfDayMorningStart', 'halfDayMorningEnd')}
        {row('반차(오후)', 'halfDayAfternoonStart', 'halfDayAfternoonEnd')}
        <p className='text-xs text-gray-500 mt-2'>
          직원이 휴가신청서에서 반차를 선택하면 여기 설정된 시간이 자동으로 채워집니다.
        </p>
      </div>
    </div>
  );
}

function PolicyRow({
  policy,
  saving,
  onSave,
}: {
  policy: LeavePolicy;
  saving: boolean;
  onSave: (patch: Partial<LeavePolicy>) => void | Promise<void>;
}) {
  // DB 레코드가 구 스키마(신규 필드 없음)일 수 있으므로 폴백값으로 초기화
  const [maxDaysPerRequest, setMaxDaysPerRequest] = useState(policy.maxDaysPerRequest ?? 0);
  const [annualCap, setAnnualCap] = useState(policy.annualCap ?? 0);
  const [evidenceTiming, setEvidenceTiming] = useState<EvidenceTiming>(policy.evidenceTiming ?? 'none');
  const [postEvidenceDays, setPostEvidenceDays] = useState(policy.postEvidenceDays ?? 7);
  const [active, setActive] = useState(policy.active ?? true);
  const [description, setDescription] = useState(policy.description ?? '');
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    setMaxDaysPerRequest(policy.maxDaysPerRequest ?? 0);
    setAnnualCap(policy.annualCap ?? 0);
    setEvidenceTiming(policy.evidenceTiming ?? 'none');
    setPostEvidenceDays(policy.postEvidenceDays ?? 7);
    setActive(policy.active ?? true);
    setDescription(policy.description ?? '');
  }, [policy]);

  // 구 스키마 레코드는 신규 필드가 undefined 이므로 폴백과 비교해 dirty 감지
  const dirty =
    maxDaysPerRequest !== (policy.maxDaysPerRequest ?? 0) ||
    annualCap !== (policy.annualCap ?? 0) ||
    evidenceTiming !== (policy.evidenceTiming ?? 'none') ||
    postEvidenceDays !== (policy.postEvidenceDays ?? 7) ||
    active !== (policy.active ?? true) ||
    description !== (policy.description ?? '');

  return (
    <>
      <tr className='hover:bg-gray-50'>
        <td className='px-4 py-3 font-semibold text-gray-900'>
          <div>{policy.category}</div>
          <div className='text-[11px] text-gray-400 font-normal mt-0.5'>{CATEGORY_HINT[policy.category]}</div>
        </td>
        <td className='px-4 py-3'>
          <input
            type='number'
            step='0.5'
            min={0}
            value={maxDaysPerRequest}
            onChange={(e) => setMaxDaysPerRequest(Number(e.target.value))}
            className='w-20 px-2 py-1 border border-gray-300 rounded text-right'
          />
          <span className='ml-1 text-xs text-gray-400'>일</span>
        </td>
        <td className='px-4 py-3'>
          <input
            type='number'
            min={0}
            value={annualCap}
            onChange={(e) => setAnnualCap(Number(e.target.value))}
            className='w-20 px-2 py-1 border border-gray-300 rounded text-right'
          />
          <span className='ml-1 text-xs text-gray-400'>일</span>
        </td>
        <td className='px-4 py-3'>
          <select
            value={evidenceTiming}
            onChange={(e) => setEvidenceTiming(e.target.value as EvidenceTiming)}
            className='px-2 py-1 border border-gray-300 rounded text-xs'
          >
            {(['none', 'pre', 'post'] as EvidenceTiming[]).map((t) => (
              <option key={t} value={t}>{TIMING_LABEL[t]}</option>
            ))}
          </select>
        </td>
        <td className='px-4 py-3'>
          <input
            type='number'
            min={0}
            value={postEvidenceDays}
            onChange={(e) => setPostEvidenceDays(Number(e.target.value))}
            disabled={evidenceTiming !== 'post'}
            className={`w-16 px-2 py-1 border rounded text-right ${
              evidenceTiming === 'post' ? 'border-gray-300' : 'border-gray-100 bg-gray-50 text-gray-300'
            }`}
          />
          <span className='ml-1 text-xs text-gray-400'>일</span>
        </td>
        <td className='px-4 py-3 text-xs text-gray-600'>
          {policy.deductFromAnnualLeave ? '예' : '아니오'}
        </td>
        <td className='px-4 py-3'>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input type='checkbox' className='sr-only peer' checked={active} onChange={(e) => setActive(e.target.checked)} />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
          </label>
        </td>
        <td className='px-4 py-3 text-right'>
          <div className='flex items-center justify-end gap-2'>
            <button
              onClick={() => setShowDesc((v) => !v)}
              className='text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded'
            >
              설명
            </button>
            <button
              disabled={!dirty || saving}
              onClick={() =>
                onSave({
                  maxDaysPerRequest,
                  annualCap,
                  evidenceTiming,
                  postEvidenceDays,
                  // 하위 호환: requiresEvidence 도 함께 맞춰줌 (timing !== 'none')
                  requiresEvidence: evidenceTiming !== 'none',
                  active,
                  description,
                })
              }
              className={`text-xs px-3 py-1 rounded font-semibold ${
                dirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </td>
      </tr>
      {showDesc && (
        <tr>
          <td colSpan={8} className='px-4 py-3 bg-gray-50'>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-full px-3 py-2 border border-gray-200 rounded text-sm'
              placeholder='유저에게 보여질 정책 설명 (휴가 신청서 폼에 표시됩니다)'
            />
          </td>
        </tr>
      )}
    </>
  );
}
