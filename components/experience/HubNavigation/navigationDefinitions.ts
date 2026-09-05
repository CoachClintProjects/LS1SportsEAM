// =====================================================
// LS1Sports Navigation Definitions
// =====================================================
// SECTION: RESPONSIBILITY
// - Define contextual navigation for all seven hubs.
// - Filter navigation based on role switcher value.
// =====================================================

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

// =====================================================
// SECTION: ROLE TO NAVIGATION MAPPING (Admin Hub)
// =====================================================

const adminRoleNavigationMap: Record<string, string[]> = {
  org_admin: [
    'Command Center',
    'Organization',
    'Hierarchy',
    'TEAM MANAGER',
    'Registrar',
    'Rosters',
    'Membership',
    'Programs',
    'Teams',
    'Seasons',
    'FINANCE',
    'Financial Overview',
    'Billing',
    'Invoices',
    'Payments',
    'OPERATIONS',
    'Facilities',
    'Payroll',
    'Imports',
    'Reporting'
  ],
  team_manager: [
    'Command Center',
    'TEAM MANAGER',
    'Registrar',
    'Rosters',
    'Membership',
    'Programs',
    'Teams',
    'Seasons'
  ],
  registrar: [
    'Command Center',
    'TEAM MANAGER',
    'Registrar',
    'Rosters',
    'Membership'
  ],
  treasurer: [
    'Command Center',
    'FINANCE',
    'Financial Overview',
    'Billing',
    'Invoices',
    'Payments'
  ],
  operations: [
    'Command Center',
    'OPERATIONS',
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

// =====================================================
// SECTION: OFFICIAL ROLE TO NAVIGATION MAPPING
// =====================================================

const officialRoleNavigationMap: Record<string, string[]> = {
  official: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Availability',
    'Conflicts',
    'ASSIGNMENTS',
    'Assignments',
    'Assignment History',
    'Check-In'
  ],
  meet_referee: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Conflicts',
    'ASSIGNMENTS',
    'Assignments',
    'Assignment History'
  ],
  starter: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Availability',
    'Conflicts',
    'ASSIGNMENTS',
    'Assignments',
    'Check-In'
  ],
  stroke_turn: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Availability',
    'ASSIGNMENTS',
    'Assignments'
  ],
  judge: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Availability',
    'ASSIGNMENTS',
    'Assignments'
  ],
  meet_director: [
    'Profile',
    'Credentials',
    'Certification',
    'AVAILABILITY',
    'Availability',
    'Conflicts',
    'ASSIGNMENTS',
    'Assignments',
    'Assignment History',
    'Check-In'
  ]
};

// =====================================================
// SECTION: SUPERUSER (Hardcoded)
// =====================================================

