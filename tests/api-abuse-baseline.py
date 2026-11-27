"""Baseline diagnostic: local disposable database only; never connect to production."""
import pathlib
import re
import subprocess

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
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
create function auth.role() returns text language sql stable
as $$ select 'authenticated'::text $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create table public.lobby_messages(sender_id uuid not null, created_at timestamptz default now());
create table public.challenges(challenger_id uuid not null, created_at timestamptz default now());
grant usage on schema auth to authenticated;
grant insert,select on public.lobby_messages,public.challenges to authenticated;
""" + match.group(0) + """
create trigger lobby_guard before insert on public.lobby_messages
for each row execute function public.guard_dartarena_insert_rate();
create trigger challenge_guard before insert on public.challenges
for each row execute function public.guard_dartarena_insert_rate();
""")

def actor_sql(actor):
    return "set role authenticated; set test.actor = '" + actor + "';\n"

for table, field, error in [
    ("lobby_messages", "sender_id", "Chat rate limit reached"),
    ("challenges", "challenger_id", "Too many challenges"),
]:
    def insert(actor, count=1):
        return f"insert into public.{table}({field}) select '{actor}'::uuid from generate_series(1,{count});\n"
    def total(actor):
        return int(query(f"select count(*) from public.{table} where {field}='{actor}';").stdout.strip())

    query(actor_sql(ACTOR) + insert(ACTOR, 20))
    rejected = query(actor_sql(ACTOR) + insert(ACTOR), ok=False)
    assert rejected.returncode and error in rejected.stderr, rejected.stderr
    query(actor_sql(OTHER) + insert(OTHER))
    assert total(ACTOR) == 20 and total(OTHER) == 1
    print(f"{table}: sequential boundary enforced, independent actor accepted", flush=True)

    query(f"truncate public.{table};")
    query(actor_sql(ACTOR) + insert(ACTOR, 19))
    # One uncommitted insert and one concurrent transaction, both against local fixture.
    a = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1)
    try:
        a.stdin.write(actor_sql(ACTOR) + "begin;\n" + insert(ACTOR) + "\\echo A_READY\n")
        a.stdin.flush()
        assert a.stdout.readline().strip() == "A_READY", "first transaction failed"
        b = query(actor_sql(ACTOR) + insert(ACTOR), ok=False)
        a.stdin.write("commit;\n\\q\n")
        a.stdin.flush()
        assert a.wait(timeout=10) == 0, a.stderr.read()
        count = total(ACTOR)
        assert count in (20, 21), count
        print(f"{table}: concurrent baseline rows={count}, configured limit=20, "
              f"second accepted={b.returncode == 0}", flush=True)
        if count == 21:
            print("OBSERVED: concurrency can exceed rate limit in isolated source fixture", flush=True)
        else:
            print("OBSERVED: limit not exceeded in this run", flush=True)
    finally:
        if a.poll() is None:
            a.kill()
            a.wait()
print("Diagnostic completed. Green means diagnostic executed, not that the current guard is race-safe.")
