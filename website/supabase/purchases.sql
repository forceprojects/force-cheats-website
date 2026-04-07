create extension if not exists pgcrypto;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  purchaser_email text,
  shopify_order_id bigint unique,
  order_name text,
  financial_status text,
  currency text,
  total_price numeric,
  created_at timestamptz default now(),
  processed_at timestamptz,
  line_items jsonb default '[]'::jsonb,
  license_keys jsonb default '[]'::jsonb,
  raw jsonb
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_email_idx on public.purchases (purchaser_email);
create index if not exists purchases_processed_at_idx on public.purchases (processed_at desc);

alter table public.purchases enable row level security;

drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own
on public.purchases
for select
using (
  user_id = auth.uid()
  or purchaser_email = (auth.jwt() ->> 'email')
);

