'use client';

// =====================================================
// LS1Sports SuperUser Route
// =====================================================

import React from 'react';
import SuperUserWorkspace from '@/components/hubs/superuser/SuperUserWorkspace';
import ProjectCommand from '@/components/hubs/superuser/ProjectCommand';

export default function SuperUserPage(){
  return <>
    <ProjectCommand />
    <div className="mt-6">
      <SuperUserWorkspace />
    </div>
  </>;
}
