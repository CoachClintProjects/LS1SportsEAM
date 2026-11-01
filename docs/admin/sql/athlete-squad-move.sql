create or replace function public.admin_move_athlete_squad(p_tenant uuid,p_org uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,p_operation text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.athletes; before_value jsonb; after_value jsonb; family uuid; related uuid; membership uuid;
begin
 select at.* into a from athletes at join people p on p.id=at.person_id where at.id=p_athlete and p.tenant_id=p_tenant for update of at;
 if not found then raise exception 'Athlete outside tenant'; end if;
 perform 1 from organizations where id=p_org and tenant_id=p_tenant;
 if not found or nullif(trim(p_values->>'reason'),'') is null then raise exception 'Organization and reason required'; end if;

 related:=(p_values->>'team_id')::uuid;membership:=(p_values->>'membership_id')::uuid;
 perform 1 from teams where id=related and organization_id=p_org and status='active';if not found then raise exception 'Choose an active destination squad in this club';end if;
 select to_jsonb(m) into before_value from team_memberships m join teams t on t.id=m.team_id where m.id=membership and m.athlete_id=p_athlete and t.organization_id=p_org and m.status='active' for update of m;
 if before_value is null then raise exception 'Current squad membership changed. Reload before moving';end if;
 if exists(select 1 from team_memberships where athlete_id=p_athlete and team_id=related and status='active') then raise exception 'Athlete is already in the destination squad';end if;
 update team_memberships set status='inactive',ends_on=current_date,notes=concat_ws(E'\n',notes,p_values->>'reason') where id=membership;
 insert into team_memberships(team_id,athlete_id,person_id,membership_type,starts_on,status,notes) values(related,p_athlete,a.person_id,'athlete',current_date,'active',p_values->>'reason') returning to_jsonb(team_memberships.*) into after_value;

 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'athlete.team_move','athlete',p_athlete,before_value,after_value,gen_random_uuid(),p_values->>'reason');
 return jsonb_build_object('ok',true,'record',after_value);
end $$;
revoke all on function public.admin_move_athlete_squad(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_move_athlete_squad(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