const superuserNavigation: NavigationSection[] = [
  {
    id: 'command',
    label: 'COMMAND',
    items: [
      { id: 'command-center', label: 'Command Center', icon: 'command', href: '/superuser' },
      { id: 'project-map', label: 'Master EAM / ERP Project Map', icon: 'map', href: '/superuser' },
      { id: 'milestones', label: '14 Milestones', icon: 'milestone' },
      { id: 'metrics', label: 'Live Core Metrics', icon: 'activity' },
    ],
  },
  {
    id: 'enterprise',
    label: 'ENTERPRISE',
    items: [
      { id: 'platform', label: 'Platform Core', icon: 'layers' },
      { id: 'organizations', label: 'Organizations', icon: 'building' },
      { id: 'people', label: 'People / Person Master', icon: 'users' },
      { id: 'team-manager', label: 'Team Manager', icon: 'users' },
      { id: 'athletes', label: 'Athlete Intelligence', icon: 'medal' },
    ],
  },
  {
    id: 'finance',
    label: 'FINANCE & ACCOUNTING',
    items: [
      { id: 'financial-overview', label: 'Financial Overview', icon: 'chart' },
      { id: 'general-ledger', label: 'General Ledger', icon: 'book' },
      { id: 'receivables', label: 'Accounts Receivable', icon: 'down' },
      { id: 'payables', label: 'Accounts Payable', icon: 'up' },
      { id: 'revenue', label: 'Revenue', icon: 'trending' },
      { id: 'costs', label: 'Costs & Overhead', icon: 'receipt' },
      { id: 'budgets', label: 'Budgets', icon: 'wallet' },
      { id: 'forecasting', label: 'Forecasting', icon: 'chart' },
      { id: 'profitability', label: 'Profitability', icon: 'dollar' },
      { id: 'cash-flow', label: 'Cash Flow', icon: 'cash' },
    ],
  },
  {
    id: 'eam',
    label: 'EAM',
    items: [
      { id: 'facilities', label: 'Facilities', icon: 'building' },
      { id: 'assets', label: 'Assets', icon: 'box' },
      { id: 'maintenance', label: 'Maintenance', icon: 'wrench' },
      { id: 'resources', label: 'Resources', icon: 'package' },
    ],
  },
  {
    id: 'security',
    label: 'IDENTITY & SECURITY',
    items: [
      { id: 'identity', label: 'Identity', icon: 'id' },
      { id: 'roles', label: 'Roles', icon: 'shield' },
      { id: 'permissions', label: 'Permissions', icon: 'key' },
      { id: 'raci', label: 'RACI / Authority Matrix', icon: 'workflow' },
      { id: 'delegation', label: 'Delegation', icon: 'branch' },
      { id: 'sod', label: 'Segregation of Duties', icon: 'lock' },
      { id: 'privileged-access', label: 'Privileged Access', icon: 'shield' },
    ],
  },
  {
    id: 'governance',
    label: 'GOVERNANCE',
    items: [
      { id: 'compliance', label: 'Compliance', icon: 'check' },
      { id: 'data-governance', label: 'Data Governance', icon: 'database' },
      { id: 'privacy', label: 'Privacy / Sovereignty', icon: 'eye' },
      { id: 'retention', label: 'Retention / Legal Holds', icon: 'archive' },
      { id: 'audit', label: 'Audit', icon: 'history' },
    ],
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    items: [
      { id: 'procurement', label: 'Procurement', icon: 'cart' },
      { id: 'payroll', label: 'Payroll', icon: 'badge' },
      { id: 'workflow', label: 'Workflow', icon: 'workflow' },
      { id: 'integrations', label: 'Integrations', icon: 'plug' },
      { id: 'imports', label: 'Imports / Ingestion', icon: 'upload' },
      { id: 'reporting', label: 'Reporting', icon: 'reports' },
    ],
  },
  {
    id: 'intelligence',
    label: 'INTELLIGENCE',
    items: [
      { id: 'agents', label: 'AI Agents', icon: 'sparkles' },
      { id: 'automation', label: 'Automations', icon: 'bot' },
      { id: 'alerts', label: 'Alerts', icon: 'bell' },
      { id: 'insights', label: 'Insights', icon: 'lightbulb' },
    ],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING',
    items: [
      { id: 'product', label: 'Product / Feature Factory', icon: 'boxes' },
      { id: 'deployments', label: 'Deployments', icon: 'rocket' },
      { id: 'system-health', label: 'System Health', icon: 'server' },
      { id: 'knowledge', label: 'Knowledge / SOP', icon: 'book' },
    ],
  },
];

// =====================================================
// SECTION: ATHLETE (Hardcoded)
// =====================================================

const athleteNavigation: NavigationSection[] = [
  {
    id: 'athlete',
    label: 'ATHLETE',
    items: [
      { id: 'overview', label: 'My World', icon: 'home', href: '/athlete' }
    ],
  },
];

// =====================================================
// SECTION: COACH (Hardcoded)
// =====================================================

const coachNavigation: NavigationSection[] = [
  {
    id: 'coach',
    label: 'COACH',
    items: [
      { id: 'command-center', label: 'Command Center', icon: 'command', href: '/coach' },
      { id: 'teams', label: 'My Teams', icon: 'users' },
      { id: 'squads', label: 'Squads', icon: 'users' },
    ],
  },
  {
    id: 'team-manager',
    label: 'TEAM MANAGER',
    items: [
      { id: 'rosters', label: 'Rosters', icon: 'clipboard' },
      { id: 'athletes', label: 'Athletes', icon: 'users' },
      { id: 'membership', label: 'Membership', icon: 'badge' },
      { id: 'programs', label: 'Programs', icon: 'layers' },
      { id: 'seasons', label: 'Seasons', icon: 'calendar' },
      { id: 'staff', label: 'Staff', icon: 'briefcase' },
    ],
  },
  {
    id: 'training',
    label: 'TRAINING',
    items: [
      { id: 'plans', label: 'Training Plans', icon: 'clipboard' },
      { id: 'deployment', label: 'Training Deployment', icon: 'send' },
      { id: 'workouts', label: 'Workouts', icon: 'activity' },
      { id: 'attendance', label: 'Attendance', icon: 'check' },
    ],
  },
  {
    id: 'development',
    label: 'DEVELOPMENT',
    items: [
      { id: 'development-plans', label: 'Development Plans', icon: 'target' },
      { id: 'athlete-development', label: 'Athlete Development', icon: 'trending' },
      { id: 'performance', label: 'Performance', icon: 'activity' },
    ],
  },
  {
    id: 'competition',
    label: 'COMPETITION PREPARATION',
    items: [
      { id: 'calendar', label: 'Competition Calendar', icon: 'calendar' },
      { id: 'entries', label: 'Entries', icon: 'list' },
      { id: 'preparation', label: 'Preparation', icon: 'clipboard' },
    ],
  },
];

