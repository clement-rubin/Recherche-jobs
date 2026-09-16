-- 006_api_usage_tracking.sql
-- Tracks monthly call counts per external API source, so scrapers can stop
-- calling a paid-tier-risk API (e.g. Adzuna) before ever exceeding its free quota.

create table if not exists api_usage (
  source text not null,
  month_key text not null,
  calls integer not null default 0,
  primary key (source, month_key)
);

-- RLS enabled with NO policies: direct table access via PostgREST is denied
-- entirely. The only way in is the security-definer function below, which
-- runs with the privileges of its owner regardless of the caller's role.
alter table api_usage enable row level security;

-- Atomically checks the cap and increments in one statement, so concurrent
-- calls (multiple locations firing Adzuna in parallel within one
-- /api/jobs/fetch run) cannot race past the cap — the row-level UPDATE lock
-- makes each caller either succeed or fail with the same guarantee a
-- sequential caller would get.
create or replace function reserve_api_usage(p_source text, p_month text, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calls int;
begin
  insert into api_usage (source, month_key, calls)
  values (p_source, p_month, 0)
  on conflict (source, month_key) do nothing;

  update api_usage
  set calls = calls + 1
  where source = p_source and month_key = p_month and calls < p_cap
  returning calls into v_calls;

  return v_calls is not null;
end;
$$;

grant execute on function reserve_api_usage(text, text, int) to anon, authenticated;
