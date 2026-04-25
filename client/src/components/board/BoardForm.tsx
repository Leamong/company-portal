'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import TipTapEditor from './TipTapEditor';

interface Channel {
  _id: string;
  name: string;
  scope: 'company' | 'department';
  noticeOnly: boolean;
  archived: boolean;
}

interface Props {
  mode: 'create' | 'edit';
  postId?: string;
  initial?: {
    title: string;
    content: string;
    channelId: string;
    channelName?: string;
  };
  defaultChannelId?: string;
}

export default function BoardForm({ mode, postId, initial, defaultChannelId }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string>(initial?.channelId ?? defaultChannelId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Channel[]>('/api/board/channels')
      .then((res) => {
        setChannels(res.data);
        if (!channelId && res.data.length > 0) {
          setChannelId(res.data[0]._id);
        }
      })
      .catch(() => setChannels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writableChannels = useMemo(
    () =>
      channels.filter((c) => {
        if (c.archived) return false;
        if (c.noticeOnly && !isAdmin) return false;
        return true;
      }),
    [channels, isAdmin],
  );

  const isContentEmpty = (html: string) => {
    const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return stripped.length === 0 && !html.includes('<img');
  };

  const handleSubmit = async () => {
    if (!channelId) {
      alert('게시판을 선택해주세요.');
      return;
    }
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (isContentEmpty(content)) {
      alert('내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await api.post<{ _id: string }>('/api/board/posts', {
          channelId,
          title: title.trim(),
          content,
        });
        router.push(`/board/${res.data._id}`);
      } else {
        await api.patch(`/api/board/posts/${postId}`, {
          channelId,
          title: title.trim(),
          content,
        });
        router.push(`/board/${postId}`);
      }
      router.refresh();
    } catch {
      alert(mode === 'create' ? '게시글 등록에 실패했습니다.' : '게시글 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 셀렉트에 표시할 옵션 — 수정 모드에서 archived 채널이 원래 게시글 채널이면 보존 표시
  const selectOptions = useMemo(() => {
    const baseList = [...writableChannels];
    if (
      mode === 'edit' &&
      initial?.channelId &&
      !baseList.some((c) => c._id === initial.channelId)
    ) {
      const orphan = channels.find((c) => c._id === initial.channelId);
      if (orphan) baseList.push(orphan);
    }
    return baseList;
  }, [writableChannels, channels, mode, initial]);

  return (
    <div className='bg-white rounded-md border border-gray-200 overflow-hidden'>
      {/* 헤더 */}
      <div className='px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3'>
        <h1 className='text-lg sm:text-xl font-bold text-gray-900'>
          {mode === 'create' ? '글쓰기' : '게시글 수정'}
        </h1>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => router.back()}
            type='button'
            className='px-3 sm:px-4 py-2 rounded-md border border-gray-200 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 transition'
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            type='button'
            className='px-4 sm:px-5 py-2 rounded-md bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition'
          >
            {submitting ? '저장 중...' : mode === 'create' ? '등록' : '수정 완료'}
          </button>
        </div>
      </div>

      {/* 본문 폼 */}
      <div className='p-4 sm:p-6 space-y-4'>
        {/* 게시판 */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <label className='shrink-0 w-20 text-xs sm:text-sm font-medium text-gray-600'>
            게시판
          </label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className='w-full sm:w-64 px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
          >
            {selectOptions.length === 0 ? (
              <option value=''>접근 가능한 게시판이 없습니다</option>
            ) : (
              selectOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.archived ? ' (보관됨)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* 제목 */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <label className='shrink-0 w-20 text-xs sm:text-sm font-medium text-gray-600'>
            제목
          </label>
          <input
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='제목을 입력하세요'
            maxLength={120}
            className='flex-1 px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {/* 본문 */}
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs sm:text-sm font-medium text-gray-600'>내용</label>
            <p className='text-[11px] text-gray-400 hidden sm:block'>
              이미지는 툴바·붙여넣기·드래그앤드롭으로 삽입할 수 있어요
            </p>
          </div>
          <TipTapEditor value={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
