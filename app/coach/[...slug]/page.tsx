import CoachOperatingSystem from '@/components/hubs/coach/CoachOperatingSystem';

/**
 * Coach deep-route safety net.
 *
 * Explicit Coach routes continue to win in the App Router. Any canonical Coach
 * navigation destination that has not yet been promoted to its own page renders
 * the real Coach operating system instead of falling through to a 404.
 */
export default function CoachDeepRoutePage() {
  return <CoachOperatingSystem />;
}
