-- Athlete Experience capability evidence checkpoint.
-- Percentages remain evidence-gated; this migration only aligns scope/evidence with shipped work.
update platform_milestone_units
set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
  'state_driven_experience_layer', true,
  'moments', jsonb_build_array('training-day','meet-prep','race-day','post-race'),
  'goal_write_ui', true,
  'reflection_write_ui', true,
  'runtime_capability_evidence', true,
  'competition_engine_authority_preserved', true
),
    evidence_source='GitHub + Supabase + Vercel',
    evidence_ref='ATHLETE_EXPERIENCE_CHECKPOINT'
where unit_key='athlete_progressive_experience';

update platform_milestone_units
set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
  'state_driven_experience_layer', true,
  'goal_write_ui', true,
  'reflection_write_ui', true,
  'runtime_capability_evidence', true
),
    evidence_source='GitHub + Supabase + Vercel',
    evidence_ref='ATHLETE_EXPERIENCE_CHECKPOINT'
where unit_key='athlete_intelligence_ui';

update platform_milestone_units
set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
  'goal_create_route', true,
  'goal_update_route', true,
  'reflection_create_route', true,
  'challenge_update_route', true,
  'athlete_ownership_guard', true,
  'runtime_capability_evidence', true
),
    evidence_source='GitHub + runtime evidence',
    evidence_ref='ATHLETE_EXPERIENCE_CHECKPOINT'
where unit_key='athlete_goals_and_actions_writeback';
