'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Grid2X2,
  Search,
  Sparkles,
  Upload,
  UserCircle,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { HubType, hubs, useHub } from '@/components/hubs/HubContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function getHubRoute(hubId: HubType): string {
  switch (hubId) {
    case 'superuser': return '/superuser';
    case 'athlete': return '/athlete';
    case 'coach': return '/coach';
    case 'admin': return '/admin';
    case 'parent': return '/parent';
    case 'official': return '/official';
    case 'scout': return '/scout';
    default: return '/superuser';
  }
}

function HeaderIconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-transparent text-neutral-400 transition-colors duration-150 hover:border-neutral-800 hover:bg-neutral-900 hover:text-white"
    >
      {children}
    </button>
  );
}

export function GlobalHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeHubId, currentHub, setActiveHub } = useHub();
  const [hubMenuOpen, setHubMenuOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const hubMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (hubMenuRef.current && !hubMenuRef.current.contains(event.target as Node)) {
        setHubMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => setHubMenuOpen(false), [pathname]);

  function handleHubSwitch(hubId: HubType) {
    setActiveHub(hubId);
    setHubMenuOpen(false);
    router.push(getHubRoute(hubId));
  }

  async function handleBrandExit() {
    if (exiting) return;
    setExiting(true);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('[GlobalHeader] sign out failed', error);
    } finally {
      router.replace('/');
      router.refresh();
      setExiting(false);
    }
  }

  return (
    <header className="flex h-[76px] w-full shrink-0 items-center border-b border-neutral-800/80 bg-[#080909]">
      <div className="flex h-full w-full min-w-0 items-center px-5 lg:px-7">
        <div className="flex w-[275px] shrink-0 items-center">
          <button
            type="button"
            onClick={() => void handleBrandExit()}
            disabled={exiting}
            aria-label="Exit LS1Sports and return to corporate site"
            title="Exit LS1Sports"
            className="flex flex-col items-start justify-center disabled:opacity-60"
          >
            <span className="text-[22px] font-black leading-none tracking-[-0.04em] text-white">
              LS1<span className="text-[#FA4616]">Sports</span>
            </span>
            <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
              {exiting ? 'Signing out…' : 'Sports ERP Intelligence'}
            </span>
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-6">
          <div className="w-full max-w-[780px]">
            <div className="flex h-11 w-full items-center rounded-lg border border-neutral-800 bg-[#121414] px-4 transition-colors duration-150 focus-within:border-neutral-700">
              <Search className="mr-3 h-[17px] w-[17px] shrink-0 text-neutral-500" strokeWidth={1.8} />
              <input
                type="search"
                aria-label="Search LS1Sports"
                placeholder="Search LS1Sports..."
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-600"
              />
              <span className="hidden rounded border border-neutral-800 bg-[#0b0d0d] px-2 py-1 font-mono text-[9px] text-neutral-600 md:block">/</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <HeaderIconButton label="Notifications"><Bell className="h-[18px] w-[18px]" strokeWidth={1.8} /></HeaderIconButton>
          <HeaderIconButton label="What's New"><Sparkles className="h-[18px] w-[18px]" strokeWidth={1.8} /></HeaderIconButton>
          <HeaderIconButton label="Upload"><Upload className="h-[18px] w-[18px]" strokeWidth={1.8} /></HeaderIconButton>
          <HeaderIconButton label="Help"><CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.8} /></HeaderIconButton>

          <div className="mx-2 h-8 w-px bg-neutral-800" />

          <div ref={hubMenuRef} className="relative">
            <button
              type="button"
              aria-label="Switch Hub"
              aria-haspopup="menu"
              aria-expanded={hubMenuOpen}
              onClick={() => setHubMenuOpen((open) => !open)}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 transition-all duration-150 ${
                hubMenuOpen
                  ? 'border-neutral-700 bg-neutral-900'
                  : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900'
              }`}
            >
              <Grid2X2 className="h-[17px] w-[17px] text-neutral-400" strokeWidth={1.8} />
              <span className="hidden max-w-[120px] truncate text-[12px] font-semibold text-neutral-200 xl:block">{currentHub.name}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-150 ${hubMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {hubMenuOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-[100] w-[280px] overflow-hidden rounded-xl border border-neutral-800 bg-[#0b0d0d] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                <div className="border-b border-neutral-800 px-3 pb-3 pt-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">Switch Workspace</div>
                  <div className="mt-1 text-[12px] font-semibold text-neutral-300">Current: {currentHub.name}</div>
                </div>
                <div className="pt-1">
                  {hubs.map((hub) => {
                    const active = hub.id === activeHubId;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleHubSwitch(hub.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-150 ${
                          active ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-[9px] font-bold ${
                          active
                            ? 'border-[#FA4616]/50 bg-[#FA4616]/10 text-[#FA4616]'
                            : 'border-neutral-800 bg-[#111313] text-neutral-600'
                        }`}>{hub.codeLane.replace('LANE ', '')}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold">{hub.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-neutral-600">{hub.description}</span>
                        </span>
                        {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Profile"
            title="Profile"
            className="ml-2 flex h-10 items-center gap-2 rounded-lg border border-transparent px-2 transition-colors duration-150 hover:border-neutral-800 hover:bg-neutral-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FA4616]/50 bg-[#171a1a]">
              <UserCircle className="h-[18px] w-[18px] text-neutral-300" strokeWidth={1.8} />
            </span>
            <span className="hidden text-xs font-semibold text-neutral-300 2xl:block">Clint</span>
          </button>
        </div>
      </div>
    </header>
  );
}
