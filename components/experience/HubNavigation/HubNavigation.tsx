'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useHub } from '@/components/hubs/HubContext';
import {
  getNavigation,
  getSwitcherConfig,
  NavigationSection,
  SwitcherConfig,
} from './navigationDefinitions';

const FALLBACKS: Record<string, NavigationSection[]> = {
  superuser: [
    {
      id: 'superuser-command',
      label: 'COMMAND',
      items: [
        { id: 'command-center', label: 'Command Center', href: '/superuser' },
        { id: 'deployments', label: 'Release Certification', href: '/superuser?view=deployments' },
      ],
    },
    {
      id: 'superuser-team-engine',
      label: 'TEAM ENGINE',
      items: [
        { id: 'team-engine', label: 'Team Engine', href: '/superuser?view=team-engine' },
        { id: 'organizations', label: 'Organizations', href: '/superuser?view=organizations' },
        { id: 'people', label: 'People', href: '/superuser?view=people' },
        { id: 'programs', label: 'Programs', href: '/superuser?view=programs' },
        { id: 'seasons', label: 'Seasons', href: '/superuser?view=seasons' },
        { id: 'teams', label: 'Teams', href: '/superuser?view=teams' },
        { id: 'memberships', label: 'Memberships', href: '/superuser?view=memberships' },
        { id: 'rosters', label: 'Rosters', href: '/superuser?view=rosters' },
        { id: 'registrar', label: 'Registrar', href: '/superuser?view=registrar' },
      ],
    },
    {
      id: 'superuser-security',
      label: 'IDENTITY & SECURITY',
      items: [
        { id: 'identity', label: 'Identity', href: '/superuser?view=identity' },
        { id: 'roles', label: 'Roles', href: '/superuser?view=roles' },
        { id: 'permissions', label: 'Permissions', href: '/superuser?view=permissions' },
        { id: 'raci', label: 'RACI', href: '/superuser?view=raci' },
        { id: 'delegation', label: 'Delegation', href: '/superuser?view=delegation' },
        { id: 'sod', label: 'Segregation of Duties', href: '/superuser?view=sod' },
        { id: 'privileged-access', label: 'Privileged Access', href: '/superuser?view=privileged-access' },
      ],
    },
    {
      id: 'superuser-governance',
      label: 'GOVERNANCE',
      items: [
        { id: 'compliance', label: 'Compliance', href: '/superuser?view=compliance' },
        { id: 'data-governance', label: 'Data Governance', href: '/superuser?view=data-governance' },
        { id: 'privacy', label: 'Privacy', href: '/superuser?view=privacy' },
        { id: 'retention', label: 'Retention', href: '/superuser?view=retention' },
        { id: 'audit', label: 'Audit', href: '/superuser?view=audit' },
      ],
    },
    {
      id: 'superuser-finance',
      label: 'FINANCE & ACCOUNTING',
      items: [
        { id: 'financial-overview', label: 'Financial Overview', href: '/superuser?view=financial-overview' },
        { id: 'general-ledger', label: 'General Ledger', href: '/superuser?view=general-ledger' },
        { id: 'receivables', label: 'Receivables', href: '/superuser?view=receivables' },
        { id: 'payables', label: 'Payables', href: '/superuser?view=payables' },
        { id: 'budgets', label: 'Budgets', href: '/superuser?view=budgets' },
        { id: 'cash-flow', label: 'Cash Flow', href: '/superuser?view=cash-flow' },
      ],
    },
    {
      id: 'superuser-operations',
      label: 'OPERATIONS',
      items: [
        { id: 'procurement', label: 'Procurement', href: '/superuser?view=procurement' },
        { id: 'workflow', label: 'Workflow', href: '/superuser?view=workflow' },
        { id: 'rules', label: 'Rules', href: '/superuser?view=rules' },
        { id: 'integrations', label: 'Integrations', href: '/superuser?view=integrations' },
        { id: 'imports', label: 'Imports', href: '/superuser?view=imports' },
        { id: 'reporting', label: 'Reporting', href: '/superuser?view=reporting' },
        { id: 'facilities', label: 'Facilities', href: '/superuser?view=facilities' },
        { id: 'assets', label: 'Assets', href: '/superuser?view=assets' },
        { id: 'maintenance', label: 'Maintenance', href: '/superuser?view=maintenance' },
      ],
    },
    {
      id: 'superuser-intelligence',
      label: 'INTELLIGENCE',
      items: [
        { id: 'agents', label: 'AI Agents', href: '/superuser?view=agents' },
        { id: 'automation', label: 'Automation', href: '/superuser?view=automation' },
        { id: 'alerts', label: 'Alerts', href: '/superuser?view=alerts' },
        { id: 'insights', label: 'Insights', href: '/superuser?view=insights' },
        { id: 'athletes', label: 'Athlete Intelligence', href: '/superuser?view=athletes' },
      ],
    },
    {
      id: 'superuser-platform',
      label: 'PLATFORM',
      items: [
        { id: 'system-health', label: 'System Health', href: '/superuser?view=system-health' },
        { id: 'platform', label: 'Platform', href: '/superuser?view=platform' },
        { id: 'settings', label: 'Settings', href: '/superuser?view=settings' },
        { id: 'knowledge', label: 'Knowledge', href: '/superuser?view=knowledge' },
      ],
    },
    {
      id: 'superuser-clients',
      label: 'CLIENT OPERATIONS',
      items: [
        { id: 'all-clients', label: 'All Clients', href: '/superuser?view=all-clients' },
        { id: 'new-client', label: 'New Client', href: '/superuser?view=new-client' },
        { id: 'onboarding', label: 'Client Onboarding', href: '/superuser/onboarding' },
        { id: 'onboarding-queue', label: 'Onboarding Queue', href: '/superuser?view=onboarding-queue' },
        { id: 'client-exceptions', label: 'Client Exceptions', href: '/superuser?view=client-exceptions' },
      ],
    },
  ],
  athlete: [
    {
      id: 'athlete-main',
      label: 'ATHLETE',
      items: [{ id: 'overview', label: 'Overview', href: '/athlete' }],
    },
  ],
  parent: [
    {
      id: 'parent-main',
      label: 'PARENT',
      items: [
        { id: 'household', label: 'Household Overview', href: '/parent' },
        { id: 'schedule', label: 'Schedules', href: '/parent?view=schedule' },
      ],
    },
  ],
  admin: [
    {
      id: 'admin-main',
      label: 'ADMIN',
      items: [{ id: 'command-center', label: 'Command Center', href: '/admin' }],
    },
  ],
};

