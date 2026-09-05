'use client';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
  children?: NavigationItem[];
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

export interface SwitcherOption {
  id: string;
  label: string;
  description?: string;
}

export interface SwitcherConfig {
  type: 'age' | 'role' | 'official_role' | 'scout' | null;
  displayStyle: 'radio' | 'dropdown' | 'none';
  options: SwitcherOption[];
  defaultOption: string;
}

type DbNavRow = {
  nav_id: string;
  label: string;
  path: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number | null;
  parent_id: string | null;
  is_active?: boolean | null;
};

const ATHLETE_NAV_BY_AGE: Record<string, string[]> = {
  '5-8': ['Overview'],
  '9-11': ['Overview', 'Goals', 'Achievements'],
  '12-14': ['Overview', 'Development', 'Goals', 'Achievements'],
  '15-17': ['Overview', 'Performance', 'Development', 'Goals', 'Documents', 'Recruiting'],
  '18+': ['Overview', 'Passport', 'Performance', 'Development', 'Documents', 'Recruiting'],
};

function buildSections(rows: DbNavRow[], hubId: string): NavigationSection[] {
  const map = new Map<string, NavigationItem>();
  const roots: NavigationItem[] = [];

  for (const row of rows) {
    map.set(row.nav_id, {
      id: row.nav_id,
      label: row.label,
      href: row.path || undefined,
      icon: row.icon || undefined,
      description: row.description || undefined,
      sort_order: row.sort_order || 0,
      children: [],
    });
  }

  for (const row of rows) {
    const item = map.get(row.nav_id);
    if (!item) continue;

    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)?.children?.push(item);
    } else {
      roots.push(item);
    }
  }

  roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  for (const item of roots) {
    item.children?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  const sections: NavigationSection[] = [];
  const parents = roots.filter((item) => item.children?.length);
  const standalone = roots.filter((item) => !item.children?.length);

  for (const parent of parents) {
    sections.push({
      id: parent.id,
      label: parent.label.toUpperCase(),
      items: parent.children || [],
    });
  }

  if (standalone.length) {
    sections.unshift({
      id: `${hubId}-main`,
      label: hubId.toUpperCase(),
      items: standalone,
    });
  }

  return sections.filter((section) => section.items.length > 0);
}

export async function getNavigation(
  hubId: string,
  switcherValue = '',
): Promise<NavigationSection[]> {
  if (!hubId) return [];

  try {
    const { data, error } = await supabase
      .from('hub_navigation')
      .select('nav_id,label,path,icon,description,sort_order,parent_id,is_active')
      .eq('hub_id', hubId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data?.length) return [];

    let rows = data as DbNavRow[];

    if (hubId === 'admin' && switcherValue) {
      const { data: role } = await supabase
        .from('admin_roles')
        .select('role_id')
        .eq('role_name', switcherValue)
        .maybeSingle();

      if (role?.role_id) {
        const { data: permissions } = await supabase
          .from('hub_role_navigation')
          .select('nav_id')
          .eq('role_id', role.role_id)
          .eq('can_view', true);

        const allowed = new Set((permissions || []).map((item: { nav_id: string }) => item.nav_id));
        const childParents = new Set(
          rows
            .filter((row) => row.parent_id && allowed.has(row.nav_id))
            .map((row) => row.parent_id as string),
        );

        rows = rows.filter(
          (row) =>
            allowed.has(row.nav_id) ||
            childParents.has(row.nav_id) ||
            row.label === 'Command Center',
        );
      }
    }

    if (hubId === 'athlete') {
      const allowedLabels = new Set(
        ATHLETE_NAV_BY_AGE[switcherValue] || ATHLETE_NAV_BY_AGE['5-8'],
      );
      rows = rows.filter((row) => allowedLabels.has(row.label));
    }

    return buildSections(rows, hubId);
  } catch (error) {
    console.error('[navigationDefinitions] getNavigation failed', { hubId, error });
    return [];
  }
}

export async function getSwitcherConfig(hubId: string): Promise<SwitcherConfig> {
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
        { id: '18+', label: 'Advanced · 18+' },
      ],
    };
  }

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
        { id: 'reporting', label: 'Reporting' },
      ],
    };
  }

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
        { id: 'meet_director', label: 'Meet Director' },
      ],
    };
  }

  return { type: null, displayStyle: 'none', options: [], defaultOption: '' };
}
