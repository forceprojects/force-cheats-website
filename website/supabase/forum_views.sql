alter table if exists public.forum_topics
add column if not exists views_count bigint not null default 0;

create or replace function public.increment_forum_topic_view(topic_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v bigint;
begin
  update public.forum_topics
    set views_count = coalesce(views_count, 0) + 1
  where slug = topic_slug
  returning views_count into v;

  return coalesce(v, 0);
end;
$$;

grant execute on function public.increment_forum_topic_view(text) to anon, authenticated;
