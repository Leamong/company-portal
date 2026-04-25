'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { DEPT_COLORS, POSITION_COLORS, getColorMeta } from '@/lib/dept-colors';

// ─── 타입 ──────────────────────────────────────────────────────
interface DeptDoc {
  _id: string;
  key: string;
  label: string;
  color: string;
  description: string;
}

interface MemberInfo {
  name: string;
  position: string;
  status: '출근' | '퇴근';
}

interface DeptStat extends DeptDoc {
  count: number;
  onlineCount: number;
  members: MemberInfo[];
}

interface Position {
  _id: string;
  title: string;
  level: number;
  description: string;
  color: string;
}

// ─── 부서 편집 모달 ────────────────────────────────────────────
function DeptModal({
  dept,
  onClose,
  onSaved,
}: {
  dept: DeptDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = dept === null;
  const [label, setLabel] = useState(dept?.label ?? '');
  const [color, setColor] = useState(dept?.color ?? 'blue');
  const [description, setDescription] = useState(dept?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!label.trim()) { setError('부서 이름을 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        // key는 서버에서 자동생성 (한글 이름도 안전하게 처리)
        await api.post('/api/departments', { label: label.trim(), color, description });
      } else {
        // 수정 시 key 변경 없이 나머지만 업데이트
        await api.patch(`/api/departments/${dept._id}`, { label: label.trim(), color, description });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-md shadow-xl w-full max-w-sm p-6'>
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-base font-bold text-gray-900'>
            {isNew ? '부서 추가' : '부서 수정'}
          </h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <div className='space-y-3.5'>
          {/* 부서 이름 */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>부서 이름 *</label>
            <input
              type='text'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='예) 마케팅팀, 디자인팀'
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {/* 색상 선택 */}
          {(() => {
            const preview = getColorMeta(color);
            return (
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-2'>색상</label>
                <div className='flex flex-wrap gap-2 mb-2.5'>
                  {DEPT_COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setColor(c.key)}
                      title={c.label}
                      className={`w-7 h-7 rounded-full ${c.avatar} transition-all ${
                        color === c.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                {/* 미리보기 */}
                <div className='flex items-center gap-2'>
                  <span className='text-[10px] text-gray-400'>미리보기</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold leading-none ${preview.badgeBg} ${preview.badgeText}`}>
                    {label || '부서명'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* 설명 */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>설명 (선택)</label>
            <input
              type='text'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='간략한 부서 설명'
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {error && <p className='text-xs text-red-500'>{error}</p>}

          <div className='flex gap-3 pt-1'>
            <button
              onClick={onClose}
              className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className='flex-1 py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60'
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 직급 편집 모달 ────────────────────────────────────────────
function PositionModal({
  position,
  onClose,
  onSaved,
}: {
  position: Position | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(position?.title ?? '');
  const [level, setLevel] = useState(position?.level ?? 0);
  const [description, setDescription] = useState(position?.description ?? '');
  const [color, setColor] = useState(position?.color ?? 'violet');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('직급명을 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      if (position) {
        await api.patch(`/api/positions/${position._id}`, { title: title.trim(), level, description, color });
      } else {
        await api.post('/api/positions', { title: title.trim(), level, description, color });
      }
      onSaved();
      onClose();
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const preview = getColorMeta(color);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-md shadow-xl w-full max-w-sm p-6'>
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-base font-bold text-gray-900'>
            {position ? '직급 수정' : '직급 추가'}
          </h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='space-y-3.5'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>직급명 *</label>
            <input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='예) 사원, 대리, 과장, 팀장'
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>직급 순서 (낮을수록 하위)</label>
            <input
              type='number'
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value) || 0)}
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          {/* 색상 선택 */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-2'>배지 색상</label>
            <div className='flex flex-wrap gap-2 mb-2.5'>
              {POSITION_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full ${c.avatar} transition-all ${
                    color === c.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
            {/* 미리보기 */}
            <div className='flex items-center gap-2'>
              <span className='text-[10px] text-gray-400'>미리보기</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold leading-none ${preview.badgeBg} ${preview.badgeText}`}>
                {title || '직급명'}
              </span>
            </div>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>설명 (선택)</label>
            <input
              type='text'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='간략한 설명'
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          {error && <p className='text-xs text-red-500'>{error}</p>}
          <div className='flex gap-3 pt-1'>
            <button onClick={onClose} className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'>
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className='flex-1 py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60'
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
export default function DepartmentsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [deptStats, setDeptStats] = useState<DeptStat[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const [deptModal, setDeptModal] = useState<{ open: boolean; editing: DeptDoc | null }>({
    open: false,
    editing: null,
  });
  const [positionModal, setPositionModal] = useState<{ open: boolean; editing: Position | null }>({
    open: false,
    editing: null,
  });

  const fetchDeptStats = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const [deptsRes, usersRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/users'),
      ]);

      const depts: DeptDoc[] = deptsRes.data;
      const employees: { name: string; department: string; position: string; status: '출근' | '퇴근' }[] =
        usersRes.data;

      const stats: DeptStat[] = depts.map((dept) => {
        const members = employees
          .filter((e) => e.department === dept.key)
          .map((e) => ({ name: e.name, position: e.position, status: e.status }));
        return {
          ...dept,
          count: members.length,
          onlineCount: members.filter((m) => m.status === '출근').length,
          members,
        };
      });

      setDeptStats(stats);
    } catch {
      //
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await api.get('/api/positions');
      setPositions(res.data);
    } catch {
      //
    } finally {
      setLoadingPositions(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'head-admin') {
      fetchDeptStats();
      fetchPositions();
    }
  }, [user, fetchDeptStats, fetchPositions]);

  const handleDeleteDept = async (dept: DeptDoc) => {
    const hasMember = deptStats.find((d) => d._id === dept._id)?.count ?? 0;
    if (hasMember > 0) {
      alert(`"${dept.label}"에 소속된 직원이 ${hasMember}명 있습니다.\n직원 부서를 먼저 변경한 후 삭제하세요.`);
      return;
    }
    if (!confirm(`"${dept.label}" 부서를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/api/departments/${dept._id}`);
      fetchDeptStats();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleDeletePosition = async (id: string, title: string) => {
    if (!confirm(`"${title}" 직급을 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/api/positions/${id}`);
      fetchPositions();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

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

  return (
    <div className='space-y-8'>
      {/* 헤더 */}
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>부서 / 직급 관리</h1>
        <p className='text-sm text-gray-500 mt-1'>부서를 자유롭게 추가·수정·삭제하고 직급 체계를 관리합니다</p>
      </div>

      {/* ───── 부서 관리 ───── */}
      <section>
        <div className='flex items-center justify-between mb-3'>
          <div>
            <h2 className='text-base font-semibold text-gray-800'>부서 관리</h2>
            <p className='text-xs text-gray-400 mt-0.5'>부서를 추가하거나 이름·색상을 수정할 수 있습니다</p>
          </div>
          <button
            onClick={() => setDeptModal({ open: true, editing: null })}
            className='flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors'
          >
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            부서 추가
          </button>
        </div>

        {loadingDepts ? (
          <div className='flex items-center justify-center py-10'>
            <div className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : deptStats.length === 0 ? (
          <div className='bg-white rounded-md border border-dashed border-gray-200 py-12 text-center'>
            <svg className='w-10 h-10 text-gray-200 mx-auto mb-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
            </svg>
            <p className='text-sm text-gray-400 mb-1'>등록된 부서가 없습니다</p>
            <p className='text-xs text-gray-300'>부서 추가 버튼을 눌러 첫 부서를 만들어보세요</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {deptStats.map((dept) => {
              const c = getColorMeta(dept.color);
              const isExpanded = expandedDept === dept._id;
              return (
                <div key={dept._id} className='bg-white rounded-md border border-gray-100 overflow-hidden'>
                  {/* 카드 헤더 */}
                  <div className={`${c.bg} px-5 py-4`}>
                    <div className='flex items-center justify-between mb-2'>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${c.text}`}>
                        {dept.label}
                      </span>
                      <div className='flex items-center gap-2'>
                        <div className='flex items-center gap-1.5'>
                          <span className='w-1.5 h-1.5 rounded-full bg-green-500' />
                          <span className='text-xs text-gray-500'>{dept.onlineCount}명 출근</span>
                        </div>
                        {/* 수정/삭제 버튼 */}
                        <button
                          onClick={() => setDeptModal({ open: true, editing: dept })}
                          className='text-gray-400 hover:text-gray-600 transition-colors'
                          title='부서 수정'
                        >
                          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteDept(dept)}
                          className='text-gray-400 hover:text-red-500 transition-colors'
                          title='부서 삭제'
                        >
                          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className='text-3xl font-bold text-gray-900'>
                      {dept.count}
                      <span className='text-sm font-normal text-gray-400 ml-1'>명</span>
                    </p>
                    {dept.description && (
                      <p className='text-xs text-gray-500 mt-1'>{dept.description}</p>
                    )}
                  </div>

                  {/* 구성원 목록 토글 */}
                  <div className='px-5 py-3'>
                    <button
                      onClick={() => setExpandedDept(isExpanded ? null : dept._id)}
                      className='w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors'
                    >
                      <span>구성원 보기</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill='none' stroke='currentColor' viewBox='0 0 24 24'
                      >
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M19 9l-7 7-7-7' />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className='mt-3 space-y-2'>
                        {dept.members.length === 0 ? (
                          <p className='text-xs text-gray-400 text-center py-2'>구성원 없음</p>
                        ) : (
                          dept.members.map((m, i) => (
                            <div key={i} className='flex items-center gap-2.5'>
                              <div className={`w-6 h-6 rounded-full ${c.avatar} flex items-center justify-center shrink-0`}>
                                <span className='text-white text-[10px] font-medium'>{m.name.charAt(0)}</span>
                              </div>
                              <div className='flex-1 min-w-0'>
                                <p className='text-xs font-medium text-gray-800 truncate'>{m.name}</p>
                                <p className='text-[10px] text-gray-400'>{m.position || '직급 없음'}</p>
                              </div>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.status === '출근' ? 'bg-green-400' : 'bg-gray-300'}`} />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───── 직급 관리 ───── */}
      <section>
        <div className='flex items-center justify-between mb-3'>
          <div>
            <h2 className='text-base font-semibold text-gray-800'>직급 관리</h2>
            <p className='text-xs text-gray-400 mt-0.5'>회사 직급 체계를 정의합니다. 직원 편집 시 참고용으로 사용됩니다.</p>
          </div>
          <button
            onClick={() => setPositionModal({ open: true, editing: null })}
            className='flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors'
          >
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            직급 추가
          </button>
        </div>

        {loadingPositions ? (
          <div className='flex items-center justify-center py-10'>
            <div className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : positions.length === 0 ? (
          <div className='bg-white rounded-md border border-dashed border-gray-200 py-12 text-center'>
            <svg className='w-10 h-10 text-gray-200 mx-auto mb-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
            </svg>
            <p className='text-sm text-gray-400 mb-1'>등록된 직급이 없습니다</p>
            <p className='text-xs text-gray-300'>직급 추가 버튼을 눌러 직급 체계를 만들어보세요</p>
          </div>
        ) : (
          <div className='bg-white rounded-md border border-gray-100 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 border-b border-gray-100'>
                  <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>직급명</th>
                  <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>순서</th>
                  <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>설명</th>
                  <th className='px-5 py-3'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50'>
                {positions.map((pos) => (
                  <tr key={pos._id} className='hover:bg-gray-50/60 transition-colors'>
                    <td className='px-5 py-3.5'>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold leading-none ${getColorMeta(pos.color).badgeBg} ${getColorMeta(pos.color).badgeText}`}>
                        {pos.title}
                      </span>
                    </td>
                    <td className='px-5 py-3.5'>
                      <span className='text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full'>
                        Lv.{pos.level}
                      </span>
                    </td>
                    <td className='px-5 py-3.5 text-xs text-gray-500'>{pos.description || '—'}</td>
                    <td className='px-5 py-3.5'>
                      <div className='flex items-center gap-2 justify-end'>
                        <button
                          onClick={() => setPositionModal({ open: true, editing: pos })}
                          className='text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors'
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePosition(pos._id, pos.title)}
                          className='text-xs text-red-400 hover:text-red-600 transition-colors'
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 모달 */}
      {deptModal.open && (
        <DeptModal
          dept={deptModal.editing}
          onClose={() => setDeptModal({ open: false, editing: null })}
          onSaved={fetchDeptStats}
        />
      )}
      {positionModal.open && (
        <PositionModal
          position={positionModal.editing}
          onClose={() => setPositionModal({ open: false, editing: null })}
          onSaved={fetchPositions}
        />
      )}
    </div>
  );
}
