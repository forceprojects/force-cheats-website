alter table public.purchases add column if not exists payment_provider text;
alter table public.purchases add column if not exists provider_checkout_session_id text;

create unique index if not exists purchases_provider_checkout_session_id_uq
  on public.purchases (provider_checkout_session_id)
  where provider_checkout_session_id is not null;
