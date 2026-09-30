create or replace function public.admin_record_requirement_review(p_tenant uuid,p_org uuid,p_athlete uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare reg public.registrations; req public.registration_requirements; doc public.documents; prior public.registration_requirement_status; saved public.registration_requirement_status; person uuid; type_code text;
begin
 if p_role not in ('org_admin','registrar') then raise exception 'Requirement review denied';end if;
 select a.person_id into person from athletes a join people p on p.id=a.person_id where a.id=p_athlete and p.tenant_id=p_tenant for update of a;
 if not found then raise exception 'Athlete outside tenant';end if;
 select * into reg from registrations where id=(p_values->>'registration_id')::uuid and organization_id=p_org and athlete_id=p_athlete for update;
 if not found or reg.status not in ('submitted','pending','under_review') then raise exception 'Open registration required';end if;
 select * into req from registration_requirements where id=(p_values->>'requirement_id')::uuid and organization_id=p_org
 and (program_id is null or program_id=reg.program_id) and (season_id is null or season_id=reg.season_id)
 and (valid_from is null or valid_from<=current_date) and (valid_until is null or valid_until>=current_date);
 if not found then raise exception 'Requirement outside registration';end if;
 select d.* into doc from documents d where d.id=(p_values->>'document_id')::uuid and d.tenant_id=p_tenant and d.owner_person_id=person and d.verification_status='verified' and (d.expires_at is null or d.expires_at>now()) for share;
 if not found then raise exception 'Current verified evidence for this person is required';end if;
 select code into type_code from document_types where id=doc.document_type_id;
 if p_role='registrar' and (type_code is null or type_code not in ('IDENTITY','REGISTRATION','SAFE_SPORT','BACKGROUND_CHECK','WAIVER','MEDIA_RELEASE')) then raise exception 'Evidence outside Registrar authority';end if;
 if req.metadata->>'document_type_id' is not null and req.metadata->>'document_type_id'<>doc.document_type_id::text then raise exception 'Evidence document type does not match requirement';end if;
 if nullif(trim(p_values->>'reason'),'') is null then raise exception 'Review reason required';end if;
 select * into prior from registration_requirement_status where registration_id=reg.id and requirement_id=req.id for update;
 if prior.status is distinct from p_values->>'expected_status' or prior.satisfied_at is distinct from nullif(p_values->>'expected_satisfied_at','')::timestamptz then raise exception 'Requirement changed. Reload before reviewing.';end if;
 insert into registration_requirement_status(registration_id,requirement_id,status,satisfied_at,evidence_document_id,notes)
 values(reg.id,req.id,'satisfied',now(),doc.id,p_values->>'reason') on conflict(registration_id,requirement_id) do update set status='satisfied',satisfied_at=now(),evidence_document_id=excluded.evidence_document_id,notes=excluded.notes returning * into saved;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'athlete.registration_requirement_reviewed','athlete',p_athlete,to_jsonb(prior),to_jsonb(saved),gen_random_uuid(),p_values->>'reason');
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_record_requirement_review(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_requirement_review(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
