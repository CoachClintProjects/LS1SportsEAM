'use client';
// =====================================================
// LS1Sports Global Shell
// =====================================================
// SECTION: RESPONSIBILITY
// - Own the complete browser viewport.
// - Establish the permanent enterprise application frame.
// - Reserve dedicated regions for the global header,
//   contextual navigation, and primary workspace.
// - Preserve full-width and full-height layout behavior.
// - Provide the HubSpot-inspired EAM/EAP application frame.
// =====================================================
// SECTION: NON-RESPONSIBILITIES
// - No database calls.
// - No business logic.
// - No RLS logic.
// - No hub-specific workspace logic.
// - No financial calculations.
// - No competition calculations.
// =====================================================
// SECTION: LAYOUT CONTRACT
// GLOBAL SHELL
//   ↓
// GLOBAL HEADER
//   ↓
// APPLICATION BODY
//   ├── CONTEXTUAL NAVIGATION
//   └── PRIMARY WORKSPACE
// =====================================================
import React from 'react';
// =====================================================
// SECTION: COMPONENT CONTRACT
// =====================================================
interface GlobalShellProps {
  children: React.ReactNode;
  header: React.ReactNode;
  navigation: React.ReactNode;
}
// =====================================================
// SECTION: GLOBAL SHELL
// =====================================================
export function GlobalShell({
  children,
  header,
  navigation,
}: GlobalShellProps) {
  return (
  <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-[#050807] text-[#f8faf9] antialiased">
    {/* =================================================
        SECTION: GLOBAL HEADER
        ================================================= */}
    <div className="w-full shrink-0">
      {header}
    </div>
    {/* =================================================
        SECTION: APPLICATION BODY
        ================================================= */}
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* =================================================
          SECTION: CONTEXTUAL NAVIGATION
          ================================================= */}
      <div className="h-full w-[272px] shrink-0 overflow-hidden border-r border-neutral-800/80 bg-[#080909]">
        {navigation}
      </div>
      {/* =================================================
          SECTION: PRIMARY WORKSPACE
          ================================================= */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#050807]">
        <div className="min-h-full w-full">
          {children}
        </div>
      </main>
    </div>
  </div>
);
}