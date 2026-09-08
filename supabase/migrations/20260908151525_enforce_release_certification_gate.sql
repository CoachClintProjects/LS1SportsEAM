alter table public.platform_release_verifications
  add column if not exists is_required boolean not null default true;

create schema if not exists private;

create or replace function private.enforce_release_certification_gate()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  required_count integer;
  nonpass_count integer;
  open_defect_count integer;
begin
  if new.status = 'CERTIFIED' and old.status is distinct from 'CERTIFIED' then
    if new.deployment_id is null or btrim(new.deployment_id) = '' then
      raise exception 'Release certification requires a deployment_id';
    end if;

    select count(*) into required_count
    from public.platform_release_verifications
    where release_candidate_id = new.id and is_required = true;

    if required_count = 0 then
      raise exception 'Release certification requires at least one required verification';
    end if;

    select count(*) into nonpass_count
    from public.platform_release_verifications
    where release_candidate_id = new.id
      and is_required = true
      and result <> 'PASS';

    if nonpass_count > 0 then
      raise exception 'Release certification blocked: % required verification(s) are not PASS', nonpass_count;
    end if;

    select count(*) into open_defect_count
    from public.platform_release_defects
    where release_candidate_id = new.id
      and status in ('OPEN','IN_PROGRESS','RETEST_REQUIRED');

    if open_defect_count > 0 then
      raise exception 'Release certification blocked: % unresolved defect(s)', open_defect_count;
    end if;

    if new.certified_at is null then
      new.certified_at := now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_release_certification_gate() from public, anon, authenticated;

drop trigger if exists trg_platform_release_certification_gate on public.platform_release_candidates;
create trigger trg_platform_release_certification_gate
before update of status on public.platform_release_candidates
for each row execute function private.enforce_release_certification_gate();
