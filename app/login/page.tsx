import { Suspense } from 'react';
import { LoginGate } from '@/components/auth/LoginGate';

function LoginFallback() {
  return (
    <main className="min-h-screen bg-[#070A09] text-[#F5F5F0]">
      <div className="mx-auto flex min-h-screen max-w-[1180px] items-center justify-center px-6 py-8 lg:px-10">
        <div className="text-sm font-bold text-[#9CA49E]">Loading LS1Sports access…</div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginGate />
    </Suspense>
  );
}
