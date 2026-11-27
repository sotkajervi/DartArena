"""Baseline diagnostic: local disposable database only; never connect to production."""
import pathlib
import re
import subprocess
import sys
import time

CANDIDATE = '--candidate' in sys.argv

PSQL = ["psql", "-X", "-h", "127.0.0.1", "-p", "5432", "-U", "postgres",
        "-d", "abuse_test", "-qAt", "-v", "ON_ERROR_STOP=1"]
ACTOR = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000002"
source = pathlib.Path("supabase-security-hardening-20261004.sql").read_text()
match = re.search(r"create or replace function public\.guard_dartarena_insert_rate\(\).*?\n\$\$;", source, re.S | re.I)
assert match, "exact existing guard not found"

def query(sql, ok=True):
    p = subprocess.run(PSQL, input=sql, text=True, capture_output=True, timeout=15)
    if ok and p.returncode:
        raise RuntimeError(p.stderr)
    return p

query("""
create schema auth;
create role authenticated;
create role anon;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
create function auth.role() returns text language sql stable
as $$ select 'authenticated'::text $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create table public.lobby_messages(sender_id uuid not null, created_at timestamptz default now());
create table public.challenges(challenger_id uuid not null, created_at timestamptz default now());
create table public.challenge_match_proposals(proposer_id uuid not null, created_at timestamptz default now());
create table public.tournaments(owner_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.client_error_logs(user_id uuid not null, created_at timestamptz default now());
create table public.jdc_challenge_results(user_id uuid not null, created_at timestamptz default now());
grant usage on schema auth to authenticated;
grant insert,select on public.lobby_messages,public.challenges,public.challenge_match_proposals,public.tournaments,public.client_error_logs,public.jdc_challenge_results to authenticated;
""" + match.group(0) + """
create trigger lobby_guard before insert on public.lobby_messages
for each row execute function public.guard_dartarena_insert_rate();
create trigger challenge_guard before insert on public.challenges
for each row execute function public.guard_dartarena_insert_rate();
create trigger challenge_match_proposals_guard before insert on public.challenge_match_proposals
for each row execute function public.guard_dartarena_insert_rate();
create trigger tournaments_guard before insert on public.tournaments
for each row execute function public.guard_dartarena_insert_rate();
create trigger client_error_logs_guard before insert on public.client_error_logs
for each row execute function public.guard_dartarena_insert_rate();
create trigger jdc_challenge_results_guard before insert on public.jdc_challenge_results
for each row execute function public.guard_dartarena_insert_rate();
""")

if CANDIDATE:
    query(pathlib.Path("db/api-rate-guard-candidate.sql").read_text())

def actor_sql(actor):
    return "set role authenticated; set test.actor = '" + actor + "';\n"

for table, field, limit, error in [
    ("lobby_messages", "sender_id", 20, "Chat rate limit reached"),
    ("challenges", "challenger_id", 20, "Too many challenges"),
    ("challenge_match_proposals", "proposer_id", 30, "Too many match proposals"),
    ("tournaments", "owner_id", 10, "Tournament rate limit reached"),
    ("client_error_logs", "user_id", 60, "Error log rate limit reached"),
    ("jdc_challenge_results", "user_id", 12, "JDC result rate limit reached"),
]:
    def insert(actor, count=1):
        return f"insert into public.{table}({field}) select '{actor}'::uuid from generate_series(1,{count});\n"
    def total(actor):
        return int(query(f"select count(*) from public.{table} where {field}='{actor}';").stdout.strip())

    query(actor_sql(ACTOR) + insert(ACTOR, limit))
    rejected = query(actor_sql(ACTOR) + insert(ACTOR), ok=False)
    assert rejected.returncode and error in rejected.stderr, rejected.stderr
    query(actor_sql(OTHER) + insert(OTHER))
    assert total(ACTOR) == limit and total(OTHER) == 1
    print(f"{table}: sequential boundary enforced, independent actor accepted", flush=True)

    query(f"truncate public.{table};")
    query(actor_sql(ACTOR) + insert(ACTOR, limit - 1))
    # One uncommitted insert and one concurrent transaction, both against local fixture.
    a = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1)
    try:
        a.stdin.write(actor_sql(ACTOR) + "begin;\n" + insert(ACTOR) + "\\echo A_READY\n")
        a.stdin.flush()
        assert a.stdout.readline().strip() == "A_READY", "first transaction failed"
        if CANDIDATE:
            bproc = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True)
            try:
                bproc.stdin.write("set application_name='da_rate_waiter'; set statement_timeout='10s';\n"
                                 + actor_sql(ACTOR) + insert(ACTOR))
                bproc.stdin.close()
                bproc.stdin = None
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    waiting = query("select count(*) from pg_stat_activity where application_name='da_rate_waiter' and wait_event_type='Lock' and wait_event='advisory';").stdout.strip()
                    if waiting == '1':
                        break
                    assert bproc.poll() is None, "second transaction did not wait for lock"
                    time.sleep(0.05)
                else:
                    raise AssertionError("second transaction never waited for advisory lock")
                query(actor_sql(OTHER) + insert(OTHER))
                assert total(OTHER) == 1, "independent actor was blocked"
                a.stdin.write("commit;\n\\q\n")
                a.stdin.flush()
                assert a.wait(timeout=10) == 0, a.stderr.read()
                out, err = bproc.communicate(timeout=12)
                assert bproc.returncode and error in err, err
                assert total(ACTOR) == limit
                print(f"{table}: candidate serialized concurrent writes; second rejected, independent actor accepted", flush=True)
            finally:
                if bproc.poll() is None:
                    bproc.kill()
                    bproc.wait()
            continue
        b = query(actor_sql(ACTOR) + insert(ACTOR), ok=False)
        a.stdin.write("commit;\n\\q\n")
        a.stdin.flush()
        assert a.wait(timeout=10) == 0, a.stderr.read()
        count = total(ACTOR)
        assert count in (limit, limit + 1), count
        print(f"{table}: concurrent baseline rows={count}, configured limit={limit}, "
              f"second accepted={b.returncode == 0}", flush=True)
        if count == limit + 1:
            print("OBSERVED: concurrency can exceed rate limit in isolated source fixture", flush=True)
        else:
            print("OBSERVED: limit not exceeded in this run", flush=True)
    finally:
        if a.poll() is None:
            a.kill()
            a.wait()
print("Candidate assertions passed." if CANDIDATE else "Diagnostic completed. Green means diagnostic executed, not that the current guard is race-safe.")