// =====================================================
// SECTION: ADMIN (Hardcoded with filtering)
// =====================================================

const adminNavigationFull: NavigationSection[] = [
  {
    id: 'admin',
    label: 'ADMIN',
    items: [
      { id: 'command-center', label: 'Command Center', icon: 'command', href: '/admin' },
      { id: 'organization', label: 'Organization', icon: 'building' },
      { id: 'hierarchy', label: 'Hierarchy', icon: 'branch' },
    ],
  },
  {
    id: 'team-manager',
    label: 'TEAM MANAGER',
    items: [
      { id: 'registrar', label: 'Registrar', icon: 'check' },
      { id: 'rosters', label: 'Rosters', icon: 'users' },
      { id: 'membership', label: 'Membership', icon: 'badge' },
      { id: 'programs', label: 'Programs', icon: 'layers' },
      { id: 'teams', label: 'Teams', icon: 'users' },
      { id: 'seasons', label: 'Seasons', icon: 'calendar' },
    ],
  },
  {
    id: 'finance',
    label: 'FINANCE',
    items: [
      { id: 'financial-overview', label: 'Financial Overview', icon: 'chart' },
      { id: 'billing', label: 'Billing', icon: 'receipt' },
      { id: 'invoices', label: 'Invoices', icon: 'file' },
      { id: 'payments', label: 'Payments', icon: 'dollar' },
    ],
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    items: [
      { id: 'facilities', label: 'Facilities', icon: 'building' },
      { id: 'payroll', label: 'Payroll', icon: 'badge' },
      { id: 'imports', label: 'Imports', icon: 'upload' },
      { id: 'reporting', label: 'Reporting', icon: 'reports' },
    ],
  },
];

// =====================================================
// SECTION: PARENT (Hardcoded)
// =====================================================

const parentNavigation: NavigationSection[] = [
  { id:'family',label:'FAMILY OS',items:[
    {id:'household',label:'Today',icon:'home',href:'/parent'},
    {id:'tasks',label:'Task Center',icon:'check'},
    {id:'messages',label:'Family Inbox',icon:'bell'},
    {id:'members',label:'Family & Permissions',icon:'users'},
    {id:'athletes',label:'My Athletes',icon:'medal'},
  ]},
  { id:'logistics',label:'LOGISTICS',items:[
    {id:'schedule',label:'Family Schedule',icon:'calendar'},
    {id:'transport',label:'Transport & Custody',icon:'route'},
    {id:'volunteer',label:'Participation',icon:'users'},
  ]},
  { id:'athlete-context',label:'ATHLETE CONTEXT',items:[
    {id:'development',label:'Development',icon:'trending'},
    {id:'trajectory',label:'Journey & Trajectory',icon:'route'},
    {id:'competition',label:'Competition',icon:'trophy'},
  ]},
  { id:'readiness',label:'READINESS & DOCUMENTS',items:[
    {id:'documents',label:'Document Vault',icon:'file'},
    {id:'compliance',label:'Compliance / Waivers',icon:'shield'},
    {id:'registrations',label:'Registrations',icon:'clipboard'},
  ]},
  { id:'financial',label:'FINANCIAL',items:[
    {id:'financial',label:'Financial Center',icon:'wallet'},
    {id:'invoices',label:'Invoices',icon:'receipt'},
    {id:'payments',label:'Payments',icon:'dollar'},
  ]},
];

// =====================================================
// SECTION: OFFICIAL (Hardcoded with filtering)
// =====================================================

const officialNavigationFull: NavigationSection[] = [
  {
    id: 'official',
    label: 'OFFICIAL',
    items: [
      { id: 'profile', label: 'Profile', icon: 'user', href: '/official' },
      { id: 'credentials', label: 'Credentials', icon: 'badge' },
      { id: 'certification', label: 'Certification', icon: 'shield' },
    ],
  },
  {
    id: 'availability',
    label: 'AVAILABILITY',
    items: [
      { id: 'availability', label: 'Availability', icon: 'calendar' },
      { id: 'conflicts', label: 'Conflicts', icon: 'alert' },
    ],
  },
  {
    id: 'assignments',
    label: 'ASSIGNMENTS',
    items: [
      { id: 'assignments', label: 'Assignments', icon: 'clipboard' },
      { id: 'history', label: 'Assignment History', icon: 'history' },
      { id: 'check-in', label: 'Check-In', icon: 'check' },
    ],
  },
];

// =====================================================
// SECTION: SCOUT (Hardcoded)
// =====================================================

