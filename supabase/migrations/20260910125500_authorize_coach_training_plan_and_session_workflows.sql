drop policy if exists training_plans_coach_scope on public.training_plans;
create policy training_plans_coach_scope on public.training_plans for all using (app.can_access_coach_team(team_id)) with check (app.can_access_coach_team(team_id));

drop policy if exists training_sessions_coach_scope on public.training_sessions;
create policy training_sessions_coach_scope on public.training_sessions for all using (exists (select 1 from public.training_plans tp where tp.id=training_plan_id and app.can_access_coach_team(tp.team_id))) with check (exists (select 1 from public.training_plans tp where tp.id=training_plan_id and app.can_access_coach_team(tp.team_id)));
