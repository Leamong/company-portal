'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import api from '@/lib/api';
import { type Task } from '@/components/kanban/types';

type DeptFilter = 'all' | 'marketing' | 'design';
type GroupMode = 'period' | 'assignee';

// ─── 이미지 삭제까지 남은 일수 ────────────────────────────────────────────────
function daysUntilDelete(archivedAt?: string | null): number | null {
  if (!archivedAt) return null;
  const deleteDate = dayjs(archivedAt).add(30, 'day');
  const diff = deleteDate.diff(dayjs(), 'day');
  return diff > 0 ? diff : 0;
}

// ─── 이미지 상태 뱃지 ─────────────────────────────────────────────────────────
function ImageBadge({ task }: { task: Task }) {
  const imagesGone = !!task.imagesDeletedAt;
  const daysLeft = daysUntilDelete(task.archivedAt);

  if (imagesGone) {
    return (
      <span className='text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0 whitespace-nowrap'>
        이미지 삭제됨
      </span>
    );
  }
  if (daysLeft !== null && daysLeft <= 7) {
    return (
      <span className='text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold shrink-0 whitespace-nowrap'>
        이미지 {daysLeft}일 후 삭제
      </span>
    );
  }
  return (
    <span className='text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0 whitespace-nowrap'>
      이미지 보관 중
    </span>
  );
}

// ─── 단일 행 카드 ─────────────────────────────────────────────────────────────
function ArchiveRow({ task }: { task: Task }) {
  return (
    <div className='flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all group'>
      {/* 완료 아이콘 */}
      <div className='w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0'>
        <svg className='w-3 h-3 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
        </svg>
      </div>

      {/* 제목 + 고객사 */}
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-gray-800 truncate'>{task.title}</p>
        <p className='text-xs text-gray-400 truncate'>{task.client}</p>
      </div>

      {/* 담당자 */}
      <div className='shrink-0 hidden sm:flex items-center gap-1.5'>
        <div className='w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center'>
          <span className='text-[9px] font-bold text-indigo-600'>{(task.assigneeName || '?')[0]}</span>
        </div>
        <span className='text-xs text-gray-500'>{task.assigneeName || '미배정'}</span>
      </div>

      {/* 디자인 종류 */}
      <span className='text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 hidden md:inline'>
        {task.designType}
      </span>

      {/* 부서 */}
      <span className='text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 hidden lg:inline
        bg-gray-100 text-gray-500'>
        {task.department === 'marketing' ? '마케팅팀' : task.department === 'design' ? '디자인팀' : ''}
      </span>

      {/* 마감일 */}
      <span className='text-xs text-gray-400 shrink-0 hidden lg:block w-16 text-right'>{task.dueDate}</span>

      {/* 이미지 상태 */}
      <ImageBadge task={task} />

      {/* 보관일 */}
      <span className='text-xs text-gray-300 shrink-0 hidden xl:block w-16 text-right'>
        {task.archivedAt ? dayjs(task.archivedAt).format('MM.DD') + ' 보관' : ''}
      </span>
    </div>
  );
}

