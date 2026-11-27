"""Scan reachable Git blobs locally. Never print secret values, excerpts or paths."""
import base64
import json
import re
import subprocess
from collections import Counter

MAX_BYTES = 10 * 1024 * 1024
PATTERNS = [
    ("Supabase secret", rb"\bsb_secret_[A-Za-z0-9_-]{15,}"),
    ("GitHub token", rb"\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{25,}"),
    ("Private key", rb"-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    ("Provider secret literal", rb"\b(?:REALTIME_SFU_BEARER_TOKEN|CLOUDFLARE_API_TOKEN|ROBOFLOW_API_KEY|TURNSTILE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD)\s*[:=]\s*['\x22][A-Za-z0-9_.\/+=-]{24,}['\x22]"),
    ("AWS access key identifier", rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    ("Credential in postgres URL", rb"postgres(?:ql)?://[^:\s/@]+:[^@\s/]{8,}@"),
]
JWT = re.compile(rb"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
compiled = [(name, re.compile(pattern)) for name, pattern in PATTERNS]

def classify(data):
    kinds = {name for name, pattern in compiled if pattern.search(data)}
    for match in JWT.finditer(data):
        try:
            part = match.group().split(b".")[1]
            payload = json.loads(base64.urlsafe_b64decode(part + b"=" * (-len(part) % 4)))
            if isinstance(payload, dict) and payload.get("role") == "service_role":
                kinds.add("Legacy service-role JWT")
        except (ValueError, TypeError, UnicodeError):
            continue
    return kinds

def self_test():
    assert "Supabase secret" in classify(b"sb_" + b"secret_" + b"x" * 24)
    assert "GitHub token" in classify(b"gh" + b"p_" + b"x" * 35)
    assert "Private key" in classify(b"-----BEGIN " + b"PRIVATE KEY-----")
    assert not classify(b"sb_" + b"publishable_" + b"x" * 24)
    def token(role):
        payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).rstrip(b"=")
        return b"eyJhbGciOiJIUzI1NiJ9." + payload + b".signature"
    assert "Legacy service-role JWT" in classify(token("service_role"))
    assert not classify(token("anon"))
    print("Scanner self-tests passed; no sample values printed.")

def main():
    self_test()
    ids = subprocess.check_output(["git", "rev-list", "--objects", "--all", "--no-object-names"])
    objects = subprocess.check_output(
        ["git", "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
        input=ids).splitlines()
    counts = Counter()
    findings = []
    oversized = []
    with subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as proc:
        for row in objects:
            sha, kind, size = row.split()
            if kind != b"blob":
                continue
            counts["blobs"] += 1
            if int(size) > MAX_BYTES:
                counts["oversized"] += 1
                oversized.append(sha.decode("ascii"))
                continue
            proc.stdin.write(sha + b"\n")
            proc.stdin.flush()
            header = proc.stdout.readline().split()
            assert header == [sha, kind, size], "Unexpected Git object header"
            data = proc.stdout.read(int(size))
            assert len(data) == int(size) and proc.stdout.read(1) == b"\n"
            if b"\x00" in data:
                counts["binary"] += 1
                continue
            counts["scanned"] += 1
            for category in sorted(classify(data)):
                findings.append((sha.decode("ascii"), category))
        proc.stdin.close()
        assert proc.wait() == 0
    print("Reachable commits:", subprocess.check_output(["git", "rev-list", "--count", "--all"]).decode().strip())
    print("Blob coverage:", dict(counts))
    print("Candidate findings:", len(findings))
    for sha, category in findings:
        print("Review candidate:", sha, category)
    for sha in oversized:
        print("Excluded large blob:", sha)
    print("Scope: fetched reachable refs, nonbinary blobs <= 10 MiB. No remote credential validation.")
    # Diagnostic only. Findings require private review; never print contents.
    print("Diagnostic completed; green is not a clean bill of health.")

if __name__ == "__main__":
    main()
