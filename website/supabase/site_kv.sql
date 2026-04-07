create table if not exists public.site_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.site_kv_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_kv_set_updated_at on public.site_kv;
create trigger site_kv_set_updated_at before update on public.site_kv for each row execute function public.site_kv_set_updated_at();

alter table public.site_kv enable row level security;

drop policy if exists site_kv_read on public.site_kv;
create policy site_kv_read on public.site_kv for select using (true);

drop policy if exists site_kv_write on public.site_kv;
create policy site_kv_write on public.site_kv
for all
to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.site_kv to anon, authenticated;
grant insert, update, delete on public.site_kv to authenticated;
