'use client';

// =============================================================================
// HUB NAVIGATION - With Switcher Fallback
// =============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHub } from '@/components/hubs/HubContext';
import { getNavigation, NavigationSection } from './navigationDefinitions';

// =============================================================================
// FALLBACK NAVIGATION (used when database fails)
// =============================================================================

const FALLBACK_NAV: NavigationSection[] = [
  {
    id: 'admin',
    label: 'ADMIN',
    items: [
      { id: 'command-center', label: 'Command Center', href: '/admin' },
      { id: 'organization', label: 'Organization', href: '/admin/organization' },
      { id: 'hierarchy', label: 'Hierarchy', href: '/admin/hierarchy' },
    ]
  },
  {
    id: 'team-manager',
    label: 'TEAM MANAGER',
    items: [
      { id: 'registrar', label: 'Registrar', href: '/admin/registrar' },
      { id: 'rosters', label: 'Rosters', href: '/admin/rosters' },
      { id: 'membership', label: 'Membership', href: '/admin/membership' },
      { id: 'programs', label: 'Programs', href: '/admin/programs' },
      { id: 'teams', label: 'Teams', href: '/admin/teams' },
      { id: 'seasons', label: 'Seasons', href: '/admin/seasons' },
    ]
  },
  {
    id: 'finance',
    label: 'FINANCE',
    items: [
      { id: 'financial-overview', label: 'Financial Overview', href: '/admin/finance' },
      { id: 'billing', label: 'Billing', href: '/admin/billing' },
      { id: 'invoices', label: 'Invoices', href: '/admin/invoices' },
      { id: 'payments', label: 'Payments', href: '/admin/payments' },
    ]
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    items: [
      { id: 'facilities', label: 'Facilities', href: '/admin/facilities' },
      { id: 'payroll', label: 'Payroll', href: '/admin/payroll' },
      { id: 'imports', label: 'Imports', href: '/admin/imports' },
      { id: 'reporting', label: 'Reporting', href: '/admin/reporting' },
      { id: 'compliance', label: 'Compliance', href: '/admin/compliance' },
    ]
  }
];

// =============================================================================
// SWITCHER CONFIG (Hardcoded Fallback)
// =============================================================================

const getSwitcherFallback = (hubId: string) => {
  // Athlete Hub - Age radio buttons
  if (hubId === 'athlete') {
    return {
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
    };
  }

  // Admin Hub - Role radio buttons
  if (hubId === 'admin') {
    return {
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
    };
  }

  // Official Hub - Official role radio buttons
  if (hubId === 'official') {
    return {
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
    };
  }

  // No switcher for other hubs
  return {
    type: null,
    displayStyle: 'none',
    defaultOption: '',
    options: []
  };
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HubNavigation() {
  const pathname = usePathname();
  const { activeHubId, currentHub } = useHub();
  const [sections, setSections] = useState<NavigationSection[]>(FALLBACK_NAV);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState('');
  const [switcherValue, setSwitcherValue] = useState('');
  const [switcherConfig, setSwitcherConfig] = useState(() => getSwitcherFallback(activeHubId));

  // Load navigation from database - RELOADS WHEN SWITCHER VALUE CHANGES
  useEffect(() => {
    const loadNavigation = async () => {
      setLoading(true);
      try {
        // Pass switcherValue to getNavigation so it can filter by role/age
        const result = await getNavigation(activeHubId, switcherValue);
        if (result && result.length > 0) {
          setSections(result);
        } else {
          setSections(FALLBACK_NAV);
        }
      } catch (error) {
        console.error('Error loading navigation:', error);
        setSections(FALLBACK_NAV);
      } finally {
        setLoading(false);
      }
    };

    loadNavigation();
  }, [activeHubId, switcherValue]); // <-- KEY FIX: switcherValue triggers reload

  // Set switcher config when hub changes
  useEffect(() => {
    const config = getSwitcherFallback(activeHubId);
    setSwitcherConfig(config);
    if (config && config.options.length > 0) {
      setSwitcherValue(config.defaultOption || config.options[0].id);
    }
  }, [activeHubId]);

  // Set active item based on current path
  useEffect(() => {
    if (pathname) {
      for (const section of sections) {
        for (const item of section.items) {
          if (item.href && pathname.startsWith(item.href)) {
            setActiveItem(item.id);
            return;
          }
        }
      }
    }
  }, [pathname, sections]);

  // Handle switcher change - updates URL and triggers navigation reload
  const handleSwitch = (value: string) => {
    setSwitcherValue(value);
    // Update URL
    const next = new URLSearchParams(window.location.search);
    next.set('switcher', value);
    const newUrl = `${window.location.pathname}?${next.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // =========================================================================
  // RENDER SWITCHER
  // =========================================================================

  const renderSwitcher = () => {
    if (!switcherConfig || switcherConfig.displayStyle === 'none' || switcherConfig.options.length === 0) {
      return null;
    }

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
          {switcherConfig.options.map((option: any) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] ${
                switcherValue === option.id ? 'bg-[#FA4616]/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
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
        {getSwitcherDescription() && (
          <div className="mt-2 text-[8px] leading-3 text-neutral-700">
            {getSwitcherDescription()}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
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

        {/* Render Switcher */}
        {renderSwitcher()}
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
                <Link
                  key={item.id}
                  href={item.href || '#'}
                  className={`
                    flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors
                    ${activeItem === item.id ? 'bg-[#FA4616]/10 text-[#FA4616]' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}
                  `}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {activeItem === item.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FA4616]" />}
                </Link>
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