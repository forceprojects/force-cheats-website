create or replace function public.delete_order_review(review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if lower(coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), '')) = 'surgeworldorder@protonmail.com' then
    delete from public.order_reviews where id = review_id;
    return true;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and lower(username) = 'admin') then
    delete from public.order_reviews where id = review_id;
    return true;
  end if;

  if exists (select 1 from public.order_reviews where id = review_id and user_id = auth.uid()) then
    delete from public.order_reviews where id = review_id and user_id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.delete_order_review(uuid) to authenticated;
