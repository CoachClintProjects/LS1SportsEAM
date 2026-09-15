'use client';

import type { ReactNode } from 'react';

/**
 * SuperUser authentication is enforced once by app/superuser/layout.tsx using the
 * httpOnly ls1_superuser_session cookie. API routes enforce the same cookie/token
 * through requireSuperUser. Do not monkey-patch window.fetch or create a second
 * Supabase browser client here: that previously created a competing auth path and
 * allowed a stale public key to break otherwise valid Level 0 sessions.
 */
export default function SuperUserApiBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
