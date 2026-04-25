'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { getColorMeta } from '@/lib/dept-colors';

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

interface DeptDoc {
  _id: string;
  key: string;
  label: string;
  color: string;
}

// ─── 소켓 싱글톤 ─────────────────────────────────────────────────────────────

let socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'}/messenger`,
      { auth: { token }, transports: ['websocket'] },
    );
  }
  return socket;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  if (year !== today.getFullYear()) return `${year}년 ${month}월 ${day}일`;
  return `${month}월 ${day}일`;
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour}:${m}`;
}

function formatRoomTime(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(dateStr);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

function isImageContent(content: string): boolean {
  return (
    content.startsWith('data:image') ||
    /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(content)
  );
}

// ─── 아바타 색상 ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── 검색 하이라이트 ──────────────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className='bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic'>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

const DEPT_ORDER = ['marketing', 'design', 'management'];

export default function MessengerPage() {
  const { user, accessToken } = useAuthStore();
  const { clearUnreadMessages } = useNotificationStore();

  useEffect(() => { clearUnreadMessages(); }, [clearUnreadMessages]);

  // ── 기존 상태 ──
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUsers, setOtherUsers] = useState<OtherUser[]>([]);
  const [userProfileMap, setUserProfileMap] = useState<Record<string, string | null>>({});
  const [leftFilter, setLeftFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [starredRoomIds, setStarredRoomIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('messenger_starred');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<OtherUser[]>([]);
  const [selectedUserInfo, setSelectedUserInfo] = useState<OtherUser | null>(null);
  const [deptMap, setDeptMap] = useState<Record<string, DeptDoc>>({});

  // ── 새 상태 ──
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [msgSearchMode, setMsgSearchMode] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [mediaLightbox, setMediaLightbox] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberSelected, setAddMemberSelected] = useState<OtherUser[]>([]);

  // ── refs ──
  const socketRef = useRef<Socket | null>(null);
  const selectedRoomRef = useRef<ChatRoom | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const msgSearchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);

  // ─── 소켓 초기화 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) return;
    const sock = getSocket(accessToken);
    socketRef.current = sock;

    sock.on('newMessage', (msg: Message) => {
      const currentRoom = selectedRoomRef.current;
      if (currentRoom && String(currentRoom._id) === String(msg.roomId)) {
        setMessages((m) =>
          m.some((x) => String(x._id) === String(msg._id)) ? m : [...m, msg],
        );
        sock.emit('markRead', msg.roomId);
      }
      fetchRooms();
    });

    sock.on('userTyping', ({ userName, isTyping: typing }: { userId: string; userName: string; isTyping: boolean }) => {
      setTypingUsers((prev) =>
        typing ? [...new Set([...prev, userName])] : prev.filter((n) => n !== userName),
      );
    });

    fetchRooms();
    fetchOtherUsers();
    fetchDepts();

    return () => {
      sock.off('newMessage');
      sock.off('userTyping');
    };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // msgSearchMode 활성화 시 검색창 포커스
  useEffect(() => {
    if (msgSearchMode) setTimeout(() => msgSearchRef.current?.focus(), 50);
    else setMsgSearchQuery('');
  }, [msgSearchMode]);

  // ─── 데이터 패치 ──────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/api/messenger/rooms');
      setRooms(res.data);
    } catch { /* 무시 */ }
  }, []);

  const fetchOtherUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users/directory');
      const all = res.data as OtherUser[];
      setOtherUsers(all.filter((u) => u._id !== user?.id));
      const map: Record<string, string | null> = {};
      all.forEach((u) => { map[u._id] = u.profileImage ?? null; });
      if (user?.id) map[user.id] = user.profileImage ?? null;
      setUserProfileMap(map);
    } catch { /* 무시 */ }
  }, [user?.id, user?.profileImage]);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/api/departments');
      const map: Record<string, DeptDoc> = {};
      (res.data as DeptDoc[]).forEach((d) => { map[d.key] = d; });
      setDeptMap(map);
    } catch { /* 무시 */ }
  }, []);

  const openRoom = useCallback(async (room: ChatRoom) => {
    setSelectedRoom(room);
    setTypingUsers([]);
    setSelectedUserInfo(null);
    setMsgSearchMode(false);
    setMsgSearchQuery('');
    setPastedImage(null);
    try {
      const res = await api.get(`/api/messenger/rooms/${room._id}/messages`);
      // REST API에서 오는 senderId가 ObjectId 객체일 수 있어 명시적으로 string 변환
      setMessages(
        (res.data as Message[]).map((m) => ({ ...m, senderId: String(m.senderId) })),
      );
      socketRef.current?.emit('joinRoom', room._id);
      socketRef.current?.emit('markRead', room._id);
      setRooms((prev) =>
        prev.map((r) => (r._id === room._id ? { ...r, unreadCount: 0 } : r)),
      );
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch { /* 무시 */ }
  }, []);

  // ─── 메시지 전송 ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !selectedRoom || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      roomId: selectedRoom._id,
      content: inputText.trim(),
    });
    setInputText('');
    if (isTyping) {
      socketRef.current.emit('typing', { roomId: selectedRoom._id, isTyping: false });
      setIsTyping(false);
    }
  }, [inputText, selectedRoom, isTyping]);

  const sendPastedImage = useCallback(() => {
    if (!pastedImage || !selectedRoom || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      roomId: selectedRoom._id,
      content: pastedImage,
    });
    setPastedImage(null);
  }, [pastedImage, selectedRoom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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

  // ─── 클립보드 붙여넣기 ────────────────────────────────────────────────────

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) setPastedImage(evt.target.result as string);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) setPastedImage(evt.target.result as string);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  }, []);

  // ─── DM / 그룹 생성 ───────────────────────────────────────────────────────

  const startDm = useCallback(async (targetUser: OtherUser) => {
    if (!user) return;
    try {
      const res = await api.post('/api/messenger/rooms/dm', {
        targetId: targetUser._id,
        targetName: targetUser.name,
      });
      await openRoom({ ...res.data, unreadCount: 0 });
      setSelectedUserInfo(targetUser);
      fetchRooms();
    } catch { /* 무시 */ }
  }, [user, openRoom, fetchRooms]);

  const createGroupRoom = useCallback(async () => {
    if (!groupName.trim() || groupMembers.length === 0 || !user) return;
    const allIds = [user.id, ...groupMembers.map((m) => m._id)];
    const allNames = [user.name, ...groupMembers.map((m) => m.name)];
    try {
      const res = await api.post('/api/messenger/rooms/group', {
        name: groupName.trim(),
        participantIds: allIds,
        participantNames: allNames,
      });
      setShowGroupModal(false);
      setGroupName('');
      setGroupMembers([]);
      await openRoom({ ...res.data, unreadCount: 0 });
      fetchRooms();
    } catch { /* 무시 */ }
  }, [groupName, groupMembers, user, openRoom, fetchRooms]);

  const addParticipants = useCallback(async () => {
    if (!selectedRoom || addMemberSelected.length === 0) return;
    try {
      const res = await api.patch(`/api/messenger/rooms/${selectedRoom._id}/participants`, {
        participantIds: addMemberSelected.map((u) => u._id),
        participantNames: addMemberSelected.map((u) => u.name),
      });
      // 현재 방 정보 갱신
      setSelectedRoom((prev) => prev ? { ...prev, ...res.data, unreadCount: prev.unreadCount } : prev);
      setShowAddMemberModal(false);
      setAddMemberSelected([]);
      fetchRooms();
    } catch { /* 무시 */ }
  }, [selectedRoom, addMemberSelected, fetchRooms]);

  // ─── 계산값 ───────────────────────────────────────────────────────────────

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.type === 'group') return room.name || '그룹 채팅';
    const other = room.participantNames.find((n) => n !== user?.name);
    return other || room.participantNames.join(', ');
  };

  const getRoomPartnerId = (room: ChatRoom) => {
    if (room.type !== 'dm') return null;
    return room.participants.find((id) => id !== user?.id) ?? null;
  };

  const UserAvatar = ({
    userId,
    name,
    colorClass = 'bg-blue-500',
    size = 'w-10 h-10',
    textSize = 'text-sm',
  }: {
    userId?: string | null;
    name: string;
    colorClass?: string;
    size?: string;
    textSize?: string;
  }) => {
    const img = userId ? userProfileMap[userId] : null;
    if (img) {
      return <img src={img} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
    }
    return (
      <div className={`${size} rounded-full ${colorClass} flex items-center justify-center shrink-0`}>
        <span className={`text-white font-bold ${textSize}`}>{name.charAt(0)}</span>
      </div>
    );
  };

  const toggleStar = (roomId: string) => {
    setStarredRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      try { localStorage.setItem('messenger_starred', JSON.stringify([...next])); } catch { /* 무시 */ }
      return next;
    });
  };

  const filteredRooms = rooms.filter((r) => {
    const nameMatch = getRoomDisplayName(r).toLowerCase().includes(searchQuery.toLowerCase());
    const unreadMatch = leftFilter !== 'unread' || r.unreadCount > 0;
    const starredMatch = leftFilter !== 'starred' || starredRoomIds.has(r._id);
    return nameMatch && unreadMatch && starredMatch;
  });

  const starredCount = rooms.filter((r) => starredRoomIds.has(r._id)).length;

  const deptLabel = (key: string) => deptMap[key]?.label ?? key;
  const deptBadge = (key: string) => getColorMeta(deptMap[key]?.color ?? 'blue');

  const groupedUsers = otherUsers.reduce<Record<string, OtherUser[]>>((acc, u) => {
    const dept = u.department || 'management';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(u);
    return acc;
  }, {});

  const sortedDepts = Object.keys(groupedUsers).sort(
    (a, b) => DEPT_ORDER.indexOf(a) - DEPT_ORDER.indexOf(b),
  );

  const getDmUserInfo = (): OtherUser | null => {
    if (!selectedRoom || selectedRoom.type !== 'dm') return null;
    if (selectedUserInfo) return selectedUserInfo;
    const otherName = selectedRoom.participantNames.find((n) => n !== user?.name);
    return otherUsers.find((u) => u.name === otherName) || null;
  };

  const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount || 0), 0);

  // 검색 필터링된 메시지 (중복 제거 포함)
  const displayMessages = useMemo(() => {
    const deduped = Array.from(new Map(messages.map((m) => [String(m._id), m])).values());
    if (!msgSearchQuery.trim()) return deduped;
    const q = msgSearchQuery.toLowerCase();
    return deduped.filter(
      (m) => !isImageContent(m.content) && m.content.toLowerCase().includes(q),
    );
  }, [messages, msgSearchQuery]);

  // 미디어 메시지 모음 (우측 패널 갤러리용)
  const mediaMessages = useMemo(() => {
    return Array.from(new Map(messages.map((m) => [String(m._id), m])).values())
      .filter((m) => isImageContent(m.content));
  }, [messages]);

  // senderId → 표시 이름 맵 (senderName이 이메일로 저장된 경우 실제 이름으로 변환)
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (user) map[user.id] = user.name;
    otherUsers.forEach((u) => { map[u._id] = u.name; });
    return map;
  }, [user, otherUsers]);

  const resolveSenderName = (msg: Message): string => {
    if (userNameMap[msg.senderId]) return userNameMap[msg.senderId];
    if (msg.senderName.includes('@')) return msg.senderName.split('@')[0];
    return msg.senderName;
  };

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className='h-[calc(100vh-7.5rem)] flex bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm'>

      {/* ══════════════════════════════════════════════════════
          좌측: 네비게이션 패널 (수신함 / 필터 / 직원 목록)
      ══════════════════════════════════════════════════════ */}
      <div className='w-52 border-r border-gray-100 flex flex-col shrink-0 bg-gray-50/60'>

        {/* 헤더 */}
        <div className='px-4 pt-5 pb-3 border-b border-gray-100'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <h1 className='text-base font-bold text-gray-900'>수신함</h1>
              {totalUnread > 0 && (
                <span className='bg-violet-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none'>
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => { fetchOtherUsers(); setShowGroupModal(true); }}
              className='p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-md transition'
              title='그룹 채팅 만들기'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            </button>
          </div>
        </div>

        {/* 필터 네비게이션 */}
        <div className='px-2 py-2 space-y-0.5 border-b border-gray-100'>
          <button
            onClick={() => setLeftFilter('unread')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition',
              leftFilter === 'unread'
                ? 'bg-violet-100 text-violet-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-200',
            )}
          >
            <div className='flex items-center gap-2.5'>
              <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
              </svg>
              <span>안 읽은 메시지</span>
            </div>
            {totalUnread > 0 && (
              <span className='bg-violet-600 text-white text-[11px] font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 leading-none shrink-0'>
                {totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setLeftFilter('starred')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition',
              leftFilter === 'starred'
                ? 'bg-violet-100 text-violet-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-200',
            )}
          >
            <div className='flex items-center gap-2.5'>
              <svg className='w-4 h-4 shrink-0' fill={leftFilter === 'starred' ? 'currentColor' : 'none'} stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
              </svg>
              즐겨찾기
            </div>
            {starredCount > 0 && (
              <span className='bg-amber-400 text-white text-[11px] font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 leading-none shrink-0'>
                {starredCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setLeftFilter('all')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition',
              leftFilter === 'all'
                ? 'bg-violet-100 text-violet-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-200',
            )}
          >
            <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
            </svg>
            전체 대화
          </button>
        </div>

        {/* 직원 목록 (부서별) */}
        <div className='flex-1 overflow-y-auto py-2'>
          <p className='px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider'>
            멤버
          </p>
          {otherUsers.length === 0 ? (
            <p className='px-4 py-2 text-xs text-gray-400'>불러오는 중...</p>
          ) : (
            sortedDepts.map((dept) => (
              <div key={dept}>
                <p className='px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400'>
                  {deptLabel(dept)}
                </p>
                {groupedUsers[dept].map((u) => (
                  <button
                    key={u._id}
                    onClick={() => startDm(u)}
                    className='w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-200 rounded-md transition text-left mx-1'
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    <div className='relative shrink-0'>
                      <UserAvatar userId={u._id} name={u.name} colorClass={getAvatarColor(u.name)} size='w-7 h-7' textSize='text-xs' />
                      <span className='absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border border-white' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-xs font-medium text-gray-700 truncate'>{u.name}</p>
                      <p className='text-[10px] text-gray-400 truncate'>{u.position}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          중간: 대화 목록 패널
      ══════════════════════════════════════════════════════ */}
      <div className='w-72 border-r border-gray-100 flex flex-col shrink-0 bg-white'>

        {/* 검색 */}
        <div className='px-4 pt-4 pb-3 border-b border-gray-100'>
          <div className='relative'>
            <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
            </svg>
            <input
              ref={searchRef}
              type='text'
              placeholder='대화 검색'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-9 pr-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-violet-500/30 focus:bg-white transition'
            />
          </div>
        </div>

        {/* 대화 목록 */}
        <div className='flex-1 overflow-y-auto'>
          {filteredRooms.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-10'>
              <svg className='w-12 h-12 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
              </svg>
              <p className='text-sm'>
                {leftFilter === 'unread' ? '읽지 않은 대화가 없습니다' :
                 leftFilter === 'starred' ? '즐겨찾기한 대화가 없습니다' :
                 '대화가 없습니다'}
              </p>
              {leftFilter === 'all' && (
                <p className='text-xs text-gray-300'>왼쪽 직원 목록에서 대화를 시작하세요</p>
              )}
            </div>
          ) : (
            filteredRooms.map((room) => {
              const active = selectedRoom?._id === room._id;
              const displayName = getRoomDisplayName(room);
              return (
                <button
                  key={room._id}
                  onClick={() => openRoom(room)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left border-r-2',
                    active
                      ? 'bg-violet-50 border-violet-600'
                      : 'hover:bg-gray-50 border-transparent',
                  )}
                >
                  <div className='relative shrink-0'>
                    <UserAvatar userId={getRoomPartnerId(room)} name={displayName} colorClass={getAvatarColor(displayName)} size='w-10 h-10' textSize='text-base' />
                    {room.type === 'group' && (
                      <span className='absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center'>
                        <svg className='w-2.5 h-2.5 text-white' fill='currentColor' viewBox='0 0 24 24'>
                          <path d='M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3z' />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between mb-0.5'>
                      <span className={cn(
                        'text-sm font-semibold truncate',
                        active ? 'text-violet-700' : 'text-gray-800',
                      )}>
                        {displayName}
                      </span>
                      {room.lastMessageAt && (
                        <span className='text-[11px] text-gray-400 shrink-0 ml-2'>
                          {formatRoomTime(room.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className='flex items-center justify-between gap-1'>
                      <p className={cn(
                        'text-xs truncate',
                        room.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-400',
                      )}>
                        {room.lastMessage
                          ? isImageContent(room.lastMessage) ? '📷 이미지' : room.lastMessage
                          : '대화를 시작해보세요'}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className='shrink-0 bg-violet-600 text-white text-[11px] rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 font-bold leading-none'>
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          가운데: 채팅 화면
      ══════════════════════════════════════════════════════ */}
      {selectedRoom ? (
        <div className='flex-1 flex flex-col min-w-0 bg-gray-50/40'>

          {/* 헤더 */}
          <div className='h-16 px-6 flex items-center gap-3 border-b border-gray-100 bg-white shrink-0'>
            <div className='relative shrink-0'>
              <UserAvatar userId={getRoomPartnerId(selectedRoom)} name={getRoomDisplayName(selectedRoom)} colorClass={getAvatarColor(getRoomDisplayName(selectedRoom))} size='w-10 h-10' />
              {selectedRoom.type === 'dm' && (
                <span className='absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              {(() => {
                const dmInfo = getDmUserInfo();
                return dmInfo ? (
                  <>
                    <p className='text-sm font-bold text-gray-900 flex items-center gap-1.5 flex-wrap'>
                      {dmInfo.name}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${deptBadge(dmInfo.department).badgeBg} ${deptBadge(dmInfo.department).badgeText}`}>
                        {deptLabel(dmInfo.department)}
                      </span>
                      <span className='inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 leading-none'>
                        {dmInfo.position}
                      </span>
                    </p>
                    <p className='text-xs'>
                      <span className='text-emerald-500 font-medium'>● 온라인</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className='text-sm font-bold text-gray-900 truncate'>{getRoomDisplayName(selectedRoom)}</p>
                    <p className='text-xs text-gray-400'>
                      {selectedRoom.type === 'dm'
                        ? <span className='text-emerald-500 font-medium'>● 온라인</span>
                        : `그룹 채팅 · ${selectedRoom.participantNames.length}명`}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* 액션 버튼들 */}
            <div className='flex items-center gap-1'>
              {/* 대화 내용 검색 */}
              <button
                onClick={() => setMsgSearchMode((v) => !v)}
                className={cn(
                  'p-2 rounded-md transition',
                  msgSearchMode
                    ? 'text-violet-600 bg-violet-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                )}
                title='대화 내용 검색'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                </svg>
              </button>
              {/* 즐겨찾기 토글 */}
              {(() => {
                const isStarred = starredRoomIds.has(selectedRoom._id);
                return (
                  <button
                    onClick={() => toggleStar(selectedRoom._id)}
                    title={isStarred ? '즐겨찾기 해제' : '즐겨찾기 등록'}
                    className={cn(
                      'p-2 rounded-md transition',
                      isStarred
                        ? 'text-amber-400 bg-amber-50'
                        : 'text-gray-400 hover:text-amber-400 hover:bg-amber-50',
                    )}
                  >
                    <svg className='w-5 h-5' fill={isStarred ? 'currentColor' : 'none'} stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
                    </svg>
                  </button>
                );
              })()}
              {/* 대화 정보 (점 3개) */}
              <button
                onClick={() => setShowInfoPanel((v) => !v)}
                className={cn(
                  'p-2 rounded-md transition',
                  showInfoPanel
                    ? 'text-violet-600 bg-violet-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                )}
                title='대화 정보 보기'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <circle cx='12' cy='5' r='1.2' fill='currentColor' />
                  <circle cx='12' cy='12' r='1.2' fill='currentColor' />
                  <circle cx='12' cy='19' r='1.2' fill='currentColor' />
                </svg>
              </button>
            </div>
          </div>

          {/* 대화 내용 검색 바 */}
          {msgSearchMode && (
            <div className='px-6 py-2.5 bg-violet-50/60 border-b border-violet-100 shrink-0'>
              <div className='flex items-center gap-2'>
                <svg className='w-4 h-4 text-violet-400 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                </svg>
                <input
                  ref={msgSearchRef}
                  type='text'
                  placeholder='대화 내용 검색...'
                  value={msgSearchQuery}
                  onChange={(e) => setMsgSearchQuery(e.target.value)}
                  className='flex-1 bg-transparent text-sm text-gray-800 placeholder-violet-300 outline-none'
                />
                {msgSearchQuery && (
                  <span className='text-xs text-violet-500 shrink-0'>
                    {displayMessages.length}건
                  </span>
                )}
                <button
                  onClick={() => setMsgSearchMode(false)}
                  className='text-violet-400 hover:text-violet-600 transition shrink-0'
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 클립보드 이미지 미리보기 */}
          {pastedImage && (
            <div className='px-6 py-3 bg-amber-50 border-b border-amber-100 shrink-0'>
              <div className='flex items-center gap-3'>
                <div className='relative shrink-0'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pastedImage}
                    alt='붙여넣기 이미지'
                    className='h-16 w-auto max-w-32 rounded-md object-cover border border-amber-200'
                  />
                  <button
                    onClick={() => setPastedImage(null)}
                    className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition'
                  >
                    <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-amber-900'>이미지 첨부</p>
                  <p className='text-xs text-amber-600 mt-0.5'>클립보드에서 붙여넣은 이미지입니다</p>
                </div>
                <div className='flex gap-2 shrink-0'>
                  <button
                    onClick={() => setPastedImage(null)}
                    className='px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition'
                  >
                    취소
                  </button>
                  <button
                    onClick={sendPastedImage}
                    className='px-3 py-1.5 text-xs text-white bg-violet-600 rounded-md hover:bg-violet-700 transition font-medium'
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 메시지 영역 */}
          <div className='flex-1 overflow-y-auto px-6 py-5' onPaste={handlePaste}>

            {/* 검색 중인데 결과 없음 */}
            {msgSearchMode && msgSearchQuery && displayMessages.length === 0 && (
              <div className='flex flex-col items-center justify-center h-full text-gray-400 gap-2'>
                <svg className='w-10 h-10 text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                </svg>
                <p className='text-sm font-medium text-gray-500'>
                  &ldquo;{msgSearchQuery}&rdquo; 검색 결과가 없습니다
                </p>
              </div>
            )}

            {/* 빈 채팅방 */}
            {!msgSearchMode && messages.length === 0 && (
              <div className='flex flex-col items-center justify-center h-full text-gray-400 gap-3'>
                <UserAvatar userId={getRoomPartnerId(selectedRoom)} name={getRoomDisplayName(selectedRoom)} colorClass={getAvatarColor(getRoomDisplayName(selectedRoom))} size='w-16 h-16' textSize='text-2xl' />
                <div className='text-center'>
                  <p className='font-semibold text-gray-700'>{getRoomDisplayName(selectedRoom)}</p>
                  <p className='text-sm text-gray-400 mt-1'>첫 메시지를 보내보세요!</p>
                  <p className='text-xs text-gray-300 mt-1'>Ctrl+V 로 이미지를 붙여넣을 수 있어요</p>
                </div>
              </div>
            )}

            {/* 메시지 렌더링 */}
            <div className='space-y-0'>
              {displayMessages.map((msg, i, arr) => {
                const myId = user?.id ?? (user as any)?._id;
                const isMe = !!myId && String(msg.senderId) === String(myId);
                const prevMsg = arr[i - 1];
                const nextMsg = arr[i + 1];

                // 날짜 구분선
                const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

                // 연속 메시지 (같은 발신자 + 2분 이내)
                const isContinued =
                  !showDateSep &&
                  !!prevMsg &&
                  prevMsg.senderId === msg.senderId &&
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 120_000;

                // 이 메시지 이후 다음 메시지가 다른 사람이거나 2분 이상 지났으면 → 마지막
                const isLastInGroup =
                  !nextMsg ||
                  nextMsg.senderId !== msg.senderId ||
                  new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() >= 120_000;

                const isImg = isImageContent(msg.content);

                return (
                  <div key={msg._id}>
                    {/* 날짜 구분선 */}
                    {showDateSep && (
                      <div className='flex items-center gap-3 my-5'>
                        <div className='flex-1 h-px bg-gray-200' />
                        <span className='text-xs text-gray-400 font-medium px-3 py-1 bg-gray-100 rounded-full shrink-0'>
                          {getDateLabel(msg.createdAt)}
                        </span>
                        <div className='flex-1 h-px bg-gray-200' />
                      </div>
                    )}

                    <div className={cn(
                      'flex gap-2.5',
                      isMe ? 'flex-row-reverse' : 'flex-row',
                      isContinued ? 'mt-0.5' : 'mt-3',
                    )}>
                      {/* 아바타 영역 (항상 공간 유지, 연속이면 invisible) */}
                      {!isMe ? (
                        <div className={cn('shrink-0 self-end', isContinued && 'invisible')}>
                          <UserAvatar userId={msg.senderId} name={msg.senderName} colorClass={getAvatarColor(msg.senderName)} size='w-8 h-8' textSize='text-xs' />
                        </div>
                      ) : (
                        <div className='w-8 shrink-0' />
                      )}

                      <div className={cn(
                        'flex flex-col max-w-[60%]',
                        isMe ? 'items-end' : 'items-start',
                      )}>
                        {/* 발신자 이름 (상대방 첫 메시지만) */}
                        {!isMe && !isContinued && (
                          <span className='text-xs text-gray-500 font-medium px-1 mb-1'>{resolveSenderName(msg)}</span>
                        )}

                        {/* 버블 + 시간 */}
                        <div className={cn('flex items-end gap-1.5', isMe && 'flex-row-reverse')}>

                          {/* 말풍선 */}
                          {isImg ? (
                            /* 이미지 메시지 */
                            <button
                              onClick={() => setMediaLightbox(msg.content)}
                              className={cn(
                                'overflow-hidden rounded-md border cursor-zoom-in hover:opacity-90 transition',
                                isMe ? 'rounded-br-sm border-violet-200' : 'rounded-bl-sm border-gray-200 shadow-sm',
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={msg.content}
                                alt='이미지 메시지'
                                className='max-w-48 max-h-48 object-cover block'
                              />
                            </button>
                          ) : (
                            /* 텍스트 메시지 */
                            <div className={cn(
                              'px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
                              isMe
                                ? 'bg-violet-600 text-white rounded-md rounded-br-sm'
                                : 'bg-white text-gray-800 rounded-md rounded-bl-sm shadow-sm border border-gray-100',
                              // 연속 메시지 모서리 처리
                              isContinued && isMe && 'rounded-tr-2xl rounded-br-sm',
                              isContinued && !isMe && 'rounded-tl-2xl rounded-bl-sm',
                            )}>
                              <HighlightText text={msg.content} query={msgSearchMode ? msgSearchQuery : ''} />
                            </div>
                          )}

                          {/* ── 시간: 마지막 메시지에만 표시, 버블 오른쪽 (상대방) / 왼쪽 (나, flex-row-reverse) ── */}
                          {isLastInGroup && (
                            <span className='text-[10px] text-gray-400 shrink-0 mb-0.5 whitespace-nowrap'>
                              {formatTime(msg.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 타이핑 인디케이터 */}
            {typingUsers.length > 0 && (
              <div className='flex items-center gap-2.5 mt-3'>
                {(() => {
                  const typingUser = otherUsers.find((u) => u.name === typingUsers[0]);
                  return <UserAvatar userId={typingUser?._id} name={typingUsers[0] || '?'} colorClass='bg-gray-300' size='w-8 h-8' textSize='text-xs' />;
                })()}
                <div className='bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-md rounded-bl-sm'>
                  <div className='flex gap-1 items-center'>
                    <span className='text-xs text-gray-400 mr-1.5'>{typingUsers.join(', ')} 입력 중</span>
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
          <div className='px-4 py-3 border-t border-gray-100 bg-white shrink-0'>
            {/* 검색 모드일 때 힌트 */}
            {msgSearchMode && (
              <p className='text-xs text-violet-400 text-center pb-2'>
                검색 모드 · 메시지를 보내려면 검색을 닫으세요
              </p>
            )}
            <div
              className={cn(
                'flex gap-3 items-center bg-gray-50 rounded-md px-4 py-2.5 border transition',
                msgSearchMode
                  ? 'border-gray-100 opacity-50 pointer-events-none'
                  : 'border-gray-200 focus-within:border-violet-400 focus-within:ring-3 focus-within:ring-violet-500/10',
              )}
            >
              {/* 파일 첨부 버튼 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className='text-gray-400 hover:text-gray-600 transition shrink-0'
                title='이미지 첨부'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleFileSelect}
              />

              {/* 이모지 버튼 */}
              <button className='text-gray-400 hover:text-gray-600 transition shrink-0'>
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                </svg>
              </button>

              <input
                ref={inputRef}
                type='text'
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={`${getRoomDisplayName(selectedRoom)}에게 메시지 보내기... (Ctrl+V 이미지 붙여넣기 가능)`}
                className='flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none'
              />

              {/* 전송 버튼 */}
              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                className={cn(
                  'p-2 rounded-md transition-all shrink-0',
                  inputText.trim()
                    ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                    : 'text-gray-300 cursor-not-allowed',
                )}
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── 채팅방 미선택 ── */
        <div className='flex-1 flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30'>
          <div className='w-20 h-20 rounded-md bg-violet-100 flex items-center justify-center'>
            <svg className='w-10 h-10 text-violet-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' />
            </svg>
          </div>
          <div className='text-center'>
            <p className='text-base font-semibold text-gray-600'>대화를 선택해주세요</p>
            <p className='text-sm text-gray-400 mt-1'>왼쪽 목록에서 대화를 선택하거나<br />새 메시지를 시작하세요</p>
          </div>
          <p className='text-xs text-gray-400 mt-1'>왼쪽 직원 목록에서 대화를 시작하세요</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          우측: 정보 패널 (토글)
      ══════════════════════════════════════════════════════ */}
      {showInfoPanel && selectedRoom && (
        <div className='w-68 border-l border-gray-100 flex flex-col shrink-0 bg-white overflow-y-auto'>

          {/* 패널 헤더 */}
          <div className='px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between'>
            <h3 className='text-sm font-bold text-gray-900'>대화 정보</h3>
            <button
              onClick={() => setShowInfoPanel(false)}
              className='text-gray-400 hover:text-gray-600 transition p-1'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>

          {/* 대화 상대 */}
          <div className='px-5 py-4 border-b border-gray-100'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                대화 상대 {selectedRoom.participantNames.length}
              </h4>
              <button
                onClick={() => { fetchOtherUsers(); setShowAddMemberModal(true); }}
                className='flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition'
                title='대화 상대 추가'
              >
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 4v16m8-8H4' />
                </svg>
                추가
              </button>
            </div>
            <div className='space-y-2.5'>
              {selectedRoom.participantNames.map((name, idx) => {
                const participantUser = otherUsers.find((u) => u.name === name);
                const isCurrentUser = name === user?.name;
                return (
                  <div key={idx} className='flex items-center gap-2.5'>
                    <div className='relative shrink-0'>
                      <UserAvatar userId={participantUser?._id ?? (isCurrentUser ? user?.id : null)} name={name} colorClass={getAvatarColor(name)} size='w-9 h-9' textSize='text-sm' />
                      <span className='absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-800 flex items-center gap-1'>
                        {name}
                        {isCurrentUser && (
                          <span className='text-[10px] text-gray-400 font-normal'>(나)</span>
                        )}
                      </p>
                      {participantUser && (
                        <p className='text-xs text-gray-400'>
                          {participantUser.position} · {deptLabel(participantUser.department)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 사진 파일 */}
          <div className='px-5 py-4 border-b border-gray-100'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                사진 파일
              </h4>
              <span className='text-xs text-gray-400'>{mediaMessages.length}장</span>
            </div>
            {mediaMessages.length === 0 ? (
              <div className='flex flex-col items-center py-4 text-gray-300 gap-1.5'>
                <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                </svg>
                <p className='text-xs'>공유된 사진이 없습니다</p>
              </div>
            ) : (
              <div className='grid grid-cols-3 gap-1.5'>
                {mediaMessages.slice(0, 9).map((msg) => (
                  <button
                    key={msg._id}
                    onClick={() => setMediaLightbox(msg.content)}
                    className='aspect-square rounded-md overflow-hidden hover:opacity-80 transition cursor-zoom-in'
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.content}
                      alt='공유 이미지'
                      className='w-full h-full object-cover'
                    />
                  </button>
                ))}
                {mediaMessages.length > 9 && (
                  <div className='aspect-square rounded-md bg-gray-100 flex items-center justify-center'>
                    <span className='text-xs text-gray-500 font-medium'>+{mediaMessages.length - 9}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 첨부 파일 (향후 확장용 placeholder) */}
          <div className='px-5 py-4'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                첨부 파일
              </h4>
            </div>
            <div className='flex flex-col items-center py-4 text-gray-300 gap-1.5'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
              </svg>
              <p className='text-xs'>공유된 파일이 없습니다</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          대화 상대 추가 모달
      ══════════════════════════════════════════════════════ */}
      {showAddMemberModal && selectedRoom && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'>
          <div className='bg-white rounded-md shadow-2xl w-full max-w-md mx-4 p-6'>
            <div className='flex items-center justify-between mb-5'>
              <div>
                <h2 className='text-lg font-bold text-gray-900'>대화 상대 추가</h2>
                {selectedRoom.type === 'dm' && (
                  <p className='text-xs text-gray-400 mt-0.5'>추가하면 그룹 채팅으로 전환됩니다</p>
                )}
              </div>
              <button
                onClick={() => { setShowAddMemberModal(false); setAddMemberSelected([]); }}
                className='text-gray-400 hover:text-gray-600 transition'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-2'>
                  추가할 멤버 선택
                  {addMemberSelected.length > 0 && (
                    <span className='ml-1 text-violet-600 font-semibold'>{addMemberSelected.length}명 선택됨</span>
                  )}
                </label>
                <div className='max-h-56 overflow-y-auto border border-gray-200 rounded-md'>
                  {otherUsers
                    .filter((u) => !selectedRoom.participantNames.includes(u.name))
                    .map((u) => {
                      const selected = addMemberSelected.some((m) => m._id === u._id);
                      return (
                        <button
                          key={u._id}
                          onClick={() =>
                            setAddMemberSelected((prev) =>
                              selected ? prev.filter((m) => m._id !== u._id) : [...prev, u],
                            )
                          }
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            selected ? 'bg-violet-50' : 'hover:bg-gray-50',
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition',
                            selected ? 'bg-violet-600 border-violet-600' : 'border-gray-300',
                          )}>
                            {selected && (
                              <svg className='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                              </svg>
                            )}
                          </div>
                          <UserAvatar userId={u._id} name={u.name} colorClass={getAvatarColor(u.name)} size='w-8 h-8' textSize='text-xs' />
                          <div>
                            <p className='text-sm font-medium text-gray-800'>{u.name}</p>
                            <p className='text-xs text-gray-400'>{u.position} · {deptLabel(u.department)}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
              <div className='flex gap-3 pt-1'>
                <button
                  onClick={() => { setShowAddMemberModal(false); setAddMemberSelected([]); }}
                  className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition'
                >
                  취소
                </button>
                <button
                  onClick={addParticipants}
                  disabled={addMemberSelected.length === 0}
                  className='flex-1 py-2.5 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm'
                >
                  추가하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          그룹 채팅 생성 모달
      ══════════════════════════════════════════════════════ */}
      {showGroupModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'>
          <div className='bg-white rounded-md shadow-2xl w-full max-w-md mx-4 p-6'>
            <div className='flex items-center justify-between mb-5'>
              <h2 className='text-lg font-bold text-gray-900'>그룹 채팅 만들기</h2>
              <button
                onClick={() => { setShowGroupModal(false); setGroupName(''); setGroupMembers([]); }}
                className='text-gray-400 hover:text-gray-600 transition'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>채팅방 이름</label>
                <input
                  type='text'
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder='예: 마케팅팀 전체'
                  className='w-full px-3 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition'
                />
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-2'>
                  멤버 선택
                  {groupMembers.length > 0 && (
                    <span className='ml-1 text-violet-600 font-semibold'>{groupMembers.length}명 선택됨</span>
                  )}
                </label>
                <div className='max-h-48 overflow-y-auto border border-gray-200 rounded-md'>
                  {otherUsers.map((u) => {
                    const selected = groupMembers.some((m) => m._id === u._id);
                    return (
                      <button
                        key={u._id}
                        onClick={() =>
                          setGroupMembers((prev) =>
                            selected ? prev.filter((m) => m._id !== u._id) : [...prev, u],
                          )
                        }
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          selected ? 'bg-violet-50' : 'hover:bg-gray-50',
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition',
                          selected ? 'bg-violet-600 border-violet-600' : 'border-gray-300',
                        )}>
                          {selected && (
                            <svg className='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                            </svg>
                          )}
                        </div>
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', getAvatarColor(u.name))}>
                          <span className='text-white text-xs font-semibold'>{u.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className='text-sm font-medium text-gray-800'>{u.name}</p>
                          <p className='text-xs text-gray-400'>{u.position} · {deptLabel(u.department)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className='flex gap-3 pt-1'>
                <button
                  onClick={() => { setShowGroupModal(false); setGroupName(''); setGroupMembers([]); }}
                  className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition'
                >
                  취소
                </button>
                <button
                  onClick={createGroupRoom}
                  disabled={!groupName.trim() || groupMembers.length === 0}
                  className='flex-1 py-2.5 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm'
                >
                  만들기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          이미지 라이트박스
      ══════════════════════════════════════════════════════ */}
      {mediaLightbox && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'
          onClick={() => setMediaLightbox(null)}
        >
          <button
            className='absolute top-4 right-4 text-white/70 hover:text-white transition p-2'
            onClick={() => setMediaLightbox(null)}
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaLightbox}
            alt='이미지 크게 보기'
            className='max-w-[90vw] max-h-[90vh] object-contain rounded-md shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
