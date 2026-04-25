'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface ChatRoom {
  _id: string;
  type: 'dm' | 'group';
  name: string | null;
  participants: string[];
  participantNames: string[];
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface OtherUser {
  _id: string;
  name: string;
  position: string;
  department: string;
  profileImage?: string | null;
}

// ─── 소켓 싱글톤 ─────────────────────────────────────────────────────────────

let socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'}/messenger`,
      {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
      },
    );
  }
  return socket;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function FloatingChat() {
  const { user, accessToken, isAuthenticated } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'rooms' | 'chat' | 'newDm'>('rooms');
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [otherUsers, setOtherUsers] = useState<OtherUser[]>([]);
  const [userProfileMap, setUserProfileMap] = useState<Record<string, string | null>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 소켓 초기화 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const sock = getSocket(accessToken);
    socketRef.current = sock;

    sock.on('newMessage', (msg: Message) => {
      // 현재 보고 있는 방이면 메시지 추가
      setSelectedRoom((prev) => {
        if (prev && prev._id === msg.roomId) {
          setMessages((m) => [...m, msg]);
          // 읽음 처리
          sock.emit('markRead', msg.roomId);
        }
        return prev;
      });
      // 방 목록 갱신
      fetchRooms(sock);
    });

    sock.on('roomUpdated', () => {
      fetchRooms(sock);
    });

    sock.on('userTyping', ({ userName, isTyping: typing }: { userId: string; userName: string; isTyping: boolean }) => {
      setTypingUsers((prev) =>
        typing ? [...new Set([...prev, userName])] : prev.filter((n) => n !== userName),
      );
    });

    fetchRooms(sock);
    fetchTotalUnread();

    return () => {
      sock.off('newMessage');
      sock.off('roomUpdated');
      sock.off('userTyping');
    };
  }, [isAuthenticated, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 스크롤 자동 이동 ─────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── 데이터 패치 ──────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async (_sock?: Socket) => {
    try {
      const res = await api.get('/api/messenger/rooms');
      setRooms(res.data);
      const unread = res.data.reduce((s: number, r: ChatRoom) => s + (r.unreadCount || 0), 0);
      setTotalUnread(unread);
    } catch {
      // 무시
    }
  }, []);

  const fetchTotalUnread = useCallback(async () => {
    try {
      const res = await api.get('/api/messenger/unread');
      setTotalUnread(res.data);
    } catch {
      // 무시
    }
  }, []);

  const openRoom = useCallback(async (room: ChatRoom) => {
    setSelectedRoom(room);
    setView('chat');
    setTypingUsers([]);
    try {
      const res = await api.get(`/api/messenger/rooms/${room._id}/messages`);
      setMessages(res.data);
      socketRef.current?.emit('joinRoom', room._id);
      socketRef.current?.emit('markRead', room._id);
      // 로컬 unread 초기화
      setRooms((prev) =>
        prev.map((r) => (r._id === room._id ? { ...r, unreadCount: 0 } : r)),
      );
      setTotalUnread((prev) => Math.max(0, prev - (room.unreadCount || 0)));
    } catch {
      // 무시
    }
  }, []);

  const fetchOtherUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users/directory');
      const all = res.data as OtherUser[];
      const others = all.filter((u) => u._id !== user?.id);
      setOtherUsers(others);
      const map: Record<string, string | null> = {};
      all.forEach((u) => { map[u._id] = u.profileImage ?? null; });
      if (user?.id) map[user.id] = user.profileImage ?? null;
      setUserProfileMap(map);
    } catch {
      // 무시
    }
  }, [user?.id, user?.profileImage]);

  // ─── 메시지 전송 ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !selectedRoom || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      roomId: selectedRoom._id,
      content: inputText.trim(),
    });
    setInputText('');
    // 타이핑 인디케이터 끄기
    if (isTyping) {
      socketRef.current.emit('typing', { roomId: selectedRoom._id, isTyping: false });
      setIsTyping(false);
    }
  }, [inputText, selectedRoom, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 타이핑 인디케이터
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!selectedRoom || !socketRef.current) return;

    if (!isTyping) {
      setIsTyping(true);
      socketRef.current.emit('typing', { roomId: selectedRoom._id, isTyping: true });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit('typing', { roomId: selectedRoom._id, isTyping: false });
    }, 2000);
  };

  // ─── DM 시작 ──────────────────────────────────────────────────────────────

  const startDm = useCallback(
    async (targetUser: OtherUser) => {
      if (!user) return;
      try {
        const res = await api.post('/api/messenger/rooms/dm', {
          targetId: targetUser._id,
          targetName: targetUser.name,
        });
        const room: ChatRoom = {
          ...res.data,
          unreadCount: 0,
        };
        await openRoom(room);
        fetchRooms();
      } catch {
        // 무시
      }
    },
    [user, openRoom, fetchRooms],
  );

  // ─── 방 이름 계산 ─────────────────────────────────────────────────────────

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.type === 'group') return room.name || '그룹 채팅';
    const myName = user?.name || '';
    const other = room.participantNames.find((n) => n !== myName);
    return other || room.participantNames.join(', ');
  };

  const getRoomPartnerId = (room: ChatRoom) => {
    if (room.type !== 'dm') return null;
    return room.participants.find((id) => id !== user?.id) ?? null;
  };

  const UserAvatar = ({ userId, name, size = 10 }: { userId?: string | null; name: string; size?: number }) => {
    const img = userId ? userProfileMap[userId] : null;
    const sz = `w-${size} h-${size}`;
    const textSz = size <= 7 ? 'text-xs' : 'text-sm';
    if (img) {
      return <img src={img} alt={name} className={`${sz} rounded-full object-cover shrink-0`} />;
    }
    return (
      <div className={`${sz} rounded-full bg-blue-100 flex items-center justify-center shrink-0`}>
        <span className={`text-blue-600 font-semibold ${textSz}`}>{name.charAt(0)}</span>
      </div>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => {
          setIsOpen((v) => {
            if (!v) {
              setView('rooms');
              fetchRooms();
            }
            return !v;
          });
        }}
        className='fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center'
        aria-label='메신저 열기'
      >
        {isOpen ? (
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
          </svg>
        ) : (
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
          </svg>
        )}
        {/* 미읽은 배지 */}
        {!isOpen && totalUnread > 0 && (
          <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1 font-bold'>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* 채팅 패널 */}
      {isOpen && (
        <div className='fixed bottom-24 right-6 z-50 w-80 h-120 bg-white rounded-md shadow-2xl border border-gray-100 flex flex-col overflow-hidden'>
          {/* ── 채팅방 목록 ── */}
          {view === 'rooms' && (
            <>
              <div className='h-12 px-4 flex items-center justify-between border-b border-gray-100 shrink-0'>
                <span className='font-semibold text-gray-900 text-sm'>메신저</span>
                <button
                  onClick={() => {
                    fetchOtherUsers();
                    setView('newDm');
                  }}
                  className='text-blue-600 hover:text-blue-700 p-1'
                  title='새 대화 시작'
                >
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                  </svg>
                </button>
              </div>

              <div className='flex-1 overflow-y-auto'>
                {rooms.length === 0 ? (
                  <div className='flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2'>
                    <svg className='w-10 h-10 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
                    </svg>
                    <p>대화가 없습니다</p>
                    <button
                      onClick={() => { fetchOtherUsers(); setView('newDm'); }}
                      className='text-blue-600 text-xs hover:underline'
                    >
                      새 대화 시작하기
                    </button>
                  </div>
                ) : (
                  rooms.map((room) => (
                    <button
                      key={room._id}
                      onClick={() => openRoom(room)}
                      className='w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left'
                    >
                      {/* 아바타 */}
                      <UserAvatar userId={getRoomPartnerId(room)} name={getRoomDisplayName(room)} size={10} />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm font-semibold text-gray-800 truncate'>
                            {getRoomDisplayName(room)}
                          </span>
                          {room.lastMessageAt && (
                            <span className='text-xs text-gray-400 shrink-0 ml-1'>
                              {formatDateTime(room.lastMessageAt).slice(11, 16)}
                            </span>
                          )}
                        </div>
                        <div className='flex items-center justify-between'>
                          <p className='text-xs text-gray-400 truncate'>
                            {room.lastMessage || '대화를 시작해보세요'}
                          </p>
                          {room.unreadCount > 0 && (
                            <span className='shrink-0 ml-1 bg-red-500 text-white text-xs rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1'>
                              {room.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── 채팅 뷰 ── */}
          {view === 'chat' && selectedRoom && (
            <>
              {/* 헤더 */}
              <div className='h-12 px-3 flex items-center gap-2 border-b border-gray-100 shrink-0'>
                <button
                  onClick={() => { setView('rooms'); setSelectedRoom(null); setMessages([]); }}
                  className='text-gray-400 hover:text-gray-600 p-1'
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                  </svg>
                </button>
                <UserAvatar userId={getRoomPartnerId(selectedRoom)} name={getRoomDisplayName(selectedRoom)} size={7} />
                <span className='text-sm font-semibold text-gray-800 flex-1 truncate'>
                  {getRoomDisplayName(selectedRoom)}
                </span>
              </div>

              {/* 메시지 목록 */}
              <div className='flex-1 overflow-y-auto px-3 py-3 space-y-2'>
                {messages.length === 0 && (
                  <p className='text-center text-xs text-gray-400 mt-8'>
                    첫 메시지를 보내보세요!
                  </p>
                )}
                {messages.map((msg) => {
                  const myId = user?.id ?? (user as any)?._id;
                  const isMe = !!myId && msg.senderId === String(myId);
                  return (
                    <div
                      key={msg._id}
                      className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}
                    >
                      {!isMe && (
                        <div className='mt-0.5'>
                          <UserAvatar userId={msg.senderId} name={msg.senderName} size={7} />
                        </div>
                      )}
                      <div className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                        {!isMe && (
                          <span className='text-xs text-gray-400 px-1'>{msg.senderName}</span>
                        )}
                        <div
                          className={cn(
                            'max-w-50 px-3 py-2 rounded-md text-sm leading-relaxed wrap-break-word',
                            isMe
                              ? 'bg-blue-600 text-white rounded-tr-sm'
                              : 'bg-gray-100 text-gray-800 rounded-tl-sm',
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className='text-[10px] text-gray-300 px-1'>
                          {formatDateTime(msg.createdAt).slice(11, 16)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* 타이핑 인디케이터 */}
                {typingUsers.length > 0 && (
                  <div className='flex items-center gap-2'>
                    <div className='w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0'>
                      <span className='text-gray-600 text-xs'>...</span>
                    </div>
                    <div className='bg-gray-100 px-3 py-2 rounded-md rounded-tl-sm'>
                      <div className='flex gap-1 items-center h-4'>
                        <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                        <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                        <span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 입력창 */}
              <div className='p-3 border-t border-gray-100 shrink-0'>
                <div className='flex gap-2 items-center bg-gray-50 rounded-md px-3 py-2'>
                  <input
                    type='text'
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder='메시지 입력...'
                    className='flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none'
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim()}
                    className='text-blue-600 hover:text-blue-700 disabled:text-gray-300 transition-colors p-0.5'
                  >
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── 새 DM 시작 ── */}
          {view === 'newDm' && (
            <>
              <div className='h-12 px-3 flex items-center gap-2 border-b border-gray-100 shrink-0'>
                <button
                  onClick={() => setView('rooms')}
                  className='text-gray-400 hover:text-gray-600 p-1'
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                  </svg>
                </button>
                <span className='text-sm font-semibold text-gray-800'>새 대화</span>
              </div>
              <div className='flex-1 overflow-y-auto'>
                {otherUsers.length === 0 ? (
                  <p className='text-center text-sm text-gray-400 mt-8'>사용자 목록을 불러오는 중...</p>
                ) : (
                  otherUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => startDm(u)}
                      className='w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left'
                    >
                      <UserAvatar userId={u._id} name={u.name} size={9} />
                      <div>
                        <p className='text-sm font-medium text-gray-800'>{u.name}</p>
                        <p className='text-xs text-gray-400'>{u.position} · {
                          u.department === 'marketing' ? '마케팅팀' :
                          u.department === 'design' ? '디자인팀' : '경영지원'
                        }</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
