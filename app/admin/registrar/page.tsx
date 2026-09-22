import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RegistrarHomePage() {
  const supabase = await createClient();

  // Check authorization - only Registrar role can access
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch HPAC athletes that need attention
  const { data: athletes, error: athletesError } = await supabase
    .from('hpac_athletes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch recent audit events
  const { data: recentActivity, error: auditError } = await supabase
    .from('audit_events')
    .select('id, occurred_at, action, entity_type, entity_id, actor_person_id')
    .order('occurred_at', { ascending: false })
    .limit(10);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Registrar Home</h1>

      {athletesError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error loading athletes: {athletesError.message}
        </div>
      )}

      {auditError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error loading recent activity: {auditError.message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* HPAC Athletes */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">HPAC Athletes</h2>
          {!athletes || athletes.length === 0 ? (
            <p className="text-sm text-gray-500">No athletes found</p>
          ) : (
            <ul className="space-y-2">
              {athletes.map((athlete) => (
                <li key={athlete.id} className="text-sm">
                  <a
                    href={`/admin/athletes/${athlete.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {athlete.name || athlete.athlete_number || `Athlete ${athlete.id.slice(0, 8)}`}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Activity */}
        <div className="border rounded-lg p-4">
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
    </div>
  );
}
