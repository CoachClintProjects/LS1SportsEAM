'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  DollarSign,
  Warehouse,
  Briefcase,
  Upload,
  ClipboardCheck,
  BarChart3,
  Shield,
  ChevronDown,
  ChevronRight,
  Bell,
  Search,
  RefreshCw,
  Menu,
  X,
  FolderTree,
  Calendar,
  FileText,
  CreditCard,
  Receipt
} from 'lucide-react';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Navigation item structure from database
interface NavItem {
  nav_id: string;
  hub_id: string;
  parent_id: string | null;
  label: string;
  icon: string | null;
  path: string | null;
  component: string | null;
  sort_order: number;
  children?: NavItem[];
}

// Role structure from database
interface Role {
  role_id: string;
  role_name: string;
  description: string;
}

// =============================================================================
// FALLBACK COMPONENT
// =============================================================================
// Rendered when a real component isn't available yet

const FallbackComponent = ({ title }: { title: string }) => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center">
      <div className="text-2xl font-black text-white">{title}</div>
      <p className="mt-2 text-sm text-neutral-500">This workspace is being built.</p>
    </div>
  </div>
);

// =============================================================================
// COMPONENT MAP
// =============================================================================
// Maps database component names to actual React components
// Add new components here when they're built

const componentMap: Record<string, React.ComponentType<any>> = {};

// Try to import each component from the admin folder
const componentNames = [
  'CommandCenter',
  'OrganizationArchitecture',
  'TeamManager',
  'RegistrarValidation',
  'FinanceAccounting',
  'Facilities',
  'Payroll',
  'Imports',
  'Compliance',
  'Reporting'
];

// Register each component with a fallback if it doesn't exist
componentNames.forEach(name => {
  try {
    const module = require(`./${name}`);
    componentMap[name] = module.default || module;
  } catch (e) {
    componentMap[name] = () => <FallbackComponent title={name} />;
  }
});

// Placeholder components for views that don't have real components yet
componentMap['RostersView'] = () => <FallbackComponent title="Rosters" />;
componentMap['MembershipView'] = () => <FallbackComponent title="Membership" />;
componentMap['ProgramsView'] = () => <FallbackComponent title="Programs" />;
componentMap['TeamsView'] = () => <FallbackComponent title="Teams" />;
componentMap['SeasonsView'] = () => <FallbackComponent title="Seasons" />;
componentMap['BillingView'] = () => <FallbackComponent title="Billing" />;
componentMap['InvoicesView'] = () => <FallbackComponent title="Invoices" />;
componentMap['PaymentsView'] = () => <FallbackComponent title="Payments" />;

// =============================================================================
// ICON MAP
// =============================================================================
// Maps database icon names to Lucide components
// Add new icons here as needed

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  Building2: <Building2 className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  UserCheck: <UserCheck className="h-4 w-4" />,
  DollarSign: <DollarSign className="h-4 w-4" />,
  Warehouse: <Warehouse className="h-4 w-4" />,
  Briefcase: <Briefcase className="h-4 w-4" />,
  Upload: <Upload className="h-4 w-4" />,
  ClipboardCheck: <ClipboardCheck className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
  FolderTree: <FolderTree className="h-4 w-4" />,
  Calendar: <Calendar className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  CreditCard: <CreditCard className="h-4 w-4" />,
  Receipt: <Receipt className="h-4 w-4" />,
  Users2: <Users className="h-4 w-4" />,
};

// =============================================================================
// MAIN COMPONENT: AdminWorkspace
// =============================================================================

