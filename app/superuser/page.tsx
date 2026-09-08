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
import SuperUserTeamManagerActions from '@/components/hubs/superuser/SuperUserTeamManagerActions';
import SuperUserSupportActions from '@/components/hubs/superuser/SuperUserSupportActions';
import SuperUserProjectControlActions from '@/components/hubs/superuser/SuperUserProjectControlActions';
import SuperUserOperationsActions from '@/components/hubs/superuser/SuperUserOperationsActions';
import SuperUserReferenceFinder from '@/components/hubs/superuser/SuperUserReferenceFinder';
import SuperUserReleaseCertification from '@/components/hubs/superuser/SuperUserReleaseCertification';

const COMMAND_VIEWS = new Set(['command-center', 'project-map', 'milestones', 'metrics']);

function LoadingWorkspace() {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 lg:p-7">
      <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">SUPERUSER</div>
      <h1 className="mt-2 text-3xl font-black text-white">Loading workspace</h1>
      <p className="mt-2 text-xs text-neutral-500">Preparing the LS1Sports Team Manager operating control surface…</p>
    </section>
  );
}

function SuperUserRouter() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view')?.trim() || 'command-center';

  return (
    <SuperUserApiBoundary>
      <div className="space-y-5">
        <SuperUserActions />
        <SuperUserReferenceFinder />
        {(view === 'command-center' || view === 'deployments') && (
          <SuperUserReleaseCertification full={view === 'deployments'} />
        )}
        {COMMAND_VIEWS.has(view) ? (
          <>
            <ProjectCommand />
            <SuperUserProjectControlActions />
          </>
        ) : (
          <>
            <SuperUserModuleWorkspace view={view} />
            <SuperUserTeamManagerActions view={view} />
            <SuperUserDomainActions view={view} />
            <SuperUserSecurityActions view={view} />
            <SuperUserFinanceActions view={view} />
            <SuperUserEnterpriseActions view={view} />
            <SuperUserSupportActions view={view} />
            <SuperUserOperationsActions view={view} />
          </>
        )}
      </div>
    </SuperUserApiBoundary>
  );
}

export default function SuperUserPage() {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <SuperUserRouter />
    </Suspense>
  );
}
