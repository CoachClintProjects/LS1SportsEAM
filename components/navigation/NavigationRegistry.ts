// =============================================================================
// NAVIGATION DEFINITIONS
// =============================================================================
// This file handles fetching navigation from the database with filtering
// based on the switcher value (role, age, etc.)
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

// =============================================================================
// ROLE TO NAVIGATION MAPPING (Admin Hub)
// =============================================================================

// Map each admin role to the navigation items they should see
// This is a temporary mapping - ideally this comes from the database
const adminRoleNavigationMap: Record<string, string[]> = {
  org_admin: [
    'Command Center',
    'Organization',
    'Hierarchy',
    'Team Manager',
    'Registrar',
    'Rosters',
    'Membership',
    'Programs',
    'Teams',
    'Seasons',
    'Finance',
    'Financial Overview',
    'Billing',
    'Invoices',
    'Payments',
    'Operations',
    'Facilities',
    'Payroll',
    'Imports',
    'Reporting'
  ],
  team_manager: [
    'Command Center',
    'Team Manager',
    'Registrar',
    'Rosters',
    'Membership',
    'Programs',
    'Teams',
    'Seasons'
  ],
  registrar: [
    'Command Center',
    'Registrar',
    'Rosters',
    'Membership'
  ],
  treasurer: [
    'Command Center',
    'Finance',
    'Financial Overview',
    'Billing',
    'Invoices',
    'Payments'
  ],
  operations: [
    'Command Center',
    'Operations',
    'Facilities',
    'Payroll',
    'Imports'
  ],
  compliance: [
    'Command Center',
    'Compliance'
  ],
  reporting: [
    'Command Center',
    'Reporting'
  ]
};

// =============================================================================
// OFFICIAL ROLE TO NAVIGATION MAPPING (Official Hub)
// =============================================================================

const officialRoleNavigationMap: Record<string, string[]> = {
  official: [
    'Today',
    'Current Competition',
    'Assignments',
    'Check-In',
    'Availability',
    'Conflicts',
    'Credentials',
    'History'
  ],
  meet_referee: [
    'Today',
    'Current Competition',
    'Assignments',
    'Conflicts',
    'Credentials',
    'History'
  ],
  starter: [
    'Today',
    'Current Competition',
    'Assignments',
    'Check-In'
  ],
  stroke_turn: [
    'Today',
    'Current Competition',
    'Assignments'
  ],
  judge: [
    'Today',
    'Current Competition',
    'Assignments'
  ],
  meet_director: [
    'Today',
    'Current Competition',
    'Assignments',
    'Availability',
    'Conflicts',
    'Credentials',
    'History'
  ]
};

// =============================================================================
// AGE TO NAVIGATION MAPPING (Athlete Hub)
// =============================================================================

// Athlete navigation is the same for all ages, but the views change
// We filter based on age in the AthleteWorkspace, not in the sidebar
const athleteNavigationItems: NavigationItem[] = [
  { id: 'overview', label: 'My World', href: '/athlete' }
];

// =============================================================================
// MAIN FUNCTION: getNavigation
// =============================================================================

