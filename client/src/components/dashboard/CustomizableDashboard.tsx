'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutItem,
  WIDGETS,
  mergeLayout,
  getDefaultLayout,
  visibleWidgetsFor,
  getAvailableWidgets,
  computeNextPosition,
  generateMobileLayout,
} from './widgetRegistry';
import AddWidgetModal from './AddWidgetModal';

const ResponsiveGridLayout = WidthProvider(Responsive);

// row height 고정 (40px). w=1 = 약 1/12 너비.
const ROW_HEIGHT = 40;
const COLS = { lg: 12, md: 10, sm: 6, xs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 0 };

export default function CustomizableDashboard() {
  const { user, updateUser } = useAuthStore();
  const isAdmin = user?.role === 'head-admin';

  // 저장된 레이아웃 + 레지스트리 병합
  const initial = useMemo(
    () => mergeLayout(user?.dashboardLayout, isAdmin),
    // 의도적으로 최초 마운트 시 한 번만 병합 (이후엔 local state 가 source of truth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [layout, setLayout] = useState<LayoutItem[]>(initial);
  const [isEditing, setIsEditing] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  // 현재 활성 breakpoint (lg | md | sm | xs). 모바일(sm/xs)에선 편집 비활성화.
  const [currentBp, setCurrentBp] = useState<'lg' | 'md' | 'sm' | 'xs'>('lg');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모바일에선 편집 불가 — PC 레이아웃을 자동 변환해서 보여줌
  const canEdit = currentBp === 'lg' || currentBp === 'md';
  const editingActive = isEditing && canEdit;

  // 즉시 저장 (추가/제거 시 — debounce 없이)
  const persistImmediate = async (next: LayoutItem[]) => {
    try {
      await api.patch('/api/users/me/dashboard-layout', { layout: next });
      updateUser({ dashboardLayout: next });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch {
      // 조용히 실패
    }
  };

  // 드래그 완료 시 서버 저장 (debounce 500ms)
  const schedulePersist = (next: LayoutItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api
        .patch('/api/users/me/dashboard-layout', { layout: next })
        .then(() => {
          updateUser({ dashboardLayout: next });
          setSavedTick(true);
          setTimeout(() => setSavedTick(false), 1500);
        })
        .catch(() => { /* 조용히 실패 — 다음 변경 시 재시도 */ });
    }, 500);
  };

  // react-grid-layout 콜백: Layout[] → LayoutItem[] 변환하여 상태 갱신
  // 모바일 breakpoint(sm/xs)에선 자동 생성된 레이아웃이므로 저장하지 않음
  const handleLayoutChange = (nextLayout: Layout[]) => {
    if (!editingActive) return;
    if (currentBp !== 'lg' && currentBp !== 'md') return;
    const merged = layout.map((item) => {
      const found = nextLayout.find((l) => l.i === item.i);
      if (!found) return item;
      return { ...item, x: found.x, y: found.y, w: found.w, h: found.h };
    });
    const changed = merged.some((m, idx) => {
      const p = layout[idx];
      return m.x !== p?.x || m.y !== p?.y || m.w !== p?.w || m.h !== p?.h;
    });
    if (!changed) return;
    setLayout(merged);
    schedulePersist(merged);
  };

  const handleReset = async () => {
    if (!confirm('대시보드 레이아웃을 기본값으로 되돌릴까요?')) return;
    const def = getDefaultLayout(isAdmin);
    setLayout(def);
    try {
      await api.patch('/api/users/me/dashboard-layout', { layout: def });
      updateUser({ dashboardLayout: def });
    } catch {
      alert('저장에 실패했습니다.');
    }
  };

  const handleRemoveWidget = (widgetId: string) => {
    const next = layout.filter((l) => l.i !== widgetId);
    setLayout(next);
    persistImmediate(next);
  };

  const handleAddWidget = (widgetId: string) => {
    const widget = WIDGETS[widgetId];
    if (!widget) return;
    const pos = computeNextPosition(layout, widget);
    const next = [...layout, { i: widgetId, ...pos }];
    setLayout(next);
    setShowAddModal(false);
    persistImmediate(next);
  };

  // 화면에 렌더링할 위젯만 필터 (역할 안 맞는 거 제외 — 안전장치)
  const visibleIds = useMemo(
    () => new Set(visibleWidgetsFor(isAdmin).map((w) => w.id)),
    [isAdmin],
  );
  const renderable = layout.filter((item) => visibleIds.has(item.i) && WIDGETS[item.i]);

  // 각 위젯 정의의 minW/minH 를 레이아웃 아이템에 병합 (react-grid-layout 이 constraint 로 사용)
  const enrichedLayout = renderable.map((item) => {
    const widget = WIDGETS[item.i];
    return {
      ...item,
      minW: widget?.minW ?? 2,
      minH: widget?.minH ?? 2,
    };
  });

  // breakpoint 별 레이아웃 — 모바일(sm/xs)은 PC 레이아웃을 풀너비 단일 컬럼으로 자동 변환
  const layouts = {
    lg: enrichedLayout,
    md: enrichedLayout, // md(996~1199)는 PC 레이아웃 유지, cols 가 10 이라 auto-clamp
    sm: generateMobileLayout(enrichedLayout, 6),
    xs: generateMobileLayout(enrichedLayout, 2),
  };

  return (
    <div className='space-y-3'>
      {/* 편집 툴바 */}
      <div className='flex items-center justify-end gap-2'>
        {savedTick && (
          <span className='text-[11px] text-green-600 font-medium flex items-center gap-1 animate-pulse'>
            <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
            </svg>
            저장됨
          </span>
        )}
        {editingActive && (
          <>
            <button
              onClick={() => setShowAddModal(true)}
              className='flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors'
            >
              <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 4v16m8-8H4' />
              </svg>
              위젯 추가
            </button>
            <button
              onClick={handleReset}
              className='text-xs text-gray-500 hover:text-red-500 font-medium px-2.5 py-1.5 rounded-md hover:bg-red-50 transition-colors'
            >
              기본값으로 초기화
            </button>
          </>
        )}
        {/* 편집 버튼은 편집 가능 환경(PC/태블릿)에서만 표시 */}
        {canEdit && (
          <button
            onClick={() => setIsEditing((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              isEditing
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {isEditing ? (
              <>
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
                </svg>
                편집 완료
              </>
            ) : (
              <>
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                </svg>
                편집
              </>
            )}
          </button>
        )}
      </div>

      {/* 편집 모드 안내 */}
      {editingActive && (
        <div className='rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-center gap-2'>
          <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
          </svg>
          위젯을 드래그해서 원하는 위치로 옮기거나 모서리를 끌어 크기를 조절하세요. 변경 사항은 자동 저장됩니다.
        </div>
      )}

      {/* 그리드 레이아웃 */}
      <div className={cn(editingActive && 'rgl-editing')}>
        <ResponsiveGridLayout
          className='layout'
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          isDraggable={editingActive}
          isResizable={editingActive}
          draggableCancel='.widget-content button, .widget-content input, .widget-content a, .widget-remove-btn'
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={(bp) => setCurrentBp(bp as 'lg' | 'md' | 'sm' | 'xs')}
        >
          {renderable.map((item) => {
            const widget = WIDGETS[item.i];
            if (!widget) return null;
            const W = widget.component;
            return (
              <div key={item.i} className='relative'>
                {/* 편집 모드일 때 drag 핸들 오버레이 (PC/태블릿에서만) */}
                {editingActive && (
                  <>
                    <div className='absolute inset-0 rounded-md ring-2 ring-blue-400/60 ring-inset pointer-events-none z-10' />
                    {/* 제거 버튼 (우상단) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWidget(item.i);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className='widget-remove-btn absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors'
                      title={`${widget.title} 제거`}
                    >
                      <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M6 18L18 6M6 6l12 12' />
                      </svg>
                    </button>
                  </>
                )}
                <div className='widget-content h-full overflow-hidden rounded-md'>
                  <W />
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>

      {/* 위젯 추가 모달 */}
      {showAddModal && (
        <AddWidgetModal
          available={getAvailableWidgets(layout, isAdmin)}
          onAdd={handleAddWidget}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* react-grid-layout 스타일 보정 */}
      <style jsx global>{`
        .rgl-editing .react-grid-item {
          cursor: grab;
        }
        .rgl-editing .react-grid-item:active {
          cursor: grabbing;
        }
        .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.15) !important;
          border-radius: 16px;
        }
        .react-grid-item > .react-resizable-handle {
          opacity: 0;
          transition: opacity 0.15s;
        }
        .rgl-editing .react-grid-item > .react-resizable-handle {
          opacity: 0.7;
        }
        .rgl-editing .react-grid-item > .react-resizable-handle:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
