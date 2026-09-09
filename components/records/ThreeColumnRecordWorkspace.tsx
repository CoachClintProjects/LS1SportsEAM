'use client';

import type { ReactNode } from 'react';

export function RecordPanel({ children, className = '', tone = 'default' }: { children: ReactNode; className?: string; tone?: 'default'|'brand'|'info'|'success'|'warning'|'ai' }) {
  const accent = {
    default: 'border-neutral-800',
    brand: 'border-[#FA4616]/35',
    info: 'border-[color:var(--ls1-info)]/35',
    success: 'border-[color:var(--ls1-success)]/35',
    warning: 'border-[color:var(--ls1-warning)]/35',
    ai: 'border-[color:var(--ls1-ai)]/35',
  }[tone];
  return <section className={`overflow-hidden rounded-2xl border ${accent} bg-[color:var(--ls1-surface-1)] shadow-[0_18px_50px_rgba(0,0,0,.18)] ${className}`}>{children}</section>;
}

export function RecordSectionHeader({ title, action, eyebrow }: { title: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ls1-border)] bg-[color:var(--ls1-surface-2)]/70 px-4 py-3.5">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-black uppercase tracking-[.16em] text-[#FA4616]">{eyebrow}</div>}
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function ThreeColumnRecordWorkspace({ left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-76px)] grid-cols-1 gap-5 bg-[radial-gradient(circle_at_top_right,rgba(77,156,255,.07),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(250,70,22,.06),transparent_24%),var(--ls1-bg)] p-4 text-white lg:p-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">{left}</aside>
      <main className="min-w-0 space-y-4">{center}</main>
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">{right}</aside>
    </div>
  );
}
