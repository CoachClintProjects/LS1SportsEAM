'use client';

import SuperUserApiBoundary from '@/components/hubs/superuser/SuperUserApiBoundary';
import SuperUserActions from '@/components/hubs/superuser/SuperUserActions';

export default function SuperUserUploadPage() {
  return (
    <SuperUserApiBoundary>
      <div className="space-y-5">
        <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
          <div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">SUPERUSER · INGESTION</div>
          <h1 className="mt-2 text-3xl font-black text-white">Upload & ingestion</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">Controlled source ingestion with lineage. Competition source files are verification inputs only and never become LS1Sports truth by import alone.</p>
        </section>
        <SuperUserActions />
      </div>
    </SuperUserApiBoundary>
  );
}
