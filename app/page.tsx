// =====================================================
// LS1Sports Root Entry
//
// Responsibility:
// - Provide the application root workspace.
// - Keep the root route intentionally minimal.
// - Global application chrome is supplied by layout/shell.
// =====================================================

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-76px)] w-full items-center justify-center bg-[#050807] px-6 py-10">
      {/* =================================================
          FOUNDATION CHECK
          ================================================= */}

      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FA4616]">
          LS1SPORTS
        </div>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] text-white">
          Enterprise Sports ERP
        </h1>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">
          Global application shell initialized. Hub Engine and operational
          workspaces will be mounted here.
        </p>
      </div>
    </main>
  );
}