export function getNavigation(
  hubId: string,
  switcherValue: string = ''
): NavigationSection[] {
  // Return empty if no hub
  if (!hubId) return [];

  // =========================================================================
  // ADMIN HUB - Role-based filtering
  // =========================================================================
  if (hubId === 'admin') {
    // Get the allowed labels for this role
    const allowedLabels = adminRoleNavigationMap[switcherValue] || adminRoleNavigationMap.org_admin;

    // Define all admin navigation sections
    const allSections: NavigationSection[] = [
      {
        id: 'admin',
        label: 'ADMIN',
        items: [
          { id: 'command-center', label: 'Command Center', href: '/admin' },
          { id: 'organization', label: 'Organization', href: '/admin/organization' },
          { id: 'hierarchy', label: 'Hierarchy', href: '/admin/hierarchy' }
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
          { id: 'seasons', label: 'Seasons', href: '/admin/seasons' }
        ]
      },
      {
        id: 'finance',
        label: 'FINANCE',
        items: [
          { id: 'financial-overview', label: 'Financial Overview', href: '/admin/finance' },
          { id: 'billing', label: 'Billing', href: '/admin/billing' },
          { id: 'invoices', label: 'Invoices', href: '/admin/invoices' },
          { id: 'payments', label: 'Payments', href: '/admin/payments' }
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
          { id: 'compliance', label: 'Compliance', href: '/admin/compliance' }
        ]
      }
    ];

    // Filter sections and items based on allowed labels
    const filteredSections: NavigationSection[] = [];

    for (const section of allSections) {
      const filteredItems = section.items.filter(item =>
        allowedLabels.includes(item.label)
      );

      // Also check if the section label itself is allowed
      const sectionLabelMatch = allowedLabels.some(label =>
        label === section.label || label === 'Command Center'
      );

      if (filteredItems.length > 0 || sectionLabelMatch) {
        // If section label matches, include all items that are allowed
        if (sectionLabelMatch) {
          filteredSections.push({
            ...section,
            items: section.items.filter(item =>
              allowedLabels.includes(item.label)
            )
          });
        } else if (filteredItems.length > 0) {
          filteredSections.push({
            ...section,
            items: filteredItems
          });
        }
      }
    }

    // Ensure Command Center is always included
    const hasCommandCenter = filteredSections.some(s =>
      s.items.some(i => i.id === 'command-center')
    );

    if (!hasCommandCenter) {
      // Add Command Center if missing
      const adminSection = filteredSections.find(s => s.id === 'admin');
      if (adminSection) {
        if (!adminSection.items.some(i => i.id === 'command-center')) {
          adminSection.items.unshift({ id: 'command-center', label: 'Command Center', href: '/admin' });
        }
      } else {
        filteredSections.unshift({
          id: 'admin',
          label: 'ADMIN',
          items: [{ id: 'command-center', label: 'Command Center', href: '/admin' }]
        });
      }
    }

    return filteredSections;
  }

  // =========================================================================
  // OFFICIAL HUB - Role-based filtering
  // =========================================================================
  if (hubId === 'official') {
    const allowedLabels = officialRoleNavigationMap[switcherValue] || officialRoleNavigationMap.official;

    const allSections: NavigationSection[] = [
      {
        id: 'official',
        label: 'OFFICIAL',
        items: [
          { id: 'today', label: 'Today', href: '/official' },
          { id: 'current-competition', label: 'Current Competition', href: '/official/meet' },
          { id: 'assignments', label: 'Assignments', href: '/official/assignments' },
          { id: 'check-in', label: 'Check-In', href: '/official/checkin' },
          { id: 'availability', label: 'Availability', href: '/official/availability' },
          { id: 'conflicts', label: 'Conflicts', href: '/official/conflicts' },
          { id: 'credentials', label: 'Credentials', href: '/official/credentials' },
          { id: 'history', label: 'History', href: '/official/history' }
        ]
      }
    ];

    const filteredSections: NavigationSection[] = [];

    for (const section of allSections) {
      const filteredItems = section.items.filter(item =>
        allowedLabels.includes(item.label)
      );
      if (filteredItems.length > 0) {
        filteredSections.push({ ...section, items: filteredItems });
      }
    }

    return filteredSections;
  }

  // =========================================================================
  // ATHLETE HUB - Same for all ages
  // =========================================================================
  if (hubId === 'athlete') {
    return [
      {
        id: 'athlete',
        label: 'ATHLETE',
        items: athleteNavigationItems
      }
    ];
  }

  // =========================================================================
  // PARENT HUB
  // =========================================================================
  if (hubId === 'parent') {
    // Define parent navigation
    const parentItems: NavigationItem[] = [
      { id: 'household', label: 'Household Overview', href: '/parent' },
      { id: 'athletes', label: 'My Athletes', href: '/parent/athletes' },
      { id: 'schedules', label: 'Schedules', href: '/parent/schedule' },
      { id: 'registration', label: 'Registration', href: '/parent/registration' },
      { id: 'finances', label: 'Financials', href: '/parent/finance' },
      { id: 'documents', label: 'Documents', href: '/parent/documents' },
      { id: 'compliance', label: 'Compliance', href: '/parent/compliance' },
      { id: 'communications', label: 'Communications', href: '/parent/comms' },
      { id: 'family', label: 'Family Members', href: '/parent/family' },
      { id: 'transport', label: 'Transportation', href: '/parent/transport' }
    ];

    return [
      {
        id: 'parent',
        label: 'PARENT',
        items: parentItems
      }
    ];
  }

  // =========================================================================
  // COACH HUB
  // =========================================================================
  if (hubId === 'coach') {
    const coachItems: NavigationItem[] = [
      { id: 'command-center', label: 'Command Center', href: '/coach' },
      { id: 'squads', label: 'Squads', href: '/coach/squads' },
      { id: 'rosters', label: 'Rosters', href: '/coach/rosters' },
      { id: 'attendance', label: 'Attendance', href: '/coach/attendance' },
      { id: 'training-plans', label: 'Training Plans', href: '/coach/training' },
      { id: 'workouts', label: 'Workouts', href: '/coach/workouts' },
      { id: 'training-deployment', label: 'Training Deployment', href: '/coach/deployment' },
      { id: 'competition-prep', label: 'Competition Prep', href: '/coach/competition' },
      { id: 'performance', label: 'Performance', href: '/coach/performance' },
      { id: 'development', label: 'Development', href: '/coach/development' },
      { id: 'deck-ledger', label: 'Deck Ledger', href: '/coach/deck' }
    ];

    return [
      {
        id: 'coach',
        label: 'COACH',
        items: coachItems
      }
    ];
  }

  // =========================================================================
  // SUPERUSER HUB
  // =========================================================================
  if (hubId === 'superuser') {
    const superuserItems: NavigationItem[] = [
      { id: 'command-center', label: 'Command Center', href: '/superuser' },
      { id: 'project-command', label: 'Project Command', href: '/superuser/command' },
      { id: 'project-map', label: 'EAM/ERP Project Map', href: '/superuser/map' },
      { id: 'milestones', label: 'Milestone Tracker', href: '/superuser/milestones' },
      { id: 'metrics', label: 'Live Core Metrics', href: '/superuser/metrics' },
      { id: 'platform-core', label: 'Platform Core', href: '/superuser/core' },
      { id: 'security', label: 'Identity & Security', href: '/superuser/security' },
      { id: 'organizations', label: 'Organizations', href: '/superuser/orgs' },
      { id: 'people', label: 'People', href: '/superuser/people' },
      { id: 'athletes', label: 'Athlete Intelligence', href: '/superuser/athletes' },
      { id: 'competition', label: 'Competition Engine', href: '/superuser/competition' },
      { id: 'finance', label: 'Finance & Accounting', href: '/superuser/finance' },
      { id: 'facilities', label: 'Facilities & Assets', href: '/superuser/facilities' },
      { id: 'procurement', label: 'Procurement', href: '/superuser/procurement' },
      { id: 'payroll', label: 'Payroll', href: '/superuser/payroll' },
      { id: 'workflow', label: 'Workflow', href: '/superuser/workflow' },
      { id: 'rules', label: 'Rules Engine', href: '/superuser/rules' },
      { id: 'ai', label: 'AI & Automation', href: '/superuser/ai' },
      { id: 'integrations', label: 'Integrations', href: '/superuser/integrations' },
      { id: 'reporting', label: 'Reporting', href: '/superuser/reporting' },
      { id: 'audit', label: 'Audit & Governance', href: '/superuser/audit' },
      { id: 'engineering', label: 'Engineering Product', href: '/superuser/engineering' },
      { id: 'compliance', label: 'Compliance', href: '/superuser/compliance' }
    ];

    return [
      {
        id: 'superuser',
        label: 'SUPERUSER',
        items: superuserItems
      }
    ];
  }

  // =========================================================================
  // SCOUT HUB
  // =========================================================================
  if (hubId === 'scout') {
    const scoutItems: NavigationItem[] = [
      { id: 'search', label: 'Search', href: '/scout' },
      { id: 'discovery', label: 'Discovery', href: '/scout/discovery' },
      { id: 'prospects', label: 'Prospects', href: '/scout/prospects' },
      { id: 'watchlists', label: 'Watchlists', href: '/scout/watchlists' },
      { id: 'dossiers', label: 'Athlete Dossiers', href: '/scout/dossiers' },
      { id: 'trajectory', label: 'Trajectory', href: '/scout/trajectory' },
      { id: 'recruiting', label: 'Recruiting', href: '/scout/recruiting' }
    ];

    return [
      {
        id: 'scout',
        label: 'SCOUT',
        items: scoutItems
      }
    ];
  }

  // =========================================================================
  // DEFAULT - Return empty
  // =========================================================================
  return [];
}