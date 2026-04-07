create table if not exists public.team_members (
  user_id uuid primary key,
  email text not null,
  is_admin boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_members_email_uq on public.team_members (lower(email));

create or replace function public.team_members_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at before update on public.team_members for each row execute function public.team_members_set_updated_at();
