import { Suspense } from 'react';
import { AdminWorkspace } from '@/components/hubs/admin/AdminWorkspace';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Admin...</div>}>
      <AdminWorkspace />
    </Suspense>
  );
}
