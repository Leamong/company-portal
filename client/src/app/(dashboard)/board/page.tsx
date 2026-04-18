'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { fromNow } from '@/lib/utils';
import api from '@/lib/api';

type Category = '전체' | '공지' | '마케팅' | '디자인' | '일반';

interface Post {
  _id: string;
  title: string;
  content: string;
  authorName: string;
  category: Exclude<Category, '전체'>;
  createdAt: string;
  views: number;
  isNotice: boolean;
}

const CATEGORY_STYLE: Record<Exclude<Category, '전체'>, string> = {
  공지: 'bg-red-100 text-red-600',
  마케팅: 'bg-blue-100 text-blue-600',
  디자인: 'bg-purple-100 text-purple-600',
  일반: 'bg-gray-100 text-gray-600',
};

export default function BoardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  const [tab, setTab] = useState<Category>('전체');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Post | null>(null);
  const [showWrite, setShowWrite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async (category?: string) => {
    setIsLoading(true);
    try {
      const params = category && category !== '전체' ? `?category=${category}` : '';
      const res = await api.get(`/api/board${params}`);
      setPosts(res.data);
    } catch {
      // 무시
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(tab);
  }, [tab, fetchPosts]);

  // 게시글 클릭 시 상세 조회 (조회수 증가)
  const handlePostClick = async (post: Post) => {
    try {
      const res = await api.get(`/api/board/${post._id}`);
      setSelected(res.data);
      // 목록의 조회수 업데이트
      setPosts((prev) =>
        prev.map((p) => (p._id === post._id ? { ...p, views: res.data.views } : p)),
      );
    } catch {
      setSelected(post);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/api/board/${postId}`);
      setSelected(null);
      fetchPosts(tab);
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const notices = posts.filter((p) => p.isNotice);
  const general = posts.filter((p) => !p.isNotice);

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>사내 게시판</h1>
          <p className='text-sm text-gray-500 mt-1'>부서별 소식과 전사 공지를 확인하세요</p>
        </div>
        <button
          onClick={() => setShowWrite(true)}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
          글쓰기
        </button>
      </div>

      {/* 탭 */}
      <div className='flex gap-1 bg-gray-100 p-1 rounded-xl w-fit'>
        {(['전체', '공지', '마케팅', '디자인', '일반'] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-16'>
          <div className='w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : (
        <>
          {/* 공지 */}
          {notices.length > 0 && (
            <div className='space-y-2'>
              {notices.map((p) => (
                <PostRow key={p._id} post={p} onClick={() => handlePostClick(p)} />
              ))}
            </div>
          )}

          {/* 일반 게시글 */}
          <div className='bg-white rounded-2xl border border-gray-100 overflow-hidden'>
            {general.length === 0 ? (
              <p className='text-center text-gray-400 text-sm py-12'>게시글이 없습니다.</p>
            ) : (
              general.map((p, i) => (
                <div key={p._id} className={i !== 0 ? 'border-t border-gray-50' : ''}>
                  <PostRow post={p} onClick={() => handlePostClick(p)} />
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
          onClick={() => setSelected(null)}
        >
          <div
            className='bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-3 mb-4'>
              <div className='flex-1'>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_STYLE[selected.category]}`}>
                  {selected.category}
                </span>
                <h2 className='text-lg font-bold text-gray-900 mt-2'>{selected.title}</h2>
                <p className='text-xs text-gray-400 mt-1'>
                  {selected.authorName} · {fromNow(selected.createdAt)} · 조회 {selected.views}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className='text-gray-400 hover:text-gray-600 shrink-0'>
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            {/* 내용 (TipTap HTML 또는 텍스트) */}
            <div
              className='prose prose-sm max-w-none text-gray-700 leading-relaxed border-t border-gray-100 pt-4'
              dangerouslySetInnerHTML={{ __html: selected.content }}
            />
            {/* 삭제 버튼 (본인/어드민) */}
            {isAdmin && (
              <div className='mt-4 pt-4 border-t border-gray-100 flex justify-end'>
                <button
                  onClick={() => handleDelete(selected._id)}
                  className='px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition'
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <WriteModal
          isAdmin={isAdmin}
          onClose={() => setShowWrite(false)}
          onSuccess={() => {
            setShowWrite(false);
            fetchPosts(tab);
          }}
        />
      )}
    </div>
  );
}

function PostRow({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors rounded-xl'
    >
      <span
        className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${CATEGORY_STYLE[post.category]}`}
      >
        {post.category}
      </span>
      <span className='flex-1 text-sm font-medium text-gray-800 truncate'>{post.title}</span>
      <span className='shrink-0 text-xs text-gray-400 hidden sm:block'>{post.authorName}</span>
      <span className='shrink-0 text-xs text-gray-400'>{fromNow(post.createdAt)}</span>
      <span className='shrink-0 text-xs text-gray-300'>👁 {post.views}</span>
    </button>
  );
}

function WriteModal({
  isAdmin,
  onClose,
  onSuccess,
}: {
  isAdmin: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [category, setCategory] = useState<string>(isAdmin ? '공지' : '마케팅');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/api/board', { title: title.trim(), content: content.trim(), category });
      onSuccess();
    } catch {
      alert('게시글 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6'>
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-lg font-bold text-gray-900'>새 게시글 작성</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='space-y-3.5'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {isAdmin && <option value='공지'>공지</option>}
              <option value='마케팅'>마케팅</option>
              <option value='디자인'>디자인</option>
              <option value='일반'>일반</option>
            </select>
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>제목</label>
            <input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='제목을 입력하세요'
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>내용</label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='내용을 입력하세요'
              className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
          <div className='flex gap-3 pt-1'>
            <button
              onClick={onClose}
              className='flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className='flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60'
            >
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
