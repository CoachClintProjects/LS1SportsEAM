import type { NextConfig } from "next";

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xedfstgwotzxnztpembv.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_Zas0f_4UBJNgjfYnHpjOxg_Ey0yOILb',
  },
  async headers() {
    return [
      { source: '/login', headers: noStoreHeaders },
      { source: '/reset-password', headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
