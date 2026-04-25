'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import BoardForm from '@/components/board/BoardForm';

interface Post {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  channelId: string;
  channel?: { _id: string; name: string } | null;
}

export default function BoardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    api
      .get<Post>(`/api/board/posts/${id}`)
      .then((res) => {
        const isOwner = !!user && user.id === res.data.authorId;
        if (!isOwner && !isAdmin) {
          setForbidden(true);
          return;
        }
        setPost(res.data);
      })
      .catch(() => setForbidden(true))
      .finally(() => setLoading(false));
  }, [id, user, isAdmin]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  if (forbidden || !post) {
    return (
      <div className='bg-white rounded-md border border-gray-200 p-10 text-center'>
        <p className='text-sm text-gray-500'>수정 권한이 없거나 게시글을 찾을 수 없습니다.</p>
        <button
          onClick={() => router.push('/board')}
          className='mt-4 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700'
        >
          목록으로
        </button>
      </div>
    );
  }

  return (
    <BoardForm
      mode='edit'
      postId={post._id}
      initial={{
        title: post.title,
        content: post.content,
        channelId: post.channelId,
        channelName: post.channel?.name,
      }}
    />
  );
}