const scoutNavigation: NavigationSection[] = [
  {
    id: 'scout',
    label: 'SCOUT',
    items: [
      { id: 'command-center', label: 'Scout Command Center', icon: 'command', href: '/scout' },
      { id: 'talent-search', label: 'Talent Search', icon: 'search' },
      { id: 'athlete-discovery', label: 'Athlete Discovery', icon: 'users' },
    ],
  },
  {
    id: 'pipeline',
    label: 'PIPELINE',
    items: [
      { id: 'prospects', label: 'Prospects', icon: 'target' },
      { id: 'pipelines', label: 'Prospect Pipelines', icon: 'branch' },
      { id: 'dossiers', label: 'Athlete Dossiers', icon: 'folder' },
    ],
  },
  {
    id: 'intelligence',
    label: 'INTELLIGENCE',
    items: [
      { id: 'trajectory', label: 'Trajectory Analysis', icon: 'chart' },
      { id: 'comparisons', label: 'Comparisons', icon: 'activity' },
      { id: 'recommendations', label: 'Recommendations', icon: 'lightbulb' },
    ],
  },
];

// =====================================================
// SECTION: FILTERING FUNCTIONS
// =====================================================

function filterAdminNavigation(role: string): NavigationSection[] {
  const allowedLabels = adminRoleNavigationMap[role] || adminRoleNavigationMap.org_admin;

  const filteredSections: NavigationSection[] = [];

  for (const section of adminNavigationFull) {
    // Check if section label itself is allowed
    const sectionAllowed = allowedLabels.some(label => label === section.label);
    // Filter items in this section
    const filteredItems = section.items.filter(item =>
      allowedLabels.includes(item.label)
    );

    // Include section if:
    // 1. Section label is directly allowed, OR
    // 2. There are filtered items in the section
    if (sectionAllowed || filteredItems.length > 0) {
      filteredSections.push({
        ...section,
        items: sectionAllowed ? section.items.filter(item => allowedLabels.includes(item.label)) : filteredItems
      });
    }
  }

  // Ensure Command Center is always present
  const hasCommandCenter = filteredSections.some(s =>
    s.items.some(i => i.id === 'command-center')
  );
  if (!hasCommandCenter) {
    const adminSection = filteredSections.find(s => s.id === 'admin');
    if (adminSection) {
      if (!adminSection.items.some(i => i.id === 'command-center')) {
        adminSection.items.unshift({ id: 'command-center', label: 'Command Center', icon: 'command', href: '/admin' });
      }
    } else {
      filteredSections.unshift({
        id: 'admin',
        label: 'ADMIN',
        items: [{ id: 'command-center', label: 'Command Center', icon: 'command', href: '/admin' }]
      });
    }
  }

  return filteredSections;
}

function filterOfficialNavigation(role: string): NavigationSection[] {
  const allowedLabels = officialRoleNavigationMap[role] || officialRoleNavigationMap.official;

  const filteredSections: NavigationSection[] = [];

  for (const section of officialNavigationFull) {
    const filteredItems = section.items.filter(item =>
      allowedLabels.includes(item.label)
    );
    if (filteredItems.length > 0) {
      filteredSections.push({ ...section, items: filteredItems });
    }
  }

  // Ensure Profile is always present
  const hasProfile = filteredSections.some(s =>
    s.items.some(i => i.id === 'profile')
  );
  if (!hasProfile) {
    const officialSection = filteredSections.find(s => s.id === 'official');
    if (officialSection) {
      if (!officialSection.items.some(i => i.id === 'profile')) {
        officialSection.items.unshift({ id: 'profile', label: 'Profile', icon: 'user', href: '/official' });
      }
    } else {
      filteredSections.unshift({
        id: 'official',
        label: 'OFFICIAL',
        items: [{ id: 'profile', label: 'Profile', icon: 'user', href: '/official' }]
      });
    }
  }

  return filteredSections;
}

// =====================================================
// SECTION: REGISTRY
// =====================================================

export const navigationRegistry: Record<string, NavigationSection[]> = {
  superuser: superuserNavigation,
  athlete: athleteNavigation,
  coach: coachNavigation,
  parent: parentNavigation,
  scout: scoutNavigation,
};

// =====================================================
// SECTION: LOOKUP (with filtering)
// =====================================================

export function getNavigation(
  hubId: string,
  switcherValue: string = ''
): NavigationSection[] {
  // Admin Hub - filter by role
  if (hubId === 'admin') {
    return filterAdminNavigation(switcherValue || 'org_admin');
  }

  // Official Hub - filter by role
  if (hubId === 'official') {
    return filterOfficialNavigation(switcherValue || 'official');
  }

  // All other hubs - return full navigation
  return navigationRegistry[hubId] ?? superuserNavigation;
}