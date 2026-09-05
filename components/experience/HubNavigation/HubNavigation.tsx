'use client';

// =============================================================================
// HUB NAVIGATION - With Fallback
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
// MAIN COMPONENT
// =============================================================================

export function HubNavigation() {
  const pathname = usePathname();
  const { activeHubId, currentHub } = useHub();
  const [sections, setSections] = useState<NavigationSection[]>(FALLBACK_NAV);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState('');

  useEffect(() => {
    const loadNavigation = async () => {
      setLoading(true);
      try {
        const result = await getNavigation(activeHubId, '');
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
