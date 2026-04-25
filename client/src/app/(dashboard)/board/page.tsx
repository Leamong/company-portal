'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import { cn } from '@/lib/utils';

interface Channel {
  _id: string;
  name: string;
  scope: 'company' | 'department';
  deptKey: string | null;
  noticeOnly: boolean;
  archived: boolean;
  systemManaged: boolean;
  order: number;
}

interface Post {
  _id: string;
  title: string;
  authorName: string;
  createdAt: string;
  channelId: string;
}

export default function BoardPage() {
  return (
    <Suspense fallback={null}>
      <BoardInner />
    </Suspense>
  );
}

function BoardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';
  const { boardUnreadByChannel, clearBoardUnreadFor } = useNotificationStore();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const channelIdParam = searchParams.get('ch');

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await api.get<Channel[]>('/api/board/channels');
      setChannels(res.data);
      return res.data;
    } catch {
      setChannels([]);
      return [] as Channel[];
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // URL의 channel param 또는 첫 번째 채널 자동 선택
  const selectedChannel = useMemo(() => {
    if (channels.length === 0) return null;
    return channels.find((c) => c._id === channelIdParam) ?? channels[0];
  }, [channels, channelIdParam]);

  useEffect(() => {
    if (!selectedChannel) {
      setPosts([]);
      return;
    }
    setPostsLoading(true);
    api
      .get<Post[]>(`/api/board/posts?channelId=${selectedChannel._id}`)
      .then((res) => setPosts(res.data))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));

    // 채널 진입 시 read 처리 + 로컬 배지 즉시 제거
    api
      .post(`/api/board/channels/${selectedChannel._id}/read`)
      .catch(() => {});
    clearBoardUnreadFor(selectedChannel._id);
  }, [selectedChannel, clearBoardUnreadFor]);

  // 다른 탭에서 새 글 알림이 와서 현재 보고 있는 채널 글이면 자동 갱신
  useEffect(() => {
    if (!selectedChannel) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ channelId: string }>).detail;
      if (detail?.channelId === selectedChannel._id) {
        api
          .get<Post[]>(`/api/board/posts?channelId=${selectedChannel._id}`)
          .then((res) => setPosts(res.data))
          .catch(() => {});
      }
    };
    window.addEventListener('board:changed', handler);
    return () => window.removeEventListener('board:changed', handler);
  }, [selectedChannel]);

  const companyChannels = channels.filter((c) => c.scope === 'company');
  const deptChannels = channels.filter((c) => c.scope === 'department');

  const selectChannel = (id: string) => {
    router.replace(`/board?ch=${id}`);
    setMobileSidebar(false);
  };

  const canWriteToSelected = (() => {
    if (!selectedChannel) return false;
    if (selectedChannel.archived) return false;
    if (selectedChannel.noticeOnly) return isAdmin;
    return true;
  })();

  return (
    <div className='flex flex-col lg:flex-row gap-4'>
      {/* 모바일 토글 */}
      <button
        onClick={() => setMobileSidebar((v) => !v)}
        className='lg:hidden self-start inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-700 shadow-xs'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
        </svg>
        게시판 목록
      </button>

      {/* 좌측 사이드바 — 채널 트리 */}
      <aside
        className={cn(
          'shrink-0 w-full lg:w-64 bg-white border border-gray-200 rounded-md p-4 space-y-5',
          'lg:block',
          mobileSidebar ? 'block' : 'hidden',
        )}
      >
        {/* 헤더 */}
        <div className='flex items-center justify-between'>
          <h2 className='text-base font-bold text-gray-900'>게시판</h2>
        </div>

        {/* 글쓰기 버튼 */}
        <button
          onClick={() => {
            if (!selectedChannel) return alert('게시판을 선택해주세요.');
            if (!canWriteToSelected) return alert('이 게시판에 작성할 권한이 없습니다.');
            router.push(`/board/write?ch=${selectedChannel._id}`);
          }}
          disabled={!selectedChannel || !canWriteToSelected}
          className='w-full py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition'
        >
          글쓰기
        </button>

        {channelsLoading ? (
          <div className='py-4 flex justify-center'>
            <div className='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : (
          <>
            {/* 전사 게시판 */}
            <ChannelGroup
              title='전사게시판'
              channels={companyChannels}
              selectedId={selectedChannel?._id ?? null}
              onSelect={selectChannel}
              isAdmin={isAdmin}
              onEdit={(c) => setEditChannel(c)}
              unreadByChannel={boardUnreadByChannel}
            />

            {/* 부서 게시판 */}
            <ChannelGroup
              title='부서게시판'
              channels={deptChannels}
              selectedId={selectedChannel?._id ?? null}
              onSelect={selectChannel}
              isAdmin={isAdmin}
              onEdit={(c) => setEditChannel(c)}
              unreadByChannel={boardUnreadByChannel}
              emptyText={
                isAdmin
                  ? '부서가 없습니다.\n부서/직급에서 추가하세요.'
                  : '소속된 부서가 없습니다.\n운영자에게 문의하세요.'
              }
            />

            {/* + 게시판 추가 (어드민) */}
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className='w-full py-2 rounded-md border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition'
              >
                + 게시판 추가
              </button>
            )}
          </>
        )}
      </aside>

      {/* 메인 — 게시글 리스트 */}
      <main className='flex-1 min-w-0'>
        {selectedChannel ? (
          <div className='bg-white border border-gray-200 rounded-md overflow-hidden'>
            {/* 채널 헤더 */}
            <div className='px-5 sm:px-6 py-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <h1 className='text-lg sm:text-xl font-bold text-gray-900 truncate'>
                  {selectedChannel.name}
                </h1>
                {selectedChannel.noticeOnly && (
                  <span className='shrink-0 text-[10px] font-semibold bg-red-50 text-red-600 px-1.5 py-0.5 rounded'>
                    공지
                  </span>
                )}
                {selectedChannel.archived && (
                  <span className='shrink-0 text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded'>
                    보관됨
                  </span>
                )}
              </div>
              <p className='text-xs text-gray-500 mt-0.5'>총 {posts.length}건의 게시글</p>
            </div>

            {/* 헤더 행 (테이블 스타일) */}
            <div className='hidden sm:grid grid-cols-[60px_1fr_160px_120px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-[12px] font-semibold text-gray-500 tracking-wide'>
              <span className='text-center'>No</span>
              <span className='text-center'>제목</span>
              <span className='text-center'>글쓴이</span>
              <span className='text-center'>작성시간</span>
            </div>

            {postsLoading ? (
              <div className='py-16 flex justify-center'>
                <div className='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
              </div>
            ) : posts.length === 0 ? (
              <div className='py-16 text-center text-sm text-gray-400'>
                게시글이 없습니다.
              </div>
            ) : (
              <ul>
                {posts.map((post, idx) => {
                  // 번호: 최신글 = 가장 큰 번호
                  const no = posts.length - idx;
                  return (
                    <li key={post._id} className='border-b border-gray-100 last:border-b-0'>
                      <Link
                        href={`/board/${post._id}`}
                        className='grid grid-cols-1 sm:grid-cols-[60px_1fr_160px_120px] gap-1 sm:gap-4 px-5 sm:px-6 py-3.5 hover:bg-gray-50 transition'
                      >
                        <span className='hidden sm:block text-xs text-gray-400 tabular-nums text-center self-center'>
                          {no}
                        </span>
                        <span className='text-sm text-gray-800 truncate sm:px-2 self-center'>
                          {post.title}
                        </span>
                        <span className='text-xs text-gray-500 truncate sm:text-center self-center'>
                          <span className='sm:hidden text-gray-400 mr-1'>글쓴이</span>
                          {post.authorName}
                        </span>
                        <span className='text-xs text-gray-400 tabular-nums sm:text-center self-center'>
                          <span className='sm:hidden text-gray-400 mr-1'>작성시간</span>
                          {dayjs(post.createdAt).format('YYYY-MM-DD')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className='bg-white border border-gray-200 rounded-md p-12 text-center'>
            <p className='text-sm text-gray-500'>
              {channelsLoading ? '게시판을 불러오는 중...' : '접근 가능한 게시판이 없습니다.'}
            </p>
          </div>
        )}
      </main>

      {/* 게시판 추가 모달 */}
      {showAddModal && (
        <ChannelEditModal
          mode='create'
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            await fetchChannels();
          }}
        />
      )}
      {editChannel && (
        <ChannelEditModal
          mode='edit'
          channel={editChannel}
          onClose={() => setEditChannel(null)}
          onSaved={async () => {
            setEditChannel(null);
            await fetchChannels();
          }}
        />
      )}
    </div>
  );
}

// ─── 채널 그룹 ─────────────────────────────────────────────────────
function ChannelGroup({
  title,
  channels,
  selectedId,
  onSelect,
  isAdmin,
  onEdit,
  unreadByChannel,
  emptyText = '게시판이 없습니다.',
}: {
  title: string;
  channels: Channel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isAdmin: boolean;
  onEdit: (c: Channel) => void;
  unreadByChannel: Record<string, number>;
  emptyText?: string;
}) {
  return (
    <div>
      <h3 className='text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2'>
        {title}
      </h3>
      {channels.length === 0 ? (
        <p className='text-xs text-gray-400 text-center py-3 leading-relaxed whitespace-pre-line'>
          {emptyText}
        </p>
      ) : (
        <ul className='space-y-0.5'>
          {channels.map((c) => (
            <li key={c._id} className='group flex items-center gap-1'>
              <button
                onClick={() => onSelect(c._id)}
                className={cn(
                  'flex-1 text-left text-sm px-3 py-1.5 rounded-md transition truncate flex items-center gap-1.5',
                  selectedId === c._id
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  c.archived && 'text-gray-400',
                )}
              >
                <span className='truncate flex-1'>{c.name}</span>
                {c.archived && (
                  <span className='shrink-0 text-[9px] font-semibold bg-gray-200 text-gray-500 px-1 py-px rounded'>
                    보관
                  </span>
                )}
                {unreadByChannel[c._id] > 0 && (
                  <span className='shrink-0 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full tabular-nums leading-none'>
                    {unreadByChannel[c._id] > 99 ? '99+' : unreadByChannel[c._id]}
                  </span>
                )}
              </button>
              {isAdmin && !c.systemManaged && (
                <button
                  onClick={() => onEdit(c)}
                  className='shrink-0 w-6 h-6 inline-flex items-center justify-center text-gray-300 hover:text-blue-600 transition opacity-0 group-hover:opacity-100'
                  title='수정'
                >
                  <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 채널 생성/수정 모달 ──────────────────────────────────────────────
function ChannelEditModal({
  mode,
  channel,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  channel?: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(channel?.name ?? '');
  const [noticeOnly, setNoticeOnly] = useState(channel?.noticeOnly ?? false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return alert('이름을 입력해주세요.');
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/api/board/channels', {
          name: name.trim(),
          scope: 'company',
          noticeOnly,
        });
      } else if (channel) {
        await api.patch(`/api/board/channels/${channel._id}`, {
          name: name.trim(),
          noticeOnly,
        });
      }
      onSaved();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!channel) return;
    if (!confirm(`'${channel.name}' 게시판을 삭제할까요? 작성된 게시글도 함께 삭제됩니다.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await api.delete(`/api/board/channels/${channel._id}`);
      onSaved();
    } catch {
      alert('삭제에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-md shadow-xl w-full max-w-md mx-4 p-6'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-bold text-gray-900 mb-4'>
          {mode === 'create' ? '게시판 추가' : '게시판 수정'}
        </h2>
        <div className='space-y-3.5'>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>이름</label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='예: 자유게시판'
              maxLength={40}
              className='w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <label className='flex items-center gap-2 text-sm text-gray-700'>
            <input
              type='checkbox'
              checked={noticeOnly}
              onChange={(e) => setNoticeOnly(e.target.checked)}
              className='accent-blue-600'
            />
            공지 전용 (관리자만 작성 가능)
          </label>
        </div>
        <div className='flex items-center justify-between mt-6'>
          {mode === 'edit' ? (
            <button
              onClick={handleDelete}
              disabled={submitting}
              className='text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50'
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <button
              onClick={onClose}
              className='px-4 py-2 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className='px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60'
            >
              {submitting ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
