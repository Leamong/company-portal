'use client';

import { ComponentType } from 'react';
import TodoWidget from './TodoWidget';
import MyTasksWidget from './MyTasksWidget';
import RecentBoardWidget from './RecentBoardWidget';
import LeaveDetailWidget from './LeaveDetailWidget';
import TodayAttendanceWidget from './TodayAttendanceWidget';
import LeaveExpiringWidget from './LeaveExpiringWidget';
import MissingEvidenceWidget from './MissingEvidenceWidget';
import MiniCalendarWidget from './MiniCalendarWidget';

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

export interface WidgetDef {
  id: string;
  title: string;
  component: ComponentType;
  /** 기본 크기 (컬럼 12 기준) */
  defaultW: number;
  defaultH: number;
  /** 최소 크기 */
  minW: number;
  minH: number;
  /** 'all' | 'employee' | 'admin' — 보여줄 대상 */
  audience: 'all' | 'employee' | 'admin';
  /** 기본 프리셋에 포함되는지 */
  defaultEnabled: boolean;
}

export const WIDGETS: Record<string, WidgetDef> = {
  'leave-detail': {
    id: 'leave-detail',
    title: '휴가',
    component: LeaveDetailWidget,
    defaultW: 4,
    defaultH: 7,
    minW: 3,
    minH: 6,
    audience: 'employee',
    defaultEnabled: true,
  },
  'todo': {
    id: 'todo',
    title: '내 할 일',
    component: TodoWidget,
    defaultW: 4,
    defaultH: 7,
    minW: 3,
    minH: 5,
    audience: 'all',
    defaultEnabled: true,
  },
  'my-tasks': {
    id: 'my-tasks',
    title: '내 담당 업무',
    component: MyTasksWidget,
    defaultW: 4,
    defaultH: 7,
    minW: 3,
    minH: 5,
    audience: 'all',
    defaultEnabled: true,
  },
  'recent-board': {
    id: 'recent-board',
    title: '최근 게시글',
    component: RecentBoardWidget,
    defaultW: 7,
    defaultH: 6,
    minW: 4,
    minH: 4,
    audience: 'all',
    defaultEnabled: true,
  },
  'today-attendance': {
    id: 'today-attendance',
    title: '오늘 근태 현황',
    component: TodayAttendanceWidget,
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    audience: 'admin',
    defaultEnabled: true,
  },
  'leave-expiring': {
    id: 'leave-expiring',
    title: '연차 만료 임박',
    component: LeaveExpiringWidget,
    defaultW: 6,
    defaultH: 6,
    minW: 4,
    minH: 5,
    audience: 'admin',
    defaultEnabled: true,
  },
  'missing-evidence': {
    id: 'missing-evidence',
    title: '증빙 미제출',
    component: MissingEvidenceWidget,
    defaultW: 6,
    defaultH: 6,
    minW: 4,
    minH: 5,
    audience: 'all',
    defaultEnabled: true,
  },
  'mini-calendar': {
    id: 'mini-calendar',
    title: '캘린더',
    component: MiniCalendarWidget,
    defaultW: 5,
    defaultH: 10,
    minW: 3,
    minH: 7,
    audience: 'all',
    defaultEnabled: true,
  },
};

// 역할별 기본 레이아웃 (12-컬럼 그리드, row height 40px 기준)
export function getDefaultLayout(isAdmin: boolean): LayoutItem[] {
  if (isAdmin) {
    return [
      { i: 'today-attendance',  x: 0, y: 0,  w: 7, h: 5 },
      { i: 'leave-expiring',    x: 7, y: 0,  w: 5, h: 6 },
      { i: 'missing-evidence',  x: 0, y: 6,  w: 6, h: 6 },
      { i: 'todo',              x: 6, y: 6,  w: 3, h: 7 },
      { i: 'my-tasks',          x: 9, y: 6,  w: 3, h: 7 },
      { i: 'mini-calendar',     x: 0, y: 13, w: 4, h: 10 },
      { i: 'recent-board',      x: 4, y: 13, w: 8, h: 6 },
    ];
  }
  return [
    { i: 'leave-detail',      x: 0, y: 0,  w: 4, h: 7 },
    { i: 'todo',              x: 4, y: 0,  w: 4, h: 7 },
    { i: 'my-tasks',           x: 8, y: 0,  w: 4, h: 7 },
    { i: 'missing-evidence',  x: 0, y: 7,  w: 5, h: 6 },
    { i: 'recent-board',      x: 5, y: 7,  w: 7, h: 6 },
    { i: 'mini-calendar',     x: 0, y: 13, w: 5, h: 10 },
  ];
}

