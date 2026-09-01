import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedSuperUser } from '@/lib/server/superuserAuth';

export async function GET(request: NextRequest) {
  const operator = await getAuthorizedSuperUser(request);
  return NextResponse.json({ authenticated: Boolean(operator), operator });
}
