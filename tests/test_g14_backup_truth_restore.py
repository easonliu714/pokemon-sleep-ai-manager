from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
module = (ROOT / 'assets/js/backup-truth-restore.js').read_text(encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')
bootstrap = (ROOT / 'assets/js/bootstrap.js').read_text(encoding='utf-8')
sw = (ROOT / 'service-worker.js').read_text(encoding='utf-8')

required = [
    "pokemon-sleep-backup-manifest/2.0",
    "PRAGMA integrity_check",
    "PRAGMA foreign_key_check",
    "database_sha256",
    "table_counts",
    "quality_summary",
    "before-verified-restore",
    "正式替換後 SHA-256 不一致",
    "已 rollback",
    "pokemon-sleep:data-changed",
]
for token in required:
    assert token in module, token

version_match = re.search(r"const APP_VERSION = '(v\d+\.\d+\.\d+)'", bootstrap)
build_match = re.search(r"const VERSION = '([^']+)'", bootstrap)
sw_version_match = re.search(r"const APP_VERSION = '(v\d+\.\d+\.\d+)'", sw)
sw_build_match = re.search(r"const APP_BUILD = '([^']+)'", sw)
assert version_match and build_match and sw_version_match and sw_build_match
active_version = version_match.group(1)
active_build = build_match.group(1)
cache_suffix = re.sub(r'^\d{8}-', '', active_build)

assert sw_version_match.group(1) == active_version
assert sw_build_match.group(1) == active_build
assert "backup-truth-restore.js" in index
assert "backup-truth-restore.js" in bootstrap
assert "backup-truth-restore.js" in sw
assert f"pokemon-sleep-ai-{active_version}-{cache_suffix}" in sw
assert "app_version:APP_VERSION" in sw
assert "build:APP_BUILD" in sw
assert f"bootstrap.js?v={active_build}" in index
print(f'G14.1 Backup Truth & Restore Verification: PASS ({active_version})')
