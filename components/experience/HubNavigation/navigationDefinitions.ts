'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key);
  return browserClient;
}

export type NavigationItem = { id: string; label: string; href?: string; icon?: string; description?: string; sort_order?: number; children?: NavigationItem[] };
export type NavigationSection = { id: string; label: string; items: NavigationItem[] };
export interface SwitcherOption { id: string; label: string; description?: string }
export interface SwitcherConfig { type: 'age' | 'role' | 'official_role' | 'scout' | null; displayStyle: 'radio' | 'dropdown' | 'none'; options: SwitcherOption[]; defaultOption: string }
type DbNavRow = { nav_id: string; label: string; path: string | null; icon: string | null; description: string | null; sort_order: number | null; parent_id: string | null; is_active?: boolean | null };
const isUrwsInternal = (row: DbNavRow) => row.label.trim().toUpperCase().startsWith('URWS ');

const ATHLETE_NAV_BY_AGE: Record<string, string[]> = {
  '5-8': ['Overview'], '9-11': ['Overview', 'Goals', 'Achievements'], '12-14': ['Overview', 'Development', 'Goals', 'Achievements'], '15-17': ['Overview', 'Performance', 'Development', 'Goals', 'Documents', 'Recruiting'], '18+': ['Overview', 'Passport', 'Performance', 'Development', 'Documents', 'Recruiting'],
};

const ADMIN_ALLOWED: Record<string, string[]> = {
  org_admin: ['Command Center','Organization','Hierarchy','Registrar','Rosters','Membership','Programs','Teams','Seasons','Financial Overview','Billing','Invoices','Payments','Facilities','Payroll','Imports','Compliance','Reporting'],
  team_manager: ['Command Center','Registrar','Rosters','Membership','Programs','Teams','Seasons'],
  registrar: ['Command Center','Registrar','Rosters','Membership'],
  treasurer: ['Command Center','Financial Overview','Billing','Invoices','Payments'],
  operations: ['Command Center','Facilities','Payroll','Imports'],
  compliance: ['Command Center','Compliance'],
  reporting: ['Command Center','Reporting'],
};

function adminFallback(role = 'org_admin'): NavigationSection[] {
  const allowed = new Set(ADMIN_ALLOWED[role] || ADMIN_ALLOWED.org_admin);
  const sections: NavigationSection[] = [
    { id: 'admin-main', label: 'ADMIN', items: [
      { id: 'command-center', label: 'Command Center', href: '/admin' },
      { id: 'organization', label: 'Organization', href: '/admin?view=organization' },
      { id: 'hierarchy', label: 'Hierarchy', href: '/admin?view=hierarchy' },
    ]},
    { id: 'team-manager', label: 'TEAM MANAGER', items: [
      { id: 'registrar', label: 'Registrar', href: '/admin?view=registrar' }, { id: 'rosters', label: 'Rosters', href: '/admin?view=rosters' }, { id: 'membership', label: 'Membership', href: '/admin?view=membership' }, { id: 'programs', label: 'Programs', href: '/admin?view=programs' }, { id: 'teams', label: 'Teams', href: '/admin?view=teams' }, { id: 'seasons', label: 'Seasons', href: '/admin?view=seasons' },
    ]},
    { id: 'finance', label: 'FINANCE', items: [
      { id: 'finance', label: 'Financial Overview', href: '/admin?view=finance' }, { id: 'billing', label: 'Billing', href: '/admin?view=billing' }, { id: 'invoices', label: 'Invoices', href: '/admin?view=invoices' }, { id: 'payments', label: 'Payments', href: '/admin?view=payments' },
    ]},
    { id: 'operations', label: 'OPERATIONS', items: [
      { id: 'facilities', label: 'Facilities', href: '/admin?view=facilities' }, { id: 'payroll', label: 'Payroll', href: '/admin?view=payroll' }, { id: 'imports', label: 'Imports', href: '/admin?view=imports' }, { id: 'compliance', label: 'Compliance', href: '/admin?view=compliance' }, { id: 'reporting', label: 'Reporting', href: '/admin?view=reporting' },
    ]},
  ];
  return sections.map(section => ({ ...section, items: section.items.filter(item => allowed.has(item.label)) })).filter(section => section.items.length > 0);
}

