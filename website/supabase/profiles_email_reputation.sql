alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists role text;

alter table public.profiles
add column if not exists reputation int2 not null default 0;

create index if not exists profiles_email_lower_idx on public.profiles ((lower(email)));

create or replace function public.grant_customer_role_by_email(target_email text)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  e text;
  updated_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  e := lower(trim(coalesce(target_email, '')));
  if e = '' then
    return false;
  end if;

  if lower(coalesce((auth.jwt() ->> 'email'), '')) <> 'surgeworldorder@protonmail.com' then
    return false;
  end if;

  update public.profiles
    set role = 'customer',
        reputation = 2
  where lower(coalesce(email, '')) = e;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.grant_customer_role_by_email(text) to authenticated;
