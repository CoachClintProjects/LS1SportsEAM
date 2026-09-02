-- Index foreign-key columns lacking direct coverage and remove duplicate parser read policy.
do $$
declare r record; idx text;
begin
  for r in
    select n.nspname schema_name,c.relname table_name,a.attname column_name
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
    join unnest(con.conkey) with ordinality k(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum
    where con.contype='f' and n.nspname='public'
      and not exists (select 1 from pg_index i where i.indrelid=c.oid and array[a.attnum] <@ i.indkey::smallint[])
  loop
    idx := left('idx_'||r.table_name||'_'||r.column_name, 60);
    execute format('create index if not exists %I on %I.%I (%I)', idx,r.schema_name,r.table_name,r.column_name);
  end loop;
end $$;
drop policy if exists parser_definitions_read on public.parser_definitions;