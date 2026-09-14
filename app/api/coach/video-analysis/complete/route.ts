import { NextRequest, NextResponse } from 'next/server';
import { CoachAuthError, requireCoach } from '@/lib/server/requireCoach';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export const dynamic = 'force-dynamic';

type Body = { assetId?: string; teamId?: string; stroke?: string; perspective?: string; notes?: string };
type TeamRow = { id: string; organization_id: string };
type MediaRow = { id: string; owner_person_id: string | null; athlete_id: string | null; storage_path: string | null; status: string | null; classification: string | null };
type MembershipRow = { athlete_id: string };

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = SERVICE_KEY ?? PUBLIC_KEY;
  if (!key) throw new Error('Coach video analysis data access is not configured.');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Coach video analysis query failed (${response.status}): ${text.slice(0, 240)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCoach(request);
    if (!actor.personId) throw new CoachAuthError('A linked person identity is required to request athlete development analysis.', 403);
    const body = (await request.json().catch(() => ({}))) as Body;
    const assetId = String(body.assetId || '');
    const teamId = String(body.teamId || '');
    if (!/^[0-9a-f-]{36}$/i.test(assetId) || !/^[0-9a-f-]{36}$/i.test(teamId)) throw new CoachAuthError('Valid asset and team context are required.', 400);

    const [teams, media] = await Promise.all([
      rest<TeamRow[]>(`teams?select=id,organization_id&id=eq.${teamId}&limit=1`),
      rest<MediaRow[]>(`media_assets?select=id,owner_person_id,athlete_id,storage_path,status,classification&id=eq.${assetId}&limit=1`),
    ]);
    const team = teams[0];
    const asset = media[0];
    if (!team || !asset) throw new CoachAuthError('Video analysis context was not found.', 404);
    if (asset.classification !== 'swim_stroke_analysis' || !asset.athlete_id || !asset.storage_path) throw new CoachAuthError('Media asset is not a valid swim stroke analysis video.', 400);

    if (!actor.isSuperUser) {
      const allowed = actor.assignments.some((assignment) => assignment.organizationId === team.organization_id && (assignment.teamId === null || assignment.teamId === team.id));
      if (!allowed) throw new CoachAuthError('Coach is not assigned to this team.', 403);
    }
    const memberships = await rest<MembershipRow[]>(`team_memberships?select=athlete_id&team_id=eq.${teamId}&athlete_id=eq.${asset.athlete_id}&status=eq.active&limit=1`);
    if (!memberships[0]) throw new CoachAuthError('Athlete is not an active member of this team.', 403);

    await rest(`media_assets?id=eq.${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'uploaded' }),
    });

    const queued = await rest<Array<{ id: string; status: string }>>('coach_agent_proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: team.organization_id,
        coach_person_id: actor.personId,
        agent_key: 'swim_stroke_development',
        proposal_type: 'stroke_video_analysis',
        autonomy_level: 'recommend',
        subject_type: 'media_asset',
        subject_id: assetId,
        proposal: {
          stage: 'analysis_requested',
          stroke: String(body.stroke || '').trim() || 'unspecified',
          perspective: String(body.perspective || '').trim() || 'unspecified',
          coach_notes: String(body.notes || '').trim() || null,
          requested_action: 'analyze_swimming_technique_and_prepare_development_recommendations',
        },
        rationale: {
          state: 'pending_analysis',
          note: 'No technique finding is asserted until the development agent processes the uploaded video.',
        },
        source_evidence: {
          media_asset_id: assetId,
          athlete_id: asset.athlete_id,
          storage_path: asset.storage_path,
          source: 'coach_uploaded_video',
        },
        status: 'queued',
      }),
    });

    return NextResponse.json({ queued: true, analysisRequest: queued[0] || null });
  } catch (error) {
    if (error instanceof CoachAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to queue stroke analysis.' }, { status: 500 });
  }
}
