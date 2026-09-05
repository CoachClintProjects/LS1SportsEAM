// =====================================================
// LS1Sports Navigation Definitions
// =====================================================
// SECTION: RESPONSIBILITY
// - Fetch navigation from the database.
// - Fetch switcher options from the database.
// - Filter by role using hub_role_navigation table.
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =====================================================
// TYPES
// =====================================================

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  children?: NavigationItem[];
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

export type SwitcherOption = {
  id: string;
  label: string;
  description?: string;
};

export type SwitcherConfig = {
  type: 'age' | 'role' | 'official_role' | 'scout' | null;
  displayStyle: 'radio' | 'dropdown' | 'none';
  options: SwitcherOption[];
  defaultOption: string;
};

// =====================================================
// FETCH SWITCHER DATA FROM DATABASE
// =====================================================

export async function getSwitcherConfig(hubId: string): Promise<SwitcherConfig> {
  // Default empty config
  const defaultConfig: SwitcherConfig = {
    type: null,
    displayStyle: 'none',
    options: [],
    defaultOption: ''
  };

  try {
    // Athlete Hub - fetch age options
    if (hubId === 'athlete') {
      const { data, error } = await supabase
        .from('athlete_age_options')
        .select('age_code, display_name, description')
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return defaultConfig;
      }

      return {
        type: 'age',
        displayStyle: 'radio',
        options: data.map((item: any) => ({
          id: item.age_code,
          label: item.display_name,
          description: item.description
        })),
        defaultOption: data[0]?.age_code || '5-8'
      };
    }

    // Admin Hub - fetch role options
    if (hubId === 'admin') {
      const { data, error } = await supabase
        .from('admin_role_switcher_options')
        .select('role_name, display_name, description')
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return defaultConfig;
      }

      return {
        type: 'role',
        displayStyle: 'radio',
        options: data.map((item: any) => ({
          id: item.role_name,
          label: item.display_name,
          description: item.description
        })),
        defaultOption: data[0]?.role_name || 'org_admin'
      };
    }

    // Official Hub - fetch official role options
    if (hubId === 'official') {
      const { data, error } = await supabase
        .from('official_role_switcher_options')
        .select('role_name, display_name, description')
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return defaultConfig;
      }

      return {
        type: 'official_role',
        displayStyle: 'radio',
        options: data.map((item: any) => ({
          id: item.role_name,
          label: item.display_name,
          description: item.description
        })),
        defaultOption: data[0]?.role_name || 'official'
      };
    }

    // Scout Hub - no switcher
    if (hubId === 'scout') {
      return {
        type: 'scout',
        displayStyle: 'none',
        options: [],
        defaultOption: ''
      };
    }

    return defaultConfig;
  } catch (error) {
    console.error('Error fetching switcher config:', error);
    return defaultConfig;
  }
}

// =====================================================
// GET NAVIGATION FROM DATABASE
// =====================================================

export async function getNavigation(
  hubId: string,
  switcherValue: string = ''
): Promise<NavigationSection[]> {
  if (!hubId) return [];

  try {
    // 1. Get role_id from switcher value (for admin/official hubs)
    let roleId = null;
    if (hubId === 'admin' || hubId === 'official') {
      const { data: roleData } = await supabase
        .from('admin_roles')
        .select('role_id')
        .eq('role_name', switcherValue)
        .single();
      roleId = roleData?.role_id || null;
    }

    // 2. Get navigation items for this hub
    const { data: navItems, error: navError } = await supabase
      .from('hub_navigation')
      .select('*')
      .eq('hub_id', hubId)
      .order('sort_order', { ascending: true });

    if (navError || !navItems || navItems.length === 0) {
      return [];
    }

    // 3. If roleId exists, filter items by role
    let filteredNavIds: string[] = [];
    if (roleId) {
      const { data: roleNavData } = await supabase
        .from('hub_role_navigation')
        .select('nav_id')
        .eq('role_id', roleId)
        .eq('can_view', true);

      filteredNavIds = roleNavData?.map((item: any) => item.nav_id) || [];
    }

    // 4. Build navigation tree
    const itemMap = new Map<string, NavigationItem>();
    const rootItems: NavigationItem[] = [];

    // First pass: create all items
    for (const item of navItems) {
      // Skip if role filtering applies and this item is not in the allowed list
      if (roleId && !filteredNavIds.includes(item.nav_id)) {
        continue;
      }

      const navItem: NavigationItem = {
        id: item.nav_id,
        label: item.label,
        href: item.path || undefined,
        icon: item.icon || undefined,
        children: []
      };
      itemMap.set(item.nav_id, navItem);
    }

    // Second pass: build hierarchy
    for (const item of navItems) {
      if (roleId && !filteredNavIds.includes(item.nav_id)) {
        continue;
      }

      const current = itemMap.get(item.nav_id);
      if (!current) continue;

      if (item.parent_id && itemMap.has(item.parent_id)) {
        // This is a child item - add to parent's children
        const parent = itemMap.get(item.parent_id);
        if (parent && parent.children) {
          parent.children.push(current);
        }
      } else {
        // This is a root item
        rootItems.push(current);
      }
    }

    // 5. Convert to sections (group by parent or use label as section)
    const sections: NavigationSection[] = [];

    // Find items that are sections (have children)
    const sectionItems = rootItems.filter(item => 
      item.children && item.children.length > 0
    );

    // Find items that are standalone (no children)
    const standaloneItems = rootItems.filter(item => 
      !item.children || item.children.length === 0
    );

    // Create sections from items with children
    for (const section of sectionItems) {
      sections.push({
        id: section.id,
        label: section.label.toUpperCase(),
        items: section.children || []
      });
    }

    // Handle standalone items - group them into a default section
    if (standaloneItems.length > 0) {
      sections.push({
        id: 'default',
        label: hubId.toUpperCase(),
        items: standaloneItems
      });
    }

    return sections;

  } catch (error) {
    console.error('Error in getNavigation:', error);
    return [];
  }
}