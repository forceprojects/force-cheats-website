create extension if not exists pgcrypto;

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_key text not null,
  product_name text,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  display_name text,
  rating int2 not null check (rating >= 1 and rating <= 5),
  content text not null,
  created_at timestamptz default now(),
  constraint product_reviews_unique unique (product_key, user_id)
);

create index if not exists product_reviews_product_key_idx on public.product_reviews (product_key);
create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);

alter table public.product_reviews enable row level security;

drop policy if exists product_reviews_select_public on public.product_reviews;
create policy product_reviews_select_public
on public.product_reviews
for select
to public
using (true);

drop policy if exists product_reviews_insert_customer on public.product_reviews;
create policy product_reviews_insert_customer
on public.product_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'customer'
      and coalesce(p.reputation, 0) >= 2
  )
);
