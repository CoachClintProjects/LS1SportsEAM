'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Mode = 'community' | 'library' | 'video-analysis';

type Resource = {
  id: string;
  resource_type: string;
  title: string;
  body: string | null;
  skill_level: string | null;
  objective: string | null;
  duration_minutes: number | null;
  equipment: unknown;
  visibility: string;
  averageRating: number | null;
  ratingCount: number;
};

type Analysis = { id: string; status: string; proposal: unknown; rationale: unknown; created_at: string };
type Video = {
  id: string;
  athlete_id: string | null;
  storage_path: string | null;
  captured_at: string | null;
  status: string | null;
  previewUrl: string | null;
  analyses: Analysis[];
};
type KnowledgeRuntime = {
  identity: { displayName: string; isSuperUser: boolean; coachPersonId: string | null };
  context: { team: { id: string; name: string } | null };
  resources: Resource[];
  videos: Video[];
  metrics: { resources: number; drills: number; videos: number; analysisQueue: number };
};
type CoachRuntime = { roster: Array<{ athleteId: string; name: string }>; context: { team: { id: string; name: string } | null } };
type ErrorPayload = { error: string };

type Props = { mode: Mode };

const COPY: Record<Mode, { eyebrow: string; title: string; description: string }> = {
  community: {
    eyebrow: 'COACH COMMUNITY',
    title: 'Community',
    description: 'A shared coaching network where human-authored ideas can be contributed, reviewed, rated and reused across the LS1 coaching ecosystem.',
  },
  library: {
    eyebrow: 'COACH LIBRARY',
    title: 'Drills & Coaching Library',
    description: 'Searchable canonical coaching resources: drills, teaching progressions, workouts, templates, articles and video references.',
  },
  'video-analysis': {
    eyebrow: 'DEVELOPMENT AGENT',
    title: 'Swimming Stroke Analysis',
    description: 'Upload real athlete video, attach it to the athlete record and queue the development agent to prepare evidence-backed technique recommendations for coach review.',
  },
};

function errorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === 'object' && 'error' in payload ? String((payload as ErrorPayload).error) : fallback;
}

