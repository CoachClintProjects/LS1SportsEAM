'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useHub } from '@/components/hubs/HubContext';
import { 
  getNavigation, 
  getSwitcherConfig,
  NavigationItem, 
  NavigationSection,
  SwitcherConfig,
  SwitcherOption
} from './navigationDefinitions';

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
  const pathname = usePathname();
  const active = activeItem === item.id || pathname === item.href;

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
      const newUrl = `${basePath}?${next.toString()}`;
      window.history.replaceState({}, '', newUrl);
      window.dispatchEvent(new CustomEvent('ls1sports:navigation', { detail: item.id }));
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
// SWITCHER RENDERER - DATABASE DRIVEN
// =============================================================================

function SwitcherRenderer({
  hubId,
  switcherValue,
  switcherConfig,
  onSwitch
}: {
  hubId: string;
  switcherValue: string;
  switcherConfig: SwitcherConfig;
  onSwitch: (value: string) => void;
}) {
  if (!switcherConfig || switcherConfig.displayStyle === 'none' || switcherConfig.options.length === 0) return null;

  const getSwitcherLabel = () => {
    switch (switcherConfig.type) {
      case 'age': return 'Demonstrate athlete experience';
      case 'role': return 'Select your admin role';
      case 'official_role': return 'Select your official role';
      default: return 'Select option';
    }
  };

  const getSwitcherDescription = () => {
    switch (switcherConfig.type) {
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
        {switcherConfig.options.map((option: SwitcherOption) => (
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
  const pathname = usePathname();
  const { activeHubId, currentHub } = useHub();
  const [switcherValue, setSwitcherValue] = useState('');
  const [switcherConfig, setSwitcherConfig] = useState<SwitcherConfig>({
    type: null,
    displayStyle: 'none',
    options: [],
    defaultOption: ''
  });
  const [activeItem, setActiveItem] = useState('');
  const [sections, setSections] = useState<NavigationSection[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isFirstRender = useRef(true);

  // Helper to get current switcher value from URL
  const getCurrentSwitcherValue = () => {
    if (typeof window === 'undefined') return switcherConfig.defaultOption || '';
    const param = new URLSearchParams(window.location.search).get('switcher');
    if (param) return param;
    return switcherConfig.defaultOption || '';
  };

  // Load switcher config from database
  useEffect(() => {
    const loadSwitcherConfig = async () => {
      try {
        const config = await getSwitcherConfig(activeHubId);
        setSwitcherConfig(config);
        const initialValue = getCurrentSwitcherValue() || config.defaultOption || '';
        setSwitcherValue(initialValue);
      } catch (error) {
        console.error('Error loading switcher config:', error);
      }
    };
    loadSwitcherConfig();
  }, [activeHubId]);

  // Load navigation from database - only show loading on first load
  useEffect(() => {
    const loadNavigation = async () => {
      try {
        const result = await getNavigation(activeHubId, switcherValue);
        setSections(result);
      } catch (error) {
        console.error('Error loading navigation:', error);
        setSections([]);
      } finally {
        setIsInitialLoad(false);
      }
    };

    if (switcherValue !== '' || activeHubId === 'scout') {
      loadNavigation();
    }
  }, [activeHubId, switcherValue]);

  // Sync active item
  useEffect(() => {
    const sync = () => {
      const view = new URLSearchParams(window.location.search).get('view');
      if (view) {
        setActiveItem(view);
      } else if (sections.length > 0 && sections[0].items.length > 0) {
        setActiveItem(sections[0].items[0].id);
      }
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

  // Handle switcher change - NO PAGE REFRESH
  const handleSwitch = (value: string) => {
    setSwitcherValue(value);
    const next = new URLSearchParams(window.location.search);
    next.set('switcher', value);
    const newUrl = `${window.location.pathname}?${next.toString()}`;
    window.history.replaceState({}, '', newUrl);
    window.dispatchEvent(new CustomEvent('ls1sports:switcher-change', { detail: value }));
  };

  // Show loading only on first load
  if (isInitialLoad) {
    return (
      <nav className="flex h-full w-full flex-col bg-[#080909]">
        <div className="flex h-full items-center justify-center">
          <div className="text-xs text-neutral-500">Loading...</div>
        </div>
      </nav>
    );
  }

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

        {/* Render Switcher based on hub - DATABASE DRIVEN */}
        <SwitcherRenderer
          hubId={activeHubId}
          switcherValue={switcherValue}
          switcherConfig={switcherConfig}
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