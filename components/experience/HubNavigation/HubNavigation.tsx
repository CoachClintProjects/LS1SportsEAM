'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, Archive, Award, Badge, BarChart3, Bell, Book, Bot, Boxes,
  Briefcase, Building, Calendar, CheckCircle, Clipboard, Command, Database,
  DollarSign, Eye, File, GitBranch, HeartPulse, History, Home, Key, Layers,
  Lightbulb, List, Lock, Map, Medal, Package, Plug, Receipt, Repeat, Rocket,
  Route, Search, Send, Server, Settings, Sparkles, Target, Timer, TrendingUp,
  Upload, User, UserPlus, Users, Wallet, Wrench, Workflow, Shield, Gavel, Flag,
  Trophy, UserCheck, Warehouse, LayoutDashboard, Building2, FolderTree,
  Calendar as CalendarIcon, FileText, CreditCard, Receipt as ReceiptIcon,
  ChevronDown, ChevronRight, CheckCircle2, X, Menu, RefreshCw, Bell as BellIcon,
  ClipboardCheck, Users as UsersIcon, DollarSign as DollarIcon, BarChart3 as ChartIcon
} from 'lucide-react';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, NavigationItem, NavigationSection } from './navigationDefinitions';

// =============================================================================
// ICON MAP - Simplified with NO DUPLICATES
// =============================================================================

const icons: Record<string, React.ElementType> = {
  activity: Activity,
  archive: Archive,
  award: Award,
  badge: Badge,
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
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  trending: TrendingUp,
  upload: Upload,
  user: User,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
  wrench: Wrench,
  workflow: Workflow,
  cash: DollarSign,
  cart: Package,
  reports: BarChart3,
  clock: Timer,
  alert: Bell,
  'layout-dashboard': LayoutDashboard,
  'building2': Building2,
  'folder-tree': FolderTree,
  'calendar-days': CalendarIcon,
  'file-text': FileText,
  'credit-card': CreditCard,
  'receipt': ReceiptIcon,
  'user-check': UserCheck,
  'bar-chart-3': ChartIcon,
  'clipboard-check': ClipboardCheck,
  'dollar-sign': DollarIcon,
  'warehouse': Warehouse,
  'gavel': Gavel,
  'flag': Flag,
  'trophy': Trophy
};

// =============================================================================
// SWITCHER CONFIGURATION
// =============================================================================

interface SwitcherOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

interface SwitcherConfig {
  type: 'age' | 'role' | 'official_role' | 'scout' | null;
  options: SwitcherOption[];
  defaultOption: string;
}

// =============================================================================
// SWITCHER DATA - No duplicate IDs
// =============================================================================

