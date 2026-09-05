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
  sort_order?: number;  // ADD THIS
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

    // Build navigation tree
    const itemMap = new Map<string, NavigationItem>();
    const rootItems: NavigationItem[] = [];

    // First pass: create all items
    for (const item of navItems) {
      const navItem: NavigationItem = {
        id: item.nav_id,
        label: item.label,
        href: item.path || undefined,
        icon: item.icon || undefined,
        description: item.description || undefined,
        children: []
      };
      itemMap.set(item.nav_id, navItem);
    }

    // Second pass: build hierarchy
    for (const item of navItems) {
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

    return sections;

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
  // This will be database-driven once the switcher tables are populated
  return {
    type: null,
    displayStyle: 'none',
    options: [],
    defaultOption: ''
  };
}