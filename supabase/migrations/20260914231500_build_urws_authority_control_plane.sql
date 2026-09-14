create or replace function app.urws_can_admin_authority(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,app
as $$
 select app.is_superuser() or exists(
  select 1
  from public.person_role_assignments pra
  join public.roles r on r.id=pra.role_id
  where pra.person_id=app.current_person_id()
    and pra.organization_id=p_organization_id
    and upper(coalesce(pra.status,''))='ACTIVE'
    and upper(r.code::text)='ORGANIZATION_ADMIN'
    and (pra.starts_at is null or pra.starts_at<=now())
    and (pra.ends_at is null or pra.ends_at>=now())
 );
$$;

insert into public.urws_authority_rules(
 organization_id,case_type_code,action,required_resource_type,required_authority_action,
 min_financial_amount,max_financial_amount,currency,requires_second_approval,escalation_role,active,metadata
)
select null,null,'execute_financial_remedy','urws_case','execute_financial_remedy',null,null,'CAD',false,'treasurer',true,
 jsonb_build_object('source','urws_authority_control_plane','scope','global_fallback')
where not exists(
 select 1 from public.urws_authority_rules
 where organization_id is null and case_type_code is null and action='execute_financial_remedy' and active=true
);

create or replace function public.urws_authority_admin_snapshot(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,app
as $$
declare v_org public.organizations%rowtype;
begin
 if p_organization_id is null then raise exception 'Organization is required'; end if;
 if not app.urws_can_admin_authority(p_organization_id) then raise exception 'URWS authority administration denied' using errcode='42501'; end if;
 select * into v_org from public.organizations where id=p_organization_id;
 if not found then raise exception 'Organization not found'; end if;
 return jsonb_build_object(
  'organization',jsonb_build_object('id',v_org.id,'name',v_org.name,'tenant_id',v_org.tenant_id),
  'people',coalesce((
   select jsonb_agg(x order by x->>'display_name') from (
    select jsonb_build_object(
      'person_id',p.id,
      'display_name',trim(concat_ws(' ',coalesce(nullif(p.preferred_name,''),p.first_name),p.last_name)),
      'email',p.email,
      'roles',jsonb_agg(distinct r.code::text)
    ) x
    from public.person_role_assignments pra
    join public.people p on p.id=pra.person_id
    join public.roles r on r.id=pra.role_id
    where pra.organization_id=p_organization_id
      and upper(coalesce(pra.status,''))='ACTIVE'
      and (pra.starts_at is null or pra.starts_at<=now())
      and (pra.ends_at is null or pra.ends_at>=now())
    group by p.id,p.preferred_name,p.first_name,p.last_name,p.email
   ) q
  ),'[]'::jsonb),
  'grants',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',g.id,'person_id',g.subject_person_id,'resource_type',g.resource_type,'resource_id',g.resource_id,
    'action',g.action,'authority_source',g.authority_source,'valid_from',g.valid_from,'valid_until',g.valid_until,
    'status',g.status,'created_at',g.created_at
   ) order by g.created_at desc)
   from public.platform_authority_grants g
   where g.resource_type='urws_case' and g.resource_id=p_organization_id
  ),'[]'::jsonb),
  'rules',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',r.id,'organization_id',r.organization_id,'case_type_code',r.case_type_code,'action',r.action,
    'required_resource_type',r.required_resource_type,'required_authority_action',r.required_authority_action,
    'min_financial_amount',r.min_financial_amount,'max_financial_amount',r.max_financial_amount,
    'currency',r.currency,'requires_second_approval',r.requires_second_approval,'escalation_role',r.escalation_role,
    'active',r.active,'metadata',r.metadata,'scope',case when r.organization_id is null then 'global_fallback' else 'organization' end
   ) order by (r.organization_id is not null) desc,r.action,r.min_financial_amount nulls first)
   from public.urws_authority_rules r
   where r.active=true and (r.organization_id=p_organization_id or r.organization_id is null)
  ),'[]'::jsonb)
 );
end $$;

