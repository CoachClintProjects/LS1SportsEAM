import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RegistrarHomePage() {
  const supabase = await createClient();

  // TODO: Replace with actual query to fetch pending registrations
  // Example: SELECT * FROM registrations WHERE status = 'pending'
  const pendingApprovals = [] as any[];

  // TODO: Replace with actual query to fetch exceptions
  // Example: SELECT * FROM athlete_eligibility WHERE status = 'blocked'
  const exceptions = [] as any[];

  // TODO: Replace with actual query to fetch recent audit events
  // Example: SELECT * FROM audit_events WHERE action LIKE '%REGISTRATION%' ORDER BY occurred_at DESC LIMIT 10
  const recentActivity = [] as any[];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Registrar Home</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Pending Approvals</h2>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-gray-500">No pending approvals</p>
          ) : (
            <ul className="space-y-2">
              {pendingApprovals.map((reg) => (
                <li key={reg.id} className="text-sm">
                  <a href={`/admin/registrar/registrations/${reg.id}`} className="text-blue-600 hover:underline">
                    Registration #{reg.id.slice(0, 8)}
                  </a>
                  {' '}— {reg.athlete_name || 'Unknown Athlete'}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Exceptions */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Exceptions</h2>
          {exceptions.length === 0 ? (
            <p className="text-sm text-gray-500">No exceptions</p>
          ) : (
            <ul className="space-y-2">
              {exceptions.map((ex) => (
                <li key={ex.id} className="text-sm">
                  <a href={`/admin/registrar/exceptions/${ex.id}`} className="text-red-600 hover:underline">
                    {ex.type || 'Eligibility Issue'}
                  </a>
                  {' '}— {ex.athlete_name || 'Unknown Athlete'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentActivity.map((event) => (
              <li key={event.id}>
                <span className="font-mono text-xs text-gray-500">
                  {new Date(event.occurred_at).toLocaleString()}
                </span>
                {' '}— {event.action} {event.entity_id ? `(${event.entity_id.slice(0, 8)}...)` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
