-- Canonical native LS1 package specification
insert into public.ls1_package_specs (code,name,version,schema_definition,compatibility,status)
values (
 'LS1-CORE-1','LS1Sports Native Data Package','1.0.0',
 jsonb_build_object('package','LS1','required',jsonb_build_array('manifest','entities','provenance','validation'),'entity_types',jsonb_build_array('person','athlete','organization','team','competition','event','entry','performance','result','rule','audit')),
 jsonb_build_object('legacy_inputs',jsonb_build_array('hy3','cl2','mdb','sdif','csv','xlsx','xml','json'),'strategy','translate-normalize-validate-canonicalize'),
 'active'
)
on conflict (code) do update set name=excluded.name,version=excluded.version,schema_definition=excluded.schema_definition,compatibility=excluded.compatibility,status=excluded.status,updated_at=now();
