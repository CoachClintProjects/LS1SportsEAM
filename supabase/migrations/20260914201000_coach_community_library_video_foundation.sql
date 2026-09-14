-- Coach Engine: community, drill library, and private stroke-video analysis foundation.
-- Idempotent so existing environments can safely apply it after live validation.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'coach-video-analysis',
  'coach-video-analysis',
  false,
  536870912,
  array['video/mp4','video/quicktime','video/webm','video/x-m4v']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.hub_navigation (
  nav_id,
  hub_id,
  parent_id,
  label,
  icon,
  path,
  component,
  sort_order,
  is_active,
  description
)
select
  gen_random_uuid(),
  'coach',
  null,
  'Community',
  'Users',
  '/coach/community',
  null,
  120,
  true,
  'Coach community knowledge sharing and peer resources'
where not exists (
  select 1 from public.hub_navigation where hub_id = 'coach' and path = '/coach/community'
);

insert into public.hub_navigation (
  nav_id,
  hub_id,
  parent_id,
  label,
  icon,
  path,
  component,
  sort_order,
  is_active,
  description
)
select
  gen_random_uuid(),
  'coach',
  null,
  'Drill Library',
  'FileText',
  '/coach/library',
  null,
  130,
  true,
  'Shared drills, progressions, workouts and coaching resources'
where not exists (
  select 1 from public.hub_navigation where hub_id = 'coach' and path = '/coach/library'
);

insert into public.hub_navigation (
  nav_id,
  hub_id,
  parent_id,
  label,
  icon,
  path,
  component,
  sort_order,
  is_active,
  description
)
select
  gen_random_uuid(),
  'coach',
  null,
  'Stroke Analysis',
  'Activity',
  '/coach/video-analysis',
  null,
  140,
  true,
  'Private athlete video upload and coach-reviewed development agent analysis'
where not exists (
  select 1 from public.hub_navigation where hub_id = 'coach' and path = '/coach/video-analysis'
);