function Stat({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">{label}</div><div className="mt-2 text-3xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-white/40">{detail}</div></div>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="text-sm font-semibold text-white">{title}</div><p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{body}</p></div>;
}

async function authJson(path: string, init: RequestInit = {}) {
  try {
    return await authenticatedFetch(path, { ...init, cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin' });
  }
}

export default function CoachKnowledgeWorkspace({ mode }: Props) {
  const copy = COPY[mode];
  const [knowledge, setKnowledge] = useState<KnowledgeRuntime | null>(null);
  const [coach, setCoach] = useState<CoachRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [knowledgeResponse, coachResponse] = await Promise.all([
        authJson('/api/coach/knowledge'),
        authJson('/api/coach/runtime'),
      ]);
      const [knowledgePayload, coachPayload] = await Promise.all([
        knowledgeResponse.json().catch(() => null),
        coachResponse.json().catch(() => null),
      ]);
      if (!knowledgeResponse.ok) throw new Error(errorMessage(knowledgePayload, `Knowledge runtime returned ${knowledgeResponse.status}.`));
      if (!coachResponse.ok) throw new Error(errorMessage(coachPayload, `Coach runtime returned ${coachResponse.status}.`));
      setKnowledge(knowledgePayload as KnowledgeRuntime);
      setCoach(coachPayload as CoachRuntime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coach knowledge runtime unavailable.');
      setKnowledge(null);
      setCoach(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const resources = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = mode === 'community'
      ? (knowledge?.resources || []).filter((resource) => resource.visibility === 'community')
      : knowledge?.resources || [];
    if (!query) return source;
    return source.filter((resource) => [resource.title, resource.body, resource.objective, resource.skill_level, resource.resource_type].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [knowledge, mode, search]);

  async function publishResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!knowledge?.context.team) return;
    const form = new FormData(event.currentTarget);
    setPublishing(true);
    setNotice(null);
    try {
      const response = await authJson('/api/coach/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: knowledge.context.team.id,
          resourceType: form.get('resourceType'),
          title: form.get('title'),
          body: form.get('body'),
          objective: form.get('objective'),
          skillLevel: form.get('skillLevel'),
          durationMinutes: form.get('durationMinutes') ? Number(form.get('durationMinutes')) : null,
          visibility: form.get('visibility'),
          equipment: String(form.get('equipment') || '').split(',').map((value) => value.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to publish resource.'));
      event.currentTarget.reset();
      setNotice('Resource published to the canonical Coach library.');
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to publish resource.');
    } finally {
      setPublishing(false);
    }
  }

  async function uploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const team = knowledge?.context.team;
    if (!team) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('video');
    if (!(file instanceof File) || file.size === 0) {
      setNotice('Choose a real stroke video first.');
      return;
    }
    const athleteId = String(form.get('athleteId') || '');
    const stroke = String(form.get('stroke') || '');
    const perspective = String(form.get('perspective') || '');
    const notes = String(form.get('notes') || '');

    setUploading(true);
    setNotice(null);
    try {
      const tokenResponse = await authJson('/api/coach/video-analysis/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, athleteId, fileName: file.name, contentType: file.type, fileSize: file.size, stroke, perspective }),
      });
      const tokenPayload = await tokenResponse.json().catch(() => null) as { assetId?: string; path?: string; token?: string; error?: string } | null;
      if (!tokenResponse.ok || !tokenPayload?.assetId || !tokenPayload.path || !tokenPayload.token) throw new Error(errorMessage(tokenPayload, 'Unable to prepare secure video upload.'));

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Browser storage configuration is missing.');
      const supabase = createClient(url, key);
      const { error: uploadError } = await supabase.storage.from('coach-video-analysis').uploadToSignedUrl(tokenPayload.path, tokenPayload.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const completeResponse = await authJson('/api/coach/video-analysis/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: tokenPayload.assetId, teamId: team.id, stroke, perspective, notes }),
      });
      const completePayload = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok) throw new Error(errorMessage(completePayload, 'Video uploaded, but analysis queueing failed.'));

      event.currentTarget.reset();
      setNotice('Video uploaded securely and queued for the swimming development agent. No technique result has been fabricated.');
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to upload stroke video.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="h-full bg-[#050807] p-6 text-sm text-white/55">Loading Coach knowledge engine…</div>;
  if (error) return <div className="h-full overflow-auto bg-[#050807] p-6 text-white"><Empty title="Coach knowledge runtime blocked" body={error} /></div>;
  if (!knowledge || !coach) return null;

  return <div className="h-full overflow-auto bg-[#050807] text-white"><div className="mx-auto max-w-[1500px] p-5 md:p-7">
    <header className="mb-6 border-b border-white/10 pb-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">{copy.eyebrow} · COACH ENGINE</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">{copy.description}</p>
      <div className="mt-3 text-xs text-white/35">{knowledge.context.team?.name || 'No team context'} · Canonical data · {knowledge.identity.displayName}</div>
    </header>

    {notice && <div className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100/80">{notice}</div>}

    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Resources" value={knowledge.metrics.resources} detail="published coaching resources" />
      <Stat label="Drills" value={knowledge.metrics.drills} detail="drill library items" />
      <Stat label="Athlete video" value={knowledge.metrics.videos} detail="private development assets" />
      <Stat label="Agent queue" value={knowledge.metrics.analysisQueue} detail="queued, processing or review" />
    </div>

    {mode !== 'video-analysis' && <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.7fr)]">
      <section>
        <div className="mb-4 flex items-center gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search drills, objectives, skill level…" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-emerald-300/30" /></div>
        <div className="space-y-3">{resources.length ? resources.map((resource) => <article key={resource.id} className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-emerald-300/60"><span>{resource.resource_type.replaceAll('_', ' ')}</span><span>·</span><span>{resource.visibility}</span>{resource.skill_level && <><span>·</span><span>{resource.skill_level}</span></>}</div>
          <h2 className="mt-2 text-lg font-semibold">{resource.title}</h2>
          {resource.objective && <div className="mt-2 text-sm text-white/70">Objective: {resource.objective}</div>}
          {resource.body && <p className="mt-2 text-sm leading-6 text-white/45">{resource.body}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/35">{resource.duration_minutes != null && <span>{resource.duration_minutes} min</span>}<span>{resource.ratingCount ? `${resource.averageRating?.toFixed(1)} / 5 · ${resource.ratingCount} ratings` : 'Not yet rated'}</span></div>
        </article>) : <Empty title={mode === 'community' ? 'Community is ready for its first real contribution' : 'No matching library resources yet'} body="LS1 will not seed fake drills or fabricated ratings. Coaches can publish real resources below, and the library will grow from actual coaching knowledge." />}</div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5">
        <h2 className="font-semibold">Contribute coaching knowledge</h2>
        <p className="mt-2 text-sm leading-6 text-white/45">Publish a real drill, progression, workout or teaching resource. Choose organization-only or LS1 community visibility.</p>
        <form onSubmit={publishResource} className="mt-5 space-y-3">
          <select name="resourceType" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm"><option value="drill">Drill</option><option value="teaching_progression">Teaching progression</option><option value="workout">Workout</option><option value="template">Template</option><option value="article">Article</option><option value="video">Video reference</option></select>
          <input name="title" required minLength={3} maxLength={160} placeholder="Resource title" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" />
          <input name="objective" placeholder="Objective / coaching outcome" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3"><input name="skillLevel" placeholder="Skill level" className="rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" /><input name="durationMinutes" type="number" min="1" step="1" placeholder="Minutes" className="rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" /></div>
          <input name="equipment" placeholder="Equipment, comma separated" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" />
          <textarea name="body" rows={5} placeholder="How to run it, cues, purpose, adaptations…" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" />
          <select name="visibility" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm"><option value="organization">Organization only</option><option value="community">LS1 Coach community</option></select>
          <button disabled={publishing} className="w-full rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{publishing ? 'Publishing…' : 'Publish resource'}</button>
        </form>
      </aside>
    </div>}

    {mode === 'video-analysis' && <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.4fr)]">
      <section className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5">
        <h2 className="font-semibold">Upload stroke video</h2>
        <p className="mt-2 text-sm leading-6 text-white/45">Video stays in a private bucket. The agent request is created only after upload completes, and its output must be reviewed by a coach before it becomes a development action.</p>
        <form onSubmit={uploadVideo} className="mt-5 space-y-3">
          <select name="athleteId" required className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm"><option value="">Select athlete</option>{coach.roster.map((athlete) => <option key={athlete.athleteId} value={athlete.athleteId}>{athlete.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-3"><select name="stroke" className="rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm"><option value="freestyle">Freestyle</option><option value="backstroke">Backstroke</option><option value="breaststroke">Breaststroke</option><option value="butterfly">Butterfly</option><option value="start">Start</option><option value="turn">Turn</option><option value="underwater">Underwater</option></select><select name="perspective" className="rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm"><option value="side">Side</option><option value="front">Front</option><option value="rear">Rear</option><option value="above_water">Above water</option><option value="underwater">Underwater</option><option value="mixed">Mixed</option></select></div>
          <input name="video" type="file" required accept="video/mp4,video/quicktime,video/webm,video/x-m4v" className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-5 text-sm text-white/60 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" />
          <textarea name="notes" rows={4} placeholder="Coach context: what are you looking at, what changed, what question should the agent answer?" className="w-full rounded-lg border border-white/10 bg-[#070a09] px-3 py-2 text-sm" />
          <button disabled={uploading} className="w-full rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{uploading ? 'Uploading & queueing…' : 'Upload and request analysis'}</button>
        </form>
      </section>

      <section>
        <div className="mb-3 text-sm font-semibold">Athlete development video</div>
        <div className="space-y-4">{knowledge.videos.length ? knowledge.videos.map((video) => {
          const athlete = coach.roster.find((item) => item.athleteId === video.athlete_id);
          const latest = video.analyses[0];
          return <article key={video.id} className="rounded-2xl border border-white/10 bg-[#0a0e0c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold">{athlete?.name || 'Athlete video'}</div><div className="mt-1 text-xs text-white/35">{video.captured_at ? new Date(video.captured_at).toLocaleString('en-CA') : 'Capture time unavailable'} · {video.status || 'unknown'}</div></div><div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-200/70">{latest?.status || 'uploaded'}</div></div>
            {video.previewUrl && <video controls preload="metadata" src={video.previewUrl} className="mt-4 max-h-[420px] w-full rounded-xl bg-black" />}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/60">Development agent</div>{latest ? <><div className="mt-2 text-sm font-medium">Analysis request: {latest.status}</div><div className="mt-1 text-xs leading-5 text-white/40">Queued means the footage is stored and awaiting actual processing. Proposed means an analysis exists and still requires coach review.</div></> : <div className="mt-2 text-sm text-white/45">No analysis request is attached to this video yet.</div>}</div>
          </article>;
        }) : <Empty title="No athlete stroke videos yet" body="Upload the first real HPAC athlete video above. This surface will remain empty until real footage is provided." />}</div>
      </section>
    </div>}
  </div></div>;
}
