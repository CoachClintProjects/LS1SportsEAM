create or replace function app.urws_registration_event_trigger()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare v_event_type text; v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status in ('exception','blocked','rejected','incomplete','waitlisted') then v_event_type := 'registration.exception.requested'; else return new; end if;
  elsif new.status is distinct from old.status then
    if new.status in ('exception','blocked','rejected','incomplete','waitlisted') then v_event_type := 'registration.exception.requested';
    elsif old.status in ('exception','blocked','rejected','incomplete','waitlisted') and new.status in ('approved','active','complete','completed') then v_event_type := 'registration.exception.resolved'; else return new; end if;
  else return new; end if;
  v_payload := jsonb_build_object('organization_id',new.organization_id,'registration_id',new.id,'athlete_id',new.athlete_id,'season_id',new.season_id,'program_id',new.program_id,'registration_status',new.status,'source',new.source);
  insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,payload,occurred_at,status)
  values (null,v_event_type,'registration',new.id,v_payload,now(),'pending'); return new;
end; $$;
drop trigger if exists urws_registration_event_bridge on public.registrations;
create trigger urws_registration_event_bridge after insert or update of status on public.registrations for each row execute function app.urws_registration_event_trigger();

create or replace function app.urws_registration_requirement_trigger()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare v_registration public.registrations%rowtype; v_requirement public.registration_requirements%rowtype;
begin
  if new.status not in ('missing','failed','expired','rejected','incomplete') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select * into v_registration from public.registrations where id=new.registration_id;
  select * into v_requirement from public.registration_requirements where id=new.requirement_id;
  if v_registration.id is null or v_requirement.id is null or coalesce(v_requirement.required,true)=false then return new; end if;
  insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,payload,occurred_at,status)
  values (null,'registration.requirement.failed','registration',v_registration.id,jsonb_build_object('organization_id',v_registration.organization_id,'registration_id',v_registration.id,'athlete_id',v_registration.athlete_id,'requirement_id',new.requirement_id,'requirement_name',v_requirement.name,'requirement_type',v_requirement.requirement_type,'requirement_status',new.status),now(),'pending'); return new;
end; $$;
drop trigger if exists urws_registration_requirement_bridge on public.registration_requirement_status;
create trigger urws_registration_requirement_bridge after insert or update of status on public.registration_requirement_status for each row execute function app.urws_registration_requirement_trigger();

insert into public.urws_event_rules(organization_id,event_type,case_type_code,subject_type,priority,public_summary_template,origin_prefix,auto_open,active,conditions,metadata)
values
(null,'registration.requirement.failed','registration_exception','registration','high','A required registration requirement failed.','registration-requirement',true,true,'{}'::jsonb,'{"bridge":"registration"}'::jsonb),
(null,'registration.exception.requested','registration_exception','registration','normal','A registration requires exception review.','registration-exception',true,true,'{}'::jsonb,'{"bridge":"registration"}'::jsonb)
on conflict (organization_id,event_type,case_type_code) do update set active=true,auto_open=true,metadata=excluded.metadata;

create or replace function app.urws_resolve_registration_cases()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if new.event_type <> 'registration.exception.resolved' then return new; end if;
  update public.urws_cases c set status='resolved',resolved_at=coalesce(c.resolved_at,new.occurred_at),updated_at=now(),metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('resolution_source_event_id',new.id)
  where c.organization_id=(new.payload->>'organization_id')::uuid and c.subject_type='registration' and c.subject_id=new.aggregate_id and c.status not in ('resolved','closed'); return new;
end; $$;
drop trigger if exists urws_registration_case_resolver on public.platform_event_outbox;
create trigger urws_registration_case_resolver after insert on public.platform_event_outbox for each row execute function app.urws_resolve_registration_cases();