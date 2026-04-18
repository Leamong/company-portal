'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PAGE_PERMISSIONS } from '@/lib/permissions';

// ─── 타입 ──────────────────────────────────────────────────────
interface Employee {
  _id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  role: 'head-admin' | 'employee';
  status: '출근' | '퇴근';
  isActive: boolean;
  pagePermissions: string[];
  canApprove: boolean;
  canManageAttendance: boolean;
  createdAt?: string;
}

interface DeptDoc {
  _id: string;
  key: string;
  label: string;
  color: string;
  description: string;
}

interface Position {
  _id: string;
  title: string;
  level: number;
}

// ─── 색상 팔레트 (departments 페이지와 동일) ───────────────────
const COLOR_PALETTE: Record<string, { bg: string; text: string; avatar: string }> = {
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   avatar: 'bg-blue-500'   },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', avatar: 'bg-purple-500' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  avatar: 'bg-green-500'  },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', avatar: 'bg-orange-500' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   avatar: 'bg-pink-500'   },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   avatar: 'bg-teal-500'   },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    avatar: 'bg-red-500'    },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-600',   avatar: 'bg-gray-400'   },
};

const getDeptColor = (colorKey: string) =>
  COLOR_PALETTE[colorKey] ?? COLOR_PALETTE['gray'];