// ─── 기간별 뷰 ────────────────────────────────────────────────────────────────
function PeriodView({ tasks }: { tasks: Task[] }) {
  // year → month → tasks
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Task[]>>();
    [...tasks]
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
      .forEach((t) => {
        const d = dayjs(t.archivedAt ?? t.dueDate);
        const year = d.format('YYYY');
        const month = d.format('MM');
        if (!map.has(year)) map.set(year, new Map());
        const monthMap = map.get(year)!;
        if (!monthMap.has(month)) monthMap.set(month, []);
        monthMap.get(month)!.push(t);
      });
    return map;
  }, [tasks]);

  const [openYears, setOpenYears] = useState<Set<string>>(
    () => new Set([dayjs().format('YYYY')]),
  );
  const [openMonths, setOpenMonths] = useState<Set<string>>(
    () => new Set([`${dayjs().format('YYYY')}-${dayjs().format('MM')}`]),
  );

  const toggleYear = (y: string) =>
    setOpenYears((prev) => {
      const s = new Set(prev);
      s.has(y) ? s.delete(y) : s.add(y);
      return s;
    });

  const toggleMonth = (key: string) =>
    setOpenMonths((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });

  const MONTH_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  if (grouped.size === 0) {
    return <EmptyState />;
  }

  return (
    <div className='flex-1 min-h-0 overflow-y-auto space-y-3 pr-1'>
      {[...grouped.entries()].map(([year, monthMap]) => {
        const yearTotal = [...monthMap.values()].reduce((s, arr) => s + arr.length, 0);
        const isYearOpen = openYears.has(year);

        return (
          <div key={year} className='rounded-2xl border border-gray-100 overflow-hidden bg-gray-50'>
            {/* 연도 헤더 */}
            <button
              onClick={() => toggleYear(year)}
              className='w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-100 transition-colors'
            >
              <div className='w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0'>
                <span className='text-white text-xs font-bold'>{year.slice(2)}</span>
              </div>
              <span className='text-sm font-bold text-gray-800 flex-1 text-left'>{year}년</span>
              <span className='text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full'>
                {yearTotal}건 완료
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isYearOpen ? 'rotate-180' : ''}`}
                fill='none' stroke='currentColor' viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
              </svg>
            </button>

            {isYearOpen && (
              <div className='border-t border-gray-100 divide-y divide-gray-100'>
                {[...monthMap.entries()].map(([month, monthTasks]) => {
                  const monthKey = `${year}-${month}`;
                  const isMonthOpen = openMonths.has(monthKey);
                  const monthName = MONTH_KO[parseInt(month, 10) - 1];

                  // 담당자별 집계
                  const assigneeCounts = monthTasks.reduce<Record<string, number>>((acc, t) => {
                    const name = t.assigneeName || '미배정';
                    acc[name] = (acc[name] || 0) + 1;
                    return acc;
                  }, {});

                  return (
                    <div key={month} className='bg-white'>
                      {/* 월 헤더 */}
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className='w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors'
                      >
                        <span className='w-8 text-center text-sm font-semibold text-gray-600'>{monthName}</span>
                        <div className='flex-1 flex items-center gap-2 flex-wrap'>
                          {Object.entries(assigneeCounts).map(([name, count]) => (
                            <span key={name} className='flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>
                              <span className='font-medium text-gray-700'>{name}</span>
                              <span>{count}건</span>
                            </span>
                          ))}
                        </div>
                        <span className='text-xs text-gray-400 shrink-0'>{monthTasks.length}건</span>
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isMonthOpen ? 'rotate-180' : ''}`}
                          fill='none' stroke='currentColor' viewBox='0 0 24 24'
                        >
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                        </svg>
                      </button>

                      {isMonthOpen && (
                        <div className='px-4 pb-3 space-y-1.5 bg-gray-50/50'>
                          {monthTasks.map((task) => (
                            <ArchiveRow key={task._id} task={task} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 담당자별 뷰 ──────────────────────────────────────────────────────────────
function AssigneeView({ tasks }: { tasks: Task[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    [...tasks]
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
      .forEach((t) => {
        const name = t.assigneeName || '미배정';
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(t);
      });
    // 완료 건수 많은 순으로 정렬
    return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
  }, [tasks]);

  const [openPeople, setOpenPeople] = useState<Set<string>>(
    () => new Set([...grouped.keys()].slice(0, 2)),
  );

  const toggle = (name: string) =>
    setOpenPeople((prev) => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });

  if (grouped.size === 0) return <EmptyState />;

  return (
    <div className='flex-1 min-h-0 overflow-y-auto space-y-3 pr-1'>
      {[...grouped.entries()].map(([name, personTasks]) => {
        const isOpen = openPeople.has(name);

        // 디자인 종류별 집계
        const designCounts = personTasks.reduce<Record<string, number>>((acc, t) => {
          acc[t.designType] = (acc[t.designType] || 0) + 1;
          return acc;
        }, {});

        // 가장 최근 보관일
        const latestDate = personTasks[0]?.archivedAt
          ? dayjs(personTasks[0].archivedAt).format('YYYY.MM.DD')
          : '';

        return (
          <div key={name} className='rounded-2xl border border-gray-100 overflow-hidden'>
            {/* 담당자 헤더 */}
            <button
              onClick={() => toggle(name)}
              className='w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition-colors'
            >
              {/* 아바타 */}
              <div className='w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0'>
                <span className='text-white text-sm font-bold'>{name[0]}</span>
              </div>

              <div className='flex-1 text-left min-w-0'>
                <p className='text-sm font-semibold text-gray-800'>{name}</p>
                <div className='flex items-center gap-2 flex-wrap mt-0.5'>
                  {Object.entries(designCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([type, cnt]) => (
                      <span key={type} className='text-[10px] text-gray-500'>
                        {type} {cnt}건
                      </span>
                    ))}
                </div>
              </div>

              <div className='text-right shrink-0'>
                <span className='text-sm font-bold text-indigo-600'>{personTasks.length}</span>
                <span className='text-xs text-gray-400'>건 완료</span>
              </div>

              {latestDate && (
                <span className='text-xs text-gray-300 shrink-0 hidden md:block'>
                  최근 {latestDate}
                </span>
              )}

              <svg
                className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                fill='none' stroke='currentColor' viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
              </svg>
            </button>

            {isOpen && (
              <div className='bg-gray-50 px-4 pb-3 pt-2 space-y-1.5 border-t border-gray-100'>
                {personTasks.map((task) => (
                  <ArchiveRow key={task._id} task={task} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className='flex-1 flex flex-col items-center justify-center gap-3 py-20'>
      <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center'>
        <svg className='w-7 h-7 text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' />
        </svg>
      </div>
      <p className='text-gray-400 text-sm'>보관된 작업이 없습니다.</p>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('all');
  const [designFilter, setDesignFilter] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('period');

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (deptFilter !== 'all') params.department = deptFilter;
      if (designFilter) params.designType = designFilter;
      const res = await api.get('/api/tasks/archive', { params });
      setTasks(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [deptFilter, designFilter]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const filtered = useMemo(() =>
    tasks.filter((t) => {
      if (!search) return true;
      return (
        t.title.includes(search) ||
        t.client.includes(search) ||
        t.assigneeName.includes(search)
      );
    }),
    [tasks, search],
  );

  // 통계
  const stats = useMemo(() => {
    const total = tasks.length;
    const marketing = tasks.filter((t) => t.department === 'marketing').length;
    const design = tasks.filter((t) => t.department === 'design').length;
    const thisMonth = tasks.filter((t) =>
      dayjs(t.archivedAt).isSame(dayjs(), 'month'),
    ).length;
    const assigneeMap = tasks.reduce<Record<string, number>>((acc, t) => {
      const n = t.assigneeName || '미배정';
      acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {});
    const topAssignee = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1])[0];
    return { total, marketing, design, thisMonth, topAssignee };
  }, [tasks]);

  return (
    <div className='flex flex-col h-full min-h-0 space-y-4'>
      {/* ── 페이지 헤더 ── */}
      <div className='flex items-start justify-between gap-4 shrink-0'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>작업 기록</h1>
          <p className='text-sm text-gray-400 mt-0.5'>
            전달 완료된 작업 기록 · 총{' '}
            <span className='font-semibold text-gray-600'>{stats.total}</span>건
          </p>
        </div>

        {/* 그룹 모드 탭 */}
        <div className='flex items-center gap-0.5 bg-gray-100 rounded-xl p-1 shrink-0'>
          <button
            onClick={() => setGroupMode('period')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              groupMode === 'period'
                ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
            </svg>
            기간별
          </button>
          <button
            onClick={() => setGroupMode('assignee')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              groupMode === 'assignee'
                ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
            </svg>
            담당자별
          </button>
        </div>
      </div>

      {/* ── 통계 카드 ── */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0'>
        <StatCard label='이번 달 완료' value={stats.thisMonth} unit='건' color='indigo' />
        <StatCard label='마케팅팀' value={stats.marketing} unit='건' color='blue' />
        <StatCard label='디자인팀' value={stats.design} unit='건' color='violet' />
        {stats.topAssignee ? (
          <div className='bg-white rounded-xl border border-gray-100 px-4 py-3'>
            <p className='text-xs text-gray-400 mb-1'>최다 완료</p>
            <p className='text-sm font-bold text-gray-800 truncate'>{stats.topAssignee[0]}</p>
            <p className='text-xs text-gray-500 mt-0.5'>{stats.topAssignee[1]}건</p>
          </div>
        ) : (
          <StatCard label='전체 완료' value={stats.total} unit='건' color='emerald' />
        )}
      </div>

      {/* ── 안내 배너 ── */}
      <div className='flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 shrink-0'>
        <svg className='w-4 h-4 text-amber-500 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
        </svg>
        <span>
          이미지는 보관 후 <strong className='font-semibold'>30일</strong>이 지나면 자동 삭제됩니다. 주문 정보는 영구 보존됩니다.
        </span>
      </div>

      {/* ── 필터 바 ── */}
      <div className='flex items-center gap-2 flex-wrap shrink-0'>
        {/* 검색 */}
        <div className='relative flex-1 min-w-48'>
          <svg className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
          </svg>
          <input
            type='text'
            placeholder='제목, 고객사, 담당자 검색...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
          />
        </div>

        {/* 부서 필터 */}
        {(['all', 'marketing', 'design'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDeptFilter(d)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              deptFilter === d
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 border border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            {d === 'all' ? '전체' : d === 'marketing' ? '마케팅팀' : '디자인팀'}
          </button>
        ))}

        {/* 디자인 종류 */}
        <select
          value={designFilter}
          onChange={(e) => setDesignFilter(e.target.value)}
          className='text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
        >
          <option value=''>종류 전체</option>
          {['배너', '로고', 'SNS', '카탈로그', '인쇄물', '기타'].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <span className='ml-auto text-xs text-gray-400 shrink-0'>{filtered.length}건</span>
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
          불러오는 중...
        </div>
      ) : groupMode === 'period' ? (
        <PeriodView tasks={filtered} />
      ) : (
        <AssigneeView tasks={filtered} />
      )}
    </div>
  );
}

// ─── 통계 카드 ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: 'indigo' | 'blue' | 'violet' | 'emerald';
}) {
  const colorMap = {
    indigo: 'text-indigo-600 bg-indigo-50',
    blue: 'text-blue-600 bg-blue-50',
    violet: 'text-violet-600 bg-violet-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };

  return (
    <div className='bg-white rounded-xl border border-gray-100 px-4 py-3'>
      <p className='text-xs text-gray-400 mb-1'>{label}</p>
      <div className='flex items-baseline gap-1'>
        <span className={`text-2xl font-bold ${colorMap[color].split(' ')[0]}`}>{value}</span>
        <span className='text-xs text-gray-400'>{unit}</span>
      </div>
    </div>
  );
}
