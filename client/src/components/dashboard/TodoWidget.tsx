'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Todo {
  _id: string;
  content: string;
  isDone: boolean;
  order: number;
  createdAt: string;
}

export default function TodoWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    api
      .get('/api/todos')
      .then((res) => setTodos(res.data))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const addTodo = async () => {
    const content = input.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/todos', { content });
      // 새 항목은 맨 아래로
      setTodos((prev) => [...prev, res.data]);
      setInput('');
    } catch {
      // 조용히 실패
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (todo: Todo) => {
    const next = !todo.isDone;
    setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, isDone: next } : t)));
    try {
      await api.patch(`/api/todos/${todo._id}`, { isDone: next });
    } catch {
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, isDone: !next } : t)));
    }
  };

  const removeTodo = async (id: string) => {
    if (!confirm('이 할 일을 삭제할까요?')) return;
    const backup = todos;
    setTodos((prev) => prev.filter((t) => t._id !== id));
    try {
      await api.delete(`/api/todos/${id}`);
    } catch {
      setTodos(backup);
    }
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo._id);
    setEditingValue(todo.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const content = editingValue.trim();
    const target = todos.find((t) => t._id === editingId);
    if (!target) return cancelEdit();
    if (!content || content === target.content) return cancelEdit();

    const backup = todos;
    setTodos((prev) => prev.map((t) => (t._id === editingId ? { ...t, content } : t)));
    setEditingId(null);
    setEditingValue('');
    try {
      await api.patch(`/api/todos/${target._id}`, { content });
    } catch {
      setTodos(backup);
    }
  };

  const clearCompleted = async () => {
    const doneCount = todos.filter((t) => t.isDone).length;
    if (doneCount === 0) return;
    if (!confirm(`완료된 할 일 ${doneCount}건을 삭제할까요?`)) return;
    const backup = todos;
    setTodos((prev) => prev.filter((t) => !t.isDone));
    try {
      await api.patch('/api/todos/clear-completed');
    } catch {
      setTodos(backup);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = todos.findIndex((t) => t._id === active.id);
    const newIndex = todos.findIndex((t) => t._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(todos, oldIndex, newIndex);
    const backup = todos;
    setTodos(next);
    try {
      await api.patch('/api/todos/reorder', {
        orderedIds: next.map((t) => t._id),
      });
    } catch {
      setTodos(backup);
    }
  };

  const pendingCount = todos.filter((t) => !t.isDone).length;
  const doneCount = todos.length - pendingCount;

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col min-h-0'>
      {/* 헤더 */}
      <div className='flex items-center justify-between mb-3 shrink-0'>
        <div className='flex items-center gap-2 min-w-0'>
          <h2 className='text-sm font-semibold text-gray-800 truncate'>내 할 일</h2>
          {pendingCount > 0 && (
            <span className='shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 tabular-nums'>
              {pendingCount}
            </span>
          )}
        </div>
        {doneCount > 0 && (
          <button
            onClick={clearCompleted}
            className='shrink-0 text-[11px] text-gray-400 hover:text-red-500 transition-colors'
          >
            완료 {doneCount}건 지우기
          </button>
        )}
      </div>

      {/* 입력 */}
      <div className='flex gap-1.5 mb-3 shrink-0'>
        <input
          type='text'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder='할 일 추가'
          disabled={submitting}
          className='flex-1 min-w-0 px-3 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60'
        />
        <button
          onClick={addTodo}
          disabled={submitting || !input.trim()}
          className='shrink-0 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors'
        >
          추가
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : todos.length === 0 ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center py-6'>
          <span className='text-2xl mb-2'>✨</span>
          <p className='text-xs text-gray-400'>아직 등록된 할 일이 없어요</p>
          <p className='text-[11px] text-gray-300 mt-0.5'>오늘 해야 할 일을 추가해보세요</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todos.map((t) => t._id)} strategy={verticalListSortingStrategy}>
            <ul className='flex-1 overflow-y-auto space-y-0.5 -mr-1 pr-1 min-h-0'>
              {todos.map((todo, idx) => (
                <SortableTodoItem
                  key={todo._id}
                  todo={todo}
                  index={idx}
                  isEditing={editingId === todo._id}
                  editingValue={editingValue}
                  editInputRef={editInputRef}
                  onToggleDone={() => toggleDone(todo)}
                  onStartEdit={() => startEdit(todo)}
                  onChangeEdit={setEditingValue}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={() => removeTodo(todo._id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* 풋터 힌트 */}
      {todos.length > 0 && !loading && (
        <p className='shrink-0 mt-2 text-[10px] text-gray-300 text-center'>
          제목 드래그로 순서 변경 · 더블클릭 수정
        </p>
      )}
    </div>
  );
}

interface SortableTodoItemProps {
  todo: Todo;
  index: number;
  isEditing: boolean;
  editingValue: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleDone: () => void;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
}

function SortableTodoItem({
  todo,
  index,
  isEditing,
  editingValue,
  editInputRef,
  onToggleDone,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo._id,
    disabled: isEditing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
        isEditing ? 'bg-blue-50' : 'hover:bg-gray-50',
        isDragging && 'shadow-md ring-1 ring-blue-200 bg-white',
      )}
    >
      {/* 체크박스 */}
      <button
        onClick={onToggleDone}
        disabled={isEditing}
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors disabled:opacity-50',
          todo.isDone
            ? 'bg-blue-600 border-blue-600'
            : 'border-gray-300 hover:border-blue-400',
        )}
        aria-label={todo.isDone ? '완료 해제' : '완료'}
      >
        {todo.isDone && (
          <svg className='w-2.5 h-2.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
          </svg>
        )}
      </button>

      {/* 번호 (배열 인덱스 기반 자동 재정렬) */}
      <span
        className={cn(
          'w-5 shrink-0 text-[11px] font-semibold tabular-nums text-right',
          todo.isDone ? 'text-gray-300' : 'text-gray-400',
        )}
      >
        {index + 1}.
      </span>

      {/* 제목 (드래그 핸들 + 더블클릭 수정 트리거) */}
      {isEditing ? (
        <input
          ref={editInputRef}
          type='text'
          value={editingValue}
          onChange={(e) => onChangeEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveEdit();
            else if (e.key === 'Escape') onCancelEdit();
          }}
          onBlur={onSaveEdit}
          className='flex-1 min-w-0 bg-white px-2 py-0.5 rounded border border-blue-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      ) : (
        <button
          type='button'
          {...attributes}
          {...listeners}
          onDoubleClick={() => !todo.isDone && onStartEdit()}
          className={cn(
            'flex-1 min-w-0 text-left text-xs wrap-break-word touch-none cursor-grab active:cursor-grabbing select-none',
            todo.isDone ? 'line-through text-gray-400' : 'text-gray-700',
          )}
          title={todo.isDone ? todo.content : '드래그로 이동 · 더블클릭으로 수정'}
        >
          {todo.content}
        </button>
      )}

      {/* 액션 버튼 */}
      {!isEditing && (
        <div className='flex items-center gap-0.5 shrink-0'>
          {!todo.isDone && (
            <button
              onClick={onStartEdit}
              className='w-6 h-6 inline-flex items-center justify-center rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors'
              title='수정'
              aria-label='수정'
            >
              <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
              </svg>
            </button>
          )}
          <button
            onClick={onRemove}
            className='w-6 h-6 inline-flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors'
            title='삭제'
            aria-label='삭제'
          >
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3' />
            </svg>
          </button>
        </div>
      )}
    </li>
  );
}
