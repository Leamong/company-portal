'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import api from '@/lib/api';

interface RecentPost {
  _id: string;
  title: string;
  authorName: string;
  createdAt: string;
  channel: { _id: string; name: string } | null;
}

export default function RecentBoardWidget() {
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<RecentPost[]>('/api/board/posts/recent?limit=5')
      .then((res) => setPosts(res.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className='bg-white rounded-md border border-gray-200 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-semibold text-gray-800'>최근 게시글</h2>
        <Link href='/board' className='text-[11px] text-blue-600 hover:text-blue-700 font-medium'>
          전체 →
        </Link>
      </div>

      {loading ? (
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : posts.length === 0 ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center py-6'>
          <span className='text-2xl mb-2'>📝</span>
          <p className='text-xs text-gray-400'>게시글이 없습니다</p>
        </div>
      ) : (
        <ul className='flex-1 divide-y divide-gray-50'>
          {posts.map((post) => (
            <li key={post._id}>
              <Link
                href={`/board/${post._id}`}
                className='flex items-center gap-2 py-2 hover:bg-gray-50/60 transition-colors -mx-2 px-2 rounded-md'
              >
                {post.channel && (
                  <span className='text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 shrink-0'>
                    {post.channel.name}
                  </span>
                )}
                <span className='text-xs text-gray-700 flex-1 min-w-0 truncate'>{post.title}</span>
                <span className='text-[10px] text-gray-400 shrink-0 tabular-nums'>
                  {dayjs(post.createdAt).format('MM.DD')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
