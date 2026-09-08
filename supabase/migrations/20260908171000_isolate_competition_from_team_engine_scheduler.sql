update public.platform_project_tasks
set status='placeholder',
    evidence=coalesce(evidence,'{}'::jsonb) || jsonb_build_object('future_domain',true,'excluded_from_team_engine',true),
    updated_at=now()
where project_id=(select id from public.platform_projects where code='LS1SPORTS-IMPLEMENTATION' order by created_at desc limit 1)
  and code='COMPETITION';

do $$
declare fn text;
begin
  select pg_get_functiondef(p.oid) into fn
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_superuser_command'
  limit 1;
  if fn is null then raise exception 'get_superuser_command not found'; end if;
  if position('excluded_from_team_engine' in fn)=0 then
    fn:=replace(
      fn,
      'where pt.project_id=(p->>''id'')::uuid order by pt.sort_order',
      'where pt.project_id=(p->>''id'')::uuid and coalesce((pt.evidence->>''excluded_from_team_engine'')::boolean,false)=false order by pt.sort_order'
    );
    execute fn;
  end if;
end $$;
