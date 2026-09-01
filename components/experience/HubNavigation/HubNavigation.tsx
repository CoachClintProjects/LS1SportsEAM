'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Archive, Award, Badge, BarChart3, Bell, Book, Bot, Boxes, Briefcase, Building, Calendar, CheckCircle, Clipboard, Command, Database, DollarSign, Eye, File, Folder, GitBranch, HeartPulse, History, Home, Key, Layers, Lightbulb, List, Lock, Map, Medal, Package, Plug, Receipt, Repeat, Rocket, Route, Search, Send, Server, Sparkles, Target, Timer, TrendingUp, Trophy, Upload, User, Users, Wallet, Wrench, Workflow } from 'lucide-react';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, NavigationItem } from './navigationDefinitions';

const icons: Record<string, React.ElementType> = { activity: Activity, archive: Archive, award: Award, badge: Badge, chart: BarChart3, bell: Bell, book: Book, bot: Bot, boxes: Boxes, briefcase: Briefcase, building: Building, calendar: Calendar, check: CheckCircle, clipboard: Clipboard, command: Command, database: Database, dollar: DollarSign, eye: Eye, file: File, folder: Folder, branch: GitBranch, heart: HeartPulse, history: History, home: Home, key: Key, layers: Layers, lightbulb: Lightbulb, list: List, lock: Lock, map: Map, medal: Medal, package: Package, plug: Plug, receipt: Receipt, repeat: Repeat, rocket: Rocket, route: Route, search: Search, send: Send, server: Server, shield: Lock, sparkles: Sparkles, target: Target, timer: Timer, trending: TrendingUp, trophy: Trophy, upload: Upload, user: User, users: Users, wallet: Wallet, wrench: Wrench, workflow: Workflow, milestone: Activity, down: TrendingUp, up: TrendingUp, cash: DollarSign, box: Boxes, id: User, cart: Package, reports: BarChart3, clock: Timer, alert: Bell };

function currentView() { if (typeof window === 'undefined') return ''; return new URLSearchParams(window.location.search).get('view') || ''; }

function NavigationItemView({ item, activeItem, onSelect, activeHubId }: { item: NavigationItem; activeItem: string; onSelect: (id: string) => void; activeHubId: string }) {
  const Icon = item.icon ? icons[item.icon] ?? File : File;
  const active = activeItem === item.id;
  const href = activeHubId === 'superuser' ? `/superuser?view=${encodeURIComponent(item.id)}` : (item.href ?? '#');
  const handleClick = () => {
    onSelect(item.id);
    if (activeHubId === 'superuser') window.setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0);
  };
  return <Link href={href} onClick={handleClick} aria-current={active ? 'page' : undefined} className={`group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors ${active ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}><Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#FA4616]' : 'text-neutral-600 group-hover:text-neutral-300'}`} strokeWidth={1.8} /><span className="min-w-0 flex-1 truncate">{item.label}</span>{active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />}</Link>;
}

export function HubNavigation() {
  const { activeHubId, currentHub } = useHub();
  const sections = getNavigation(activeHubId);
  const [activeItem, setActiveItem] = useState('');
  useEffect(() => { const sync = () => setActiveItem(currentView() || sections[0]?.items[0]?.id || ''); sync(); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, [activeHubId, sections]);
  return <nav className="flex h-full w-full flex-col bg-[#080909]">
    <div className="shrink-0 border-b border-neutral-800/80 px-5 py-5"><div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#FA4616]">{currentHub.codeLane}</div><div className="mt-1.5 truncate text-[15px] font-black text-white">{currentHub.name}</div><div className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-neutral-600">{currentHub.description}</div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{sections.map(section => <div key={section.id} className="mb-5"><div className="mb-1.5 px-3 text-[8px] font-bold tracking-[0.2em] text-neutral-700">{section.label}</div><div className="space-y-0.5">{section.items.map(item => <NavigationItemView key={item.id} item={item} onSelect={setActiveItem} activeItem={activeItem} activeHubId={activeHubId} />)}</div></div>)}</div>
    <div className="shrink-0 border-t border-neutral-800/80 px-4 py-3"><div className="flex items-center justify-between"><span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-neutral-700">LS1Sports EAM / EAP</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /></div></div>
  </nav>;
}
