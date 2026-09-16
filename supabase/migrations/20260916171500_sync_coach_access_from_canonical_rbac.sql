create unique index if not exists uq_coach_access_canonical_scope on public.coach_access_assignments(coach_person_id,organization_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid));
create or replace function public.sync_coach_access_from_role_assignment() returns trigger language plpgsql security definer set search_path=public as $$
declare v_code text; v_org uuid; v_role_id uuid;
begin
 v_role_id:=case when tg_op='DELETE' then old.role_definition_id else new.role_definition_id end;
 select code into v_code from public.role_definitions where id=v_role_id;
 if v_code is distinct from 'COACH' then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='DELETE' then
  update public.coach_access_assignments set status='inactive',updated_at=now() where coach_person_id=old.person_id and team_id is not distinct from old.team_id and program_id is not distinct from old.program_id;
  return old;
 end if;
 v_org:=new.organization_id;
 if v_org is null and new.team_id is not null then select organization_id into v_org from public.teams where id=new.team_id; end if;
 if v_org is null then raise exception 'COACH assignment requires organization or team scope'; end if;
 insert into public.coach_access_assignments(tenant_id,organization_id,coach_person_id,team_id,program_id,role_key,is_head_coach,status,starts_on,ends_on,updated_at)
 values(new.tenant_id,v_org,new.person_id,new.team_id,new.program_id,'coach',coalesce((new.metadata->>'is_head_coach')::boolean,false),case when new.status='active' then 'active' else 'inactive' end,new.starts_at::date,new.ends_at::date,now())
 on conflict (coach_person_id,organization_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid))
 do update set tenant_id=excluded.tenant_id,status=excluded.status,starts_on=excluded.starts_on,ends_on=excluded.ends_on,is_head_coach=excluded.is_head_coach,updated_at=now();
 return new;
end$$;
drop trigger if exists trg_sync_coach_access_from_role_assignment on public.role_assignments;
create trigger trg_sync_coach_access_from_role_assignment after insert or update or delete on public.role_assignments for each row execute function public.sync_coach_access_from_role_assignment();
insert into public.coach_access_assignments(tenant_id,organization_id,coach_person_id,team_id,program_id,role_key,is_head_coach,status,starts_on,ends_on)
select ra.tenant_id,coalesce(ra.organization_id,t.organization_id),ra.person_id,ra.team_id,ra.program_id,'coach',coalesce((ra.metadata->>'is_head_coach')::boolean,false),case when ra.status='active' then 'active' else 'inactive' end,ra.starts_at::date,ra.ends_at::date
from public.role_assignments ra join public.role_definitions rd on rd.id=ra.role_definition_id left join public.teams t on t.id=ra.team_id
where rd.code='COACH' and coalesce(ra.organization_id,t.organization_id) is not null
on conflict (coach_person_id,organization_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)) do update set status=excluded.status,starts_on=excluded.starts_on,ends_on=excluded.ends_on,updated_at=now();
