import type { NextConfig } from "next";

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/login', headers: noStoreHeaders },
      { source: '/reset-password', headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
