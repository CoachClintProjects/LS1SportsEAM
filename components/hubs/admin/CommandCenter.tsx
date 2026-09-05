'use client';

// =============================================================================
// COMMAND CENTER - Admin Dashboard
// =============================================================================

export function CommandCenter() {
  return (
    <div className="text-white p-6">
      <h1 className="text-3xl font-black">Command Center</h1>
      <p className="mt-2 text-neutral-400">Dashboard overview will appear here.</p>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="text-sm text-neutral-500">Active Swimmers</div>
          <div className="text-2xl font-bold text-white">247</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="text-sm text-neutral-500">Upcoming Meets</div>
          <div className="text-2xl font-bold text-white">3</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="text-sm text-neutral-500">Open Invoices</div>
          <div className="text-2xl font-bold text-white">12</div>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;