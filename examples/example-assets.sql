-- Three example assets (a shared condo with a loan, a car, a sailboat) plus their reminders, in the super admin account.
-- Run it in the Supabase SQL Editor. Running it again replaces the examples instead of duplicating them: every example is marked by its notes.
-- The super admin has no plan limit, so these count as normal assets. Remove them from the app with "Delete" like any other asset.

delete from public.assets
 where user_id = (select id from auth.users where lower(email) = 'carlosmartinezhold@gmail.com')
   and notes like 'Example asset:%';

with me as (
  select id from auth.users where lower(email) = 'carlosmartinezhold@gmail.com'
),
new_assets as (
  insert into public.assets
    (user_id, name, type, place, country, lat, lon, value, cost, gross, expenses, debt, debt_payment, debt_rate, ownership, owner, status, acquired_on, annual_change, notes, history, is_sample)
  select o.id, v.name, v.type, v.place, v.country, v.lat, v.lon, v.value, v.cost, v.gross, v.expenses, v.debt, v.debt_payment, v.debt_rate, v.ownership, v.owner, v.status, v.acquired_on, v.annual_change, v.notes, v.history, false
  from me o
  cross join (values
    ('Miami Beach Condo'::text, 'house'::text, 'Miami, FL'::text, 'US'::text, 25.7617::float8, -80.1918::float8, 640000::numeric, 520000::numeric, 38400::numeric, 9600::numeric, 310000::numeric, 1850::numeric, 6.2::numeric, 50::numeric, 'You and partner'::text, 'Leased'::text, date '2021-03-15', 4::numeric,
      'Example asset: rented all year, half owned with a partner'::text,
      '[{"d":"2021-03-15","v":520000},{"d":"2022-03-01","v":560000},{"d":"2023-03-01","v":595000},{"d":"2024-03-01","v":615000},{"d":"2025-03-01","v":630000},{"d":"2026-03-01","v":640000}]'::jsonb),
    ('Tesla Model Y', 'car', 'Austin, TX', 'US', 30.2672, -97.7431, 34000, 52000, 0, 2100, 0, 0, 0, 100, null, 'Garaged', date '2022-05-20', -12,
      'Example asset: personal car, loses value every year',
      '[{"d":"2022-05-20","v":52000},{"d":"2023-05-01","v":43000},{"d":"2024-05-01","v":38000},{"d":"2025-05-01","v":35500},{"d":"2026-05-01","v":34000}]'::jsonb),
    ('Sailing Yacht Aurora', 'yacht', 'Miami, FL', 'US', 25.7617, -80.1918, 285000, 240000, 0, 11800, 60000, 980, 7.1, 100, null, 'Moored', date '2020-06-10', -3,
      'Example asset: weekend boat with a small loan',
      '[{"d":"2020-06-10","v":240000},{"d":"2022-06-01","v":275000},{"d":"2024-06-01","v":292000},{"d":"2026-06-01","v":285000}]'::jsonb)
  ) as v(name, type, place, country, lat, lon, value, cost, gross, expenses, debt, debt_payment, debt_rate, ownership, owner, status, acquired_on, annual_change, notes, history)
  returning id, user_id, name
)
insert into public.asset_reminders (user_id, asset_id, title, kind, due_on, repeat, notify_days)
select a.user_id, a.id, r.title, r.kind, r.due_on, r.repeat, r.notify_days
from new_assets a
join (values
  ('Miami Beach Condo', 'Insurance renewal', 'insurance', date '2026-12-15', 'yearly', 30),
  ('Miami Beach Condo', 'Property tax', 'tax', date '2027-01-31', 'yearly', 30),
  ('Miami Beach Condo', 'Update estimated value', 'other', date '2026-12-01', 'monthly', 3),
  ('Tesla Model Y', 'Registration renewal', 'registration', date '2027-05-20', 'yearly', 30),
  ('Sailing Yacht Aurora', 'Insurance renewal', 'insurance', date '2026-10-25', 'yearly', 30),
  ('Sailing Yacht Aurora', 'Engine service', 'maintenance', date '2027-03-01', 'yearly', 30)
) as r(asset_name, title, kind, due_on, repeat, notify_days) on r.asset_name = a.name;

-- what you should see afterwards: 3 assets and 6 reminders (the yacht insurance is already overdue, on purpose, so you see how a due reminder looks)
select (select count(*) from public.assets where notes like 'Example asset:%') as assets,
       (select count(*) from public.asset_reminders r join public.assets a on a.id = r.asset_id where a.notes like 'Example asset:%') as reminders;
