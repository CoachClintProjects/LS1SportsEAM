import { NextResponse } from 'next/server';
import { getCorporateSite } from '@/lib/server/corporateSite';

export async function GET() {
  try {
    const site = await getCorporateSite('home');
    return NextResponse.json({
      brand: site.brand,
      primaryCta: site.primaryCta,
      loginCta: site.loginCta,
      navigation: site.navigation,
      authPolicy: site.authPolicy,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Corporate site configuration is unavailable.' },
      { status: 503 },
    );
  }
}
