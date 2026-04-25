'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import { type Task, COLUMNS, ALLOWED_TRANSITIONS } from './types';

interface Props {
  task: Task;
  isAdmin: boolean;
  currentUserId: string;
  onMove: (taskId: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpload?: (task: Task) => void;
  onTogglePriority?: (taskId: string) => void;
}

export default function KanbanCard({ task, isAdmin, currentUserId, onMove, onEdit, onDelete, onUpload, onTogglePriority }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuToggle = () => {
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen((p) => !p);
  };

  const isOwner = task.assigneeId === currentUserId;
  const isTerminal = task.status === '고객사전달완료';
  const canDrag = (isAdmin || isOwner) && !isTerminal;
  const isPendingConfirm = task.status === '컨펌대기';
  const canUpload = isPendingConfirm && (isOwner || isAdmin);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { task },
    disabled: !canDrag,
  });

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };

  // 드래그 핸들 아이콘 (hover 시 노출)
  const DragHandle = canDrag ? (
    <div className='absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none z-10'>
      <svg width='18' height='10' viewBox='0 0 18 10' fill='none'>
        <circle cx='5' cy='2' r='1.4' fill='#9ca3af' />
        <circle cx='13' cy='2' r='1.4' fill='#9ca3af' />
        <circle cx='5' cy='5' r='1.4' fill='#9ca3af' />
        <circle cx='13' cy='5' r='1.4' fill='#9ca3af' />
        <circle cx='5' cy='8' r='1.4' fill='#9ca3af' />
        <circle cx='13' cy='8' r='1.4' fill='#9ca3af' />
      </svg>
    </div>
  ) : null;

  const today = dayjs().startOf('day');
  const due = dayjs(task.dueDate);
  const diff = due.diff(today, 'day');

  const dueBadge = (() => {
    if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-600 font-bold' };
    if (diff === 0) return { label: 'D-Day', cls: 'text-red-500 font-bold' };
    if (diff <= 3) return { label: `D-${diff}`, cls: 'text-orange-500 font-semibold' };
    if (diff <= 7) return { label: `D-${diff}`, cls: 'text-yellow-600' };
    return { label: `D-${diff}`, cls: 'text-gray-400' };
  })();

  const isOverdue = diff < 0;
  const isNearDue = diff >= 0 && diff <= 3;
  const col = COLUMNS.find((c) => c.key === task.status);

  // 이동 가능한 대상 컬럼
  const moveTargets = isAdmin
    ? COLUMNS.filter((c) => {
        if (c.key === task.status) return false; // 현재 상태 제외
        if (task.status === '고객사전달완료') return false; // 종착 → 이동 불가
        return true;
      })
    : COLUMNS.filter((c) => (ALLOWED_TRANSITIONS[task.status] ?? []).includes(c.key));

  const canEdit = isAdmin || isOwner;

  const handleCardClick = (e: React.MouseEvent) => {
    // ⋮ 메뉴 영역 클릭은 무시
    if ((e.target as HTMLElement).closest('[data-menu]')) return;
    if (canUpload && onUpload) onUpload(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={handleCardClick}
      className={[
        'group relative bg-white rounded-md border p-3.5 shadow-sm transition-all select-none',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        canUpload ? 'ring-2 ring-violet-300 ring-offset-1 cursor-pointer' : '',
        isOverdue
          ? 'border-red-200 shadow-red-50'
          : isNearDue
            ? 'border-orange-200 shadow-orange-50'
            : 'border-gray-100',
        !isDragging && 'hover:shadow-md hover:-translate-y-0.5',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {DragHandle}

      {/* 헤더: 제목 + 메뉴 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {task.priority === '긴급' && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
              긴급
            </span>
          )}
          <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{task.title}</p>
        </div>

        {canEdit && (
          <div className='flex items-center gap-0.5 shrink-0' data-menu onClick={(e) => e.stopPropagation()}>
            {/* ⚡ 긴급 토글 버튼 */}
            {onTogglePriority && (
              <button
                onClick={() => onTogglePriority(task._id)}
                title={task.priority === '긴급' ? '긴급 해제' : '긴급으로 설정'}
                className={[
                  'p-0.5 rounded transition-colors',
                  task.priority === '긴급'
                    ? 'text-red-500 hover:text-red-300'
                    : 'text-gray-300 hover:text-red-400',
                ].join(' ')}
              >
                <svg className='w-3.5 h-3.5' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
                </svg>
              </button>
            )}

            <div className="relative">
            <button
              ref={btnRef}
              onClick={handleMenuToggle}
              className="text-gray-500 hover:text-gray-800 transition-colors p-0.5 rounded"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {menuOpen && typeof window !== 'undefined' && createPortal(
              <div
                ref={dropdownRef}
                style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                className="bg-white rounded-md border border-gray-100 shadow-xl py-1.5 w-40 text-xs"
              >
                {moveTargets.length > 0 && (
                  <>
                    <p className="px-3 pt-0.5 pb-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                      상태 변경
                    </p>
                    {moveTargets.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => { onMove(task._id, c.key); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                        {c.label}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}
                <button
                  onClick={() => { onEdit(task); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  수정하기
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { onDelete(task._id); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
              </div>,
              document.body
            )}
            </div>
          </div>
        )}
      </div>

      {/* 고객사 */}
      <p className="text-xs text-gray-400 mb-2.5 truncate">{task.client}</p>

      {/* 디자인 종류 태그 + 수량 */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${col?.tagColor ?? 'bg-gray-100 text-gray-600'}`}>
          {task.designType}
        </span>
        <span className="text-xs text-gray-400">{task.quantity}장</span>
      </div>

      {/* 담당자 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-indigo-600">
            {task.assigneeName ? task.assigneeName[0] : '?'}
          </span>
        </div>
        <span className="truncate">{task.assigneeName || '미배정'}</span>
        {!task.assigneeName && isAdmin && (
          <span className="ml-auto text-orange-400 text-[10px] font-medium shrink-0">배정 필요</span>
        )}
      </div>

      {/* 마감일 */}
      <div className="flex items-center justify-between text-xs border-t border-gray-50 pt-2 mt-0.5">
        <span className="text-gray-400">{task.dueDate}</span>
        <span className={dueBadge.cls}>{dueBadge.label}</span>
      </div>

      {/* 컨펌대기 업로드 안내 */}
      {canUpload && (
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 rounded-md">
          <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-[10px] font-semibold text-violet-600">클릭하여 결과물 업로드</span>
        </div>
      )}
    </div>
  );
}
