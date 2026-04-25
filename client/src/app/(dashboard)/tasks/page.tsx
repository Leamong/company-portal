'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Gantt, ViewMode as GanttViewMode, type Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import dayjs from 'dayjs';
import KanbanColumn from '@/components/kanban/KanbanColumn';
import KanbanCard from '@/components/kanban/KanbanCard';
import TaskModal from '@/components/kanban/TaskModal';
import { COLUMNS, ALLOWED_TRANSITIONS, type Task, type TaskStatus } from '@/components/kanban/types';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

type DeptTab = 'all' | 'marketing' | 'design';
type AppViewMode = 'board' | 'mywork' | 'timeline';

const STATUS_COLORS: Record<string, string> = {
  '상담중': '#9ca3af',
  '결재완료': '#3b82f6',
  '제작중': '#6366f1',
  '컨펌대기': '#a855f7',
  '고객사전달완료': '#10b981',
};

const STATUS_PROGRESS: Record<string, number> = {
  '상담중': 10,
  '결재완료': 30,
  '제작중': 60,
  '컨펌대기': 80,
  '고객사전달완료': 100,
};

export default function TasksPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<AppViewMode>('board');

  // 필터 상태
  const [deptTab, setDeptTab] = useState<DeptTab>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [designFilter, setDesignFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortByDue, setSortByDue] = useState(false);

  // 모달 상태
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; task?: Task }>({
    open: false,
    mode: 'create',
  });

  // 컨펌 업로드 모달
  const [uploadTask, setUploadTask] = useState<Task | null>(null);

  // ── API 호출 ──────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (deptTab !== 'all') params.department = deptTab;
      const res = await api.get('/api/tasks', { params });
      setTasks(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [deptTab]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── 드래그앤드롭 ──────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(e.active.data.current?.task ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const task = active.data.current?.task as Task;
    const newStatus = over.id as TaskStatus;
    if (!task || task.status === newStatus) return;

    if (!isAdmin) {
      const allowed = ALLOWED_TRANSITIONS[task.status] ?? [];
      if (!allowed.includes(newStatus)) return;
    }

    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t)),
    );

    try {
      await api.patch(`/api/tasks/${task._id}/status`, { status: newStatus });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: task.status } : t)),
      );
    }
  };

  // ── 메뉴에서 상태 변경 ───────────────────────────────────
  const handleMove = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const oldStatus = task.status;

    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus as TaskStatus } : t)),
    );

    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: oldStatus } : t)),
      );
    }
  };

  // ── 긴급 토글 ─────────────────────────────────────────
  const handleTogglePriority = async (taskId: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const newPriority = task.priority === '긴급' ? '일반' : '긴급';

    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, priority: newPriority } : t)),
    );

    try {
      await api.patch(`/api/tasks/${taskId}`, { priority: newPriority });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, priority: task.priority } : t)),
      );
    }
  };

  // ── 삭제 ────────────────────────────────────────────────
  const handleDelete = async (taskId: string) => {
    if (!confirm('이 주문을 삭제할까요?')) return;
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch {
      fetchTasks();
    }
  };

  // ── 생성 / 수정 ─────────────────────────────────────────
  const handleSubmit = async (data: Partial<Task>) => {
    if (modal.mode === 'create') {
      const res = await api.post('/api/tasks', data);
      setTasks((prev) => [res.data, ...prev]);
    } else if (modal.task) {
      const res = await api.patch(`/api/tasks/${modal.task._id}`, data);
      setTasks((prev) => prev.map((t) => (t._id === modal.task!._id ? res.data : t)));
    }
  };

  // ── 필터 적용 ────────────────────────────────────────────
  const filteredTasks = useMemo(() => tasks
    .filter((t) => {
      if (deptTab !== 'all' && t.department !== deptTab) return false;
      if (assigneeFilter && !t.assigneeName.includes(assigneeFilter)) return false;
      if (designFilter && t.designType !== designFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortByDue) return 0;
      return a.dueDate.localeCompare(b.dueDate);
    }),
  [tasks, deptTab, assigneeFilter, designFilter, priorityFilter, sortByDue],
  );

  const getByStatus = (status: TaskStatus) =>
    filteredTasks.filter((t) => t.status === status);

  const assignees = [...new Set(tasks.map((t) => t.assigneeName).filter(Boolean))];
  const totalActive = tasks.filter(
    (t) => t.status !== '고객사전달완료',
  ).length;
  const urgentCount = tasks.filter((t) => t.priority === '긴급').length;

  return (
    <div className='flex flex-col h-full min-h-0 space-y-4'>
      {/* ── 컨펌 업로드 모달 ── */}
      {uploadTask && (
        <ConfirmUploadModal
          task={uploadTask}
          onClose={() => setUploadTask(null)}
        />
      )}

      {/* ── 페이지 헤더 ── */}
      <div className='flex items-start justify-between gap-4 shrink-0'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>업무 보드</h1>
          <p className='text-sm text-gray-400 mt-0.5'>
            진행 중 <span className='font-semibold text-gray-600'>{totalActive}</span>건
            {urgentCount > 0 && (
              <span className='ml-2 text-red-500 font-semibold'>· 긴급 {urgentCount}건</span>
            )}
          </p>
        </div>

        <div className='flex items-center gap-3 shrink-0'>
          {/* 뷰 전환 탭 */}
          <div className='flex items-center gap-0.5 bg-gray-100 rounded-md p-1'>
            <ViewButton
              active={viewMode === 'board'}
              onClick={() => setViewMode('board')}
              icon={<BoardIcon />}
              label='보드'
            />
            <ViewButton
              active={viewMode === 'mywork'}
              onClick={() => setViewMode('mywork')}
              icon={<PersonIcon />}
              label='내 작업'
            />
            <ViewButton
              active={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
              icon={<TimelineIcon />}
              label='타임라인'
            />
          </div>

          {/* 새 주문 (보드 뷰 + 어드민만) */}
          {isAdmin && viewMode === 'board' && (
            <button
              onClick={() => setModal({ open: true, mode: 'create' })}
              className='flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors shadow-sm'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
              </svg>
              새 주문 등록
            </button>
          )}
        </div>
      </div>

      {/* ── 부서 탭 + 필터 (보드·타임라인에서만 표시) ── */}
      {viewMode !== 'mywork' && (
        <div className='flex flex-col gap-2 shrink-0'>
          <div className='flex items-center gap-1 flex-wrap'>
            {([
              { key: 'all', label: '전체' },
              { key: 'marketing', label: '마케팅팀' },
              { key: 'design', label: '디자인팀' },
            ] as { key: DeptTab; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDeptTab(tab.key)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  deptTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100',
                ].join(' ')}
              >
                {tab.label}
                <span className='ml-1.5 text-xs opacity-70'>
                  {tab.key === 'all'
                    ? tasks.length
                    : tasks.filter((t) => t.department === tab.key).length}
                </span>
              </button>
            ))}
          </div>

          <div className='flex items-center gap-2 flex-wrap'>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className='text-xs border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
            >
              <option value=''>담당자 전체</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>

            <select
              value={designFilter}
              onChange={(e) => setDesignFilter(e.target.value)}
              className='text-xs border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
            >
              <option value=''>종류 전체</option>
              {['배너', '로고', 'SNS', '카탈로그', '인쇄물', '기타'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <button
              onClick={() => setPriorityFilter((p) => (p ? '' : '긴급'))}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap',
                priorityFilter === '긴급'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-500',
              ].join(' ')}
            >
              긴급만
            </button>

            <button
              onClick={() => setSortByDue((p) => !p)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap',
                sortByDue
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500',
              ].join(' ')}
            >
              <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' />
              </svg>
              마감 임박순
            </button>
          </div>
        </div>
      )}

      {/* ── 뷰 렌더링 ── */}
      {loading ? (
        <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
          불러오는 중...
        </div>
      ) : viewMode === 'board' ? (
        /* ── 칸반 보드 ── */
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className='grid grid-cols-5 gap-2 overflow-x-auto pb-4 flex-1 min-h-0' style={{ minWidth: 900 }}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={getByStatus(col.key)}
                isAdmin={isAdmin}
                currentUserId={user?.id ?? ''}
                onMove={handleMove}
                onEdit={(task) => setModal({ open: true, mode: 'edit', task })}
                onDelete={handleDelete}
                onAddCard={isAdmin ? () => setModal({ open: true, mode: 'create' }) : undefined}
                onUpload={(task) => setUploadTask(task)}
                onTogglePriority={handleTogglePriority}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className='rotate-2 scale-105 opacity-95 pointer-events-none w-64'>
                <KanbanCard
                  task={activeTask}
                  isAdmin={isAdmin}
                  currentUserId={user?.id ?? ''}
                  onMove={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : viewMode === 'mywork' ? (
        /* ── 내 작업 ── */
        <MyWorkView
          tasks={tasks}
          userId={user?.id ?? ''}
          userName={user?.name ?? '나'}
          isAdmin={isAdmin}
          onEdit={(task) => setModal({ open: true, mode: 'edit', task })}
          onMove={handleMove}
          onDelete={handleDelete}
        />
      ) : (
        /* ── 타임라인 ── */
        <TimelineView
          tasks={filteredTasks}
          onEdit={(task) => setModal({ open: true, mode: 'edit', task })}
        />
      )}

      {/* ── 생성/수정 모달 ── */}
      {modal.open && (
        <TaskModal
          mode={modal.mode}
          initial={modal.task}
          onClose={() => setModal({ open: false, mode: 'create' })}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ─── 뷰 전환 버튼 ─────────────────────────────────────────────────────────────

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-white text-indigo-700 shadow-sm font-semibold'
          : 'text-gray-500 hover:text-gray-700',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

function BoardIcon() {
  return (
    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <rect x='3' y='3' width='7' height='18' rx='1' strokeWidth={2} />
      <rect x='14' y='3' width='7' height='11' rx='1' strokeWidth={2} />
      <rect x='14' y='18' width='7' height='3' rx='1' strokeWidth={2} />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
    </svg>
  );
}

// ─── 내 작업 뷰 ───────────────────────────────────────────────────────────────

const MY_WORK_GROUPS = [
  {
    label: '진행 중',
    statuses: ['상담중', '결재완료', '제작중'] as TaskStatus[],
    color: 'text-indigo-600',
    dot: 'bg-indigo-400',
  },
  {
    label: '컨펌 대기',
    statuses: ['컨펌대기'] as TaskStatus[],
    color: 'text-purple-600',
    dot: 'bg-purple-400',
  },
  {
    label: '전달 완료',
    statuses: ['고객사전달완료'] as TaskStatus[],
    color: 'text-emerald-600',
    dot: 'bg-emerald-400',
  },
];

function MyWorkView({
  tasks,
  userId,
  userName,
  isAdmin,
  onEdit,
  onMove,
  onDelete,
}: {
  tasks: Task[];
  userId: string;
  userName: string;
  isAdmin: boolean;
  onEdit: (t: Task) => void;
  onMove: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const myTasks = tasks.filter((t) => t.assigneeId === userId);
  const activeCount = myTasks.filter(
    (t) => t.status !== '고객사전달완료',
  ).length;
  const urgentCount = myTasks.filter((t) => t.priority === '긴급').length;

  if (myTasks.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center text-center gap-3 py-20'>
        <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center'>
          <svg className='w-7 h-7 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
          </svg>
        </div>
        <p className='text-gray-400 text-sm'>담당 업무가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className='flex-1 min-h-0 overflow-y-auto'>
      {/* 요약 헤더 */}
      <div className='flex items-center gap-3 pb-3 mb-2 border-b border-gray-100'>
        <div className='w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0'>
          <span className='text-sm font-bold text-indigo-600'>{userName[0]}</span>
        </div>
        <div>
          <p className='text-sm font-semibold text-gray-800'>{userName}님의 담당 업무</p>
          <p className='text-xs text-gray-400'>
            진행 중 {activeCount}건
            {urgentCount > 0 && (
              <span className='ml-1.5 text-red-500 font-semibold'>· 긴급 {urgentCount}건</span>
            )}
          </p>
        </div>
      </div>

      {/* 그룹별 목록 */}
      <div className='space-y-4'>
        {MY_WORK_GROUPS.map((group) => {
          const groupTasks = myTasks.filter((t) => group.statuses.includes(t.status));
          if (groupTasks.length === 0) return null;

          return (
            <div key={group.label}>
              <div className='flex items-center gap-2 mb-2'>
                <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                <span className={`text-xs font-semibold ${group.color}`}>{group.label}</span>
                <span className='text-xs text-gray-400'>{groupTasks.length}</span>
              </div>
              <div className='space-y-1.5'>
                {groupTasks.map((task) => (
                  <MyTaskRow
                    key={task._id}
                    task={task}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                    onMove={onMove}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyTaskRow({
  task,
  isAdmin,
  onEdit,
  onMove,
  onDelete,
}: {
  task: Task;
  isAdmin: boolean;
  onEdit: (t: Task) => void;
  onMove: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const today = dayjs().startOf('day');
  const due = dayjs(task.dueDate);
  const diff = due.diff(today, 'day');

  const dueBadge = (() => {
    if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-600 bg-red-50 font-bold' };
    if (diff === 0) return { label: 'D-Day', cls: 'text-red-500 bg-red-50 font-bold' };
    if (diff <= 3) return { label: `D-${diff}`, cls: 'text-orange-500 bg-orange-50 font-semibold' };
    if (diff <= 7) return { label: `D-${diff}`, cls: 'text-yellow-600 bg-yellow-50' };
    return { label: `D-${diff}`, cls: 'text-gray-400 bg-gray-50' };
  })();

  const col = COLUMNS.find((c) => c.key === task.status);
  const isTerminal = task.status === '고객사전달완료';

  const allowedNext = isAdmin
    ? COLUMNS.filter(
        (c) =>
          c.key !== task.status &&
          !isTerminal,
      )
    : COLUMNS.filter((c) => (ALLOWED_TRANSITIONS[task.status] ?? []).includes(c.key));

  return (
    <div className='flex items-center gap-3 px-4 py-3 bg-white rounded-md border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group'>
      {/* 상태 도트 */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${col?.dot ?? 'bg-gray-300'}`} />

      {/* 제목 + 고객사 */}
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-1.5'>
          {task.priority === '긴급' && (
            <span className='text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 shrink-0'>긴급</span>
          )}
          <p
            className='text-sm font-semibold text-gray-800 truncate cursor-pointer hover:text-indigo-600 transition-colors'
            onClick={() => onEdit(task)}
          >
            {task.title}
          </p>
        </div>
        <p className='text-xs text-gray-400 truncate'>{task.client}</p>
      </div>

      {/* 디자인 종류 태그 */}
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 hidden sm:inline ${col?.tagColor ?? 'bg-gray-100 text-gray-600'}`}>
        {task.designType}
      </span>

      {/* 마감일 */}
      <span className='text-xs text-gray-400 shrink-0 w-20 text-right hidden md:block'>{task.dueDate}</span>

      {/* D-day 뱃지 */}
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 w-14 text-center ${dueBadge.cls}`}>
        {dueBadge.label}
      </span>

      {/* 빠른 상태 이동 버튼 (hover 시 노출) */}
      {allowedNext.length > 0 && (
        <div className='hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
          {allowedNext.slice(0, 2).map((c) => (
            <button
              key={c.key}
              onClick={() => onMove(task._id, c.key)}
              className='text-[10px] px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors whitespace-nowrap'
            >
              → {c.label}
            </button>
          ))}
        </div>
      )}

      {/* 수정 버튼 */}
      <button
        onClick={() => onEdit(task)}
        className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600 p-1 rounded shrink-0'
      >
        <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
        </svg>
      </button>

      {isAdmin && (
        <button
          onClick={() => onDelete(task._id)}
          className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-1 rounded shrink-0'
        >
          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── 타임라인 뷰 ──────────────────────────────────────────────────────────────

function TimelineView({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const [ganttView, setGanttView] = useState<GanttViewMode>(GanttViewMode.Week);

  const ganttTasks = useMemo<GanttTask[]>(() => {
    return tasks
      .filter((t) => t.dueDate)
      .map((task) => {
        const endDate = dayjs(task.dueDate);
        const startDate = task.orderDate
          ? dayjs(task.orderDate)
          : endDate.subtract(7, 'day');
        const safeStart = startDate.isAfter(endDate) ? endDate.subtract(1, 'day') : startDate;
        const safeEnd = endDate.isBefore(safeStart) ? safeStart.add(1, 'day') : endDate;

        return {
          id: task._id,
          name: task.title + (task.assigneeName ? `  ${task.assigneeName}` : ''),
          start: safeStart.toDate(),
          end: safeEnd.toDate(),
          progress: STATUS_PROGRESS[task.status] ?? 0,
          type: 'task' as const,
          styles: {
            backgroundColor: (STATUS_COLORS[task.status] ?? '#9ca3af') + 'cc',
            backgroundSelectedColor: STATUS_COLORS[task.status] ?? '#9ca3af',
            progressColor: 'rgba(255,255,255,0.35)',
            progressSelectedColor: 'rgba(255,255,255,0.5)',
          },
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks]);

  if (ganttTasks.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center text-center gap-3 py-20'>
        <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center'>
          <svg className='w-7 h-7 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
          </svg>
        </div>
        <p className='text-gray-400 text-sm'>표시할 일정이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className='flex-1 min-h-0 flex flex-col gap-3'>
      {/* 상단 컨트롤 */}
      <div className='flex items-center gap-2 shrink-0 flex-wrap'>
        <span className='text-xs text-gray-400'>기간 단위:</span>
        {([
          { mode: GanttViewMode.Day, label: '일' },
          { mode: GanttViewMode.Week, label: '주' },
          { mode: GanttViewMode.Month, label: '월' },
        ] as const).map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setGanttView(mode)}
            className={[
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              ganttView === mode
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 border border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}

        {/* 범례 */}
        <div className='ml-auto flex items-center gap-3 flex-wrap'>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className='flex items-center gap-1'>
              <span className='w-2.5 h-2.5 rounded-sm' style={{ backgroundColor: color }} />
              <span className='text-xs text-gray-500'>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 간트 차트 */}
      <div className='flex-1 rounded-md border border-gray-100 overflow-auto bg-white'>
        <Gantt
          tasks={ganttTasks}
          viewMode={ganttView}
          locale='ko'
          listCellWidth='200px'
          columnWidth={
            ganttView === GanttViewMode.Day ? 40
              : ganttView === GanttViewMode.Week ? 160
                : 200
          }
          rowHeight={44}
          headerHeight={56}
          onClick={(task) => {
            const originalTask = tasks.find((t) => t._id === task.id);
            if (originalTask) onEdit(originalTask);
          }}
          todayColor='rgba(99, 102, 241, 0.06)'
        />
      </div>

      <p className='text-xs text-gray-300 text-center shrink-0'>
        바 클릭 시 상세 수정 · 마감일 기준으로 정렬
      </p>
    </div>
  );
}

// ─── 컨펌 업로드 모달 ────────────────────────────────────────────────────────

function ConfirmUploadModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) { setError('이미지를 첨부해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', task.title);
      formData.append('designType', task.designType);
      formData.append('taskId', task._id);
      formData.append('file', file);
      await api.post('/api/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone(true);
    } catch {
      setError('업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4'
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className='bg-white rounded-md shadow-2xl w-full max-w-md'>
        {done ? (
          <div className='px-8 py-10 text-center space-y-4'>
            <div className='w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto'>
              <svg className='w-7 h-7 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
              </svg>
            </div>
            <p className='text-base font-bold text-gray-900'>컨펌 요청 완료!</p>
            <p className='text-sm text-gray-500'>어드민이 검토 후 승인 또는 피드백을 드릴 예정입니다.</p>
            <button
              onClick={onClose}
              className='w-full py-2.5 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors'
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
              <div>
                <h2 className='text-sm font-bold text-gray-900'>결과물 업로드</h2>
                <p className='text-xs text-gray-400 mt-0.5'>{task.title} · {task.designType}</p>
              </div>
              <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>

            <div className='px-6 py-5 space-y-4'>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className='relative border-2 border-dashed border-gray-200 rounded-md h-48 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors overflow-hidden'
              >
                {preview ? (
                  <>
                    <img src={preview} alt='preview' className='w-full h-full object-cover' />
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      className='absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-black/70'
                    >
                      <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <svg className='w-10 h-10 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
                    </svg>
                    <p className='text-sm text-gray-400'>클릭하거나 파일을 드래그하세요</p>
                    <p className='text-xs text-gray-300'>JPG, PNG, PDF · 최대 50MB</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type='file' accept='image/jpeg,image/png,application/pdf' onChange={handleFileChange} className='hidden' />
              {file && <p className='text-xs text-gray-500'>📎 {file.name}</p>}
              {error && <p className='text-xs text-red-500'>{error}</p>}
            </div>

            <div className='px-6 pb-5 flex gap-2'>
              <button onClick={onClose} className='flex-1 py-2.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors'>
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !file}
                className='flex-1 py-2.5 rounded-md bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
              >
                {loading ? (
                  <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
                  </svg>
                ) : null}
                {loading ? '업로드 중...' : '컨펌 요청하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
