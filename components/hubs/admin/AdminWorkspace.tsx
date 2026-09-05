'use client';

// =============================================================================
// IMPORTS
// =============================================================================

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// =============================================================================
// IMPORT ALL ADMIN COMPONENTS
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

// =============================================================================
// COMPONENT MAP - Maps view IDs to components
// =============================================================================

const componentMap: Record<string, React.ComponentType> = {
  // ADMIN section
  'command-center': CommandCenter,
  'organization': OrganizationArchitecture,
  'hierarchy': OrganizationArchitecture,
  
  // TEAM MANAGER section
  'registrar': RegistrarValidation,
  'rosters': TeamManager,
  'membership': TeamManager,
  'programs': TeamManager,
  'teams': TeamManager,
  'seasons': TeamManager,
  
  // FINANCE section
  'financial-overview': FinanceAccounting,
  'billing': FinanceAccounting,
  'invoices': FinanceAccounting,
  'payments': FinanceAccounting,
  
  // OPERATIONS section
  'facilities': Facilities,
  'payroll': Payroll,
  'imports': Imports,
  'reporting': Reporting,
  'compliance': Compliance,
};

// =============================================================================
// FALLBACK COMPONENT
// =============================================================================

const FallbackComponent = ({ view }: { view: string }) => (
  <div className="flex h-full items-center justify-center">
    <div className="text-center">
      <div className="text-2xl font-black text-white">Admin Workspace</div>
      <p className="mt-2 text-sm text-neutral-500">View: {view}</p>
      <p className="text-xs text-neutral-600">This workspace is being built.</p>
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT: AdminWorkspace
// =============================================================================

export function AdminWorkspace() {
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState('command-center');

  // Get active view from URL
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && componentMap[view]) {
      setActiveView(view);
    } else {
      // Default to command-center
      setActiveView('command-center');
    }
  }, [searchParams]);

  // Get the active component
  const ActiveComponent = componentMap[activeView] || FallbackComponent;

  return (
    <div className="min-h-full w-full">
      <ActiveComponent />
    </div>
  );
}

export default AdminWorkspace;