create or replace function public.urws_set_authority_grant(
 p_organization_id uuid,
 p_subject_person_id uuid,
 p_action text,
 p_enabled boolean,
 p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=public,app
as $$
declare v_tenant uuid; v_grantor uuid; v_id uuid; v_existing uuid;
begin
 if not app.urws_can_admin_authority(p_organization_id) then raise exception 'URWS authority administration denied' using errcode='42501'; end if;
 if p_action not in ('decide','approve_financial_remedy','execute_financial_remedy') then raise exception 'Unsupported URWS authority action'; end if;
 if p_enabled and p_valid_until is not null and p_valid_until<=now() then raise exception 'Authority expiry must be in the future'; end if;
 select tenant_id into v_tenant from public.organizations where id=p_organization_id;
 if v_tenant is null then raise exception 'Organization not found'; end if;
 if not exists(
  select 1 from public.person_role_assignments pra
  where pra.person_id=p_subject_person_id and pra.organization_id=p_organization_id
    and upper(coalesce(pra.status,''))='ACTIVE'
    and (pra.starts_at is null or pra.starts_at<=now()) and (pra.ends_at is null or pra.ends_at>=now())
 ) then raise exception 'Authority can only be assigned to an active organization operator'; end if;
 v_grantor:=app.current_person_id();
 select id into v_existing from public.platform_authority_grants
 where subject_person_id=p_subject_person_id and resource_type='urws_case' and resource_id=p_organization_id
   and action=p_action and status='active'
 order by created_at desc limit 1;
 if p_enabled then
  if v_existing is not null then
   update public.platform_authority_grants
   set valid_until=p_valid_until,authority_source='urws_authority_admin',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('updated_at',now(),'updated_by_auth_user_id',auth.uid())
   where id=v_existing returning id into v_id;
  else
   insert into public.platform_authority_grants(
    tenant_id,subject_person_id,resource_type,resource_id,action,grantor_person_id,authority_source,valid_from,valid_until,status,metadata
   ) values(
    v_tenant,p_subject_person_id,'urws_case',p_organization_id,p_action,v_grantor,'urws_authority_admin',now(),p_valid_until,'active',
    jsonb_build_object('created_by_auth_user_id',auth.uid())
   ) returning id into v_id;
  end if;
 else
  update public.platform_authority_grants
  set status='revoked',valid_until=coalesce(valid_until,now()),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('revoked_at',now(),'revoked_by_auth_user_id',auth.uid())
  where subject_person_id=p_subject_person_id and resource_type='urws_case' and resource_id=p_organization_id and action=p_action and status='active'
  returning id into v_id;
 end if;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,case when p_enabled then 'urws.authority.granted' else 'urws.authority.revoked' end,'organization',p_organization_id,v_grantor,
  jsonb_build_object('organization_id',p_organization_id,'subject_person_id',p_subject_person_id,'action',p_action,'enabled',p_enabled,'valid_until',p_valid_until,'actor_auth_user_id',auth.uid()));
 return coalesce(v_id,v_existing);
end $$;

create or replace function public.urws_set_decision_approval_policy(
 p_organization_id uuid,
 p_requires_second_approval boolean,
 p_min_financial_amount numeric default null,
 p_currency character default 'CAD'
)
returns uuid
language plpgsql
security definer
set search_path=public,app
as $$
declare v_id uuid;
begin
 if not app.urws_can_admin_authority(p_organization_id) then raise exception 'URWS authority administration denied' using errcode='42501'; end if;
 if p_min_financial_amount is not null and p_min_financial_amount<0 then raise exception 'Financial threshold cannot be negative'; end if;
 update public.urws_authority_rules
 set active=false,updated_at=now()
 where organization_id=p_organization_id and case_type_code is null and action='decide_case'
   and coalesce(metadata->>'source','')='urws_authority_admin';
 insert into public.urws_authority_rules(
  organization_id,case_type_code,action,required_resource_type,required_authority_action,
  min_financial_amount,max_financial_amount,currency,requires_second_approval,escalation_role,active,metadata
 ) values(
  p_organization_id,null,'decide_case','urws_case','decide',p_min_financial_amount,null,coalesce(p_currency,'CAD'),
  p_requires_second_approval,'org_admin',true,jsonb_build_object('source','urws_authority_admin','configured_by_auth_user_id',auth.uid())
 ) returning id into v_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 select o.tenant_id,'urws.authority.policy_changed','organization',o.id,app.current_person_id(),
  jsonb_build_object('organization_id',o.id,'requires_second_approval',p_requires_second_approval,'min_financial_amount',p_min_financial_amount,'currency',coalesce(p_currency,'CAD'),'rule_id',v_id,'actor_auth_user_id',auth.uid())
 from public.organizations o where o.id=p_organization_id;
 return v_id;
end $$;

grant execute on function public.urws_authority_admin_snapshot(uuid) to authenticated;
grant execute on function public.urws_set_authority_grant(uuid,uuid,text,boolean,timestamptz) to authenticated;
grant execute on function public.urws_set_decision_approval_policy(uuid,boolean,numeric,character) to authenticated;
