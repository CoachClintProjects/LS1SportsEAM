create or replace function public.admin_athlete_relationship(p_tenant uuid,p_org uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,p_operation text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.athletes; before_value jsonb; after_value jsonb; family uuid; related uuid; membership uuid;
begin
 select at.* into a from athletes at join people p on p.id=at.person_id where at.id=p_athlete and p.tenant_id=p_tenant for update of at;
 if not found then raise exception 'Athlete outside tenant'; end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant;
 if not found or nullif(trim(p_values->>'reason'),'') is null then raise exception 'Organization and reason required'; end if;
 if p_operation='team_add' then
 related:=(p_values->>'team_id')::uuid;
 perform 1 from teams where id=related and organization_id=p_org and status='active';if not found then raise exception 'Active team outside organization';end if;
 if exists(select 1 from team_memberships where athlete_id=p_athlete and team_id=related and status='active') then raise exception 'Athlete is already active in this squad';end if;
 insert into team_memberships(team_id,athlete_id,person_id,membership_type,starts_on,status,notes) values(related,p_athlete,a.person_id,'athlete',current_date,'active',p_values->>'reason') returning to_jsonb(team_memberships.*) into after_value;
 elsif p_operation='team_remove' then
 membership:=(p_values->>'membership_id')::uuid;
 select to_jsonb(m) into before_value from team_memberships m join teams t on t.id=m.team_id where m.id=membership and m.athlete_id=p_athlete and t.organization_id=p_org for update of m;
 if before_value is null or before_value->>'status'<>'active' then raise exception 'Active squad membership required';end if;
 update team_memberships set status='inactive',ends_on=current_date,notes=concat_ws(E'\n',notes,p_values->>'reason') where id=membership returning to_jsonb(team_memberships.*) into after_value;
 elsif p_operation in ('coach_add','coach_remove') then
 related:=(p_values->>'team_id')::uuid;
 perform 1 from teams t where t.id=related and t.organization_id=p_org
   and exists(select 1 from team_memberships m where m.team_id=t.id and m.athlete_id=p_athlete and m.status='active') for update;
 if not found then raise exception 'Select an active squad for this athlete';end if;
 if p_operation='coach_add' then
 perform 1 from role_assignments r join role_definitions d on d.id=r.role_definition_id join people p on p.id=r.person_id join teams t on t.id=related
   where r.tenant_id=p_tenant and p.tenant_id=p_tenant and r.organization_id=p_org
   and r.person_id=(p_values->>'coach_person_id')::uuid and d.code='COACH' and r.status='active'
   and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())
   and (r.team_id is null or r.team_id=related) and (r.program_id is null or r.program_id=t.program_id);
 if not found then raise exception 'A current authorized coach is required for this squad';end if;
 if exists(select 1 from coach_access_assignments where team_id=related and coach_person_id=(p_values->>'coach_person_id')::uuid and status='active') then raise exception 'Coach already assigned';end if;
 if coalesce((p_values->>'is_head_coach')::boolean,false) and exists(select 1 from coach_access_assignments where team_id=related and status='active' and is_head_coach) then raise exception 'End the existing head-coach assignment first';end if;
 insert into coach_access_assignments(tenant_id,organization_id,coach_person_id,team_id,role_key,is_head_coach,status,starts_on)
 values(p_tenant,p_org,(p_values->>'coach_person_id')::uuid,related,'coach',coalesce((p_values->>'is_head_coach')::boolean,false),'active',current_date) returning to_jsonb(coach_access_assignments.*) into after_value;
 else
 select to_jsonb(c) into before_value from coach_access_assignments c where c.id=(p_values->>'assignment_id')::uuid and c.tenant_id=p_tenant and c.organization_id=p_org and c.team_id=related and c.status='active' for update;
 if before_value is null then raise exception 'Active coach assignment not found';end if;
 update coach_access_assignments set status='inactive',ends_on=current_date,updated_at=now() where id=(p_values->>'assignment_id')::uuid returning to_jsonb(coach_access_assignments.*) into after_value;
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'team.'||p_operation,'coach_access_assignment',(after_value->>'id')::uuid,before_value,after_value,gen_random_uuid(),p_values->>'reason');
 elsif p_operation='guardian_link' then
 related:=(p_values->>'person_id')::uuid;
 perform 1 from people where id=related and tenant_id=p_tenant and id<>a.person_id;if not found then raise exception 'Guardian must be a different person in this tenant';end if;
 if nullif(trim(p_values->>'relationship_type'),'') is null then raise exception 'Relationship type required';end if;
 family:=a.primary_family_id;
 if family is null then
 family:=nullif(p_values->>'family_id','')::uuid;
 if family is null then
 if nullif(trim(p_values->>'family_name'),'') is null then raise exception 'Select a family or enter its name';end if;
 insert into families(tenant_id,name,status) values(p_tenant,trim(p_values->>'family_name'),'active') returning id into family;
 end if;
 perform 1 from families where id=family and tenant_id=p_tenant;if not found then raise exception 'Family outside tenant';end if;
 update athletes set primary_family_id=family,updated_at=now() where id=p_athlete;
 insert into family_members(family_id,person_id,relationship_type,is_primary_guardian,can_view_minor_data) values(family,a.person_id,'athlete',false,false) on conflict(family_id,person_id) do nothing;
 end if;
 perform 1 from families where id=family and tenant_id=p_tenant for update;
 if not found then raise exception 'Family outside tenant';end if;
 select jsonb_build_object('family_id',family,'members',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)) into before_value from family_members m where family_id=family;
 if coalesce((p_values->>'is_primary')::boolean,false) then update family_members set is_primary_guardian=false where family_id=family;end if;
 insert into family_members(family_id,person_id,relationship_type,is_primary_guardian,can_view_minor_data) values(family,related,p_values->>'relationship_type',coalesce((p_values->>'is_primary')::boolean,false),false)
 on conflict(family_id,person_id) do update set relationship_type=excluded.relationship_type,is_primary_guardian=excluded.is_primary_guardian returning to_jsonb(family_members.*) into after_value;
 select jsonb_build_object('family_id',family,'members',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)) into after_value from family_members m where family_id=family;
 elsif p_operation='guardian_remove' then
 related:=(p_values->>'person_id')::uuid;family:=(p_values->>'family_id')::uuid;
 if family is distinct from a.primary_family_id then raise exception 'Relationship outside athlete primary family';end if;
 if exists(select 1 from family_authority_assignments where family_id=family and person_id=related and status='active') then raise exception 'Revoke active family authority before removing this relationship';end if;
 select to_jsonb(m) into before_value from family_members m where family_id=family and person_id=related and person_id<>a.person_id and (is_primary_guardian or relationship_type ~* 'parent|guardian|mother|father') for update;
 if before_value is null then raise exception 'Guardian relationship not found';end if;
 delete from family_members where family_id=family and person_id=related;
 after_value:=jsonb_build_object('removed_person_id',related,'family_id',family);
 elsif p_operation in ('athlete_inactivate','athlete_reactivate') then
 before_value:=to_jsonb(a);
 update athletes set status=case p_operation when 'athlete_inactivate' then 'INACTIVE' else 'ACTIVE' end,athlete_status=case p_operation when 'athlete_inactivate' then 'inactive' else 'active' end,updated_at=now() where id=p_athlete returning to_jsonb(athletes.*) into after_value;
 else raise exception 'Unknown relationship action';
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'athlete.'||p_operation,'athlete',p_athlete,before_value,after_value,gen_random_uuid(),p_values->>'reason');
 return jsonb_build_object('ok',true,'record',after_value);
end $$;
revoke all on function public.admin_athlete_relationship(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_athlete_relationship(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
