'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface GlobalShellProps {
  children: React.ReactNode;
  header: React.ReactNode;
  navigation: React.ReactNode;
}

export function GlobalShell({ children, header, navigation }: GlobalShellProps) {
  const pathname = usePathname();
  const isPublicSurface = pathname === '/' || pathname === '/login';
  const usesExperienceNavigation = pathname === '/athlete' || pathname.startsWith('/athlete/');

  if (isPublicSurface) {
    return (
      <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#070A09]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-[#050807] text-[#f8faf9] antialiased">
      <div className="w-full shrink-0">{header}</div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!usesExperienceNavigation && (
          <div className="h-full w-[272px] shrink-0 overflow-hidden border-r border-neutral-800/80 bg-[#080909]">
            {navigation}
          </div>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#050807]">
          <div className="min-h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
