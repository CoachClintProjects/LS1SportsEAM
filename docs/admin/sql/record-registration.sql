create or replace function public.admin_record_registration(p_tenant uuid,p_org uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,p_operation text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.registrations; old_row public.registrations; program uuid; season uuid; target text;
begin
 perform 1 from athletes a join people p on p.id=a.person_id where a.id=p_athlete and p.tenant_id=p_tenant for update of a;
 if not found then raise exception 'Athlete outside tenant';end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant;if not found then raise exception 'Organization outside tenant';end if;
 if p_operation='create' then
 program:=(p_values->>'program_id')::uuid;season:=(p_values->>'season_id')::uuid;
 perform 1 from programs where id=program and organization_id=p_org;if not found then raise exception 'Select an authorized program';end if;
 perform 1 from seasons where id=season and organization_id=p_org;if not found then raise exception 'Select an authorized season';end if;
 if exists(select 1 from registrations where organization_id=p_org and athlete_id=p_athlete and program_id=program and season_id=season and status<>'cancelled') then raise exception 'Registration already exists for this program and season';end if;
 insert into registrations(organization_id,athlete_id,program_id,season_id,submitted_at,status,source) values(p_org,p_athlete,program,season,now(),'submitted','admin_record') returning * into saved;
 else
 select * into old_row from registrations where id=(p_values->>'id')::uuid and organization_id=p_org and athlete_id=p_athlete for update;
 if not found then raise exception 'Registration outside record';end if;
 if old_row.status is distinct from p_values->>'expected_status' then raise exception 'Registration changed. Reload before saving.';end if;
 target:=p_values->>'status';
 if not ((old_row.status in ('submitted','pending','under_review') and target in ('approved','rejected','cancelled')) or (old_row.status='approved' and target='cancelled') or (old_row.status in ('rejected','cancelled') and target='submitted')) then raise exception 'Registration transition not allowed';end if;
 if nullif(trim(p_values->>'reason'),'') is null then raise exception 'Decision reason required';end if;
 if target='approved' and exists (
   select 1 from registration_requirements req
   where req.organization_id=p_org and req.required
     and (req.program_id is null or req.program_id=old_row.program_id)
     and (req.season_id is null or req.season_id=old_row.season_id)
     and (req.valid_from is null or req.valid_from<=current_date)
     and (req.valid_until is null or req.valid_until>=current_date)
     and not exists (select 1 from registration_requirement_status rs
       where rs.registration_id=old_row.id and rs.requirement_id=req.id
         and rs.satisfied_at is not null and rs.status in ('satisfied','verified','approved','waived'))
 ) then raise exception 'Required registration checks are incomplete';end if;
 update registrations set status=target,approved_at=case when target='approved' then now() else null end,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('decision_reason',p_values->>'reason','decided_by',p_actor_person,'decided_at',now()) where id=old_row.id returning * into saved;
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'athlete.registration_'||p_operation,'athlete',p_athlete,to_jsonb(old_row),to_jsonb(saved),gen_random_uuid(),coalesce(p_values->>'reason','Registration submitted'));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_record_registration(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_registration(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
