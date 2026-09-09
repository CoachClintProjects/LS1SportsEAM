import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { verifySuperUserToken } from '@/lib/server/superuserAuth';
import SuperUserSessionBridge from '@/components/hubs/superuser/SuperUserSessionBridge';

export const dynamic = 'force-dynamic';

export default async function SuperUserLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('ls1_superuser_session')?.value;
  const operator = await verifySuperUserToken(token);

  if (!operator) {
    return <SuperUserSessionBridge />;
  }

  return <>{children}</>;
}
