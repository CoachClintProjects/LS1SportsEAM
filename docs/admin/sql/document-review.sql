create or replace function public.admin_review_person_document(
 p_tenant uuid,p_person uuid,p_document uuid,p_actor_user uuid,p_actor_person uuid,
 p_role text,p_expected_version integer,p_expected_status text,p_status text,p_reason text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare previous public.documents; saved public.documents; type_code text;
begin
 if p_role not in ('org_admin','registrar') then raise exception 'Document review denied';end if;
 if p_status not in ('verified','rejected','pending') or nullif(trim(p_reason),'') is null then raise exception 'Decision and review reason required';end if;
 select d.* into previous from documents d join people p on p.id=d.owner_person_id
 where d.id=p_document and d.tenant_id=p_tenant and d.owner_person_id=p_person and p.tenant_id=p_tenant for update of d;
 if not found then raise exception 'Document outside record';end if;
 select code into type_code from document_types where id=previous.document_type_id;
 if p_role='registrar' and (type_code is null or type_code not in ('IDENTITY','REGISTRATION','SAFE_SPORT','BACKGROUND_CHECK','WAIVER','MEDIA_RELEASE')) then raise exception 'Document type outside Registrar authority';end if;
 if previous.current_version is distinct from p_expected_version or previous.verification_status is distinct from p_expected_status then raise exception 'Document changed. Reload before reviewing.';end if;
 if p_status='verified' and (previous.expires_at is not null and previous.expires_at<=now()) then raise exception 'Expired documents cannot be verified';end if;
 update documents set verification_status=p_status where id=p_document returning * into saved;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'person.document_reviewed','person',p_person,
 jsonb_build_object('document_id',previous.id,'version',previous.current_version,'status',previous.verification_status),
 jsonb_build_object('document_id',saved.id,'version',saved.current_version,'status',saved.verification_status,'reviewed_at',now(),'reviewer',p_actor_person),gen_random_uuid(),p_reason);
 return jsonb_build_object('id',saved.id,'verification_status',saved.verification_status);
end $$;
revoke all on function public.admin_review_person_document(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_person_document(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) to service_role;
