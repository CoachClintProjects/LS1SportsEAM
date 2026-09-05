'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, NavigationItem, NavigationSection } from './navigationDefinitions';

// =============================================================================
// SWITCHER CONFIGURATION
// =============================================================================

interface SwitcherOption {
  id: string;
  label: string;
  description?: string;
}

interface SwitcherConfig {
  type: 'age' | 'role' | 'official_role' | 'scout' | null;
  displayStyle: 'radio' | 'dropdown' | 'none';
  options: SwitcherOption[];
  defaultOption: string;
}

// =============================================================================
// SWITCHER DATA - ALL USE RADIO BUTTONS (except none)
// =============================================================================

const switcherConfigs: Record<string, SwitcherConfig> = {
  athlete: {
    type: 'age',
    displayStyle: 'radio',
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
    displayStyle: 'radio',
    defaultOption: 'org_admin',
    options: [
      { id: 'org_admin', label: 'Organization Admin' },
      { id: 'team_manager', label: 'Team Manager' },
      { id: 'registrar', label: 'Registrar' },
      { id: 'treasurer', label: 'Treasurer' },
      { id: 'operations', label: 'Operations' },
      { id: 'compliance', label: 'Compliance' },
      { id: 'reporting', label: 'Reporting' }
    ]
  },
  official: {
    type: 'official_role',
    displayStyle: 'radio',
    defaultOption: 'official',
    options: [
      { id: 'official', label: 'Official' },
      { id: 'meet_referee', label: 'Meet Referee' },
      { id: 'starter', label: 'Starter' },
      { id: 'stroke_turn', label: 'Stroke & Turn' },
      { id: 'judge', label: 'Judge' },
      { id: 'meet_director', label: 'Meet Director' }
    ]
  },
  scout: {
    type: 'scout',
    displayStyle: 'none',
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
  const active = activeItem === item.id;

  const classes = `
    group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors
    ${active ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}
  `;

  const content = (
    <>
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
// SWITCHER RENDERER - RADIO BUTTONS FOR EVERYTHING
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
  if (!config || config.displayStyle === 'none' || config.options.length === 0) return null;

  // =========================================================================
  // Get the label for the switcher section
  // =========================================================================
  const getSwitcherLabel = () => {
    switch (config.type) {
      case 'age': return 'Demonstrate athlete experience';
      case 'role': return 'Select your admin role';
      case 'official_role': return 'Select your official role';
      default: return 'Select option';
    }
  };

  const getSwitcherDescription = () => {
    switch (config.type) {
      case 'age': return 'The selector changes the entire workspace experience, not the underlying Athlete Passport.';
      case 'role': return 'Your role determines what you can see and do in the Admin Hub.';
      case 'official_role': return 'Your role determines your responsibilities and view.';
      default: return '';
    }
  };

  return (
    <div className="mt-5 rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
      <div className="mb-2 text-[8px] font-black uppercase tracking-[.18em] text-[#FA4616]">
        {getSwitcherLabel()}
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
              name={`switcher-${hubId}`}
              checked={switcherValue === option.id}
              onChange={() => onSwitch(option.id)}
              className="accent-[#FA4616]"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {getSwitcherDescription() && (
        <div className="mt-2 text-[8px] leading-3 text-neutral-700">
          {getSwitcherDescription()}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT: HubNavigation
// =============================================================================

export function HubNavigation() {
  const router = useRouter();
  const { activeHubId, currentHub } = useHub();
  const [switcherValue, setSwitcherValue] = useState('');
  const [activeItem, setActiveItem] = useState('');

  // Get navigation sections - pass switcher value to filter
  const sections = useMemo(() => {
    let result: NavigationSection[] = getNavigation(activeHubId, switcherValue);

    // Deduplicate items within each section
    return result.map(section => ({
      ...section,
      items: section.items.filter((item, index, self) =>
        index === self.findIndex(i => i.id === item.id)
      )
    })).filter(section => section.items.length > 0);
  }, [activeHubId, switcherValue]);

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
    // Trigger navigation refresh for role-based hubs
    if (activeHubId === 'admin' || activeHubId === 'official') {
      // Navigation will refresh via the useMemo dependency on switcherValue
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

        {/* Render Switcher based on hub - ALL RADIO BUTTONS */}
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