-- Lock down bosch_auth: drop the temporary open policies and keep RLS enabled
-- with NO public policies. Server code accesses this table exclusively via
-- SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS); the frontend checks
-- connection status through /api/auth/bosch/status instead of reading tokens.
--
-- !! RUN ORDER MATTERS !!
-- 1. First set SUPABASE_SERVICE_ROLE_KEY in Netlify env vars and deploy the
--    code that uses it (src/lib/supabase-admin.js).
-- 2. Only then run this migration. Running it earlier will bring back the
--    "No Bosch authentication found" failures from last Shabbat.

-- Drop ALL existing policies on bosch_auth (names were created ad-hoc in the dashboard)
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'bosch_auth'
  loop
    execute format('drop policy %I on public.bosch_auth', pol.policyname);
  end loop;
end $$;

-- RLS stays on; with no policies, anon/authenticated get no access at all.
alter table public.bosch_auth enable row level security;

-- Note: schedules / schedule_events are intentionally left as-is — the
-- dashboard still reads them directly with the anon key (read-only data,
-- no secrets). Writes go through server API routes.
