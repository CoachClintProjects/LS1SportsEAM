'use client';

// =====================================================
// LS1Sports Hub Navigation
//
// SECTION: RESPONSIBILITY
// - Render the active hub's navigation.
// - Maintain full-height contextual navigation.
// =====================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Archive,
  Award,
  Badge,
  BarChart3,
  Bell,
  Book,
  Bot,
  Boxes,
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  Clipboard,
  Command,
  Database,
  DollarSign,
  Eye,
  File,
  Folder,
  GitBranch,
  HeartPulse,
  History,
  Home,
  Key,
  Layers,
  Lightbulb,
  List,
  Lock,
  Map,
  Medal,
  Package,
  Plug,
  Receipt,
  Repeat,
  Rocket,
  Route,
  Search,
  Send,
  Server,
  Shield,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, NavigationItem } from './navigationDefinitions';

// =====================================================
// SECTION: ICON REGISTRY
// =====================================================

const icons: Record<string, React.ElementType> = {
  activity: Activity,
  archive: Archive,
  award: Award,
  badge: Badge,
  chart: BarChart3,
  bell: Bell,
  book: Book,
  bot: Bot,
  boxes: Boxes,
  briefcase: Briefcase,
  building: Building,
  calendar: Calendar,
  check: CheckCircle,
  clipboard: Clipboard,
  command: Command,
  database: Database,
  dollar: DollarSign,
  eye: Eye,
  file: File,
  folder: Folder,
  branch: GitBranch,
  heart: HeartPulse,
  history: History,
  home: Home,
  key: Key,
  layers: Layers,
  lightbulb: Lightbulb,
  list: List,
  lock: Lock,
  map: Map,
  medal: Medal,
  package: Package,
  plug: Plug,
  receipt: Receipt,
  repeat: Repeat,
  rocket: Rocket,
  route: Route,
  search: Search,
  send: Send,
  server: Server,
  shield: Shield,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  trending: TrendingUp,
  trophy: Trophy,
  upload: Upload,
  user: User,
  users: Users,
  wallet: Wallet,
  wrench: Wrench,
};

// =====================================================
// SECTION: NAV ITEM
// =====================================================

function NavigationItemView({
  item,
  activeItem,
  onSelect,
}: {
  item: NavigationItem;
  activeItem: string;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon ? icons[item.icon] ?? File : File;
  const active = activeItem === item.id;

  return (
    <Link
      href={item.href ?? '#'}
      onClick={() => onSelect(item.id)}
      className={`group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors ${
        active
          ? 'bg-[#FA4616]/10 text-white'
          : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active
            ? 'text-[#FA4616]'
            : 'text-neutral-600 group-hover:text-neutral-300'
        }`}
        strokeWidth={1.8}
      />

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />
      )}
    </Link>
  );
}

// =====================================================
// SECTION: HUB NAVIGATION
// =====================================================

export function HubNavigation() {
  const { activeHubId, currentHub } = useHub();
  const sections = getNavigation(activeHubId);

  const [activeItem, setActiveItem] = useState(
    sections[0]?.items[0]?.id ?? '',
  );

  // ===================================================
  // SECTION: RESET ACTIVE ITEM WHEN HUB CHANGES
  // ===================================================

  useEffect(() => {
    setActiveItem(sections[0]?.items[0]?.id ?? '');
  }, [activeHubId, sections]);

  return (
    <nav className="flex h-full w-full flex-col bg-[#080909]">
      {/* =================================================
          SECTION: HUB CONTEXT
          ================================================= */}

      <div className="shrink-0 border-b border-neutral-800/80 px-5 py-5">
        <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#FA4616]">
          {currentHub.codeLane}
        </div>

        <div className="mt-1.5 truncate text-[15px] font-black text-white">
          {currentHub.name}
        </div>

        <div className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-neutral-600">
          {currentHub.description}
        </div>
      </div>

      {/* =================================================
          SECTION: NAVIGATION BODY
          ================================================= */}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            <div className="mb-1.5 px-3 text-[8px] font-bold tracking-[0.2em] text-neutral-700">
              {section.label}
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavigationItemView
                  key={item.id}
                  item={item}
                  activeItem={activeItem}
                  onSelect={setActiveItem}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* =================================================
          SECTION: FOOTER
          ================================================= */}

      <div className="shrink-0 border-t border-neutral-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
            LS1Sports EAM / EAP
          </span>

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>
    </nav>
  );
}