const switcherConfigs: Record<string, SwitcherConfig> = {
  athlete: {
    type: 'age',
    defaultOption: '5-8',
    options: [
      { id: '5-8', label: 'Foundation · Ages 5–8' },
      { id: '9-11', label: 'Development · Ages 9–11' },
      { id: '12-14', label: 'Growth · Ages 12–14' },
      { id: '15-17', label: 'Performance · Ages 15–17' },
      { id: '18+', label: 'Elite · 18+' }
    ]
  },
  admin: {
    type: 'role',
    defaultOption: 'org_admin',
    options: [
      { id: 'org_admin', label: 'Organization Admin', icon: 'shield' },
      { id: 'team_manager', label: 'Team Manager', icon: 'users' },
      { id: 'registrar', label: 'Registrar', icon: 'user-check' },
      { id: 'treasurer', label: 'Treasurer', icon: 'dollar-sign' },
      { id: 'operations', label: 'Operations', icon: 'warehouse' },
      { id: 'compliance', label: 'Compliance', icon: 'clipboard-check' },
      { id: 'reporting', label: 'Reporting', icon: 'bar-chart-3' }
    ]
  },
  official: {
    type: 'official_role',
    defaultOption: 'official',
    options: [
      { id: 'official', label: 'Official', icon: 'shield' },
      { id: 'meet_referee', label: 'Meet Referee', icon: 'gavel' },
      { id: 'starter', label: 'Starter', icon: 'flag' },
      { id: 'stroke_turn', label: 'Stroke & Turn', icon: 'eye' },
      { id: 'judge', label: 'Judge', icon: 'clipboard' },
      { id: 'meet_director', label: 'Meet Director', icon: 'trophy' }
    ]
  },
  scout: {
    type: 'scout',
    defaultOption: '',
    options: []
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function currentView() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('view') || '';
}

function currentSwitcherValue(hubId: string) {
  if (typeof window === 'undefined') {
    const config = switcherConfigs[hubId];
    return config?.defaultOption || '';
  }
  const param = new URLSearchParams(window.location.search).get('switcher');
  if (param) return param;
  const config = switcherConfigs[hubId];
  return config?.defaultOption || '';
}

// =============================================================================
// NAVIGATION ITEM VIEW
// =============================================================================

function NavigationItemView({
  item,
  activeItem,
  onSelect,
  activeHubId
}: {
  item: NavigationItem;
  activeItem: string;
  onSelect: (id: string) => void;
  activeHubId: string;
}) {
  const router = useRouter();
  const Icon = item.icon ? icons[item.icon] ?? File : File;
  const active = activeItem === item.id;

  const classes = `
    group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors
    ${active ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}
  `;

  const content = (
    <>
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#FA4616]' : 'text-neutral-600 group-hover:text-neutral-300'}`} strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />}
    </>
  );

  const select = () => {
    onSelect(item.id);
    if (['superuser', 'athlete', 'parent'].includes(activeHubId)) {
      const next = new URLSearchParams(window.location.search);
      next.set('view', item.id);
      const basePath = activeHubId === 'superuser' ? '/superuser' : activeHubId === 'athlete' ? '/athlete' : '/parent';
      window.dispatchEvent(new CustomEvent('ls1sports:navigation', { detail: item.id }));
      router.push(`${basePath}?${next.toString()}`, { scroll: false });
    }
  };

  if (['superuser', 'athlete', 'parent'].includes(activeHubId)) {
    return (
      <button type="button" onClick={select} aria-current={active ? 'page' : undefined} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href ?? '#'} onClick={() => onSelect(item.id)} aria-current={active ? 'page' : undefined} className={classes}>
      {content}
    </Link>
  );
}

// =============================================================================
// SWITCHER RENDERER
// =============================================================================

function SwitcherRenderer({
  hubId,
  switcherValue,
  onSwitch
}: {
  hubId: string;
  switcherValue: string;
  onSwitch: (value: string) => void;
}) {
  const config = switcherConfigs[hubId];
  if (!config || config.type === 'scout' || config.options.length === 0) return null;

  const [isOpen, setIsOpen] = useState(false);

  // Age switcher (Athlete Hub) - radio buttons style
  if (config.type === 'age') {
    return (
      <div className="mt-5 rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
        <div className="mb-2 text-[8px] font-black uppercase tracking-[.18em] text-[#FA4616]">
          Demonstrate athlete experience
        </div>
        <div className="space-y-1">
          {config.options.map(option => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] ${
                switcherValue === option.id ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="switcher"
                checked={switcherValue === option.id}
                onChange={() => onSwitch(option.id)}
                className="accent-[#FA4616]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 text-[8px] leading-3 text-neutral-700">
          The selector changes the entire workspace experience, not the underlying Athlete Passport.
        </div>
      </div>
    );
  }

  // Role switcher (Admin Hub & Official Hub) - dropdown style
  if (config.type === 'role' || config.type === 'official_role') {
    const currentOption = config.options.find(o => o.id === switcherValue) || config.options[0];
    const Icon = currentOption?.icon ? icons[currentOption.icon] || Shield : Shield;

    return (
      <div className="mt-5">
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-[#0d1010] px-3 py-2.5 text-sm text-white hover:border-neutral-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              {currentOption?.icon && (
                <span className="text-[#FA4616]">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <span className="truncate">{currentOption?.label || 'Select Role'}</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-neutral-800 bg-[#0d1010] shadow-xl">
              {config.options.map(option => {
                const OptionIcon = option.icon ? icons[option.icon] || Shield : Shield;
                const isActive = switcherValue === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      onSwitch(option.id);
                      setIsOpen(false);
                    }}
                    className={`
                      flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors
                      ${isActive ? 'bg-[#FA4616]/10 text-[#FA4616]' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
                    `}
                  >
                    <span className={isActive ? 'text-[#FA4616]' : 'text-neutral-500'}>
                      <OptionIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium">{option.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// =============================================================================
// MAIN COMPONENT: HubNavigation
// =============================================================================

export function HubNavigation() {
  const router = useRouter();
  const { activeHubId, currentHub } = useHub();
  const [switcherValue, setSwitcherValue] = useState('');
  const [activeItem, setActiveItem] = useState('');

  // Get navigation sections
  const sections = useMemo(() => {
    let result: NavigationSection[] = getNavigation(activeHubId);

    // Deduplicate items within each section
    return result.map(section => ({
      ...section,
      items: section.items.filter((item, index, self) =>
        index === self.findIndex(i => i.id === item.id)
      )
    })).filter(section => section.items.length > 0);
  }, [activeHubId]);

  // Get switcher value
  useEffect(() => {
    const value = currentSwitcherValue(activeHubId);
    setSwitcherValue(value);
  }, [activeHubId]);

  // Sync active item
  useEffect(() => {
    const sync = () => {
      setActiveItem(currentView() || sections[0]?.items[0]?.id || '');
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('ls1sports:navigation', (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next) setActiveItem(next);
    });
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('ls1sports:navigation', () => {});
    };
  }, [sections]);

  // Handle switcher change
  const handleSwitch = (value: string) => {
    setSwitcherValue(value);
    const next = new URLSearchParams(window.location.search);
    next.set('switcher', value);
    if (activeHubId === 'admin') {
      window.dispatchEvent(new CustomEvent('ls1sports:role-change', { detail: value }));
    }
    router.push(`${window.location.pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <nav className="flex h-full w-full flex-col bg-[#080909]">
      {/* Hub Header */}
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

        {/* Render Switcher based on hub */}
        <SwitcherRenderer
          hubId={activeHubId}
          switcherValue={switcherValue}
          onSwitch={handleSwitch}
        />
      </div>

      {/* Navigation */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map(section => (
          <div key={section.id} className="mb-5">
            <div className="mb-1.5 px-3 text-[8px] font-bold tracking-[0.2em] text-neutral-700">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavigationItemView
                  key={item.id}
                  item={item}
                  onSelect={setActiveItem}
                  activeItem={activeItem}
                  activeHubId={activeHubId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-neutral-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
            LS1SPORTS OS
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>
    </nav>
  );
}

export default HubNavigation;