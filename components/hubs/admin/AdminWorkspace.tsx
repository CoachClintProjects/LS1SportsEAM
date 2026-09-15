'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { UsersAccess } from './UsersAccess';
import { AdminSettings } from './AdminSettings';

const ComingSoon = ({ title, message }: { title: string; message: string }) => (<div className="p-6 text-white"><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-neutral-400">{message}</p></div>);
const RostersView=()=> <ComingSoon title="Rosters" message="Roster management coming soon."/>; const MembershipView=()=> <ComingSoon title="Membership" message="Membership management coming soon."/>; const ProgramsView=()=> <ComingSoon title="Programs" message="Programs management coming soon."/>; const TeamsView=()=> <ComingSoon title="Teams" message="Teams management coming soon."/>; const SeasonsView=()=> <ComingSoon title="Seasons" message="Seasons management coming soon."/>; const BillingView=()=> <ComingSoon title="Billing" message="Billing management coming soon."/>; const InvoicesView=()=> <ComingSoon title="Invoices" message="Invoice management coming soon."/>; const PaymentsView=()=> <ComingSoon title="Payments" message="Payment management coming soon."/>;
const viewRegistry:Record<string,React.ComponentType>={'command-center':CommandCenter,organization:OrganizationArchitecture,hierarchy:OrganizationArchitecture,'team-manager':TeamManager,registrar:RegistrarValidation,rosters:RostersView,membership:MembershipView,programs:ProgramsView,teams:TeamsView,seasons:SeasonsView,finance:FinanceAccounting,'financial-overview':FinanceAccounting,billing:BillingView,invoices:InvoicesView,payments:PaymentsView,facilities:Facilities,payroll:Payroll,imports:Imports,compliance:Compliance,reporting:Reporting,'users-access':UsersAccess,settings:AdminSettings};
export function AdminWorkspace(){const searchParams=useSearchParams();const view=searchParams.get('view')||'command-center';const ActiveComponent=useMemo(()=>viewRegistry[view]||CommandCenter,[view]);return <div className="min-h-full w-full"><ActiveComponent/></div>}
export default AdminWorkspace;
