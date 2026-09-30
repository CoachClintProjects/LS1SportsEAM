create or replace function public.submit_support_ticket(p_id uuid,p_tenant uuid,p_person uuid,p_title text,p_description text,p_severity text,p_context text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ticket public.support_tickets;
begin
 if nullif(trim(p_title),'') is null or length(p_title)>200 or nullif(trim(p_description),'') is null or length(p_description)>10000 then raise exception 'Title and description are required'; end if;
 if p_severity not in ('low','normal','high','critical') then raise exception 'Invalid severity'; end if;
 perform 1 from public.people where id=p_person and tenant_id=p_tenant;
 if not found then raise exception 'Requester outside tenant'; end if;
 insert into public.support_tickets(id,tenant_id,ticket_number,title,description,category,severity,status,requester_person_id)
 values(p_id,p_tenant,'LS1-'||upper(replace(p_id::text,'-','')),trim(p_title),trim(p_description),'application',p_severity,'open',p_person)
 on conflict(id) do nothing returning * into ticket;
 if ticket.id is null then
 select * into ticket from public.support_tickets where id=p_id and tenant_id=p_tenant and requester_person_id=p_person;
 if ticket.id is null then raise exception 'Ticket request conflict'; end if;
 else
 insert into public.support_ticket_events(ticket_id,event_type,actor_person_id,message,metadata)
 values(ticket.id,'submitted',p_person,'Ticket submitted',jsonb_build_object('page',left(p_context,1000),'email_delivery','pending_configuration'));
 end if;
 return jsonb_build_object('id',ticket.id,'ticket_number',ticket.ticket_number,'status',ticket.status,'emailDelivery','pending_configuration');
end $$;
revoke all on function public.submit_support_ticket(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_support_ticket(uuid,uuid,uuid,text,text,text,text) to service_role;
