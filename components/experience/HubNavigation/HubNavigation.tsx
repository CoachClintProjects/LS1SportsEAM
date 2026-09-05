'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
      id: 'superuser-main',
      label: 'SUPERUSER',
      items: [
        { id: 'command-center', label: 'Command Center', href: '/superuser' },
        { id: 'onboarding', label: 'Client Onboarding', href: '/superuser/onboarding' },
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

function currentLocation() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
}

function isItemActive(href: string | undefined, pathname: string) {
  if (!href) return false;
  if (typeof window === 'undefined') return pathname === href;

  const target = new URL(href, window.location.origin);
  if (target.pathname !== window.location.pathname) return false;

  const targetView = target.searchParams.get('view');
  if (targetView) return new URLSearchParams(window.location.search).get('view') === targetView;

  return target.search === '' || target.search === window.location.search;
}

export function HubNavigation() {
  const pathname = usePathname();
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

  useEffect(() => {
    let cancelled = false;

    async function initializeHub() {
      const config = await getSwitcherConfig(activeHubId);
      if (cancelled) return;

      setSwitcherConfig(config);

      const queryKey = getQueryKey(activeHubId);
      const urlValue =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get(queryKey)
          : null;
      const nextValue =
        urlValue && config.options.some((option) => option.id === urlValue)
          ? urlValue
          : config.defaultOption || config.options[0]?.id || '';

      setSwitcherValue(nextValue);
      setSections(fallback);
    }

    void initializeHub();
    return () => {
      cancelled = true;
    };
  }, [activeHubId, fallback]);

  useEffect(() => {
    let cancelled = false;

    async function loadNavigation() {
      setRefreshing(true);
      try {
        const result = await getNavigation(activeHubId, switcherValue);
        if (!cancelled && result.length) setSections(result);
        if (!cancelled && !result.length) setSections(fallback);
      } catch (error) {
        console.error('[HubNavigation] navigation load failed', { activeHubId, error });
        if (!cancelled) setSections(fallback);
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
    const query = new URLSearchParams(window.location.search);
    query.set(queryKey, value);

    if (activeHubId === 'athlete') {
      query.delete('switcher');
    }
    if (activeHubId === 'admin') {
      query.delete('switcher');
    }

    const href = `${window.location.pathname}?${query.toString()}`;
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
        if (isItemActive(item.href, pathname)) return item.id;
      }
    }
    return '';
  }, [pathname, sections, switcherValue]);

  function hrefFor(itemHref?: string) {
    if (!itemHref || typeof window === 'undefined') return itemHref || '#';
    const target = new URL(itemHref, window.location.origin);

    if (activeHubId === 'athlete' && switcherValue) {
      target.searchParams.set('age', switcherValue);
    }
    if (activeHubId === 'admin' && switcherValue) {
      target.searchParams.set('role', switcherValue);
    }

    return `${target.pathname}${target.search}`;
  }

  const showSwitcher =
    switcherConfig.displayStyle !== 'none' && switcherConfig.options.length > 0;

  const switcherLabel =
    switcherConfig.type === 'age'
      ? 'Demonstrate athlete experience'
      : switcherConfig.type === 'role'
        ? 'Select admin role'
        : switcherConfig.type === 'official_role'
          ? 'Select official role'
          : 'Select option';

  return (
    <nav className="flex h-full w-full flex-col bg-[#080909]">
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

        {showSwitcher && (
          <div className="mt-5 rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[.18em] text-[#FA4616]">
              <span>{switcherLabel}</span>
              {refreshing && <span className="text-neutral-700">updating</span>}
            </div>
            <div className="space-y-1">
              {switcherConfig.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] ${
                    switcherValue === option.id
                      ? 'bg-[#FA4616]/10 text-white'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`switcher-${activeHubId}`}
                    checked={switcherValue === option.id}
                    onChange={() => handleSwitch(option.id)}
                    className="accent-[#FA4616]"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            <div className="mb-1.5 px-3 text-[8px] font-bold tracking-[0.2em] text-neutral-700">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const href = hrefFor(item.href);
                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('ls1sports:navigation', {
                          detail: { hubId: activeHubId, itemId: item.id, href },
                        }),
                      )
                    }
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors ${
                      activeItem === item.id
                        ? 'bg-[#FA4616]/10 text-[#FA4616]'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    {activeItem === item.id && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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
