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
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true) = 'yes', false) $$;
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
if CANDIDATE:
    # Privileged fixture seeding only: exercise long-window boundaries without waiting.
    for table, field, limit, age, error in [
        ("challenges", "challenger_id", 100, "5 minutes", "Challenge rate limit reached"),
        ("lobby_messages", "sender_id", 200, "2 minutes", "Chat rate limit reached"),
        ("tournaments", "owner_id", 30, "2 hours", "Daily tournament limit reached"),
    ]:
        query(f"""truncate public.{table};
        alter table public.{table} disable trigger user;
        insert into public.{table}({field},created_at)
          select '{ACTOR}'::uuid,now()-interval '{age}' from generate_series(1,{limit-1});
        alter table public.{table} enable trigger user;""")
        statement = f"insert into public.{table}({field}) values ('{ACTOR}');"
        query(actor_sql(ACTOR) + statement)
        denied = query(actor_sql(ACTOR) + statement, ok=False)
        assert denied.returncode and error in denied.stderr, denied.stderr
        assert int(query(f"select count(*) from public.{table} where {field}='{ACTOR}';").stdout.strip()) == limit
        print(f"{table}: long-window boundary enforced", flush=True)

    for table, field in [
        ("lobby_messages", "sender_id"), ("challenges", "challenger_id"),
        ("challenge_match_proposals", "proposer_id"), ("tournaments", "owner_id"),
        ("client_error_logs", "user_id"), ("jdc_challenge_results", "user_id"),
    ]:
        query(f"truncate public.{table};")
        denied = query(actor_sql(ACTOR) + f"insert into public.{table}({field}) values ('{OTHER}');", ok=False)
        assert denied.returncode and "Invalid" in denied.stderr, denied.stderr
        # Existing trigger overwrites client-provided timestamps on normal inserts.
        query(actor_sql(ACTOR) + f"insert into public.{table}({field},created_at) values ('{ACTOR}',now()-interval '10 days');")
        assert query(f"select created_at between now()-interval '10 seconds' and now() from public.{table};").stdout.strip() == 't'
        if table == "tournaments":
            assert query("select updated_at between now()-interval '10 seconds' and now() from public.tournaments;").stdout.strip() == 't'
        print(f"{table}: actor mismatch denied; insert timestamp assigned by server", flush=True)

    # Confirm the pre-existing administrator exception without changing production auth.
    query("truncate public.lobby_messages;")
    query(actor_sql(ACTOR) + "set test.admin='yes'; insert into public.lobby_messages(sender_id) select '" + ACTOR + "'::uuid from generate_series(1,21);")
    assert query("select count(*) from public.lobby_messages;").stdout.strip() == '21'
    denied = query(actor_sql(ACTOR) + "insert into public.lobby_messages(sender_id) values ('" + ACTOR + "');", ok=False)
    assert denied.returncode and "Chat rate limit reached" in denied.stderr, denied.stderr
    print("Existing administrator exception preserved; regular actor remains limited", flush=True)

    # Verify a rejected transaction leaves the lock available to subsequent requests.
    query("truncate public.challenges;")
    query(actor_sql(ACTOR) + "begin; insert into public.challenges(challenger_id) values ('" + ACTOR + "'); rollback;")
    query(actor_sql(ACTOR) + "set statement_timeout='2s'; insert into public.challenges(challenger_id) values ('" + ACTOR + "');")
    assert query("select count(*) from public.challenges;").stdout.strip() == '1'
    print("Rollback releases transaction lock and does not consume a row", flush=True)

if CANDIDATE:
    # Confirm the candidate changes only the six intended branches.
    candidate_source = pathlib.Path("db/api-rate-guard-candidate.sql").read_text()
    rollback_source = pathlib.Path("db/api-rate-guard-rollback.sql").read_text()
    candidate_body = re.search(r"create or replace function public\.guard_dartarena_insert_rate\(\).*?\n\$\$;", candidate_source, re.S | re.I).group(0)
    rollback_body = re.search(r"create or replace function public\.guard_dartarena_insert_rate\(\).*?\n\$\$;", rollback_source, re.S | re.I).group(0)
    lock_line = "    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dartarena:insert-rate:' || tg_table_name || ':' || v_uid::text, 0));\n"
    assert candidate_body.count(lock_line) == 6
    assert candidate_body.replace(lock_line, "") == match.group(0) == rollback_body
    assert query("select not has_function_privilege('anon','public.guard_dartarena_insert_rate()','execute') and not has_function_privilege('authenticated','public.guard_dartarena_insert_rate()','execute');").stdout.strip() == 't'
    before_rollback = query("select prosrc from pg_proc where oid='public.guard_dartarena_insert_rate()'::regprocedure;").stdout
    query(rollback_source)
    after_rollback = query("select prosrc from pg_proc where oid='public.guard_dartarena_insert_rate()'::regprocedure;").stdout
    assert before_rollback.replace(lock_line, "") == after_rollback
    assert query("select not has_function_privilege('anon','public.guard_dartarena_insert_rate()','execute') and not has_function_privilege('authenticated','public.guard_dartarena_insert_rate()','execute');").stdout.strip() == 't'
    query("truncate public.challenges;")
    query(actor_sql(ACTOR) + "insert into public.challenges(challenger_id) select '" + ACTOR + "'::uuid from generate_series(1,20);")
    denied = query(actor_sql(ACTOR) + "insert into public.challenges(challenger_id) values ('" + ACTOR + "');", ok=False)
    assert denied.returncode and "Too many challenges" in denied.stderr
    print("Rollback restores original guard and restricted execution privileges; normal rate limit remains active", flush=True)

print("Candidate assertions passed." if CANDIDATE else "Diagnostic completed. Green means diagnostic executed, not that the current guard is race-safe.")
