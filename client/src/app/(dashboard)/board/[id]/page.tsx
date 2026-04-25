'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import api from '@/lib/api';

interface PostChannel {
  _id: string;
  name: string;
  scope: 'company' | 'department';
  deptKey: string | null;
  archived: boolean;
}

interface Post {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  channelId: string;
  channel: PostChannel | null;
  createdAt: string;
  updatedAt?: string;
  views: number;
}

export default function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  const { clearBoardUnreadFor } = useNotificationStore();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get<Post>(`/api/board/posts/${id}`)
      .then((res) => {
        setPost(res.data);
        // 게시글 진입 시 채널 read 처리
        if (res.data.channel?._id) {
          api.post(`/api/board/channels/${res.data.channel._id}/read`).catch(() => {});
          clearBoardUnreadFor(res.data.channel._id);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, clearBoardUnreadFor]);

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/api/board/posts/${post._id}`);
      const back = post.channel ? `/board?ch=${post.channel._id}` : '/board';
      router.push(back);
      router.refresh();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className='bg-white rounded-md border border-gray-200 p-10 text-center'>
        <p className='text-sm text-gray-500'>게시글을 찾을 수 없거나 삭제되었습니다.</p>
        <Link
          href='/board'
          className='inline-block mt-4 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700'
        >
          목록으로
        </Link>
      </div>
    );
  }

  const isOwner = !!user && user.id === post.authorId;
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin;
  const listHref = post.channel ? `/board?ch=${post.channel._id}` : '/board';

  return (
    <div>
      {/* 상단 액션 바 */}
      <div className='flex items-center justify-between mb-3 gap-3'>
        <Link
          href={listHref}
          className='inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition min-w-0'
        >
          <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
          <span className='truncate'>
            {post.channel ? post.channel.name : '게시판'}
          </span>
        </Link>
        <div className='flex items-center gap-2 shrink-0'>
          {canEdit && (
            <Link
              href={`/board/${post._id}/edit`}
              className='px-3 py-1.5 rounded-md border border-gray-200 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 transition'
            >
              수정
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className='px-3 py-1.5 rounded-md border border-red-200 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition'
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 게시글 카드 */}
      <article className='bg-white rounded-md border border-gray-200 overflow-hidden'>
        <header className='px-5 sm:px-7 pt-6 pb-5 border-b border-gray-100'>
          {post.channel && (
            <p className='text-xs font-semibold text-blue-600 mb-2'>{post.channel.name}</p>
          )}
          <h1 className='text-xl sm:text-2xl font-bold text-gray-900 leading-snug wrap-break-word'>
            {post.title}
          </h1>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-3'>
            <span className='font-medium text-gray-600'>{post.authorName}</span>
            <span>·</span>
            <span className='tabular-nums'>{dayjs(post.createdAt).format('YY/MM/DD HH:mm')}</span>
            {post.updatedAt && post.updatedAt !== post.createdAt && (
              <>
                <span>·</span>
                <span>수정됨</span>
              </>
            )}
            <span>·</span>
            <span>조회 {post.views.toLocaleString()}</span>
          </div>
        </header>

        <div
          className='tiptap-render px-5 sm:px-7 py-6 sm:py-8'
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      {/* 하단 액션 */}
      <div className='mt-4 flex items-center justify-between'>
        <Link
          href={listHref}
          className='inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h7' />
          </svg>
          목록
        </Link>
      </div>
    </div>
  );
}
