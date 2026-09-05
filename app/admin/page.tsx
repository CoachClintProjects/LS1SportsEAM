'use client';

import { Suspense } from 'react';
import { AdminWorkspace } from '@/components/hubs/admin/AdminWorkspace';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-white p-6">Loading Admin...</div>}>
      <AdminWorkspace />
    </Suspense>
  );
}
