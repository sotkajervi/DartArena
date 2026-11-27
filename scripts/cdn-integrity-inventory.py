"""Report external HTML dependencies; do not execute or fetch any inventoried URLs."""
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import subprocess

class Inventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script":
            url = a.get("src") or ""
        elif tag == "link" and "stylesheet" in (a.get("rel") or "").lower().split():
            url = a.get("href") or ""
        else:
            return
        if url.startswith(("https://", "http://", "//")):
            self.items.append((tag, url, a.get("integrity") or "", a.get("crossorigin") or ""))

groups = defaultdict(list)
for name in subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0"):
    if not name.endswith(".html"):
        continue
    parser = Inventory()
    parser.feed(Path(name).read_text(encoding="utf-8"))
    for item in parser.items:
        groups[item].append(name)

print("External HTML script and stylesheet inventory (tracked HTML only)")
for (tag, url, sri, cors), files in sorted(groups.items()):
    # Omit query values to avoid printing potential tokens.
    parsed = urlsplit(url)
    display = parsed.netloc + parsed.path
    print(f"{tag} {display} | SRI={bool(sri)} | crossorigin={cors or '-'} | occurrences={len(files)}")
    print("  " + ", ".join(sorted(set(files))))
print(f"Total external references: {sum(map(len, groups.values()))}")
print("Scope excludes runtime-injected scripts, JS imports, WASM/model fetches and external service configuration.")
