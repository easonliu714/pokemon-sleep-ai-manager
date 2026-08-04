from pathlib import Path

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

assert "backup-truth-restore.js" in index
assert "backup-truth-restore.js" in bootstrap
assert "backup-truth-restore.js" in sw
assert "APP_VERSION = 'v0.3.77'" in bootstrap
assert "pokemon-sleep-ai-v0.3.77-v0377a-backup-truth-restore-verification" in sw
assert "app_version:'v0.3.77'" in sw
print('G14.1 Backup Truth & Restore Verification: PASS')
