'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Task {
  _id: string;
  title: string;
  client: string;
  dueDate: string;
  status: string;
  priority: '긴급' | '일반';
  designType: string;
  department: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  상담중: { bg: 'bg-gray-100', text: 'text-gray-600' },
  결재완료: { bg: 'bg-blue-100', text: 'text-blue-700' },
  제작중: { bg: 'bg-amber-100', text: 'text-amber-700' },
  컨펌대기: { bg: 'bg-purple-100', text: 'text-purple-700' },
  고객사전달완료: { bg: 'bg-green-100', text: 'text-green-700' },
};

function ddayLabel(dueDate: string) {
  const diff = dayjs(dueDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (diff < 0) return { text: `D+${Math.abs(diff)}`, tone: 'text-red-600 font-bold' };
  if (diff === 0) return { text: 'D-day', tone: 'text-red-500 font-bold' };
  if (diff <= 3) return { text: `D-${diff}`, tone: 'text-orange-600 font-semibold' };
  return { text: `D-${diff}`, tone: 'text-gray-400' };
}

export default function MyTasksWidget() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api
      .get('/api/tasks', { params: { assigneeId: user.id } })
      .then((res) => {
        const active = (res.data as Task[]).filter(
          (t) => t.status !== '고객사전달완료',
        );
        active.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setTasks(active.slice(0, 5));
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className='bg-white rounded-md border border-gray-100 p-4 md:p-5 h-full flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-semibold text-gray-800'>내 담당 업무</h2>
        <Link href='/tasks' className='text-[11px] text-blue-600 hover:text-blue-700 font-medium'>
          전체 →
        </Link>
      </div>

      {loading ? (
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : tasks.length === 0 ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center py-6'>
          <span className='text-2xl mb-2'>📋</span>
          <p className='text-xs text-gray-400'>담당 업무가 없습니다</p>
        </div>
      ) : (
        <ul className='flex-1 space-y-2 overflow-y-auto -mr-1 pr-1'>
          {tasks.map((task) => {
            const dd = ddayLabel(task.dueDate);
            const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE['상담중'];
            return (
              <li key={task._id}>
                <Link
                  href='/tasks'
                  className='block p-2.5 rounded-md border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors'
                >
                  <div className='flex items-start justify-between gap-2 mb-1'>
                    <p className='text-xs font-semibold text-gray-800 line-clamp-1 flex-1 min-w-0'>
                      {task.title}
                    </p>
                    {task.priority === '긴급' && (
                      <span className='text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0'>
                        긴급
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-2 text-[10px] text-gray-500'>
                    <span className='truncate'>{task.client}</span>
                    <span className='text-gray-300'>·</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', statusStyle.bg, statusStyle.text)}>
                      {task.status}
                    </span>
                    <span className={cn('ml-auto tabular-nums shrink-0 text-[11px]', dd.tone)}>
                      {dd.text}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