function buildSections(rows: DbNavRow[], hubId: string): NavigationSection[] {
  const map = new Map<string, NavigationItem>(); const roots: NavigationItem[] = [];
  for (const row of rows) map.set(row.nav_id, { id: row.nav_id, label: row.label, href: row.path || undefined, icon: row.icon || undefined, description: row.description || undefined, sort_order: row.sort_order || 0, children: [] });
  for (const row of rows) { const item = map.get(row.nav_id); if (!item) continue; if (row.parent_id && map.has(row.parent_id)) map.get(row.parent_id)?.children?.push(item); else roots.push(item); }
  roots.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)); for (const item of roots) item.children?.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const sections: NavigationSection[] = []; const parents=roots.filter(item=>item.children?.length); const standalone=roots.filter(item=>!item.children?.length);
  for (const parent of parents) sections.push({ id: parent.id, label: parent.label.toUpperCase(), items: parent.children || [] });
  if (standalone.length) sections.unshift({ id: `${hubId}-main`, label: hubId.toUpperCase(), items: standalone });
  return sections.filter(section=>section.items.length>0);
}

export async function getNavigation(hubId: string, switcherValue = ''): Promise<NavigationSection[]> {
  if (!hubId) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return hubId === 'admin' ? adminFallback(switcherValue) : [];
  try {
    const { data, error } = await supabase.from('hub_navigation').select('nav_id,label,path,icon,description,sort_order,parent_id,is_active').eq('hub_id', hubId).eq('is_active', true).order('sort_order', { ascending: true });
    if (error || !data?.length) return hubId === 'admin' ? adminFallback(switcherValue) : [];
    let rows = data as DbNavRow[];
    // URWS is authorization/governance logic beneath the Admin OS, never user-facing navigation.
    // The UAT role switcher remains intact and drives the effective role view through hub_role_navigation.
    if (hubId === 'admin') rows = rows.filter(row => !isUrwsInternal(row));
    if (hubId === 'admin' && switcherValue) {
      const { data: role } = await supabase.from('admin_roles').select('role_id').eq('role_name', switcherValue).maybeSingle();
      if (role?.role_id) {
        const { data: permissions, error: permissionError } = await supabase.from('hub_role_navigation').select('nav_id').eq('role_id', role.role_id).eq('can_view', true);
        if (!permissionError && permissions?.length) {
          const allowed = new Set(permissions.map((item: { nav_id: string }) => item.nav_id));
          const childParents = new Set(rows.filter(row=>row.parent_id && allowed.has(row.nav_id)).map(row=>row.parent_id as string));
          rows = rows.filter(row=>allowed.has(row.nav_id)||childParents.has(row.nav_id)||row.label==='Command Center');
        }
      }
    }
    if (hubId === 'athlete') { const allowedLabels = new Set(ATHLETE_NAV_BY_AGE[switcherValue] || ATHLETE_NAV_BY_AGE['5-8']); rows = rows.filter(row=>allowedLabels.has(row.label)); }
    const sections = buildSections(rows, hubId);
    return sections.length ? sections : (hubId === 'admin' ? adminFallback(switcherValue) : []);
  } catch (error) {
    console.error('[navigationDefinitions] getNavigation failed', { hubId, error });
    return hubId === 'admin' ? adminFallback(switcherValue) : [];
  }
}

export async function getSwitcherConfig(hubId: string): Promise<SwitcherConfig> {
  if (hubId === 'athlete') return { type:'age', displayStyle:'radio', defaultOption:'5-8', options:[{id:'5-8',label:'Foundation · Ages 5–8'},{id:'9-11',label:'Development · Ages 9–11'},{id:'12-14',label:'Growth · Ages 12–14'},{id:'15-17',label:'Performance · Ages 15–17'},{id:'18+',label:'Advanced · 18+'}] };
  if (hubId === 'admin') return { type:'role', displayStyle:'radio', defaultOption:'org_admin', options:[{id:'org_admin',label:'Organization Admin'},{id:'team_manager',label:'Team Manager'},{id:'registrar',label:'Registrar'},{id:'treasurer',label:'Treasurer'},{id:'operations',label:'Operations'},{id:'compliance',label:'Compliance'},{id:'reporting',label:'Reporting'}] };
  if (hubId === 'official') return { type:'official_role', displayStyle:'radio', defaultOption:'official', options:[{id:'official',label:'Official'},{id:'meet_referee',label:'Meet Referee'},{id:'starter',label:'Starter'},{id:'stroke_turn',label:'Stroke & Turn'},{id:'judge',label:'Judge'},{id:'meet_director',label:'Meet Director'}] };
  return { type:null, displayStyle:'none', options:[], defaultOption:'' };
}
