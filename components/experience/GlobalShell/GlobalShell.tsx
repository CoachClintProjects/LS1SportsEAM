'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Lexend_Deca } from 'next/font/google';
import { AdminRoleBar } from '@/components/hubs/admin/AdminRoleBar';
const workspaceFont = Lexend_Deca({subsets: ['latin'], weight: ['400','500','600','700'], display: 'swap'});

interface GlobalShellProps {
  children: React.ReactNode;
  header: React.ReactNode;
  navigation: React.ReactNode;
}

export function GlobalShell({ children, header, navigation }: GlobalShellProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const role = params.get("role") || "org_admin";
  const isPublicSurface = pathname === '/' || pathname === '/login';
  const isAdmin = pathname.startsWith('/admin');

  if (isPublicSurface) {
    return (
      <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#070A09]">
        {children}
      </div>
    );
  }

  return (
    <div style={isAdmin ? workspaceFont.style : undefined} className={`flex h-screen w-screen min-w-0 flex-col overflow-hidden antialiased ${isAdmin ? 'ls1-admin-shell bg-[#0A0C10] text-white' : 'bg-[#050807] text-[#f8faf9]'}`}>
      <div className="w-full shrink-0">{header}</div>
      {isAdmin && <AdminRoleBar />}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={`h-full w-[272px] shrink-0 overflow-hidden border-r ${isAdmin ? 'border-[#30363D] bg-[#161B22]' : 'border-neutral-800/80 bg-[#080909]'}`}>
          {navigation}
        </div>
        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${isAdmin ? 'bg-[#0A0C10]' : 'bg-[#050807]'}`}>
          <div key={isAdmin ? role : pathname} className="min-h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
