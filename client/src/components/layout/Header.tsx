'use client';

import { useUiStore } from '@/store/ui.store';
import { formatDate } from '@/lib/utils';

export default function Header() {
  const { toggleSidebar } = useUiStore();
  const today = formatDate(new Date(), 'YY/MM/DD (ddd)');

  return (
    <header className="h-14 md:h-16 bg-white border-b border-gray-100 flex items-center px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-xs md:text-sm text-gray-400 hidden sm:block">{today}</span>
      </div>
    </header>
  );
}
