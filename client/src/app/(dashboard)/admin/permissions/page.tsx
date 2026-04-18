'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PAGE_PERMISSIONS } from '@/lib/permissions';

// ─── 고정 위치 툴팁 (overflow 컨테이너 밖으로 탈출) ────────────
function FixedTooltip({ label, desc, color, icon }: { label: string; desc: string; color: string; icon: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className='flex flex-col items-center gap-0.5 cursor-default'
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <span className={color}>{icon}</span>
      <span className='text-[10px] font-semibold text-gray-400'>{label}</span>
      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          className='pointer-events-none bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg'
        >
          {desc}
          <div className='absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800' />
        </div>
      )}
    </div>
  );
}

// ─── 타입 ──────────────────────────────────────────────────────
interface Employee {
  _id: string;
  name: string;
  email: string;
  position: string;
  department: 'marketing' | 'design' | 'management';
  role: 'head-admin' | 'employee';
  isActive: boolean;
  canApprove: boolean;
  canManageAttendance: boolean;
  pagePermissions: string[];
}

type DelegationKey = 'canApprove' | 'canManageAttendance';

interface DelegationDef {
  key: DelegationKey;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
}

const DELEGATION_TYPES: DelegationDef[] = [
  {
    key: 'canApprove',
    label: '결재 대리',
    desc: '직원들의 휴가/지출결의 결재를 처리합니다',
    icon: (
      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
      </svg>
    ),
    color: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'canManageAttendance',
    label: '근태 관리',
    desc: '팀원의 출퇴근 기록을 조회·수정합니다',
    icon: (
      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
      </svg>
    ),
    color: 'text-emerald-600',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
];

const DEPT_LABEL: Record<string, string> = {
  marketing: '마케팅',
  design: '디자인',
  management: '경영지원',
};

const DEPT_COLOR: Record<string, string> = {
  marketing: 'bg-blue-500',
  design: 'bg-purple-500',
  management: 'bg-gray-400',
};

// ─── 토글 스위치 ───────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ─── 직원 행 컴포넌트 ──────────────────────────────────────────
function EmployeePermRow({
  emp,
  onToggleDelegation,
  onTogglePage,
  saving,
}: {
  emp: Employee;
  onToggleDelegation: (id: string, key: DelegationKey, val: boolean) => void;
  onTogglePage: (id: string, key: string, val: boolean) => void;
  saving: string | null;
}) {
  const isHead = emp.role === 'head-admin';
  const isSaving = saving === emp._id;

  const delegatedCount = DELEGATION_TYPES.filter((d) => emp[d.key]).length;

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
      {/* 직원 정보 */}
      <td className='px-5 py-4 min-w-[160px]'>
        <div className='flex items-center gap-3'>
          <div className={`w-8 h-8 rounded-full ${DEPT_COLOR[emp.department]} flex items-center justify-center shrink-0`}>
            <span className='text-white text-xs font-semibold'>{emp.name.charAt(0)}</span>
          </div>
          <div>
            <p className='text-sm font-semibold text-gray-800'>{emp.name}</p>
            <p className='text-xs text-gray-400'>
              {emp.position ? `${emp.position} · ` : ''}{DEPT_LABEL[emp.department]}
            </p>
          </div>
        </div>
      </td>

      {/* 역할 */}
      <td className='px-4 py-4'>
        {isHead ? (
          <span className='text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full'>
            헤드 어드민
          </span>
        ) : (
          <div className='flex flex-wrap gap-1'>
            {delegatedCount > 0 ? (
              DELEGATION_TYPES.filter((d) => emp[d.key]).map((d) => (
                <span key={d.key} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${d.badgeColor}`}>
                  {d.label}
                </span>
              ))
            ) : (
              <span className='text-xs text-gray-400'>일반 직원</span>
            )}
          </div>
        )}
      </td>

      {/* 위임 권한 토글 */}
      {DELEGATION_TYPES.map((def) => (
        <td key={def.key} className='px-4 py-4 text-center'>
          {isSaving ? (
            <div className='inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin' />
          ) : (
            <Toggle
              checked={isHead ? true : emp[def.key]}
              disabled={isHead}
              onChange={(val) => onToggleDelegation(emp._id, def.key, val)}
            />
          )}
        </td>
      ))}

      {/* 페이지 권한 */}
      <td className='px-4 py-4'>
        {isHead ? (
          <span className='text-xs text-blue-500 font-medium'>전체 접근</span>
        ) : (
          <div className='flex flex-wrap gap-1.5'>
            {PAGE_PERMISSIONS.map((page) => {
              const has = emp.pagePermissions.includes(page.key);
              return (
                <button
                  key={page.key}
                  onClick={() => onTogglePage(emp._id, page.key, !has)}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-colors
                    ${has
                      ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {page.label}
                </button>
              );
            })}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
export default function PermissionsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      setEmployees(res.data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'head-admin') fetchEmployees();
  }, [user, fetchEmployees]);

  const handleToggleDelegation = async (id: string, key: DelegationKey, val: boolean) => {
    setSaving(id);
    try {
      const res = await api.patch(`/api/users/${id}`, { [key]: val });
      setEmployees((prev) => prev.map((e) => e._id === id ? { ...e, ...res.data } : e));
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const handleTogglePage = async (id: string, pageKey: string, val: boolean) => {
    const emp = employees.find((e) => e._id === id);
    if (!emp) return;
    const newPerms = val
      ? [...emp.pagePermissions, pageKey]
      : emp.pagePermissions.filter((k) => k !== pageKey);
    setSaving(id);
    try {
      const res = await api.patch(`/api/users/${id}`, { pagePermissions: newPerms });
      setEmployees((prev) => prev.map((e) => e._id === id ? { ...e, ...res.data } : e));
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(null);
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

  const filtered = employees.filter((e) => {
    if (deptFilter !== 'all' && e.department !== deptFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    }
    return true;
  });

  // 통계
  const delegatedCount = employees.filter((e) => e.role !== 'head-admin' && (e.canApprove || e.canManageAttendance)).length;

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>권한 위임</h1>
        <p className='text-sm text-gray-500 mt-1'>
          대표의 업무를 신뢰할 수 있는 직원에게 위임하고, 페이지 접근 권한을 설정합니다
        </p>
      </div>

      {/* 안내 배너 */}
      <div className='bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3'>
        <svg className='w-5 h-5 text-amber-500 shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
        </svg>
        <div className='flex-1'>
          <p className='text-sm font-semibold text-amber-800'>위임 권한 안내</p>
          <ul className='text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside'>
            <li><strong>결재 대리</strong>: 활성화된 직원은 본인에게 지정된 결재 요청을 처리할 수 있습니다</li>
            <li><strong>근태 관리</strong>: 활성화된 직원은 팀원의 출퇴근 기록을 조회하고 관리할 수 있습니다</li>
            <li><strong>페이지 권한</strong>: 각 메뉴 버튼을 클릭하면 즉시 접근 권한이 토글됩니다</li>
          </ul>
        </div>
        <div className='shrink-0 text-right'>
          <p className='text-2xl font-bold text-amber-600'>{delegatedCount}</p>
          <p className='text-xs text-amber-500'>위임 직원 수</p>
        </div>
      </div>

      {/* 위임 타입 카드 */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {DELEGATION_TYPES.map((def) => {
          const count = employees.filter((e) => e.role !== 'head-admin' && e[def.key]).length;
          const holders = employees.filter((e) => e.role !== 'head-admin' && e[def.key]);
          return (
            <div key={def.key} className='bg-white rounded-2xl border border-gray-100 p-4'>
              <div className='flex items-center gap-2 mb-2'>
                <span className={def.color}>{def.icon}</span>
                <span className='text-sm font-semibold text-gray-800'>{def.label}</span>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${def.badgeColor}`}>
                  {count}명 활성
                </span>
              </div>
              <p className='text-xs text-gray-400 mb-3'>{def.desc}</p>
              <div className='flex flex-wrap gap-1.5'>
                {holders.length === 0 ? (
                  <span className='text-xs text-gray-300'>위임된 직원 없음</span>
                ) : (
                  holders.map((e) => (
                    <span key={e._id} className='text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full'>
                      {e.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 필터 & 검색 */}
      <div className='flex flex-col sm:flex-row gap-3'>
        <div className='flex gap-1 bg-gray-100 p-1 rounded-xl w-fit'>
          {[
            { key: 'all', label: '전체' },
            { key: 'marketing', label: '마케팅' },
            { key: 'design', label: '디자인' },
            { key: 'management', label: '경영지원' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setDeptFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${deptFilter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className='relative sm:ml-auto sm:w-56'>
          <svg className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
          </svg>
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='이름 또는 이메일 검색'
            className='w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      {/* 권한 테이블 */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : (
        <div className='bg-white rounded-2xl border border-gray-100 overflow-x-auto'>
          <table className='w-full text-sm min-w-[800px]'>
            <thead>
              <tr className='bg-gray-50 border-b border-gray-100'>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-400'>직원</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-400'>현재 역할</th>
                {DELEGATION_TYPES.map((def) => (
                  <th key={def.key} className='px-4 py-3 text-center'>
                    <FixedTooltip
                      label={def.label}
                      desc={def.desc}
                      color={def.color}
                      icon={def.icon}
                    />
                  </th>
                ))}
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-400'>페이지 접근 권한</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4 + DELEGATION_TYPES.length} className='text-center py-12 text-sm text-gray-400'>
                    해당하는 직원이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <EmployeePermRow
                    key={emp._id}
                    emp={emp}
                    onToggleDelegation={handleToggleDelegation}
                    onTogglePage={handleTogglePage}
                    saving={saving}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