// ────────────── 직원 수정 모달 ──────────────
function EditModal({
  employee,
  departments,
  positions,
  onClose,
  onSaved,
}: {
  employee: Employee;
  departments: DeptDoc[];
  positions: Position[];
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}) {
  const [position, setPosition] = useState(employee.position);
  const [department, setDepartment] = useState(employee.department);
  const [role, setRole] = useState(employee.role);
  const [perms, setPerms] = useState<string[]>(employee.pagePermissions ?? []);
  const [canApprove, setCanApprove] = useState(employee.canApprove ?? false);
  const [canManageAttendance, setCanManageAttendance] = useState(employee.canManageAttendance ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePerm = (key: string) => {
    setPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/api/users/${employee._id}`, {
        position,
        department,
        role,
        pagePermissions: role === 'head-admin' ? [] : perms,
        canApprove: role === 'head-admin' ? false : canApprove,
        canManageAttendance: role === 'head-admin' ? false : canManageAttendance,
      });
      onSaved(res.data);
      onClose();
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = role === 'head-admin';
  const currentDept = departments.find((d) => d.key === department);
  const avatarColor = getDeptColor(currentDept?.color ?? 'gray').avatar;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto max-h-[90vh]'>
        <div className='flex items-center justify-between p-6 border-b border-gray-100'>
          <div className='flex items-center gap-3'>
            <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center`}>
              <span className='text-white text-sm font-semibold'>{employee.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className='text-base font-bold text-gray-900'>{employee.name}</h2>
              <p className='text-xs text-gray-400'>{employee.email}</p>
            </div>
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <div className='p-6 space-y-5'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1.5'>직급</label>
              {positions.length > 0 ? (
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>직급 없음</option>
                  {positions.map((p) => (
                    <option key={p._id} value={p.title}>{p.title}</option>
                  ))}
                </select>
              ) : (
                <div className='w-full px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400'>
                  직급 없음 — 부서/직급 관리에서 먼저 추가하세요
                </div>
              )}
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1.5'>부서</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
                {departments.length === 0 && (
                  <option value={employee.department}>{employee.department}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1.5'>권한 등급</label>
            <select
              value={role}
              onChange={(e) => {
                const newRole = e.target.value as Employee['role'];
                setRole(newRole);
                if (newRole === 'head-admin') setCanApprove(false);
              }}
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='employee'>직원</option>
              <option value='head-admin'>헤드 어드민</option>
            </select>
          </div>

          {/* 위임 권한 (직원만) */}
          {!isAdmin && (
            <div className='space-y-2'>
              <label className='block text-xs font-medium text-gray-600'>위임 권한</label>

              {/* 결재 대리 */}
              <div className='flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50'>
                <div className='flex items-center gap-2.5'>
                  <span className='text-blue-600'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                    </svg>
                  </span>
                  <div>
                    <p className='text-xs font-medium text-gray-700'>결재 대리</p>
                    <p className='text-xs text-gray-400'>직원들의 휴가/지출결의 결재를 처리합니다</p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setCanApprove((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none
                    ${canApprove ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
                    ${canApprove ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* 근태 관리 */}
              <div className='flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50'>
                <div className='flex items-center gap-2.5'>
                  <span className='text-emerald-600'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
                    </svg>
                  </span>
                  <div>
                    <p className='text-xs font-medium text-gray-700'>근태 관리</p>
                    <p className='text-xs text-gray-400'>팀원의 출퇴근 기록을 조회·수정합니다</p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setCanManageAttendance((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none
                    ${canManageAttendance ? 'bg-emerald-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
                    ${canManageAttendance ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}

          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='text-xs font-medium text-gray-600'>페이지 접근 권한</label>
              {isAdmin ? (
                <span className='text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full'>
                  헤드 어드민 · 전체 접근
                </span>
              ) : (
                <button
                  type='button'
                  onClick={() =>
                    setPerms(
                      perms.length === PAGE_PERMISSIONS.length
                        ? []
                        : PAGE_PERMISSIONS.map((p) => p.key),
                    )
                  }
                  className='text-xs text-gray-500 hover:text-blue-600 transition-colors'
                >
                  {perms.length === PAGE_PERMISSIONS.length ? '전체 해제' : '전체 선택'}
                </button>
              )}
            </div>

            {isAdmin ? (
              <div className='bg-blue-50 rounded-xl p-3 text-xs text-blue-600'>
                헤드 어드민은 모든 페이지에 자동으로 접근 가능합니다.
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-2'>
                {PAGE_PERMISSIONS.map((page) => {
                  const checked = perms.includes(page.key);
                  return (
                    <button
                      key={page.key}
                      type='button'
                      onClick={() => togglePerm(page.key)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                        checked
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}
                      >
                        {checked && (
                          <svg className='w-2.5 h-2.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                          </svg>
                        )}
                      </div>
                      <span className='font-medium text-xs'>{page.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className='text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg'>{error}</p>
          )}

          <div className='flex gap-3 pt-1'>
            <button
              onClick={onClose}
              className='flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors'
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className='flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors'
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────── 직원 초대 모달 ──────────────
function InviteModal({
  departments,
  onClose,
}: {
  departments: DeptDoc[];
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState(departments[0]?.key ?? 'design');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email) {
      setEmailError(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/invite', { email, department, role: 'employee' });
      const baseUrl = window.location.origin;
      setResult(`${baseUrl}${res.data.registerUrl}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || '초대 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md p-6'>
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-lg font-bold text-gray-900'>직원 초대</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {result ? (
          <div className='space-y-4'>
            <div className='bg-green-50 rounded-xl p-4 text-center'>
              <p className='text-sm font-semibold text-green-700 mb-2'>초대 링크가 생성되었습니다</p>
              <code className='text-xs text-green-600 break-all'>{result}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`w-full py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                copied
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {copied ? '링크가 복사되었습니다!' : '링크 복사'}
            </button>
          </div>
        ) : (
          <div className='space-y-3.5'>
            <div>
              <label className={`block text-xs font-medium mb-1 ${emailError ? 'text-red-500' : 'text-gray-600'}`}>
                초대할 이메일 {emailError && <span className='font-normal'>— 이메일을 입력해주세요</span>}
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (e.target.value) setEmailError(false);
                }}
                placeholder='employee@company.com'
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-colors ${
                  emailError
                    ? 'border-red-400 bg-red-50 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-blue-500'
                }`}
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-600 mb-1'>부서</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
                {departments.length === 0 && <option value=''>부서 없음</option>}
              </select>
            </div>
            {error && <p className='text-xs text-red-500'>{error}</p>}
            <div className='flex gap-3 pt-1'>
              <button
                onClick={onClose}
                className='flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors'
              >
                취소
              </button>
              <button
                onClick={handleInvite}
                disabled={loading}
                className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : email
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-300 cursor-pointer'
                }`}
              >
                {loading ? '생성 중...' : '초대 링크 생성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────── 메인 페이지 ──────────────
export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DeptDoc[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [empRes, deptRes, posRes] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/departments'),
        api.get('/api/positions'),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setPositions(posRes.data);
    } catch {
      // 조용히 실패
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'head-admin') fetchData();
  }, [user, fetchData]);

  const deptMap = useMemo(() => {
    const map: Record<string, DeptDoc> = {};
    departments.forEach((d) => { map[d.key] = d; });
    return map;
  }, [departments]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchDept = deptFilter === 'all' || e.department === deptFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [employees, deptFilter, search]);

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

  const toggleActive = async (emp: Employee) => {
    try {
      const res = await api.patch(`/api/users/${emp._id}`, { isActive: !emp.isActive });
      setEmployees((prev) => prev.map((e) => e._id === emp._id ? { ...e, ...res.data } : e));
    } catch {
      // 조용히 실패
    }
  };

  const handleSaved = (updated: Employee) => {
    setEmployees((prev) => prev.map((e) => e._id === updated._id ? updated : e));
  };

  const onlineCount = employees.filter((e) => e.status === '출근').length;
  const activeCount = employees.filter((e) => e.isActive).length;

  const DEPT_TABS = [
    { key: 'all', label: '전체', count: employees.length },
    ...departments.map((d) => ({
      key: d.key,
      label: d.label,
      count: employees.filter((e) => e.department === d.key).length,
    })),
  ];

  const currentFilterLabel = deptFilter === 'all'
    ? '전체'
    : (deptMap[deptFilter]?.label ?? deptFilter);

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>직원 관리</h1>
          <p className='text-sm text-gray-500 mt-1'>직원 명부 조회, 권한 설정, 초대 링크를 관리합니다</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors self-start sm:self-auto'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' />
          </svg>
          직원 초대
        </button>
      </div>

      {/* 요약 카드 */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs font-medium text-gray-400'>전체 인원</p>
          <p className='text-2xl font-bold text-gray-900 mt-1'>{employees.length}<span className='text-sm font-normal text-gray-400 ml-1'>명</span></p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs font-medium text-gray-400'>현재 출근</p>
          <p className='text-2xl font-bold text-green-600 mt-1'>{onlineCount}<span className='text-sm font-normal text-gray-400 ml-1'>명</span></p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs font-medium text-gray-400'>활성 계정</p>
          <p className='text-2xl font-bold text-blue-600 mt-1'>{activeCount}<span className='text-sm font-normal text-gray-400 ml-1'>명</span></p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-100 p-4'>
          <p className='text-xs font-medium text-gray-400'>비활성 계정</p>
          <p className='text-2xl font-bold text-gray-400 mt-1'>{employees.length - activeCount}<span className='text-sm font-normal text-gray-400 ml-1'>명</span></p>
        </div>
      </div>

      {/* 직원 명부 */}
      <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>

        {/* 탭 + 검색 */}
        <div className='px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3'>
          {/* 부서 탭 */}
          <div className='flex gap-1 flex-wrap'>
            {DEPT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDeptFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  deptFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs ${deptFilter === tab.key ? 'text-blue-200' : 'text-gray-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className='relative sm:ml-auto sm:w-56'>
            <svg className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
            </svg>
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='이름, 이메일, 직급 검색'
              className='w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-16'>
            <div className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : filtered.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 gap-2'>
            <svg className='w-10 h-10 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
            </svg>
            <p className='text-sm text-gray-400'>해당하는 직원이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 데스크탑 테이블 */}
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 border-b border-gray-100'>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>직원</th>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>부서 / 직급</th>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>권한</th>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>출퇴근</th>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>페이지 권한</th>
                    <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>계정 상태</th>
                    <th className='px-5 py-3'></th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {filtered.map((emp) => {
                    const dept = deptMap[emp.department];
                    const dc = getDeptColor(dept?.color ?? 'gray');
                    return (
                      <tr key={emp._id} className='hover:bg-gray-50/60 transition-colors'>
                        {/* 직원 */}
                        <td className='px-5 py-3.5'>
                          <div className='flex items-center gap-3'>
                            <div className={`w-9 h-9 rounded-full ${dc.avatar} flex items-center justify-center shrink-0`}>
                              <span className='text-white text-sm font-semibold'>{emp.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className='font-semibold text-gray-800 text-sm'>{emp.name}</p>
                              <p className='text-xs text-gray-400'>{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* 부서/직급 */}
                        <td className='px-5 py-3.5'>
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${dc.bg} ${dc.text} mb-1`}>
                            {dept?.label ?? emp.department}
                          </span>
                          <p className='text-xs text-gray-500'>{emp.position || '—'}</p>
                        </td>
                        {/* 권한 */}
                        <td className='px-5 py-3.5'>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            emp.role === 'head-admin'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {emp.role === 'head-admin' ? '헤드 어드민' : '직원'}
                          </span>
                        </td>
                        {/* 출퇴근 */}
                        <td className='px-5 py-3.5'>
                          <div className='flex items-center gap-1.5'>
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.status === '출근' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className={`text-xs font-medium ${emp.status === '출근' ? 'text-green-600' : 'text-gray-400'}`}>
                              {emp.status}
                            </span>
                          </div>
                        </td>
                        {/* 페이지 권한 */}
                        <td className='px-5 py-3.5'>
                          {emp.role === 'head-admin' ? (
                            <span className='text-xs text-blue-500 font-medium'>전체</span>
                          ) : (
                            <div className='flex items-center gap-2'>
                              <div className='w-20 h-1.5 rounded-full bg-gray-100'>
                                <div
                                  className='h-full rounded-full bg-blue-500'
                                  style={{ width: `${((emp.pagePermissions ?? []).length / PAGE_PERMISSIONS.length) * 100}%` }}
                                />
                              </div>
                              <span className='text-xs text-gray-400'>
                                {(emp.pagePermissions ?? []).length}/{PAGE_PERMISSIONS.length}
                              </span>
                            </div>
                          )}
                        </td>
                        {/* 계정 상태 */}
                        <td className='px-5 py-3.5'>
                          <button
                            onClick={() => toggleActive(emp)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emp.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${emp.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                          </button>
                        </td>
                        {/* 수정 */}
                        <td className='px-5 py-3.5'>
                          <button
                            onClick={() => setEditTarget(emp)}
                            className='text-xs text-blue-600 hover:text-blue-700 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors'
                          >
                            수정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className='md:hidden divide-y divide-gray-50'>
              {filtered.map((emp) => {
                const dept = deptMap[emp.department];
                const dc = getDeptColor(dept?.color ?? 'gray');
                return (
                  <div key={emp._id} className='p-4 flex items-start gap-3'>
                    <div className={`w-10 h-10 rounded-full ${dc.avatar} flex items-center justify-center shrink-0`}>
                      <span className='text-white text-sm font-semibold'>{emp.name.charAt(0)}</span>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span className='font-semibold text-gray-800 text-sm'>{emp.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}>
                          {dept?.label ?? emp.department}
                        </span>
                        {emp.role === 'head-admin' && (
                          <span className='text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600'>
                            어드민
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-gray-400 mt-0.5'>{emp.email}</p>
                      <p className='text-xs text-gray-400'>{emp.position || '직급 미설정'}</p>
                      <div className='flex items-center gap-3 mt-2'>
                        <div className='flex items-center gap-1'>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.status === '출근' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={`text-xs ${emp.status === '출근' ? 'text-green-600' : 'text-gray-400'}`}>{emp.status}</span>
                        </div>
                        <span className='text-xs text-gray-300'>|</span>
                        <span className='text-xs text-gray-400'>
                          권한 {emp.role === 'head-admin' ? '전체' : `${(emp.pagePermissions ?? []).length}/${PAGE_PERMISSIONS.length}`}
                        </span>
                      </div>
                    </div>
                    <div className='flex flex-col items-end gap-2 shrink-0'>
                      <button
                        onClick={() => toggleActive(emp)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emp.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${emp.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <button
                        onClick={() => setEditTarget(emp)}
                        className='text-xs text-blue-600 hover:text-blue-700 font-medium'
                      >
                        수정
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 하단 카운트 */}
        {!loading && filtered.length > 0 && (
          <div className='px-5 py-3 border-t border-gray-50 text-xs text-gray-400'>
            {currentFilterLabel} {filtered.length}명
            {search && ` · "${search}" 검색 결과`}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showInvite && (
        <InviteModal departments={departments} onClose={() => setShowInvite(false)} />
      )}
      {editTarget && (
        <EditModal
          employee={editTarget}
          departments={departments}
          positions={positions}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
