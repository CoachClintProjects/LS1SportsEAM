create or replace function app.urws_process_outbox_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public','app'
as $function$
declare
  e public.platform_event_outbox%rowtype;
  r public.urws_event_rules%rowtype;
  v_org uuid;
  v_case uuid;
  v_origin text;
  v_summary text;
  v_restricted boolean:=false;
begin
  select * into e from public.platform_event_outbox where id=p_event_id;
  if not found then return null; end if;
  begin v_org:=nullif(e.payload->>'organization_id','')::uuid; exception when invalid_text_representation then v_org:=null; end;
  if v_org is null then return null; end if;
  select * into r from public.urws_event_rules
   where event_type=e.event_type and active=true and auto_open=true and (organization_id=v_org or organization_id is null)
   order by (organization_id is not null) desc limit 1;
  if not found then return null; end if;
  v_origin:=r.origin_prefix||':'||e.event_type||':'||e.id::text;
  v_summary:=coalesce(r.public_summary_template,e.event_type);
  v_restricted:=coalesce((r.metadata->>'restricted')::boolean,false);
  insert into public.urws_cases(tenant_id,organization_id,case_type_code,subject_type,subject_id,opened_by_person_id,status,priority,public_summary,origin_key,source_event_id,restricted,metadata)
  values(e.tenant_id,v_org,r.case_type_code,r.subject_type,e.aggregate_id,e.actor_person_id,'open',r.priority,v_summary,v_origin,e.id,v_restricted,jsonb_build_object('source_event_type',e.event_type,'source_aggregate_type',e.aggregate_type,'restricted',v_restricted))
  on conflict (organization_id,origin_key) where origin_key is not null do update set updated_at=now(),restricted=excluded.restricted
  returning id into v_case;
  insert into public.urws_case_event_links(case_id,event_id,relationship) values(v_case,e.id,'opened_by') on conflict do nothing;
  if v_restricted and e.aggregate_type='safeguarding_case' then
    insert into public.urws_restricted_case_links(tenant_id,urws_case_id,safeguarding_case_id)
    values(e.tenant_id,v_case,e.aggregate_id) on conflict do nothing;
  end if;
  insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
  values(e.tenant_id,'urws.case.opened','urws_case',v_case,e.actor_person_id,jsonb_build_object('organization_id',v_org,'case_type_code',r.case_type_code,'source_event_id',e.id,'restricted',v_restricted));
  return v_case;
end;
$function$;