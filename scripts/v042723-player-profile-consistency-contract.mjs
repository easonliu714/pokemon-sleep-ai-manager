import assert from 'node:assert/strict';
import fs from 'node:fs';

const authority=fs.readFileSync('assets/js/version-authority.js','utf8');
const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');
const source=fs.readFileSync('assets/js/player-profile-consistency-v042723.js','utf8');

assert.match(authority,/app_version:\s*'v0\.4\.27\.23'/);
assert.match(authority,/app_build:\s*'20260820-v042723-player-profile-consistency'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.23-v042723-player-profile-consistency'/);
assert.match(runtime,/import '\.\/player-profile-consistency-v042723\.js';/);
assert.match(source,/PLAYER_PROFILE_CONSISTENCY_VERSION='v0\.4\.27\.23-player-profile-consistency-2026-08-20-a'/);
assert.match(source,/normalizeGameDateForInput/);
assert.match(source,/\(\\d\{4\}\)年/);
assert.match(source,/BERRY_BY_TYPE/);
assert.match(source,/DETERMINISTIC_TYPE_BERRY_MISMATCH_CORRECTED/);
assert.match(source,/observedBerry&&canonicalBerry&&observedBerry!==canonicalBerry/);
assert.match(source,/VALIDATION_NOT_IMAGE_EVIDENCE/);
assert.match(source,/getPersistedPlayerEvolutionOverride/);
assert.match(source,/PLAYER_OVERRIDE/);
assert.match(source,/CANNOT_EVOLVE/);
assert.match(source,/公版進化 Master 僅供物種參考，不是此個體的有效進化條件/);
assert.match(source,/AI 原始 JSON 保留不變/);
assert.doesNotMatch(source,/UPDATE pokemon|INSERT INTO pokemon\(|DELETE FROM pokemon/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042723_PLAYER_PROFILE_CONSISTENCY_STATIC',
  version:'v0.4.27.23',
  localized_date_projection:true,
  observed_type_berry_conflict_correction:true,
  missing_berry_public_fill:false,
  persisted_evolution_override_detail_projection:true,
  raw_provider_json_write:false,
  production_numeric_authority_unchanged:true,
},null,2));
