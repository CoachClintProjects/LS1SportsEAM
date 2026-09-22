import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RegistrarHomePage() {
  const supabase = await createClient();

  // Check authorization - only Registrar role can access
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // TODO: Add RLS check for Registrar role
  // For now, proceed with data fetch

  // Fetch pending registrations
  const { data: pendingApprovals, error: pendingError } = await supabase
    .from('registrations')
    .select(`
      id,
      created_at,
      status,
      athlete_id,
      athletes (
        id,
        athlete_number,
        person_id,
        person (
          id,
          full_name
        )
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch exceptions (eligibility blockers, missing documents, etc.)
  const { data: exceptions, error: exceptionsError } = await supabase
    .from('athlete_eligibility')
    .select(`
      id,
      athlete_id,
      status,
      blocker_type,
      athletes (
        id,
        athlete_number,
        person (
          full_name
        )
      )
    `)
    .eq('status', 'blocked')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch recent audit events for Registrar actions
  const { data: recentActivity, error: auditError } = await supabase
    .from('audit_events')
    .select('id, occurred_at, action, entity_type, entity_id, actor_person_id')
    .or('action.ilike.%REGISTRATION%,action.ilike.%MEMBERSHIP%,action.ilike.%ELIGIBILITY%')
    .order('occurred_at', { ascending: false })
    .limit(10);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Registrar Home</h1>

      {pendingError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error loading pending approvals: {pendingError.message}
        </div>
      )}

      {exceptionsError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error loading exceptions: {exceptionsError.message}
        </div>
      )}

      {auditError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error loading recent activity: {auditError.message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Pending Approvals</h2>
          {!pendingApprovals || pendingApprovals.length === 0 ? (
            <p className="text-sm text-gray-500">No pending approvals</p>
          ) : (
            <ul className="space-y-2">
              {pendingApprovals.map((reg) => (
                <li key={reg.id} className="text-sm">
                  <a
                    href={`/admin/registrar/registrations/${reg.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Registration #{reg.id.slice(0, 8)}
                  </a>
                  {' '}
                  — {reg.athletes?.person?.full_name || reg.athletes?.athlete_number || 'Unknown Athlete'}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Exceptions */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Exceptions</h2>
          {!exceptions || exceptions.length === 0 ? (
            <p className="text-sm text-gray-500">No exceptions</p>
          ) : (
            <ul className="space-y-2">
              {exceptions.map((ex) => (
                <li key={ex.id} className="text-sm">
                  <a
                    href={`/admin/registrar/exceptions/${ex.id}`}
                    className="text-red-600 hover:underline"
                  >
                    {ex.blocker_type || 'Eligibility Issue'}
                  </a>
                  {' '}
                  — {ex.athletes?.person?.full_name || ex.athletes?.athlete_number || 'Unknown Athlete'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        {!recentActivity || recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentActivity.map((event) => (
              <li key={event.id}>
                <span className="font-mono text-xs text-gray-500">
                  {new Date(event.occurred_at).toLocaleString()}
                </span>
                {' '}— {event.action}{' '}
                {event.entity_id ? `(${event.entity_id.slice(0, 8)}...)` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
