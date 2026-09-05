// =====================================================
// LS1Sports Navigation Definitions
// =====================================================
// SECTION: RESPONSIBILITY
// - Fetch navigation from the database.
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
  description?: string;  // ADDED: from database
  children?: NavigationItem[];
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

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
        description: item.description || undefined,  // ADDED: fetch from database
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