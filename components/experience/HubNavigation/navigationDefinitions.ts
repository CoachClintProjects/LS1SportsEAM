// =====================================================
// LS1Sports Navigation Definitions
// =====================================================
// SECTION: RESPONSIBILITY
// - Define contextual navigation for all seven hubs.
// - Keep navigation structure separate from rendering.
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
// SECTION: SUPERUSER
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
// SECTION: ATHLETE
// =====================================================

const athleteNavigation: NavigationSection[] = [
  {
    id: 'athlete',
    label: 'ATHLETE',
    items: [
      { id: 'overview', label: 'Overview', icon: 'home', href: '/athlete' },
      { id: 'passport', label: 'Athlete Passport', icon: 'id' },
      { id: 'chronometer', label: 'Chronometer', icon: 'clock' },
      { id: 'journey', label: 'Athlete Journey', icon: 'route' },
    ],
  },
  {
    id: 'development',
    label: 'DEVELOPMENT',
    items: [
      { id: 'development', label: 'Development', icon: 'trending' },
      { id: 'stage', label: 'Development Stage', icon: 'layers' },
      { id: 'skills', label: 'Skills', icon: 'target' },
      { id: 'goals', label: 'Goals', icon: 'target' },
      { id: 'trajectory', label: 'Trajectory', icon: 'chart' },
    ],
  },
  {
    id: 'performance',
    label: 'PERFORMANCE',
    items: [
      { id: 'performance', label: 'Performance', icon: 'activity' },
      { id: 'records', label: 'Personal Records', icon: 'award' },
      { id: 'standards', label: 'Time Standards', icon: 'timer' },
      { id: 'rankings', label: 'Rankings', icon: 'chart' },
      { id: 'analysis', label: 'Competition Analysis', icon: 'search' },
    ],
  },
  {
    id: 'training',
    label: 'TRAINING',
    items: [
      { id: 'training-history', label: 'Training History', icon: 'history' },
      { id: 'habits', label: 'Training Habits', icon: 'repeat' },
      { id: 'readiness', label: 'Readiness', icon: 'heart' },
    ],
  },
  {
    id: 'competition',
    label: 'COMPETITION',
    items: [
      { id: 'schedule', label: 'Schedule', icon: 'calendar' },
      { id: 'preparation', label: 'Meet Preparation', icon: 'clipboard' },
      { id: 'results', label: 'Results', icon: 'list' },
    ],
  },
];

// =====================================================
// SECTION: COACH
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
// SECTION: ADMIN
// =====================================================

const adminNavigation: NavigationSection[] = [
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
// SECTION: PARENT
// =====================================================

const parentNavigation: NavigationSection[] = [
  {
    id: 'family',
    label: 'FAMILY',
    items: [
      { id: 'household', label: 'Household Overview', icon: 'home', href: '/parent' },
      { id: 'members', label: 'Family Members', icon: 'users' },
      { id: 'athletes', label: 'Athletes', icon: 'medal' },
    ],
  },
  {
    id: 'athlete-development',
    label: 'ATHLETE DEVELOPMENT',
    items: [
      { id: 'development', label: 'Development', icon: 'trending' },
      { id: 'trajectory', label: 'Trajectories', icon: 'route' },
      { id: 'competition', label: 'Competition', icon: 'trophy' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar' },
    ],
  },
  {
    id: 'registration',
    label: 'REGISTRATION',
    items: [
      { id: 'registrations', label: 'Registrations', icon: 'clipboard' },
      { id: 'documents', label: 'Documents', icon: 'file' },
      { id: 'compliance', label: 'Compliance / Waivers', icon: 'shield' },
    ],
  },
  {
    id: 'financial',
    label: 'FINANCIAL',
    items: [
      { id: 'accounts', label: 'Financial Accounts', icon: 'wallet' },
      { id: 'invoices', label: 'Invoices', icon: 'receipt' },
      { id: 'payments', label: 'Payments', icon: 'dollar' },
    ],
  },
];

// =====================================================
// SECTION: OFFICIAL
// =====================================================

const officialNavigation: NavigationSection[] = [
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
// SECTION: SCOUT
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
// SECTION: REGISTRY
// =====================================================

export const navigationRegistry: Record<string, NavigationSection[]> = {
  superuser: superuserNavigation,
  athlete: athleteNavigation,
  coach: coachNavigation,
  admin: adminNavigation,
  parent: parentNavigation,
  official: officialNavigation,
  scout: scoutNavigation,
};

// =====================================================
// SECTION: LOOKUP
// =====================================================

export function getNavigation(
  hubId: string,
): NavigationSection[] {
  return navigationRegistry[hubId] ?? superuserNavigation;
}