export function AdminWorkspace() {
  // ===========================================================================
  // STATE
  // ===========================================================================

  const [loading, setLoading] = useState(true);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [activeView, setActiveView] = useState<string>('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Load navigation data on mount
  useEffect(() => {
    loadNavigation();
  }, []);

  // Reload navigation when role changes
  useEffect(() => {
    if (currentRole) {
      loadNavigationForRole(currentRole);
    }
  }, [currentRole]);

  // ===========================================================================
  // DATA LOADING FUNCTIONS
  // ===========================================================================

  // Load roles and set default role
  const loadNavigation = async () => {
    setLoading(true);
    try {
      // Get all roles from database
      const { data: rolesData, error: rolesError } = await supabase
        .from('admin_roles')
        .select('*');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Set first role as default
      if (rolesData && rolesData.length > 0) {
        setCurrentRole(rolesData[0].role_name);
        await loadNavigationForRole(rolesData[0].role_name);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading navigation:', error);
      setLoading(false);
    }
  };

  // Load navigation items for a specific role
  const loadNavigationForRole = async (roleName: string) => {
    try {
      // 1. Get the role ID
      const { data: roleData, error: roleError } = await supabase
        .from('admin_roles')
        .select('role_id')
        .eq('role_name', roleName)
        .single();

      if (roleError) throw roleError;

      // 2. Get navigation items for this role via the junction table
      const { data: navData, error: navError } = await supabase
        .from('hub_role_navigation')
        .select(`
          nav_id,
          hub_navigation:nav_id (
            nav_id,
            hub_id,
            parent_id,
            label,
            icon,
            path,
            component,
            sort_order
          )
        `)
        .eq('role_id', roleData.role_id)
        .eq('can_view', true);

      if (navError) throw navError;

      // 3. Extract and filter out null values
      const items: NavItem[] = navData
        .map((item: any) => {
          const nav = item.hub_navigation;
          if (!nav) return null;
          return {
            nav_id: nav.nav_id,
            hub_id: nav.hub_id,
            parent_id: nav.parent_id,
            label: nav.label,
            icon: nav.icon,
            path: nav.path,
            component: nav.component,
            sort_order: nav.sort_order || 0,
            children: []
          };
        })
        .filter((item: NavItem | null): item is NavItem => item !== null);

      // 4. Build parent-child hierarchy
      const itemMap = new Map<string, NavItem>();
      const rootItems: NavItem[] = [];

      // First pass: create map of all items
      items.forEach(item => {
        itemMap.set(item.nav_id, { ...item, children: [] });
      });

      // Second pass: build tree structure
      items.forEach(item => {
        const current = itemMap.get(item.nav_id)!;
        if (item.parent_id && itemMap.has(item.parent_id)) {
          const parent = itemMap.get(item.parent_id)!;
          if (!parent.children) parent.children = [];
          parent.children.push(current);
        } else {
          rootItems.push(current);
        }
      });

      // 5. Sort by sort_order
      rootItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      // 6. Update state
      setNavItems(rootItems);

      // Set first item as active view
      if (rootItems.length > 0) {
        setActiveView(rootItems[0].nav_id);
      }

      // Auto-expand sections that have children
      const sectionsWithChildren = rootItems
        .filter(item => item.children && item.children.length > 0)
        .map(item => item.nav_id);
      setExpandedSections(sectionsWithChildren);

      setLoading(false);
    } catch (error) {
      console.error('Error loading navigation for role:', error);
      setLoading(false);
    }
  };

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  // Find the active component by searching the nav tree
  const findActiveComponent = (items: NavItem[]): React.ComponentType<any> | null => {
    for (const item of items) {
      if (item.nav_id === activeView && item.component && componentMap[item.component]) {
        return componentMap[item.component];
      }
      if (item.children) {
        const found = findActiveComponent(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  // ===========================================================================
  // RENDER FUNCTIONS
  // ===========================================================================

  // Render navigation items recursively
  const renderNavItems = (items: NavItem[], level: number = 0) => {
    return items.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedSections.includes(item.nav_id);
      const isActive = activeView === item.nav_id;
      const paddingLeft = level > 0 ? `${level * 12 + 12}px` : '12px';
      const icon = item.icon && iconMap[item.icon] ? iconMap[item.icon] : <FileText className="h-4 w-4" />;

      // =========================================================================
      // SECTION HEADER (has children - expandable)
      // =========================================================================
      if (hasChildren) {
        return (
          <div key={item.nav_id}>
            <button
              onClick={() => {
                setExpandedSections(prev =>
                  prev.includes(item.nav_id)
                    ? prev.filter(id => id !== item.nav_id)
                    : [...prev, item.nav_id]
                );
              }}
              className={`
                flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
                ${isActive ? 'bg-[#FA4616]/10 text-[#FA4616]' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
              `}
              style={{ paddingLeft }}
            >
              {icon}
              <span className="flex-1 text-left">{item.label}</span>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            {isExpanded && (
              <div className="ml-2">
                {renderNavItems(item.children!, level + 1)}
              </div>
            )}
          </div>
        );
      }

      // =========================================================================
      // NAV ITEM (no children - clickable)
      // =========================================================================
      return (
        <button
          key={item.nav_id}
          onClick={() => {
            setActiveView(item.nav_id);
          }}
          className={`
            flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
            ${isActive ? 'bg-[#FA4616]/10 text-[#FA4616]' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
          `}
          style={{ paddingLeft }}
        >
          {icon}
          <span className="flex-1 text-left">{item.label}</span>
          {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#FA4616]" />}
        </button>
      );
    });
  };

  // ===========================================================================
  // LOADING STATE
  // ===========================================================================

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050707]">
        <div className="text-neutral-500">Loading Admin Workspace...</div>
      </div>
    );
  }

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  const ActiveComponent = findActiveComponent(navItems) || (() => <FallbackComponent title="Dashboard" />);
  const currentRoleLabel = roles.find(r => r.role_name === currentRole)?.description || currentRole;

  return (
    <div className="flex h-screen bg-[#050707]">

      {/* =====================================================================
           SIDEBAR
           ===================================================================== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform border-r border-neutral-800 bg-[#090b0b] transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
      >
        {/* --- Sidebar Header --- */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#FA4616]" />
            <span className="text-sm font-black text-white">Admin Hub</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-neutral-500 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* --- Role Selector --- */}
        <div className="border-b border-neutral-800 p-3">
          <div className="relative">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white hover:border-neutral-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#FA4616]" />
                <span className="truncate">{currentRoleLabel}</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* --- Role Dropdown --- */}
            {isRoleDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-neutral-800 bg-[#090b0b] shadow-xl">
                {roles.map((role) => (
                  <button
                    key={role.role_id}
                    onClick={() => {
                      setCurrentRole(role.role_name);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`
                      flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors
                      ${currentRole === role.role_name ? 'bg-[#FA4616]/10 text-[#FA4616]' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
                    `}
                  >
                    <Shield className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{role.description}</div>
                      <div className="text-[10px] text-neutral-500">{role.role_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Navigation --- */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {renderNavItems(navItems)}
          </div>
        </nav>

        {/* --- Sidebar Footer --- */}
        <div className="border-t border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-neutral-600">System Online</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">HPAC · Swimming</span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
           MAIN CONTENT AREA
           ===================================================================== */}
      <main className="flex-1 overflow-y-auto bg-[#050707]">

        {/* --- Top Bar --- */}
        <div className="sticky top-0 z-10 border-b border-neutral-800 bg-[#090b0b]/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-3">

            {/* Left side: Mobile toggle + breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <span className="text-xs text-neutral-500 lg:hidden">
                {currentRoleLabel}
              </span>

              <button className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors">
                <Bell className="h-4 w-4" />
              </button>

              <div className="h-4 w-px bg-neutral-800" />

              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Sport:</span>
                <span className="font-bold text-white">Swimming</span>
              </div>
            </div>

            {/* Right side: Search + actions */}
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-neutral-800 bg-black px-3 py-1.5 lg:flex">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-48 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                />
              </div>

              <button className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>

              {/* User avatar */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FA4616]/20 text-xs font-bold text-[#FA4616]">
                CK
              </div>
            </div>
          </div>
        </div>

        {/* --- Page Content --- */}
        <div className="p-6">
          <ActiveComponent />
        </div>

      </main>
    </div>
  );
}

// =============================================================================
// EXPORT
// =============================================================================

export default AdminWorkspace;