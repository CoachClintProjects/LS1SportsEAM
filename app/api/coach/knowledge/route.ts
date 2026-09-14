import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CoachAuthError, requireCoach, type CoachIdentity } from '@/lib/server/requireCoach';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xedfstgwotzxnztpembv.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const VIDEO_BUCKET = 'coach-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeamRow = { id: string; organization_id: string; sport_id: string | null; name: string; status: string | null };
type MembershipRow = { athlete_id: string | null };
type ResourceRow = {
  id: string;
  creator_person_id: string;
  organization_id: string | null;
  sport_id: string | null;
  resource_type: string;
  title: string;
  body: string | null;
  age_range: unknown;
  skill_level: string | null;
  objective: string | null;
  duration_minutes: number | null;
  equipment: unknown;
  adaptations: unknown;
  provenance: unknown;
  visibility: string;
  status: string;
  published_at: string | null;
  created_at: string;
};
type RatingRow = { resource_id: string; rating: number };
type MediaRow = { id: string; owner_person_id: string | null; athlete_id: string | null; storage_path: string | null; media_type: string | null; classification: string | null; captured_at: string | null; status: string | null };
type ProposalRow = { id: string; subject_id: string | null; status: string; proposal: unknown; rationale: unknown; source_evidence: unknown; created_at: string };

type CreateResourceBody = {
  teamId?: string;
  resourceType?: string;
  title?: string;
  body?: string;
  visibility?: string;
  objective?: string;
  skillLevel?: string;
  durationMinutes?: number | null;
  equipment?: string[];
  adaptations?: string[];
};

