'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BoardForm from '@/components/board/BoardForm';

function WriteInner() {
  const searchParams = useSearchParams();
  const ch = searchParams.get('ch') ?? undefined;
  return <BoardForm mode='create' defaultChannelId={ch} />;
}

export default function BoardWritePage() {
  return (
    <Suspense fallback={null}>
      <WriteInner />
    </Suspense>
  );
}
