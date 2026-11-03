-- Owned Map v7: closes two ways around the plan limit. Safe to run more than once. Run after 20261104000000_checkout_first.sql.
-- "Sample" rows do not count toward a plan, and nothing stopped a signed-in user from saving REAL assets as samples through the API,
-- or from switching samples to real later (the limit only ran on INSERT). Both are checked here, over all the rows of a statement at once.
-- NOT run against a real database by the author: read it, then run it in the SQL Editor, then try "Load sample data" and a CSV import.

-- 1) A person never needs more than a few dozen sample rows ("Load sample data" makes 17).
create or replace function public.assets_sample_cap() returns trigger language plpgsql as $$
declare r record;
begin
  for r in select user_id from newrows where is_sample group by user_id loop
    if (select count(*) from public.assets where user_id = r.user_id and is_sample) > 40 then
      raise exception 'sample_limit' using errcode = 'P0001', hint = 'Remove the sample data before adding more.';
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.assets_sample_cap() from public, anon;
drop trigger if exists assets_sample_cap on public.assets;
create trigger assets_sample_cap after insert on public.assets referencing new table as newrows for each statement execute function public.assets_sample_cap();

-- 2) Turning samples into real assets counts them: after the update, every owner who gained real assets must still be within their plan.
create or replace function public.assets_sample_to_real() returns trigger language plpgsql as $$
declare r record;
begin
  for r in select n.user_id from newrows n join oldrows o on o.id = n.id where o.is_sample and not n.is_sample group by n.user_id loop
    if not public.can_add_assets(r.user_id, 0) then
      raise exception 'plan_limit' using errcode = 'P0001', hint = 'Your plan does not include more assets.';
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.assets_sample_to_real() from public, anon;
drop trigger if exists assets_sample_to_real on public.assets;
create trigger assets_sample_to_real after update on public.assets referencing old table as oldrows new table as newrows for each statement execute function public.assets_sample_to_real();
