'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';
import SuperUserModuleWorkspace from '@/components/hubs/superuser/SuperUserModuleWorkspace';
import SuperUserActions from '@/components/hubs/superuser/SuperUserActions';
import SuperUserApiBoundary from '@/components/hubs/superuser/SuperUserApiBoundary';
import SuperUserDomainActions from '@/components/hubs/superuser/SuperUserDomainActions';
import SuperUserSecurityActions from '@/components/hubs/superuser/SuperUserSecurityActions';
import SuperUserFinanceActions from '@/components/hubs/superuser/SuperUserFinanceActions';
import SuperUserEnterpriseActions from '@/components/hubs/superuser/SuperUserEnterpriseActions';
import SuperUserTeamEngineActions from '@/components/hubs/superuser/SuperUserTeamEngineActions';
import SuperUserSupportActions from '@/components/hubs/superuser/SuperUserSupportActions';
import SuperUserProjectControlActions from '@/components/hubs/superuser/SuperUserProjectControlActions';
import SuperUserOperationsActions from '@/components/hubs/superuser/SuperUserOperationsActions';
import SuperUserReferenceFinder from '@/components/hubs/superuser/SuperUserReferenceFinder';
import SuperUserReleaseCertification from '@/components/hubs/superuser/SuperUserReleaseCertification';

const COMPETITION_PLACEHOLDER_VIEWS = new Set(['competition','competition-events','competition-entries','competition-results','competition-officials','competition-seeding','competition-timing','competition-rules','competition-reconciliation','competition-publication','competition-records','competition-imports']);

function LoadingWorkspace() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
      <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
      <p className="mt-2 text-xs text-neutral-500">Preparing the LS1Sports Team Engine operating control surface…</p>
    </section>
  );
}

function CompetitionPlaceholder() {
  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6"><div className="text-[9px] font-black uppercase tracking-[.2em] text-neutral-500">FUTURE DOMAIN · PLACEHOLDER ONLY</div><h1 className="mt-2 text-2xl font-black text-white">Competition Engine</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">Competition is intentionally isolated from the Team Engine release. No competition workflow, timing, scoring, results or lifecycle action is mounted here, so future Competition work cannot disrupt Team Engine completion.</p></section>;
}

function CommandCenter() {
  return (
    <div className="space-y-5">
      <ProjectCommand />
      <SuperUserActions />
      <SuperUserReferenceFinder />
      <SuperUserProjectControlActions />
    </div>
  );
}

function SuperUserRouter() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view')?.trim() || 'command-center';

  return (
    <SuperUserApiBoundary>
      {view === 'command-center' ? (
        <CommandCenter />
      ) : view === 'deployments' ? (
        <SuperUserReleaseCertification full />
      ) : COMPETITION_PLACEHOLDER_VIEWS.has(view) ? (
        <CompetitionPlaceholder />
      ) : (
        <div className="space-y-5">
          <SuperUserModuleWorkspace view={view} />
          <SuperUserTeamEngineActions view={view} />
          <SuperUserDomainActions view={view} />
          <SuperUserSecurityActions view={view} />
          <SuperUserFinanceActions view={view} />
          <SuperUserEnterpriseActions view={view} />
          <SuperUserSupportActions view={view} />
          <SuperUserOperationsActions view={view} />
        </div>
      )}
    </SuperUserApiBoundary>
  );
}

export default function SuperUserPage() {
  return <Suspense fallback={<LoadingWorkspace />}><SuperUserRouter /></Suspense>;
}
