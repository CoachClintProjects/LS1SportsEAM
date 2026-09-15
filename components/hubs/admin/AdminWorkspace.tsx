'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

let browserSupabase: SupabaseClient | null | undefined;

function getSupabaseClient(): SupabaseClient | null {
  if (browserSupabase !== undefined) return browserSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  browserSupabase = url && key ? createClient(url, key) : null;
  return browserSupabase;
}

const RostersView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Rosters</h1><p className="text-neutral-400 mt-2">Roster management coming soon.</p></div>;
const MembershipView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Membership</h1><p className="text-neutral-400 mt-2">Membership management coming soon.</p></div>;
const ProgramsView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Programs</h1><p className="text-neutral-400 mt-2">Programs management coming soon.</p></div>;
const TeamsView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Teams</h1><p className="text-neutral-400 mt-2">Teams management coming soon.</p></div>;
const SeasonsView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Seasons</h1><p className="text-neutral-400 mt-2">Seasons management coming soon.</p></div>;
const BillingView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Billing</h1><p className="text-neutral-400 mt-2">Billing management coming soon.</p></div>;
const InvoicesView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Invoices</h1><p className="text-neutral-400 mt-2">Invoice management coming soon.</p></div>;
const PaymentsView = () => <div className="text-white p-6"><h1 className="text-2xl font-black">Payments</h1><p className="text-neutral-400 mt-2">Payment management coming soon.</p></div>;

const componentRegistry: Record<string, React.ComponentType> = {
  CommandCenter,
  OrganizationArchitecture,
  TeamManager,
  RegistrarValidation,
  RostersView,
  MembershipView,
  ProgramsView,
  TeamsView,
  SeasonsView,
  FinanceAccounting,
  BillingView,
  InvoicesView,
  PaymentsView,
  Facilities,
  Payroll,
  Imports,
  Compliance,
  Reporting,
};

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

export function AdminWorkspace() {
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<string | null>(null);
  const [ActiveComponent, setActiveComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view) {
      setActiveView(view);
      return;
    }

    const loadDefaultView = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setActiveView('command-center');
        return;
      }

      try {
        const { data } = await supabase
          .from('hub_navigation')
          .select('nav_id')
          .eq('hub_id', 'admin')
          .eq('label', 'Command Center')
          .single();
        setActiveView(data?.nav_id || 'command-center');
      } catch {
        setActiveView('command-center');
      }
    };

    void loadDefaultView();
  }, [searchParams]);

  useEffect(() => {
    if (!activeView) return;

    const loadComponent = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          const fallback = activeView === 'command-center' ? CommandCenter : null;
          setActiveComponent(() => fallback || (() => <FallbackComponent />));
          return;
        }

        const { data, error } = await supabase
          .from('hub_navigation')
          .select('component, label')
          .eq('hub_id', 'admin')
          .eq('nav_id', activeView)
          .single();

        let resolved = data;
        if (error) {
          const path = `/admin?view=${activeView}`;
          const { data: pathData } = await supabase
            .from('hub_navigation')
            .select('component, label')
            .eq('hub_id', 'admin')
            .eq('path', path)
            .single();
          resolved = pathData;
        }

        if (resolved?.component) {
          const Component = componentRegistry[resolved.component];
          setActiveComponent(() => Component || (() => <FallbackComponent componentName={resolved?.component || undefined} />));
        } else if (resolved) {
          const label = resolved.label || 'Section';
          setActiveComponent(() => () => (
            <div className="text-white p-6">
              <h1 className="text-2xl font-black">{label}</h1>
              <p className="text-neutral-400 mt-2">This is a parent section. Please select a sub-item from the navigation.</p>
            </div>
          ));
        } else {
          setActiveComponent(() => () => <FallbackComponent />);
        }
      } catch (error) {
        console.error('Error loading Admin workspace:', error);
        setActiveComponent(() => () => <FallbackComponent />);
      } finally {
        setLoading(false);
      }
    };

    void loadComponent();
  }, [activeView]);

  if (loading) {
    return <div className="flex h-full items-center justify-center p-12"><div className="text-sm text-neutral-500">Loading...</div></div>;
  }

  const ComponentToRender = ActiveComponent || FallbackComponent;
  return <div className="min-h-full w-full"><ComponentToRender /></div>;
}

export default AdminWorkspace;