function safeIn(values: string[]) {
  return values.filter((value) => /^[0-9a-f-]{36}$/i.test(value)).join(',');
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = SERVICE_KEY ?? PUBLIC_KEY;
  if (!key) throw new Error('Coach knowledge data access is not configured.');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Coach knowledge query failed (${response.status}): ${text.slice(0, 240)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function resolveTeam(actor: CoachIdentity, requestedTeamId: string | null) {
  if (requestedTeamId && !/^[0-9a-f-]{36}$/i.test(requestedTeamId)) throw new CoachAuthError('Invalid team context.', 400);
  if (requestedTeamId) {
    const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,sport_id,name,status&id=eq.${requestedTeamId}&limit=1`);
    const team = rows[0] || null;
    if (!team) throw new CoachAuthError('Requested team was not found.', 404);
    if (!actor.isSuperUser) {
      const allowed = actor.assignments.some((assignment) => assignment.organizationId === team.organization_id && (assignment.teamId === null || assignment.teamId === team.id));
      if (!allowed) throw new CoachAuthError('Coach is not assigned to the requested team.', 403);
    }
    return team;
  }

  const assigned = actor.assignments.find((assignment) => assignment.teamId)?.teamId;
  if (assigned) {
    const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,sport_id,name,status&id=eq.${assigned}&limit=1`);
    if (rows[0]) return rows[0];
  }
  const org = actor.assignments[0]?.organizationId;
  const filter = org ? `&organization_id=eq.${org}` : '';
  const rows = await rest<TeamRow[]>(`teams?select=id,organization_id,sport_id,name,status&status=eq.active${filter}&order=name.asc&limit=1`);
  return rows[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCoach(request);
    const team = await resolveTeam(actor, request.nextUrl.searchParams.get('team'));
    if (!team) return NextResponse.json({ context: { team: null }, resources: [], videos: [], metrics: { resources: 0, drills: 0, videos: 0, analysisQueue: 0 } });

    const memberships = await rest<MembershipRow[]>(`team_memberships?select=athlete_id&team_id=eq.${team.id}&status=eq.active`);
    const athleteIds = memberships.map((row) => row.athlete_id).filter((value): value is string => Boolean(value));
    const athleteIn = safeIn(athleteIds);

    const resourceFilter = team.sport_id
      ? `or=(organization_id.eq.${team.organization_id},organization_id.is.null)&or=(sport_id.eq.${team.sport_id},sport_id.is.null)`
      : `or=(organization_id.eq.${team.organization_id},organization_id.is.null)`;

    const [resources, ratings, media] = await Promise.all([
      rest<ResourceRow[]>(`coach_community_resources?select=id,creator_person_id,organization_id,sport_id,resource_type,title,body,age_range,skill_level,objective,duration_minutes,equipment,adaptations,provenance,visibility,status,published_at,created_at&${resourceFilter}&status=eq.published&order=published_at.desc.nullslast,created_at.desc&limit=100`),
      rest<RatingRow[]>('coach_community_ratings?select=resource_id,rating'),
      athleteIn ? rest<MediaRow[]>(`media_assets?select=id,owner_person_id,athlete_id,storage_path,media_type,classification,captured_at,status&athlete_id=in.(${athleteIn})&media_type=eq.video&order=captured_at.desc.nullslast&limit=50`) : Promise.resolve([] as MediaRow[]),
    ]);

    const mediaIn = safeIn(media.map((row) => row.id));
    const proposals = mediaIn
      ? await rest<ProposalRow[]>(`coach_agent_proposals?select=id,subject_id,status,proposal,rationale,source_evidence,created_at&organization_id=eq.${team.organization_id}&agent_key=eq.swim_stroke_development&subject_type=eq.media_asset&subject_id=in.(${mediaIn})&order=created_at.desc`)
      : [];

    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const rating of ratings) {
      const current = ratingMap.get(rating.resource_id) || { sum: 0, count: 0 };
      current.sum += Number(rating.rating) || 0;
      current.count += 1;
      ratingMap.set(rating.resource_id, current);
    }

    const proposalsByMedia = new Map<string, ProposalRow[]>();
    for (const proposal of proposals) {
      if (!proposal.subject_id) continue;
      const list = proposalsByMedia.get(proposal.subject_id) || [];
      list.push(proposal);
      proposalsByMedia.set(proposal.subject_id, list);
    }

    const supabase = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    const videos = await Promise.all(media.map(async (asset) => {
      let previewUrl: string | null = null;
      if (supabase && asset.storage_path) {
        const { data } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(asset.storage_path, 600);
        previewUrl = data?.signedUrl || null;
      }
      return { ...asset, previewUrl, analyses: proposalsByMedia.get(asset.id) || [] };
    }));

    const enrichedResources = resources.map((resource) => {
      const rating = ratingMap.get(resource.id);
      return { ...resource, ratingCount: rating?.count || 0, averageRating: rating?.count ? rating.sum / rating.count : null };
    });

    return NextResponse.json({
      identity: { displayName: actor.displayName, isSuperUser: actor.isSuperUser, coachPersonId: actor.personId },
      context: { team },
      resources: enrichedResources,
      videos,
      metrics: {
        resources: enrichedResources.length,
        drills: enrichedResources.filter((resource) => resource.resource_type.toLowerCase().includes('drill')).length,
        videos: videos.length,
        analysisQueue: proposals.filter((proposal) => ['queued', 'processing', 'proposed'].includes(proposal.status)).length,
      },
      generatedAt: new Date().toISOString(),
      source: 'canonical',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    if (error instanceof CoachAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Coach knowledge runtime unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCoach(request);
    if (!actor.personId) throw new CoachAuthError('A linked person identity is required to publish coaching resources.', 403);
    const body = (await request.json().catch(() => ({}))) as CreateResourceBody;
    const team = await resolveTeam(actor, body.teamId || null);
    if (!team) throw new CoachAuthError('An active team context is required.', 400);

    const title = String(body.title || '').trim();
    const resourceType = String(body.resourceType || 'drill').trim().toLowerCase();
    if (title.length < 3 || title.length > 160) throw new CoachAuthError('Resource title must be between 3 and 160 characters.', 400);
    if (!['drill', 'workout', 'teaching_progression', 'video', 'article', 'template'].includes(resourceType)) throw new CoachAuthError('Unsupported resource type.', 400);

    const visibility = ['organization', 'community'].includes(String(body.visibility)) ? String(body.visibility) : 'organization';
    const now = new Date().toISOString();
    const payload = {
      creator_person_id: actor.personId,
      organization_id: visibility === 'organization' ? team.organization_id : null,
      sport_id: team.sport_id,
      resource_type: resourceType,
      title,
      body: String(body.body || '').trim() || null,
      age_range: {},
      skill_level: String(body.skillLevel || '').trim() || null,
      objective: String(body.objective || '').trim() || null,
      duration_minutes: typeof body.durationMinutes === 'number' && Number.isFinite(body.durationMinutes) ? body.durationMinutes : null,
      equipment: Array.isArray(body.equipment) ? body.equipment : [],
      adaptations: Array.isArray(body.adaptations) ? body.adaptations : [],
      provenance: { source: 'coach_contribution', created_via: 'coach_hub', human_authored: true },
      visibility,
      status: 'published',
      published_at: now,
    };

    const created = await rest<ResourceRow[]>('coach_community_resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ resource: created[0] || null }, { status: 201 });
  } catch (error) {
    if (error instanceof CoachAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to publish coaching resource.' }, { status: 500 });
  }
}