const EMPTY_SWITCHER: SwitcherConfig = {
  type: null,
  displayStyle: 'none',
  defaultOption: '',
  options: [],
};

function getQueryKey(hubId: string) {
  if (hubId === 'athlete') return 'age';
  if (hubId === 'admin') return 'role';
  if (hubId === 'official') return 'official_role';
  return 'switcher';
}

function isItemActive(href: string | undefined, pathname: string, search: string) {
  if (!href) return false;

  const origin = typeof window === 'undefined' ? 'https://ls1sports.local' : window.location.origin;
  const target = new URL(href, origin);
  if (target.pathname !== pathname) return false;

  const current = new URLSearchParams(search);
  const targetView = target.searchParams.get('view');
  if (targetView) return current.get('view') === targetView;

  if (target.search) {
    for (const [key, value] of target.searchParams.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }

  return !current.get('view');
}

function navigationEventDetail(hubId: string, itemId: string, href: string) {
  const origin = typeof window === 'undefined' ? 'https://ls1sports.local' : window.location.origin;
  const target = new URL(href, origin);
  return {
    hubId,
    itemId,
    href,
    view: target.searchParams.get('view') || null,
  };
}

export function HubNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const router = useRouter();
  const { activeHubId, currentHub } = useHub();

  const fallback = useMemo(
    () => FALLBACKS[activeHubId] || [{ id: `${activeHubId}-main`, label: activeHubId.toUpperCase(), items: [] }],
    [activeHubId],
  );

  const [sections, setSections] = useState<NavigationSection[]>(fallback);
  const [switcherConfig, setSwitcherConfig] = useState<SwitcherConfig>(EMPTY_SWITCHER);
  const [switcherValue, setSwitcherValue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const loadedHubRef = useRef<string | null>(null);

  useEffect(() => {
    loadedHubRef.current = null;
    setSections(fallback);
  }, [activeHubId, fallback]);

  useEffect(() => {
    let cancelled = false;

    async function initializeHub() {
      const config = await getSwitcherConfig(activeHubId);
      if (cancelled) return;
      setSwitcherConfig(config);

      const queryKey = getQueryKey(activeHubId);
      const urlValue = searchParams.get(queryKey);
      const nextValue =
        urlValue && config.options.some(option => option.id === urlValue)
          ? urlValue
          : config.defaultOption || config.options[0]?.id || '';
      setSwitcherValue(nextValue);
    }

    void initializeHub();
    return () => {
      cancelled = true;
    };
  }, [activeHubId, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadNavigation() {
      setRefreshing(true);
      try {
        const result = await getNavigation(activeHubId, switcherValue);
        if (!cancelled && result.length) {
          setSections(result);
          loadedHubRef.current = activeHubId;
        } else if (!cancelled && loadedHubRef.current !== activeHubId) {
          setSections(fallback);
        }
      } catch (error) {
        console.error('[HubNavigation] navigation load failed', { activeHubId, error });
        if (!cancelled && loadedHubRef.current !== activeHubId) setSections(fallback);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    void loadNavigation();
    return () => {
      cancelled = true;
    };
  }, [activeHubId, fallback, switcherValue]);

  function handleSwitch(value: string) {
    setSwitcherValue(value);

    if (typeof window === 'undefined') return;

    const queryKey = getQueryKey(activeHubId);
    const query = new URLSearchParams(search);
    query.set(queryKey, value);

    if (activeHubId === 'athlete' || activeHubId === 'admin') {
      query.delete('switcher');
    }

    const href = `${pathname}?${query.toString()}`;
    window.dispatchEvent(
      new CustomEvent('ls1sports:switcher', {
        detail: { hubId: activeHubId, value },
      }),
    );
    router.replace(href, { scroll: false });
  }

  const activeItem = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (isItemActive(item.href, pathname, search)) return item.id;
      }
    }
    return '';
  }, [pathname, search, sections]);

  function hrefFor(itemHref?: string) {
    if (!itemHref) return '#';
    const origin = typeof window === 'undefined' ? 'https://ls1sports.local' : window.location.origin;
    const target = new URL(itemHref, origin);

    if (activeHubId === 'athlete' && switcherValue) target.searchParams.set('age', switcherValue);
    if (activeHubId === 'admin' && switcherValue) target.searchParams.set('role', switcherValue);
    if (activeHubId === 'official' && switcherValue) target.searchParams.set('official_role', switcherValue);

    return `${target.pathname}${target.search}`;
  }

  const showSwitcher = switcherConfig.displayStyle !== 'none' && switcherConfig.options.length > 0;
  const switcherLabel = switcherConfig.type === 'age'
    ? 'Demonstrate athlete experience'
    : switcherConfig.type === 'role'
      ? 'Select admin role'
      : switcherConfig.type === 'official_role'
        ? 'Select official role'
        : 'Select option';

  return (
    <nav className="flex h-full w-full flex-col bg-[#080909]">
      <div className="shrink-0 border-b border-neutral-800/80 px-5 py-5">
        <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#FA4616]">{currentHub.codeLane}</div>
        <div className="mt-1.5 truncate text-[15px] font-black text-white">{currentHub.name}</div>
        <div className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-neutral-600">{currentHub.description}</div>

        {showSwitcher && (
          <div className="mt-5 rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[.18em] text-[#FA4616]">
              <span>{switcherLabel}</span>
              {refreshing && <span className="text-neutral-700">updating</span>}
            </div>
            <div className="space-y-1">
              {switcherConfig.options.map(option => (
                <label key={option.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] ${switcherValue === option.id ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  <input type="radio" name={`${activeHubId}-switcher`} value={option.id} checked={switcherValue === option.id} onChange={() => handleSwitch(option.id)} className="h-3 w-3 accent-[#FA4616]" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map(section => (
          <div key={section.id} className="mb-5 last:mb-0">
            <div className="mb-2 px-2 text-[7px] font-black uppercase tracking-[.24em] text-neutral-700">{section.label}</div>
            <div className="space-y-1">
              {section.items.map(item => {
                const href = hrefFor(item.href);
                const active = item.id === activeItem;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    scroll={false}
                    onClick={() => {
                      if (typeof window === 'undefined' || !item.href) return;
                      window.dispatchEvent(new CustomEvent('ls1sports:navigation', { detail: navigationEventDetail(activeHubId, item.id, href) }));
                    }}
                    className={`block rounded-lg px-3 py-2 text-[11px] transition ${active ? 'bg-[#25100a] font-black text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}
                  >
                    <span className="flex items-center justify-between gap-2"><span>{item.label}</span>{active && <span className="h-1.5 w-1.5 rounded-full bg-[#FA4616]" />}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
