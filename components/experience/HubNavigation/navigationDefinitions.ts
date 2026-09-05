// =====================================================
// LS1Sports Navigation Definitions
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

// =====================================================
// GET NAVIGATION FROM DATABASE
// =====================================================

export async function getNavigation(
  hubId: string,
  switcherValue: string = ''
): Promise<NavigationSection[]> {
  if (!hubId) return [];

  try {
    // Get navigation items for this hub
    const { data: navItems, error: navError } = await supabase
      .from('hub_navigation')
      .select('*')
      .eq('hub_id', hubId)
      .order('sort_order', { ascending: true });

    if (navError || !navItems || navItems.length === 0) {
      return [];
    }

    // ================================================================
    // FILTER BY SWITCHER VALUE (Role/Age)
    // ================================================================
    let filteredItems = navItems;

    // For Admin Hub - filter by role
    if (hubId === 'admin' && switcherValue) {
      // Get the role ID for this switcher value
      const { data: roleData } = await supabase
        .from('admin_roles')
        .select('role_id')
        .eq('role_name', switcherValue)
        .single();

      if (roleData) {
        // Get navigation items allowed for this role
        const { data: roleNavData } = await supabase
          .from('hub_role_navigation')
          .select('nav_id')
          .eq('role_id', roleData.role_id)
          .eq('can_view', true);

        if (roleNavData && roleNavData.length > 0) {
          const allowedNavIds = roleNavData.map((item: any) => item.nav_id);
          // Filter: only keep items that are in the allowed list OR are parent items
          filteredItems = navItems.filter(item => {
            // Always include parent sections (items with children that have no parent_id)
            const isParent = item.parent_id === null && navItems.some(child => child.parent_id === item.nav_id);
            // Always include items that are explicitly allowed
            const isAllowed = allowedNavIds.includes(item.nav_id);
            // Always include the command-center (dashboard)
            const isCommandCenter = item.label === 'Command Center' || item.path === '/admin';
            return isAllowed || isParent || isCommandCenter;
          });
        }
      }
    }

    // For Athlete Hub - navigation stays the same for all ages
    // The age changes the AthleteWorkspace content, not the sidebar
    if (hubId === 'athlete') {
      // Athlete navigation stays the same regardless of age
    }

    // Build navigation tree with filtered items
    const itemMap = new Map<string, NavigationItem>();
    const rootItems: NavigationItem[] = [];

    for (const item of filteredItems) {
      const navItem: NavigationItem = {
        id: item.nav_id,
        label: item.label,
        href: item.path || undefined,
        icon: item.icon || undefined,
        description: item.description || undefined,
        sort_order: item.sort_order || 0,
        children: []
      };
      itemMap.set(item.nav_id, navItem);
    }

    // Build hierarchy
    for (const item of filteredItems) {
      const current = itemMap.get(item.nav_id);
      if (!current) continue;

      if (item.parent_id && itemMap.has(item.parent_id)) {
        const parent = itemMap.get(item.parent_id);
        if (parent && parent.children) {
          parent.children.push(current);
        }
      } else {
        rootItems.push(current);
      }
    }

    // Sort root items
    rootItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Convert to sections
    const sections: NavigationSection[] = [];

    const sectionItems = rootItems.filter(item => 
      item.children && item.children.length > 0
    );

    const standaloneItems = rootItems.filter(item => 
      !item.children || item.children.length === 0
    );

    for (const section of sectionItems) {
      sections.push({
        id: section.id,
        label: section.label.toUpperCase(),
        items: section.children || []
      });
    }

    if (standaloneItems.length > 0) {
      sections.push({
        id: 'default',
        label: hubId.toUpperCase(),
        items: standaloneItems
      });
    }

    // Ensure sections have content
    const filteredSections = sections.filter(section => section.items.length > 0);
    
    // If no sections after filtering, return fallback
    if (filteredSections.length === 0) {
      // Return at least a default section with Command Center
      const commandCenterItem = navItems.find(item => item.label === 'Command Center' || item.path === '/admin');
      if (commandCenterItem) {
        return [{
          id: 'default',
          label: hubId.toUpperCase(),
          items: [{
            id: commandCenterItem.nav_id,
            label: commandCenterItem.label,
            href: commandCenterItem.path || '/admin',
            icon: commandCenterItem.icon || undefined,
            description: commandCenterItem.description || undefined,
            sort_order: commandCenterItem.sort_order || 0
          }]
        }];
      }
    }

    return filteredSections;

  } catch (error) {
    console.error('Error in getNavigation:', error);
    return [];
  }
}

// =====================================================
// GET SWITCHER CONFIG
// =====================================================

export async function getSwitcherConfig(hubId: string): Promise<SwitcherConfig> {
  // Return default config for now
  return {
    type: null,
    displayStyle: 'none',
    options: [],
    defaultOption: ''
  };
}