'use client';

import type { ReactNode } from 'react';

export function RecordPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-neutral-800 bg-[#0b0d0d] ${className}`}>{children}</section>;
}

export function RecordSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
      <h3 className="text-sm font-black text-white">{title}</h3>
      {action}
    </div>
  );
}

export function ThreeColumnRecordWorkspace({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-76px)] grid-cols-1 gap-4 bg-[#060707] p-4 text-white xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">{left}</aside>
      <main className="min-w-0 space-y-4">{center}</main>
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">{right}</aside>
    </div>
  );
}
