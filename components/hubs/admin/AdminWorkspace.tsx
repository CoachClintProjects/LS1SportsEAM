'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// COMPONENT REGISTRY - Maps component names from DB to actual components
// =============================================================================

import { CommandCenter } from './CommandCenter';
import { OrganizationArchitecture } from './OrganizationArchitecture';
import { TeamManager } from './TeamManager';
import { RegistrarValidation } from './RegistrarValidation';
import { FinanceAccounting } from './FinanceAccounting';
import { Facilities } from './Facilities';
import { Payroll } from './Payroll';
import { Imports } from './Imports';
import { Compliance } from './Compliance';
import { Reporting } from './Reporting';

// Placeholder components for views that don't have dedicated components yet
const RostersView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Rosters</h1>
    <p className="text-neutral-400 mt-2">Roster management coming soon.</p>
  </div>
);

const MembershipView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Membership</h1>
    <p className="text-neutral-400 mt-2">Membership management coming soon.</p>
  </div>
);

const ProgramsView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Programs</h1>
    <p className="text-neutral-400 mt-2">Programs management coming soon.</p>
  </div>
);

const TeamsView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Teams</h1>
    <p className="text-neutral-400 mt-2">Teams management coming soon.</p>
  </div>
);

const SeasonsView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Seasons</h1>
    <p className="text-neutral-400 mt-2">Seasons management coming soon.</p>
  </div>
);

const BillingView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Billing</h1>
    <p className="text-neutral-400 mt-2">Billing management coming soon.</p>
  </div>
);

const InvoicesView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Invoices</h1>
    <p className="text-neutral-400 mt-2">Invoice management coming soon.</p>
  </div>
);

const PaymentsView = () => (
  <div className="text-white p-6">
    <h1 className="text-2xl font-black">Payments</h1>
    <p className="text-neutral-400 mt-2">Payment management coming soon.</p>
  </div>
);

// Component registry - maps database component names to React components
const componentRegistry: Record<string, React.ComponentType> = {
  // ADMIN section
  'CommandCenter': CommandCenter,
  'OrganizationArchitecture': OrganizationArchitecture,
  
  // TEAM MANAGER section
  'TeamManager': TeamManager,
  'RegistrarValidation': RegistrarValidation,
  'RostersView': RostersView,
  'MembershipView': MembershipView,
  'ProgramsView': ProgramsView,
  'TeamsView': TeamsView,
  'SeasonsView': SeasonsView,
  
  // FINANCE section
  'FinanceAccounting': FinanceAccounting,
  'BillingView': BillingView,
  'InvoicesView': InvoicesView,
  'PaymentsView': PaymentsView,
  
  // OPERATIONS section
  'Facilities': Facilities,
  'Payroll': Payroll,
  'Imports': Imports,
  'Compliance': Compliance,
  'Reporting': Reporting,
};

// =============================================================================
// FALLBACK COMPONENT
// =============================================================================

const FallbackComponent = ({ componentName }: { componentName?: string }) => (
  <div className="flex h-full items-center justify-center p-12">
    <div className="text-center">
      <div className="text-2xl font-black text-white">Admin Workspace</div>
      <p className="mt-2 text-sm text-neutral-500">
        {componentName ? `Component "${componentName}" is being built.` : 'This workspace is being built.'}
      </p>
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT: AdminWorkspace
// =============================================================================

export function AdminWorkspace() {
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<string | null>(null);
  const [ActiveComponent, setActiveComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [componentName, setComponentName] = useState<string>('');

  // Get active view from URL
  useEffect(() => {
    const view = searchParams.get('view');
    if (view) {
      setActiveView(view);
    } else {
      // Default view if none specified - look up Command Center nav_id
      const loadDefaultView = async () => {
        try {
          const { data } = await supabase
            .from('hub_navigation')
            .select('nav_id')
            .eq('hub_id', 'admin')
            .eq('label', 'Command Center')
            .single();
          if (data) {
            setActiveView(data.nav_id);
          } else {
            setActiveView('command-center');
          }
        } catch {
          setActiveView('command-center');
        }
      };
      loadDefaultView();
    }
  }, [searchParams]);

  // Load component from database based on view
  useEffect(() => {
    if (!activeView) return;

    const loadComponent = async () => {
      setLoading(true);
      try {
        // Query the database for the navigation item that matches this view
        const { data, error } = await supabase
          .from('hub_navigation')
          .select('component, label')
          .eq('hub_id', 'admin')
          .eq('nav_id', activeView)
          .single();

        if (error) {
          console.error('Error loading component from database:', error);
          // Try to find by path
          const path = `/admin?view=${activeView}`;
          const { data: pathData } = await supabase
            .from('hub_navigation')
            .select('component, label')
            .eq('hub_id', 'admin')
            .eq('path', path)
            .single();
          
          if (pathData && pathData.component) {
            const Component = componentRegistry[pathData.component];
            if (Component) {
              setActiveComponent(() => Component);
              setComponentName(pathData.component);
            } else {
              setActiveComponent(() => () => <FallbackComponent componentName={pathData.component} />);
              setComponentName(pathData.component);
            }
          } else {
            setActiveComponent(() => () => <FallbackComponent />);
            setComponentName('');
          }
        } else if (data && data.component) {
          // Use the component from the database
          const Component = componentRegistry[data.component];
          if (Component) {
            setActiveComponent(() => Component);
            setComponentName(data.component);
          } else {
            setActiveComponent(() => () => <FallbackComponent componentName={data.component} />);
            setComponentName(data.component);
          }
        } else {
          // No component specified - this might be a parent section
          setActiveComponent(() => () => (
            <div className="text-white p-6">
              <h1 className="text-2xl font-black">{data?.label || 'Section'}</h1>
              <p className="text-neutral-400 mt-2">This is a parent section. Please select a sub-item from the navigation.</p>
            </div>
          ));
          setComponentName('');
        }
      } catch (error) {
        console.error('Error:', error);
        setActiveComponent(() => () => <FallbackComponent />);
        setComponentName('');
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, [activeView]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  // Render the active component
  const ComponentToRender = ActiveComponent || FallbackComponent;

  return (
    <div className="min-h-full w-full">
      <ComponentToRender />
    </div>
  );
}

export default AdminWorkspace;