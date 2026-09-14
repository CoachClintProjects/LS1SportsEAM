import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CoachAuthError, requireCoach } from '@/lib/server/requireCoach';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const VIDEO_BUCKET = 'coach-video-analysis';
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);
const MAX_SIZE = 536870912;

export const dynamic = 'force-dynamic';

type Body = {
  teamId?: string;
  athleteId?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  stroke?: string;
  perspective?: string;
};
type TeamRow = { id: string; organization_id: string; name: string };
type MembershipRow = { athlete_id: string };
type MediaRow = { id: string; storage_path: string | null };

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

function safeFileName(value: string) {
  const trimmed = value.trim().slice(0, 180);
  const base = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return base || 'stroke-video.mp4';
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCoach(request);
    if (!actor.personId) throw new CoachAuthError('A linked person identity is required to upload athlete development video.', 403);
    if (!SERVICE_KEY) throw new CoachAuthError('Private video storage is not configured.', 500);

    const body = (await request.json().catch(() => ({}))) as Body;
    const teamId = String(body.teamId || '');
    const athleteId = String(body.athleteId || '');
    const contentType = String(body.contentType || '').toLowerCase();
    const fileSize = Number(body.fileSize || 0);
    if (!/^[0-9a-f-]{36}$/i.test(teamId) || !/^[0-9a-f-]{36}$/i.test(athleteId)) throw new CoachAuthError('Valid team and athlete context are required.', 400);
    if (!ALLOWED_TYPES.has(contentType)) throw new CoachAuthError('Unsupported video format. Use MP4, MOV, WEBM or M4V.', 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_SIZE) throw new CoachAuthError('Video must be between 1 byte and 512 MB.', 400);

    const teams = await rest<TeamRow[]>(`teams?select=id,organization_id,name&id=eq.${teamId}&limit=1`);
    const team = teams[0];
    if (!team) throw new CoachAuthError('Team was not found.', 404);
    if (!actor.isSuperUser) {
      const allowed = actor.assignments.some((assignment) => assignment.organizationId === team.organization_id && (assignment.teamId === null || assignment.teamId === team.id));
      if (!allowed) throw new CoachAuthError('Coach is not assigned to this team.', 403);
    }

    const memberships = await rest<MembershipRow[]>(`team_memberships?select=athlete_id&team_id=eq.${teamId}&athlete_id=eq.${athleteId}&status=eq.active&limit=1`);
    if (!memberships[0]) throw new CoachAuthError('Athlete is not an active member of this team.', 403);

    const assetId = crypto.randomUUID();
    const fileName = safeFileName(String(body.fileName || 'stroke-video.mp4'));
    const storagePath = `${team.organization_id}/${teamId}/${athleteId}/${assetId}/${fileName}`;
    const now = new Date().toISOString();

    const created = await rest<MediaRow[]>('media_assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        id: assetId,
        owner_person_id: actor.personId,
        athlete_id: athleteId,
        storage_path: storagePath,
        media_type: 'video',
        classification: 'swim_stroke_analysis',
        captured_at: now,
        status: 'awaiting_upload',
      }),
    });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token) {
      await rest(`media_assets?id=eq.${assetId}`, { method: 'DELETE' }).catch(() => null);
      throw new Error(error?.message || 'Unable to create signed upload URL.');
    }

    return NextResponse.json({
      assetId: created[0]?.id || assetId,
      path: storagePath,
      token: data.token,
      stroke: String(body.stroke || '').trim() || null,
      perspective: String(body.perspective || '').trim() || null,
    });
  } catch (error) {
    if (error instanceof CoachAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to prepare video upload.' }, { status: 500 });
  }
}
