from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
module = (ROOT / 'assets/js/backup-truth-restore.js').read_text(encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')
bootstrap = (ROOT / 'assets/js/bootstrap.js').read_text(encoding='utf-8')
sw = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
authority = (ROOT / 'assets/js/version-authority.js').read_text(encoding='utf-8')

required = [
    'pokemon-sleep-backup-manifest/2.0',
    'PRAGMA integrity_check',
    'PRAGMA foreign_key_check',
    'database_sha256',
    'table_counts',
    'quality_summary',
    'before-verified-restore',
    '正式替換後 SHA-256 不一致',
    '已 rollback',
    'pokemon-sleep:data-changed',
]
for token in required:
    assert token in module, token

version_match = re.search(r"app_version:\s*'(v\d+(?:\.\d+){2,})'", authority)
build_match = re.search(r"app_build:\s*'([^']+)'", authority)
cache_match = re.search(r"cache_name:\s*'([^']+)'", authority)
assert version_match and build_match and cache_match
active_version = version_match.group(1)
active_build = build_match.group(1)
active_cache = cache_match.group(1)
assert active_cache == f"pokemon-sleep-ai-{active_version}-{re.sub(r'^\d{8}-', '', active_build)}"
assert "version-authority.js" in bootstrap
assert "authority.app_version" in bootstrap
assert "authority.app_build" in bootstrap
assert "importScripts('./assets/js/version-authority.js')" in sw
assert "cache_name:CACHE" in sw
assert "backup-truth-restore.js" in index

page_aware = "page_aware_feature_loading:true" in bootstrap and "global_deferred_sweep:false" in bootstrap
if page_aware:
    # v0.4.27.55.3.2 keeps Backup Truth/Restore on its historical direct index entry.
    # The page-aware loader must not import it again under a query-versioned ESM
    # identity; Backup navigation only hydrates metadata-only snapshot listing.
    assert "backup:Object.freeze([])" in bootstrap
    assert "if(page==='backup')await hydrateBackupSnapshotPanel()" in bootstrap
    assert "listSnapshots({force:true})" in bootstrap
    assert "importFeatureModule('backup-truth-restore.js')" not in bootstrap
else:
    assert "backup-truth-restore.js" in bootstrap

assert "backup-truth-restore.js" in sw
assert "app_version:APP_VERSION" in sw
assert "build:APP_BUILD" in sw
assert "bootstrap.js" in index
print(f"G14.1 Backup Truth & Restore Verification: PASS ({active_version}, central authority, {'page-aware' if page_aware else 'legacy-eager'})")
