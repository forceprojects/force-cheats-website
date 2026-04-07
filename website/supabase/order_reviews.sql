create extension if not exists pgcrypto;

create table if not exists public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  display_name text,
  rating int2 not null check (rating >= 1 and rating <= 5),
  content text not null,
  created_at timestamptz default now(),
  constraint order_reviews_unique unique (order_id, user_id)
);

create index if not exists order_reviews_order_id_idx on public.order_reviews (order_id);
create index if not exists order_reviews_user_id_idx on public.order_reviews (user_id);

alter table public.order_reviews enable row level security;

drop policy if exists order_reviews_select_public on public.order_reviews;
create policy order_reviews_select_public
on public.order_reviews
for select
to public
using (true);

drop policy if exists order_reviews_select_own on public.order_reviews;
create policy order_reviews_select_own
on public.order_reviews
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists order_reviews_insert_own_for_purchase on public.order_reviews;
create policy order_reviews_insert_own_for_purchase
on public.order_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.purchases p
    where p.id = order_id
      and (
        p.user_id = auth.uid()
        or p.purchaser_email = (auth.jwt() ->> 'email')
      )
  )
);
