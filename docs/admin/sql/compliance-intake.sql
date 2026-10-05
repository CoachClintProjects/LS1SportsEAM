-- Release candidate: complete evidence intake before enabling the new client.
alter table public.credentials add column if not exists document_id uuid references public.documents(id);
alter table public.background_checks add column if not exists document_id uuid references public.documents(id);
alter table public.safesport_records add column if not exists document_id uuid references public.documents(id);

create or replace function public.admin_compliance_intake(p_tenant uuid,p_org uuid,p_actor_user uuid,p_actor_person uuid,p_domain text,p_id uuid,p_person uuid,p_values jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare tab text; fields text[]; k text; saved jsonb; existing jsonb; requested jsonb; type_field text;
begin
 if p_id is null or p_person is null or p_actor_user is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Person, record and intake reason required';end if;
 if not exists(select 1 from organizations where id=p_org and tenant_id=p_tenant) then raise exception 'Organization outside tenant';end if;
 if not exists(select 1 from admin_compliance_people(p_tenant,array[p_org]) where id=p_person) then raise exception 'Person outside organization';end if;
 if p_domain='credentials' then tab:='credentials';type_field:='credential_type';fields:=array['credential_type','requirement_id','issuer','credential_number','issued_on','expires_on','document_id'];
 elsif p_domain='backgroundChecks' then tab:='background_checks';type_field:='check_type';fields:=array['check_type','provider','reference_number','submitted_at','completed_at','expires_on','result_classification','document_id'];
 elsif p_domain='safeSport' then tab:='safesport_records';type_field:='certification_type';fields:=array['certification_type','certificate_id','completed_on','expires_on','source','document_id'];
 else raise exception 'Unsupported evidence category';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Evidence properties required';end if;
 for k in select jsonb_object_keys(p_values) loop
  if not k=any(fields) then raise exception 'Unsupported evidence property: %',k;end if;
 end loop;
 if nullif(trim(p_values->>type_field),'') is null then raise exception 'Evidence type required';end if;
 if p_values->>'document_id' is not null and not exists(select 1 from documents where id=(p_values->>'document_id')::uuid and tenant_id=p_tenant and owner_person_id=p_person) then raise exception 'Document outside person record';end if;
 if nullif(p_values->>'expires_on','') is not null and (p_values->>'expires_on')::date<coalesce(nullif(p_values->>'issued_on','')::date,nullif(p_values->>'completed_on','')::date,nullif(p_values->>'completed_at','')::timestamptz::date) then raise exception 'Expiry must follow completion or issue date';end if;
 requested:=jsonb_build_object('organization_id',p_org,'person_id',p_person,'domain',p_domain,'values',p_values);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 execute format('select to_jsonb(r) from %I r where id=$1',tab) into existing using p_id;
 if existing is not null then
  if exists(select 1 from audit_events where tenant_id=p_tenant and actor_user_id=p_actor_user and action='compliance_record.created' and entity_type=p_domain and entity_id=p_id and after_data->'intake_request'=requested) then return existing;end if;
  raise exception 'Record already exists with different intake properties';
 end if;
 p_values:=p_values||jsonb_build_object('id',p_id,'person_id',p_person,'status','pending','version',1);
 if p_domain='credentials' then p_values:=p_values||jsonb_build_object('verification_status','unverified');end if;
 execute format('insert into %I select (jsonb_populate_record(null::%I,$1)).* returning to_jsonb(%I.*)',tab,tab,tab) into saved using p_values;
 insert into work_items(id,tenant_id,work_type,entity_type,entity_id,status,priority,payload)
 values(p_id,p_tenant,'COMPLIANCE_REVIEW',p_domain,p_id,'open','normal',jsonb_build_object('organization_id',p_org,'person_id',p_person,'assigned_role','org_admin','domain',p_domain,'title',p_values->>type_field,'record_status','pending','due_on',p_values->>'expires_on'));
 insert into audit_events(tenant_id,actor_user_id,actor_person_id,action,entity_type,entity_id,after_data,correlation_id,reason)
 values(p_tenant,p_actor_user,p_actor_person,'compliance_record.created',p_domain,p_id,saved||jsonb_build_object('intake_request',requested),gen_random_uuid(),trim(p_reason));
 return saved;
end $$;
revoke all on function public.admin_compliance_intake(uuid,uuid,uuid,uuid,text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_compliance_intake(uuid,uuid,uuid,uuid,text,uuid,uuid,jsonb,text) to service_role;

create or replace function public.admin_compliance_evidence_list(p_tenant uuid,p_orgs uuid[],p_domain text,p_page integer default 0,p_search text default '',p_sort text default 'person',p_direction text default 'asc')
returns setof jsonb language plpgsql stable security invoker set search_path=public as $$
declare tab text; sort_sql text; direction_sql text;
begin
 tab:=case p_domain when 'credentials' then 'credentials' when 'backgroundChecks' then 'background_checks' when 'safeSport' then 'safesport_records' end;
 if tab is null or p_page<0 or p_page>10000 or p_page is null then raise exception 'Valid evidence category and page required';end if;
 sort_sql:=case p_sort when 'status' then 'c.status' when 'expires_on' then 'c.expires_on' else 'p.last_name' end;
 direction_sql:=case p_direction when 'desc' then 'desc' else 'asc' end;
 return query execute format('select to_jsonb(c)||jsonb_build_object(''person_label'',concat_ws('' '',coalesce(p.preferred_name,p.first_name),p.last_name),''total_count'',count(*) over()) from %I c join people p on p.id=c.person_id join admin_compliance_people($1,$2) scoped on scoped.id=p.id where p.tenant_id=$1 and ($3='''' or concat_ws('' '',p.first_name,p.last_name,p.preferred_name,to_jsonb(c)::text) ilike ''%%''||$3||''%%'') order by %s %s nulls last,c.id asc limit 26 offset $4',tab,sort_sql,direction_sql)
 using p_tenant,p_orgs,left(coalesce(p_search,''),100),p_page*25;
end $$;
revoke all on function public.admin_compliance_evidence_list(uuid,uuid[],text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_compliance_evidence_list(uuid,uuid[],text,integer,text,text,text) to service_role;
