create or replace function public.urws_prepare_refund_from_request(p_refund_request_id uuid,p_payment_id uuid)
returns uuid language plpgsql security definer set search_path=public,app as $$
declare rr public.refund_requests%rowtype; p public.payments%rowtype; v_refund uuid; v_existing numeric:=0; v_person uuid; v_operator uuid; v_auth uuid; v_tenant uuid; v_linked boolean:=false;
begin
 select * into rr from public.refund_requests where id=p_refund_request_id for update; if not found then raise exception 'Refund request not found'; end if;
 if rr.status<>'approved' then raise exception 'Only approved refund requests can prepare a canonical refund'; end if;
 if rr.resulting_refund_id is not null then return rr.resulting_refund_id; end if;
 if rr.membership_id is null then raise exception 'Refund request is not linked to a membership'; end if;
 select * into p from public.payments where id=p_payment_id; if not found then raise exception 'Payment not found'; end if;
 if p.invoice_id is null then raise exception 'Payment must be tied to an invoice for membership refund preparation'; end if;
 select exists(select 1 from public.invoice_lines il where il.invoice_id=p.invoice_id and lower(coalesce(il.entity_type,''))='membership' and il.entity_id=rr.membership_id) into v_linked;
 if not v_linked then raise exception 'Selected payment is not linked to this membership'; end if;
 select coalesce(sum(r.amount),0) into v_existing from public.refunds r where r.payment_id=p.id and lower(coalesce(r.status,'pending')) not in ('failed','cancelled','void','denied');
 if rr.amount > greatest(p.amount-v_existing,0) then raise exception 'Approved refund amount exceeds remaining refundable payment amount'; end if;
 if upper(coalesce(rr.currency,'CAD'))<>upper(coalesce(p.currency,'CAD')) then raise exception 'Refund request currency does not match payment currency'; end if;
 v_auth:=auth.uid(); v_person:=app.current_person_id(); select id,person_id into v_operator,v_person from public.platform_superuser_operators where auth_user_id=v_auth and active=true limit 1; if v_person is null and v_operator is null then v_person:=app.current_person_id(); end if;
 if not app.urws_has_authority(v_person,rr.organization_id,'membership_refund_dispute','execute_financial_remedy',rr.amount) then raise exception 'Refund preparation authority denied' using errcode='42501'; end if;
 insert into public.refunds(payment_id,invoice_id,amount,reason,status,currency_code,reconciliation_status,reconciliation_metadata)
 values(p.id,p.invoice_id,rr.amount,coalesce(rr.reason,'Approved membership refund'),'pending',coalesce(rr.currency,p.currency,'CAD'),'PENDING',jsonb_build_object('source','urws_refund_request','refund_request_id',rr.id,'membership_id',rr.membership_id,'organization_id',rr.organization_id,'prepared_by_auth_user_id',v_auth,'prepared_by_operator_id',v_operator,'prepared_by_person_id',v_person)) returning id into v_refund;
 update public.refund_requests set resulting_refund_id=v_refund,updated_at=now() where id=rr.id;
 select tenant_id into v_tenant from public.organizations where id=rr.organization_id;
 insert into public.platform_event_outbox(tenant_id,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
 values(v_tenant,'membership.refund.prepared','refund',v_refund,v_person,jsonb_build_object('organization_id',rr.organization_id,'membership_id',rr.membership_id,'refund_request_id',rr.id,'payment_id',p.id,'amount',rr.amount,'currency',rr.currency,'status','pending','operator_id',v_operator,'auth_user_id',v_auth));
 return v_refund;
end $$;
grant execute on function public.urws_prepare_refund_from_request(uuid,uuid) to authenticated;
