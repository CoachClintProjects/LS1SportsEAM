'use client';

import SuperUserApiBoundary from '@/components/hubs/superuser/SuperUserApiBoundary';
import SuperUserSupportActions from '@/components/hubs/superuser/SuperUserSupportActions';

export default function SuperUserProfilePage() {
  return (
    <SuperUserApiBoundary>
      <div className="space-y-5">
        <SuperUserSupportActions view="profile" />
      </div>
    </SuperUserApiBoundary>
  );
}
