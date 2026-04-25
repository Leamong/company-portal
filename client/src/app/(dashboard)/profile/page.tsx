'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '-';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}세`;
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [birthYear, setBirthYear] = useState(() => user?.birthDate?.split('-')[0] ?? '');
  const [birthMonth, setBirthMonth] = useState(() => user?.birthDate?.split('-')[1] ?? '');
  const [birthDay, setBirthDay] = useState(() => user?.birthDate?.split('-')[2] ?? '');
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (birthYear.length === 4 && birthMonth && birthDay) {
      setBirthDate(`${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`);
    } else if (!birthYear && !birthMonth && !birthDay) {
      setBirthDate('');
    }
  }, [birthYear, birthMonth, birthDay]);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deptLabel =
    user?.department === 'marketing' ? '마케팅팀' :
    user?.department === 'design' ? '디자인팀' : '경영지원';

  const roleLabel = isAdmin ? '헤드 어드민' : `${user?.position || ''} · ${deptLabel}`;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
  };

  const handleSave = async () => {
    if (!name.trim()) { showError('이름을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const res = await api.patch('/api/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
        birthDate: birthDate || null,
      });
      updateUser({
        name: res.data.name,
        phone: res.data.phone,
        birthDate: res.data.birthDate,
      });
      showSuccess('프로필이 저장되었습니다.');
    } catch {
      showError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showError('파일 크기는 5MB 이하여야 합니다.'); return; }
    if (!file.type.startsWith('image/')) { showError('이미지 파일만 업로드 가능합니다.'); return; }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/auth/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ profileImage: res.data.profileImage });
      showSuccess('프로필 사진이 업데이트되었습니다.');
    } catch {
      showError('사진 업로드에 실패했습니다.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }, [updateUser]);

  const avatarColor = isAdmin ? 'bg-blue-600' :
    user?.canManageAttendance ? 'bg-emerald-500' :
    user?.canApprove ? 'bg-amber-500' : 'bg-gray-600';

  return (
    <div className='max-w-2xl mx-auto px-4 py-8'>
      {/* 헤더 */}
      <div className='mb-8'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>내 프로필</h1>
        <p className='text-sm text-gray-500 mt-1'>연락처, 생년월일, 프로필 사진을 수정할 수 있습니다.</p>
      </div>

      {/* 피드백 메시지 */}
      {successMsg && (
        <div className='mb-4 px-4 py-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2'>
          <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className='mb-4 px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2'>
          <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
          </svg>
          {errorMsg}
        </div>
      )}

      <div className='bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
        {/* 프로필 사진 섹션 */}
        <div className='px-6 py-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-5'>
          <div className='relative'>
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center overflow-hidden shrink-0',
              avatarColor,
            )}>
              {user?.profileImage ? (
                <img src={user.profileImage} alt={user.name} className='w-full h-full object-cover' />
              ) : (
                <span className='text-white text-2xl font-semibold'>{user?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            {avatarUploading && (
              <div className='absolute inset-0 rounded-full bg-black/50 flex items-center justify-center'>
                <svg className='w-5 h-5 text-white animate-spin' fill='none' viewBox='0 0 24 24'>
                  <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                  <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
                </svg>
              </div>
            )}
          </div>
          <div className='flex-1'>
            <p className='font-semibold text-gray-900 dark:text-white text-lg'>{user?.name}</p>
            <p className='text-sm text-gray-500 mt-0.5'>{roleLabel}</p>
            <p className='text-xs text-gray-400 mt-0.5'>{user?.email}</p>
            <div className='mt-3 flex items-center gap-2'>
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className='text-sm px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50'
              >
                사진 변경
              </button>
              {user?.profileImage && (
                <button
                  type='button'
                  onClick={async () => {
                    try {
                      await api.patch('/api/auth/profile', { profileImage: null });
                      updateUser({ profileImage: null });
                      showSuccess('프로필 사진이 삭제되었습니다.');
                    } catch {
                      showError('사진 삭제에 실패했습니다.');
                    }
                  }}
                  className='text-sm px-3 py-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                >
                  삭제
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* 수정 불가 정보 (읽기 전용) */}
        <div className='px-6 py-5 border-b border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4'>
          <div>
            <p className='text-xs font-medium text-gray-400 uppercase tracking-wider mb-1'>이메일</p>
            <p className='text-sm text-gray-600 dark:text-gray-300'>{user?.email}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-400 uppercase tracking-wider mb-1'>부서</p>
            <p className='text-sm text-gray-600 dark:text-gray-300'>{deptLabel}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-400 uppercase tracking-wider mb-1'>직급</p>
            <p className='text-sm text-gray-600 dark:text-gray-300'>{user?.position || '-'}</p>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-400 uppercase tracking-wider mb-1'>나이</p>
            <p className='text-sm text-gray-600 dark:text-gray-300'>{calcAge(user?.birthDate ?? null)}</p>
          </div>
        </div>

        {/* 편집 가능 필드 */}
        <div className='px-6 py-5 space-y-4'>
          {/* 이름 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
              이름
            </label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-40 px-3.5 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              placeholder='이름을 입력하세요'
            />
          </div>

          {/* 연락처 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
              연락처
            </label>
            <input
              type='tel'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className='w-44 px-3.5 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              placeholder='010-0000-0000'
            />
          </div>

          {/* 생년월일 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
              생년월일
            </label>
            <div className='flex items-center gap-2'>
              {/* YYYY */}
              <input
                type='text'
                inputMode='numeric'
                maxLength={4}
                value={birthYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setBirthYear(val);
                  if (val.length === 4) monthRef.current?.focus();
                }}
                placeholder='YYYY'
                className='w-20 px-2 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center'
              />
              <span className='text-gray-400 text-sm'>/</span>
              {/* MM */}
              <input
                ref={monthRef}
                type='text'
                inputMode='numeric'
                maxLength={2}
                value={birthMonth}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val === '' || (Number(val) >= 1 && Number(val) <= 12) || val === '0') {
                    setBirthMonth(val);
                    if (val.length === 2) dayRef.current?.focus();
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val.length === 1 && val !== '0') setBirthMonth(val.padStart(2, '0'));
                }}
                placeholder='MM'
                className='w-14 px-2 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center'
              />
              <span className='text-gray-400 text-sm'>/</span>
              {/* DD */}
              <div className='relative'>
                <input
                  ref={dayRef}
                  type='text'
                  inputMode='numeric'
                  maxLength={2}
                  value={birthDay}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '' || (Number(val) >= 1 && Number(val) <= 31) || val === '0') {
                      setBirthDay(val);
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (val.length === 1 && val !== '0') setBirthDay(val.padStart(2, '0'));
                  }}
                  placeholder='DD'
                  className='w-14 px-2 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center'
                />
              </div>
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className='px-6 pb-6 flex justify-end'>
          <button
            type='button'
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-5 py-2.5 rounded-md text-sm font-medium transition-colors',
              saving
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
            )}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
