'use client';

import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';
import { type Column, type Task } from './types';

interface Props {
  column: Column;
  tasks: Task[];
  isAdmin: boolean;
  currentUserId: string;
  onMove: (taskId: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAddCard?: () => void;
  onUpload?: (task: Task) => void;
  onTogglePriority?: (taskId: string) => void;
}

export default function KanbanColumn({
  column,
  tasks,
  isAdmin,
  currentUserId,
  onMove,
  onEdit,
  onDelete,
  onAddCard,
  onUpload,
  onTogglePriority,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div className="min-w-0 flex flex-col h-full">
      {/* 컬럼 헤더 */}
      <div
        className={[
          'rounded-t-xl border border-b-0 border-gray-100 px-3 py-2.5 flex items-center gap-2',
          `border-t-2 ${column.border}`,
          column.color,
        ].join(' ')}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${column.dot}`} />
        <span className="text-sm font-semibold flex-1">{column.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">
          {tasks.length}
        </span>
      </div>

      {/* 드롭 영역 */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 rounded-b-xl border border-t-0 border-gray-100 p-2 space-y-2 min-h-48 overflow-y-auto transition-colors',
          isOver ? 'bg-indigo-50/60 border-indigo-200' : 'bg-gray-50/50',
        ].join(' ')}
      >
        {/* 미배정 경고 (어드민 전용) */}
        {isAdmin && tasks.some((t) => !t.assigneeName) && (
          <div className="text-[10px] text-orange-500 font-medium px-1 flex items-center gap-1">
            <span>⚠</span> 미배정 카드 있음
          </div>
        )}

        {tasks.map((task) => (
          <KanbanCard
            key={task._id}
            task={task}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpload={onUpload}
            onTogglePriority={onTogglePriority}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-gray-300">
            카드 없음
          </div>
        )}

        {/* 상담중 컬럼에만 + 추가 버튼 */}
        {column.key === '상담중' && isAdmin && onAddCard && (
          <button
            onClick={onAddCard}
            className="w-full py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            주문 추가
          </button>
        )}
      </div>
    </div>
  );
}
