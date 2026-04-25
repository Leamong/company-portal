'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import dayjs from 'dayjs';
import { formatDateShort } from '@/lib/utils';
import { getColorMeta } from '@/lib/dept-colors';

// ── Types ─────────────────────────────────────────────────────
interface OrgEmployee {
  _id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  role: string;
  status: '출근' | '퇴근';
  profileImage: string | null;
  phone: string;
  birthDate: string | null;
  emergencyContact: { name: string; phone: string; relation: string };
  createdAt: string;
}

interface Department {
  _id: string;
  key: string;
  label: string;
  color: string;
}

interface Position {
  _id: string;
  title: string;
  level: number;
  color: string;
}

interface EmployeeFormData {
  name: string;
  email: string;
  password: string;
  position: string;
  department: string;
  phone: string;
  birthDate: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: '', email: '', password: '', position: '', department: '',
  phone: '', birthDate: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '',
};

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '-';
  return `${dayjs().diff(dayjs(birthDate), 'year')}세`;
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({
  name, color, profileImage, size = 'md',
}: {
  name: string; color: string; profileImage?: string | null; size?: 'sm' | 'md' | 'lg';
}) {
  const c = getColorMeta(color);
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'md' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} ${c.avatar} rounded-full flex items-center justify-center shrink-0 overflow-hidden`}>
      {profileImage
        ? <img src={profileImage} alt={name} className='w-full h-full object-cover' />
        : <span className='text-white font-bold'>{name.charAt(0)}</span>}
    </div>
  );
}

// ── Employee Card (목록형용) ───────────────────────────────────
function EmployeeCard({
  emp, deptColor, posColor, onClick,
}: {
  emp: OrgEmployee; deptColor: string; posColor: string; onClick: () => void;
}) {
  const dc = getColorMeta(deptColor);
  const pc = getColorMeta(posColor);
  const isAdmin = emp.role === 'head-admin';
  return (
    <div
      onClick={onClick}
      className='bg-white border border-gray-100 rounded-md p-4 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group flex flex-col items-center gap-3 w-44 shrink-0'
    >
      <div className='relative'>
        <Avatar name={emp.name} color={isAdmin ? 'blue' : deptColor} profileImage={emp.profileImage} size='md' />
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${emp.status === '출근' ? 'bg-green-400' : 'bg-gray-300'}`} />
      </div>
      <div className='text-center min-w-0 w-full'>
        <p className='text-sm font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors'>{emp.name}</p>
        {emp.position
          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${pc.badgeBg} ${pc.badgeText}`}>{emp.position}</span>
          : isAdmin
            ? <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 bg-blue-100 text-blue-700'>대표</span>
            : <span className='text-[10px] text-gray-400 mt-1 block'>직급 미지정</span>}
        {emp.phone && <p className='text-[11px] text-gray-400 mt-1.5 truncate'>{emp.phone}</p>}
      </div>
    </div>
  );
}

// ── Employee Detail Modal ─────────────────────────────────────
function EmployeeDetailModal({
  emp, deptLabel, deptColor, canEdit, onClose, onEdit,
}: {
  emp: OrgEmployee; deptLabel: string; deptColor: string; canEdit: boolean; onClose: () => void; onEdit: () => void;
}) {
  const dc = getColorMeta(deptColor);
  const isAdmin = emp.role === 'head-admin';
  const rows = [
    { label: '부서', value: deptLabel },
    { label: '직급', value: emp.position || (isAdmin ? 'CEO' : '-') },
    { label: '연락처', value: emp.phone || '-' },
    { label: '이메일', value: emp.email },
    { label: '나이', value: calcAge(emp.birthDate) },
    { label: '생년월일', value: emp.birthDate ? formatDateShort(emp.birthDate) : '-' },
    { label: '입사일', value: formatDateShort(emp.createdAt) },
  ];
  const hasEmergency = emp.emergencyContact?.name || emp.emergencyContact?.phone || emp.emergencyContact?.relation;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4' onClick={onClose}>
      <div className='bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden' onClick={(e) => e.stopPropagation()}>
        <div className={`${dc.bg} px-6 pt-6 pb-5`}>
          <div className='flex items-start justify-between'>
            <div className='flex items-center gap-4'>
              <Avatar name={emp.name} color={isAdmin ? 'blue' : deptColor} profileImage={emp.profileImage} size='lg' />
              <div>
                <h2 className='text-xl font-bold text-gray-900'>{emp.name}</h2>
                <div className='flex items-center gap-2 mt-1'>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${dc.text}`}>{deptLabel}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${emp.status === '출근' ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${emp.status === '출근' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {emp.status}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className='text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-white/50 transition'>
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>
        </div>
        <div className='px-6 py-4'>
          <table className='w-full text-sm'>
            <tbody className='divide-y divide-gray-50'>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className='py-2.5 pr-4 text-xs font-semibold text-gray-400 w-24 whitespace-nowrap'>{r.label}</td>
                  <td className='py-2.5 text-sm text-gray-800'>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className='mt-4 pt-4 border-t border-gray-100'>
            <p className='text-xs font-semibold text-gray-400 mb-2'>비상연락처</p>
            {hasEmergency ? (
              <div className='bg-amber-50 rounded-md px-4 py-3 text-sm space-y-1'>
                {emp.emergencyContact.name && <div className='flex gap-3'><span className='text-xs text-gray-400 w-12 shrink-0'>이름</span><span className='text-gray-800 font-medium'>{emp.emergencyContact.name}</span></div>}
                {emp.emergencyContact.phone && <div className='flex gap-3'><span className='text-xs text-gray-400 w-12 shrink-0'>연락처</span><span className='text-gray-800'>{emp.emergencyContact.phone}</span></div>}
                {emp.emergencyContact.relation && <div className='flex gap-3'><span className='text-xs text-gray-400 w-12 shrink-0'>관계</span><span className='text-gray-800'>{emp.emergencyContact.relation}</span></div>}
              </div>
            ) : (
              <p className='text-sm text-gray-400'>등록된 비상연락처가 없습니다</p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className='px-6 pb-5 flex gap-3'>
            <button onClick={onEdit} className='flex-1 py-2.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm'>
              정보 수정
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Employee Form Modal ───────────────────────────────────────
function EmployeeFormModal({
  editing, departments, positions, onClose, onSuccess,
}: {
  editing: OrgEmployee | null; departments: Department[]; positions: Position[]; onClose: () => void; onSuccess: () => void;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<EmployeeFormData>(() => {
    if (!editing) return { ...EMPTY_FORM, department: departments[0]?.key ?? '' };
    return {
      name: editing.name, email: editing.email, password: '',
      position: editing.position, department: editing.department,
      phone: editing.phone ?? '',
      birthDate: editing.birthDate ? dayjs(editing.birthDate).format('YYYY-MM-DD') : '',
      emergencyName: editing.emergencyContact?.name ?? '',
      emergencyPhone: editing.emergencyContact?.phone ?? '',
      emergencyRelation: editing.emergencyContact?.relation ?? '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof EmployeeFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('이름을 입력하세요.'); return; }
    if (!isEdit && !form.email.trim()) { setError('이메일을 입력하세요.'); return; }
    if (!isEdit && !form.password.trim()) { setError('비밀번호를 입력하세요.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(),
        ...(form.password.trim() && { password: form.password.trim() }),
        position: form.position, department: form.department,
        phone: form.phone, birthDate: form.birthDate || null,
        emergencyContact: { name: form.emergencyName, phone: form.emergencyPhone, relation: form.emergencyRelation },
      };
      if (isEdit) await api.patch(`/api/users/${editing._id}`, payload);
      else await api.post('/api/users', payload);
      onSuccess(); onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto'>
      <div className='bg-white rounded-md shadow-2xl w-full max-w-lg my-4'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='text-base font-bold text-gray-900'>{isEdit ? '직원 정보 수정' : '직원 추가'}</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto'>
          <div>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>기본 정보</p>
            <div className='grid grid-cols-2 gap-3'>
              <div><label className={labelCls}>이름 *</label><input type='text' value={form.name} onChange={set('name')} placeholder='홍길동' className={inputCls} /></div>
              <div><label className={labelCls}>이메일 {!isEdit && '*'}</label><input type='email' value={form.email} onChange={set('email')} placeholder='user@company.com' disabled={isEdit} className={`${inputCls} ${isEdit ? 'bg-gray-50 text-gray-400' : ''}`} /></div>
              {!isEdit && <div className='col-span-2'><label className={labelCls}>임시 비밀번호 *</label><input type='password' value={form.password} onChange={set('password')} placeholder='초기 비밀번호 입력' className={inputCls} /></div>}
              {isEdit && <div className='col-span-2'><label className={labelCls}>비밀번호 변경 (선택)</label><input type='password' value={form.password} onChange={set('password')} placeholder='변경 시에만 입력' className={inputCls} /></div>}
              <div>
                <label className={labelCls}>부서</label>
                <select value={form.department} onChange={set('department')} className={inputCls}>
                  <option value=''>부서 미지정</option>
                  {departments.map((d) => <option key={d._id} value={d.key}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>직급</label>
                <select value={form.position} onChange={set('position')} className={inputCls}>
                  <option value=''>직급 미지정</option>
                  {[...positions].sort((a, b) => b.level - a.level).map((p) => <option key={p._id} value={p.title}>{p.title} (Lv.{p.level})</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>연락처 정보</p>
            <div className='grid grid-cols-2 gap-3'>
              <div><label className={labelCls}>연락처</label><input type='tel' value={form.phone} onChange={set('phone')} placeholder='010-0000-0000' className={inputCls} /></div>
              <div><label className={labelCls}>생년월일</label><input type='date' value={form.birthDate} onChange={set('birthDate')} className={inputCls} /></div>
            </div>
          </div>
          <div>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>비상연락처</p>
            <div className='grid grid-cols-3 gap-3'>
              <div><label className={labelCls}>이름</label><input type='text' value={form.emergencyName} onChange={set('emergencyName')} placeholder='홍부모' className={inputCls} /></div>
              <div><label className={labelCls}>연락처</label><input type='tel' value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder='010-0000-0000' className={inputCls} /></div>
              <div><label className={labelCls}>관계</label><input type='text' value={form.emergencyRelation} onChange={set('emergencyRelation')} placeholder='부모, 배우자...' className={inputCls} /></div>
            </div>
          </div>
          {error && <p className='text-sm text-red-500 bg-red-50 rounded-md px-3 py-2'>{error}</p>}
        </div>
        <div className='px-6 pb-5 flex gap-3 border-t border-gray-100 pt-4'>
          <button onClick={onClose} className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'>취소</button>
          <button onClick={handleSave} disabled={saving} className='flex-1 py-2.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm'>
            {saving ? '저장 중...' : isEdit ? '수정 완료' : '직원 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OrgNodeBox: 트리형 카드 ───────────────────────────────────
function OrgNodeBox({
  title, name, status, highlight, textColor, onClick,
}: {
  title: string; name: string; status?: '출근' | '퇴근';
  highlight?: boolean; textColor?: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-md border bg-white text-center transition-all hover:shadow-lg hover:border-blue-300 select-none group ${
        highlight ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-blue-200'
      }`}
      style={{ minWidth: 110, maxWidth: 140, padding: '8px 12px' }}
    >
      {status !== undefined && (
        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${status === '출근' ? 'bg-green-400' : 'bg-gray-300'}`} />
      )}
      <p className={`text-[10px] font-semibold leading-tight truncate mb-0.5 ${textColor ?? 'text-gray-400'}`}>{title}</p>
      <p className='text-[13px] font-bold text-gray-800 leading-tight truncate group-hover:text-blue-700 transition-colors'>{name}</p>
    </div>
  );
}

// ── OrgChartTree: 트리형 조직도 ──────────────────────────────
const COL_W = 168;

function OrgChartTree({
  headAdmins, departments, regularEmps, posLevelMap, onCardClick,
}: {
  headAdmins: OrgEmployee[];
  departments: Department[];
  regularEmps: OrgEmployee[];
  posLevelMap: Record<string, number>;
  onCardClick: (emp: OrgEmployee) => void;
}) {
  const activeDepts = departments.filter((d) => regularEmps.some((e) => e.department === d.key));
  const noDeptEmps = regularEmps.filter((e) => !e.department || !departments.find((d) => d.key === e.department));
  const allCols = [...activeDepts.map((d) => d._id), ...(noDeptEmps.length > 0 ? ['__none__'] : [])];
  const totalCols = allCols.length;
  const totalW = totalCols * COL_W;
  const halfColW = COL_W / 2;

  return (
    <div className='overflow-x-auto rounded-md border border-gray-100 bg-white shadow-sm'>
      <div
        className='flex flex-col items-center py-10 px-8'
        style={{ minWidth: Math.max(totalW + 64, 400) }}
      >
        {/* ── CEO 레벨 ── */}
        <div className='flex gap-4'>
          {headAdmins.length > 0
            ? headAdmins.map((emp) => (
                <OrgNodeBox
                  key={emp._id}
                  title='CEO'
                  name={emp.name}
                  status={emp.status}
                  highlight
                  textColor='text-blue-600'
                  onClick={() => onCardClick(emp)}
                />
              ))
            : <OrgNodeBox title='CEO' name='(미등록)' onClick={() => {}} />}
        </div>

        {totalCols > 0 && (
          <>
            {/* CEO → branch 수직선 */}
            <div className='w-px bg-gray-300' style={{ height: 32 }} />

            {/* 부서 열 그룹 */}
            <div className='relative flex' style={{ width: totalW }}>
              {/* 수평 연결선 */}
              {totalCols > 1 && (
                <div
                  className='absolute h-px bg-gray-300'
                  style={{ top: 0, left: halfColW, right: halfColW }}
                />
              )}

              {/* 각 부서 열 */}
              {activeDepts.map((dept) => {
                const c = getColorMeta(dept.color);
                const deptEmps = regularEmps
                  .filter((e) => e.department === dept.key)
                  .sort((a, b) => (posLevelMap[b.position] ?? -1) - (posLevelMap[a.position] ?? -1));

                return (
                  <div key={dept._id} className='flex flex-col items-center' style={{ width: COL_W }}>
                    {/* branch → 부서 헤더 수직선 */}
                    <div className='w-px bg-gray-300' style={{ height: 32 }} />

                    {/* 부서 헤더 */}
                    <div
                      className='rounded-md text-white text-xs font-bold text-center py-2 px-3 tracking-wide'
                      style={{ width: COL_W - 24, backgroundColor: '#1e2d5a' }}
                    >
                      {dept.label}
                    </div>

                    {deptEmps.length > 0 && (
                      <>
                        {/* 부서 헤더 → 첫 직원 수직선 */}
                        <div className='w-px bg-gray-300' style={{ height: 16 }} />

                        {/* 직원 목록 */}
                        <div className='flex flex-col items-center' style={{ gap: 0 }}>
                          {deptEmps.map((emp, i) => (
                            <div key={emp._id} className='flex flex-col items-center'>
                              {i > 0 && <div className='w-px bg-gray-200' style={{ height: 6 }} />}
                              <OrgNodeBox
                                title={emp.position || '미지정'}
                                name={emp.name}
                                status={emp.status}
                                textColor={c.text}
                                onClick={() => onCardClick(emp)}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {deptEmps.length === 0 && (
                      <p className='text-[11px] text-gray-300 mt-4'>인원 없음</p>
                    )}
                  </div>
                );
              })}

              {/* 부서 미지정 열 */}
              {noDeptEmps.length > 0 && (
                <div className='flex flex-col items-center' style={{ width: COL_W }}>
                  <div className='w-px bg-gray-300' style={{ height: 32 }} />
                  <div
                    className='rounded-md text-white text-xs font-bold text-center py-2 px-3'
                    style={{ width: COL_W - 24, backgroundColor: '#6b7280' }}
                  >
                    미지정
                  </div>
                  <div className='w-px bg-gray-300' style={{ height: 16 }} />
                  <div className='flex flex-col items-center' style={{ gap: 0 }}>
                    {noDeptEmps
                      .sort((a, b) => (posLevelMap[b.position] ?? -1) - (posLevelMap[a.position] ?? -1))
                      .map((emp, i) => (
                        <div key={emp._id} className='flex flex-col items-center'>
                          {i > 0 && <div className='w-px bg-gray-200' style={{ height: 6 }} />}
                          <OrgNodeBox
                            title={emp.position || '미지정'}
                            name={emp.name}
                            status={emp.status}
                            textColor='text-gray-400'
                            onClick={() => onCardClick(emp)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {totalCols === 0 && headAdmins.length === 0 && (
          <p className='text-sm text-gray-400 mt-8'>등록된 직원이 없습니다</p>
        )}
      </div>
    </div>
  );
}

// ── DeptTiers (목록형용) ──────────────────────────────────────
type Tier = { title: string; level: number; color: string; members: OrgEmployee[] };

function DeptTiers({
  tiers, deptColor, onCardClick,
}: {
  tiers: Tier[]; deptColor: string; onCardClick: (emp: OrgEmployee) => void;
}) {
  return (
    <div className='space-y-5'>
      {tiers.map((tier) => {
        const pc = getColorMeta(tier.color);
        return (
          <div key={tier.title}>
            <div className='flex items-center gap-2 mb-3'>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pc.badgeBg} ${pc.badgeText}`}>{tier.title}</span>
              {tier.level > 0 && <span className='text-[10px] text-gray-300'>Lv.{tier.level}</span>}
              <div className='flex-1 h-px bg-gray-100' />
              <span className='text-[10px] text-gray-300'>{tier.members.length}명</span>
            </div>
            <div className='flex gap-3 flex-wrap'>
              {tier.members.map((emp) => (
                <EmployeeCard key={emp._id} emp={emp} deptColor={deptColor} posColor={tier.color} onClick={() => onCardClick(emp)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function OrganizationPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'head-admin' || user?.canApprove === true;

  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [activeDept, setActiveDept] = useState<string>('all');
  const [detailEmp, setDetailEmp] = useState<OrgEmployee | null>(null);
  const [formModal, setFormModal] = useState<{ open: boolean; editing: OrgEmployee | null }>({ open: false, editing: null });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empRes, deptRes, posRes] = await Promise.all([
        api.get('/api/users/org'),
        api.get('/api/departments'),
        api.get('/api/positions'),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setPositions(posRes.data);
    } catch { /* noop */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const posLevelMap = Object.fromEntries(positions.map((p) => [p.title, p.level]));
  const posColorMap = Object.fromEntries(positions.map((p) => [p.title, p.color]));
  const deptMap = Object.fromEntries(departments.map((d) => [d.key, d]));

  const headAdmins = employees.filter((e) => e.role === 'head-admin');
  const regularEmps = employees.filter((e) => e.role !== 'head-admin');
  const filteredEmps = activeDept === 'all' ? regularEmps : regularEmps.filter((e) => e.department === activeDept);

  const buildTiers = (emps: OrgEmployee[]): Tier[] => {
    const grouped = new Map<string, OrgEmployee[]>();
    for (const emp of emps) {
      const key = emp.position || '__none__';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(emp);
    }
    return Array.from(grouped.entries())
      .map(([title, members]) => ({
        title: title === '__none__' ? '미지정' : title,
        level: title === '__none__' ? -1 : (posLevelMap[title] ?? 0),
        color: title === '__none__' ? 'gray' : (posColorMap[title] ?? 'gray'),
        members,
      }))
      .sort((a, b) => b.level - a.level);
  };

  const onEdit = (emp: OrgEmployee) => { setDetailEmp(null); setFormModal({ open: true, editing: emp }); };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-80'>
        <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>조직도</h1>
          <p className='text-sm text-gray-500 mt-1'>부서·직급 기준으로 자동 구성됩니다</p>
        </div>
        <div className='flex items-center gap-3'>
          {/* 뷰 토글 */}
          <div className='flex items-center bg-gray-100 rounded-md p-1 text-sm'>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                viewMode === 'tree' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              트리형
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              목록형
            </button>
          </div>

          {canManage && (
            <button
              onClick={() => setFormModal({ open: true, editing: null })}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition shadow-sm'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
              </svg>
              직원 추가
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <div className='bg-white rounded-md border border-gray-100 p-4 text-center'>
          <p className='text-2xl font-bold text-gray-900'>{employees.length}</p>
          <p className='text-xs text-gray-500 mt-0.5'>전체 인원</p>
        </div>
        <div className='bg-white rounded-md border border-gray-100 p-4 text-center'>
          <p className='text-2xl font-bold text-green-600'>{employees.filter((e) => e.status === '출근').length}</p>
          <p className='text-xs text-gray-500 mt-0.5'>출근 중</p>
        </div>
        <div className='bg-white rounded-md border border-gray-100 p-4 text-center'>
          <p className='text-2xl font-bold text-blue-600'>{departments.length}</p>
          <p className='text-xs text-gray-500 mt-0.5'>부서 수</p>
        </div>
        <div className='bg-white rounded-md border border-gray-100 p-4 text-center'>
          <p className='text-2xl font-bold text-purple-600'>{positions.length}</p>
          <p className='text-xs text-gray-500 mt-0.5'>직급 수</p>
        </div>
      </div>

      {/* ── 트리형 뷰 ── */}
      {viewMode === 'tree' && (
        <OrgChartTree
          headAdmins={headAdmins}
          departments={departments}
          regularEmps={regularEmps}
          posLevelMap={posLevelMap}
          onCardClick={setDetailEmp}
        />
      )}

      {/* ── 목록형 뷰 ── */}
      {viewMode === 'list' && (
        <>
          {/* 부서 탭 */}
          <div className='flex items-center gap-2 flex-wrap'>
            <button
              onClick={() => setActiveDept('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeDept === 'all' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              전체
            </button>
            {departments.map((d) => {
              const c = getColorMeta(d.color);
              const isActive = activeDept === d.key;
              return (
                <button
                  key={d._id}
                  onClick={() => setActiveDept(d.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                    isActive ? `${c.badgeBg} ${c.text} border-transparent shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {d.label}
                  <span className='ml-1.5 text-xs opacity-70'>
                    {employees.filter((e) => e.department === d.key && e.role !== 'head-admin').length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 전체 탭 */}
          {activeDept === 'all' && (
            <>
              {headAdmins.length > 0 && (
                <div className='space-y-3'>
                  <div className='flex items-center gap-3'>
                    <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>CEO</span>
                    <div className='flex-1 h-px bg-gray-100' />
                  </div>
                  <div className='flex gap-4 flex-wrap'>
                    {headAdmins.map((emp) => (
                      <EmployeeCard key={emp._id} emp={emp} deptColor='blue' posColor='blue' onClick={() => setDetailEmp(emp)} />
                    ))}
                  </div>
                </div>
              )}

              <div className='space-y-8'>
                {departments.map((dept) => {
                  const deptEmps = regularEmps.filter((e) => e.department === dept.key);
                  if (deptEmps.length === 0) return null;
                  const c = getColorMeta(dept.color);
                  return (
                    <div key={dept._id}>
                      <div className='flex items-center gap-3 mb-4'>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.badgeBg} ${c.text}`}>{dept.label}</span>
                        <div className='flex-1 h-px bg-gray-100' />
                        <span className='text-xs text-gray-400'>{deptEmps.length}명</span>
                      </div>
                      <DeptTiers tiers={buildTiers(deptEmps)} deptColor={dept.color} onCardClick={setDetailEmp} />
                    </div>
                  );
                })}

                {(() => {
                  const noDeptEmps = regularEmps.filter((e) => !e.department || !deptMap[e.department]);
                  if (noDeptEmps.length === 0) return null;
                  return (
                    <div>
                      <div className='flex items-center gap-3 mb-4'>
                        <span className='text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600'>부서 미지정</span>
                        <div className='flex-1 h-px bg-gray-100' />
                        <span className='text-xs text-gray-400'>{noDeptEmps.length}명</span>
                      </div>
                      <DeptTiers tiers={buildTiers(noDeptEmps)} deptColor='gray' onCardClick={setDetailEmp} />
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* 특정 부서 탭 */}
          {activeDept !== 'all' && (
            <div className='space-y-6'>
              {filteredEmps.length === 0 ? (
                <div className='bg-white rounded-md border border-dashed border-gray-200 py-16 text-center'>
                  <p className='text-sm text-gray-400'>이 부서에 소속된 직원이 없습니다</p>
                </div>
              ) : (
                <DeptTiers
                  tiers={buildTiers(filteredEmps)}
                  deptColor={deptMap[activeDept]?.color ?? 'blue'}
                  onCardClick={setDetailEmp}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {detailEmp && (
        <EmployeeDetailModal
          emp={detailEmp}
          deptLabel={deptMap[detailEmp.department]?.label ?? detailEmp.department ?? '미지정'}
          deptColor={deptMap[detailEmp.department]?.color ?? 'gray'}
          canEdit={canManage}
          onClose={() => setDetailEmp(null)}
          onEdit={() => onEdit(detailEmp)}
        />
      )}

      {/* Form Modal */}
      {formModal.open && (
        <EmployeeFormModal
          editing={formModal.editing}
          departments={departments}
          positions={positions}
          onClose={() => setFormModal({ open: false, editing: null })}
          onSuccess={fetchAll}
        />
      )}
    </div>
  );
}
