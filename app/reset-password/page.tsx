import { Suspense } from 'react';
import { ResetPassword } from '@/components/auth/ResetPassword';

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#070A09] p-8 text-white">Loading password recovery…</main>}><ResetPassword /></Suspense>;
}