// 역할에 맞는 위젯만 필터링
export function visibleWidgetsFor(isAdmin: boolean): WidgetDef[] {
  return Object.values(WIDGETS).filter((w) => {
    if (w.audience === 'all') return true;
    return isAdmin ? w.audience === 'admin' : w.audience === 'employee';
  });
}

// 현재 레이아웃에 없는(추가 가능한) 위젯 목록
export function getAvailableWidgets(
  currentLayout: LayoutItem[],
  isAdmin: boolean,
): WidgetDef[] {
  const usedIds = new Set(currentLayout.map((l) => l.i));
  return visibleWidgetsFor(isAdmin).filter((w) => !usedIds.has(w.id));
}

// 새 위젯을 추가할 때 사용할 기본 위치 계산 (기존 레이아웃 맨 아래)
export function computeNextPosition(
  currentLayout: LayoutItem[],
  widget: WidgetDef,
): { x: number; y: number; w: number; h: number } {
  const maxY = currentLayout.reduce(
    (acc, item) => Math.max(acc, item.y + item.h),
    0,
  );
  return {
    x: 0,
    y: maxY,
    w: widget.defaultW,
    h: widget.defaultH,
  };
}

/**
 * PC 레이아웃을 모바일용 단일 컬럼 스택 레이아웃으로 변환
 * - 읽기 순서(y → x) 대로 정렬
 * - 각 위젯이 풀 너비(cols)로 세로 스택
 * - 높이는 사용자가 설정한 값 유지 (너무 크면 위젯별 기본값으로 대체)
 */
export function generateMobileLayout(
  lgLayout: LayoutItem[],
  cols: number,
): LayoutItem[] {
  const sorted = [...lgLayout].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  let currentY = 0;
  return sorted.map((item) => {
    const widget = WIDGETS[item.i];
    // 모바일에선 과도한 높이 방지 — 기본 높이의 1.5배를 상한으로
    const maxMobileH = widget ? Math.round(widget.defaultH * 1.5) : item.h;
    const h = Math.min(item.h, maxMobileH);
    const result: LayoutItem = {
      ...item,
      x: 0,
      y: currentY,
      w: cols,
      h,
    };
    currentY += h;
    return result;
  });
}

// 저장된 레이아웃과 레지스트리를 병합:
// - 현재 역할에 보이지 않아야 할 위젯 제외
// - 레지스트리에 없는 위젯(과거에 제거된 것) 제외
// - 숨기지 않았지만 저장본에 없는 새 위젯은 기본 위치로 자동 추가
export function mergeLayout(saved: LayoutItem[] | undefined, isAdmin: boolean): LayoutItem[] {
  const allowed = new Set(visibleWidgetsFor(isAdmin).map((w) => w.id));
  const savedById = new Map((saved ?? []).map((l) => [l.i, l]));

  const defaults = getDefaultLayout(isAdmin);
  const result: LayoutItem[] = [];

  // 저장본 기준으로 진행
  if (saved && saved.length > 0) {
    for (const item of saved) {
      if (!allowed.has(item.i)) continue; // 역할 안 맞는 위젯 제거
      if (!WIDGETS[item.i]) continue; // 레지스트리에 없는 위젯 제거
      result.push(item);
    }
    // 기본 프리셋 중 아직 추가 안 된 위젯은 defaultEnabled=true 인 경우에만 자동 추가
    for (const def of defaults) {
      if (!allowed.has(def.i)) continue;
      if (savedById.has(def.i)) continue;
      const widget = WIDGETS[def.i];
      if (widget?.defaultEnabled) {
        result.push(def);
      }
    }
    return result;
  }

  // 저장본이 없으면 기본 프리셋 사용
  return defaults.filter((d) => allowed.has(d.i));
}
