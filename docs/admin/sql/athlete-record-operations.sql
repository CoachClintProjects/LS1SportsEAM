insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('athlete-records','athlete-records',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain']) on conflict(id) do nothing;
create or replace function public.admin_record_task(p_tenant uuid,p_person uuid,p_actor_user uuid,p_actor_person uuid,p_role text,p_id uuid,p_operation text,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row public.work_items; saved public.work_items;
begin
 perform 1 from people where id=p_person and tenant_id=p_tenant;
 if not found then raise exception 'Person outside tenant'; end if;
 if p_operation='create' then
 if nullif(trim(p_values->>'title'),'') is null then raise exception 'Task title required'; end if;
 insert into work_items(id,tenant_id,work_type,entity_type,entity_id,owner_person_id,status,priority,payload)
 values(p_id,p_tenant,'ADMIN_TASK','person',p_person,p_actor_person,'open','normal',jsonb_build_object('title',trim(p_values->>'title'),'description',p_values->>'description','due_at',p_values->>'due_at','assigned_role',p_role,'created_from','athlete_record','created_by',p_actor_user)) on conflict(id) do nothing returning * into saved;
 if saved.id is null then select * into saved from work_items where id=p_id and tenant_id=p_tenant and entity_id=p_person and owner_person_id=p_actor_person; if saved.id is null then raise exception 'Task request conflict'; end if; return to_jsonb(saved); end if;
 else
 select * into old_row from work_items where id=p_id and tenant_id=p_tenant and entity_type='person' and entity_id=p_person and work_type='ADMIN_TASK' for update;
 if not found then raise exception 'Task not found'; end if;
 if p_role<>'org_admin' and old_row.payload->>'assigned_role' is distinct from p_role then raise exception 'Task belongs to another role'; end if;
 if p_operation not in ('complete','cancel','reopen') then raise exception 'Invalid task transition'; end if;
 if p_operation='reopen' and old_row.status not in ('completed','cancelled') then raise exception 'Only closed tasks can reopen'; end if;
 if p_operation in ('complete','cancel') and old_row.status not in ('open','in_progress') then raise exception 'Task is already closed'; end if;
 update work_items set status=case p_operation when 'complete' then 'completed' when 'cancel' then 'cancelled' else 'open' end,payload=payload||jsonb_build_object('last_changed_at',now(),'last_changed_by',p_actor_user) where id=p_id returning * into saved;
 end if;
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,before_data,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'record.task_'||p_operation,'person',p_person,to_jsonb(old_row),to_jsonb(saved),gen_random_uuid(),'Athlete record task action');
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_record_task(uuid,uuid,uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_task(uuid,uuid,uuid,uuid,text,uuid,text,jsonb) to service_role;
create or replace function public.admin_attach_person_document(p_id uuid,p_tenant uuid,p_person uuid,p_actor_user uuid,p_actor_person uuid,p_type uuid,p_title text,p_path text,p_mime text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.documents;
begin
 perform 1 from people where id=p_person and tenant_id=p_tenant;
 if not found then raise exception 'Person outside tenant'; end if;
 if nullif(trim(p_title),'') is null or p_path not like 'athlete-records/'||p_tenant::text||'/'||p_person::text||'/%' then raise exception 'Invalid document'; end if;
 insert into documents(id,tenant_id,owner_person_id,document_type_id,title,storage_path,mime_type,classification,current_version,verification_status) values(p_id,p_tenant,p_person,p_type,trim(p_title),p_path,p_mime,'restricted',1,'pending') returning * into saved;
 insert into document_versions(document_id,version_no,storage_path,uploaded_by) values(saved.id,1,p_path,p_actor_person);
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason) values(p_tenant,p_actor_user,p_actor_person,'person.document_attached','person',p_person,jsonb_build_object('document_id',saved.id,'title',saved.title),gen_random_uuid(),'Record document upload');
 return jsonb_build_object('id',saved.id,'title',saved.title);
end $$;
revoke all on function public.admin_attach_person_document(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_attach_person_document(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;
