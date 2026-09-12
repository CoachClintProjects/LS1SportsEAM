-- Authorized remedy approval is separate from financial execution. Approved != processed.
create or replace function public.urws_record_authorized_remedy(
 p_case_id uuid,
 p_decision_id uuid,
 p_remedy_type text,
 p_amount numeric default null,
 p_currency char(3) default 'CAD',
 p_description text default null
) returns uuid
language plpgsql
security definer
set search_path=public,app
as $$
declare
 c public.urws_cases%rowtype;
 d public.urws_decisions%rowtype;
 v_person uuid;
 v_id uuid;
 v_tenant uuid;
begin
 select * into c from public.urws_cases where id=p_case_id;
 if not found then raise exception 'URWS case not found'; end if;
 select * into d from public.urws_decisions where id=p_decision_id and case_id=p_case_id;
 if not found then raise exception 'A case decision is required before approving a remedy'; end if;
 if p_remedy_type not in ('refund','credit','fee_waiver','payment_plan','service_credit','operational_correction','other') then raise exception 'Unsupported remedy type'; end if;
 if p_amount is not null and p_amount < 0 then raise exception 'Remedy amount cannot be negative'; end if;
 if length(trim(coalesce(p_description,''))) < 8 then raise exception 'Remedy description is required'; end if;
 v_person:=app.current_person_id();
 if v_person is null then select person_id into v_person from public.platform_superuser_operators where auth_user_id=auth.uid() and active=true and person_id is not null limit 1; end if;
 if v_person is null then raise exception 'Authorized remedy requires a person identity'; end if;
 if not app.urws_has_authority(v_person,c.organization_id,c.case_type_code,'approve_financial_remedy',coalesce(p_amount,0)) then raise exception 'URWS financial remedy authority denied' using errcode='42501'; end if;
 select tenant_id into v_tenant from public.organizations where id=c.organization_id;
 insert into public.urws_remedies(tenant_id,organization_id,case_id,decision_id,remedy_type,status,amount,currency,effective_at,description,metadata)
 values(v_tenant,c.organization_id,p_case_id,p_decision_id,p_remedy_type,'approved',p_amount,coalesce(p_currency,'CAD'),now(),trim(p_description),jsonb_build_object('approved_by_person_id',v_person,'source','admin_urws_workspace','execution_required',true))
 returning id into v_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,'urws.remedy.approved','urws_remedy',v_id,v_person,jsonb_build_object('organization_id',c.organization_id,'case_id',p_case_id,'decision_id',p_decision_id,'remedy_type',p_remedy_type,'amount',p_amount,'currency',coalesce(p_currency,'CAD'),'execution_required',true));
 return v_id;
end $$;
grant execute on function public.urws_record_authorized_remedy(uuid,uuid,text,numeric,char,text) to authenticated;
