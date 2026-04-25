'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 초대 링크입니다.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('이름은 2자 이상 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register', { token, name: name.trim(), password });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || '가입에 실패했습니다. 초대 링크를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className='text-center space-y-4'>
        <div className='inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-2'>
          <svg className='w-7 h-7 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
          </svg>
        </div>
        <h2 className='text-xl font-bold text-gray-900'>가입이 완료되었습니다</h2>
        <p className='text-sm text-gray-500'>로그인 페이지에서 계정에 접속하세요.</p>
        <button
          onClick={() => router.push('/login')}
          className='mt-2 w-full py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors'
        >
          로그인하러 가기
        </button>
      </div>
    );
  }

  return (
    <>
      <div className='text-center mb-8'>
        <div className='inline-flex items-center justify-center w-14 h-14 rounded-md bg-blue-600 mb-4'>
          <span className='text-white text-2xl font-bold'>C</span>
        </div>
        <h1 className='text-2xl font-bold text-gray-900'>직원 등록</h1>
        <p className='text-sm text-gray-500 mt-1'>초대받은 이메일로 계정을 만들어주세요</p>
      </div>

      <div className='bg-white rounded-md shadow-sm border border-gray-100 p-8'>
        {!token ? (
          <div className='text-center py-4'>
            <p className='text-sm text-red-500'>유효하지 않은 초대 링크입니다.</p>
            <button
              onClick={() => router.push('/login')}
              className='mt-4 text-sm text-blue-600 hover:underline'
            >
              로그인 페이지로 이동
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-5'>
            <div>
              <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-1.5'>
                이름
              </label>
              <input
                id='name'
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder='홍길동'
                className='w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              />
            </div>

            <div>
              <label htmlFor='password' className='block text-sm font-medium text-gray-700 mb-1.5'>
                비밀번호
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder='6자 이상 입력'
                className='w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              />
            </div>

            <div>
              <label htmlFor='passwordConfirm' className='block text-sm font-medium text-gray-700 mb-1.5'>
                비밀번호 확인
              </label>
              <input
                id='passwordConfirm'
                type='password'
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                placeholder='비밀번호를 다시 입력'
                className='w-full px-4 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              />
            </div>

            {error && (
              <div className='flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm'>
                <svg className='w-4 h-4 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
                </svg>
                {error}
              </div>
            )}

            <button
              type='submit'
              disabled={loading}
              className='w-full py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>
        )}
      </div>

      <p className='text-center text-xs text-gray-400 mt-6'>
        문제가 있으면 관리자에게 문의하세요
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='w-full max-w-md'>
        <Suspense fallback={
          <div className='flex items-center justify-center py-20'>
            <div className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        }>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
