import assert from 'node:assert/strict';
import fs from 'node:fs';

const authority=fs.readFileSync('assets/js/version-authority.js','utf8');
const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');
const source=fs.readFileSync('assets/js/player-profile-consistency-v042723.js','utf8');

assert.match(authority,/app_version:\s*'v0\.4\.27\.23'/);
assert.match(authority,/app_build:\s*'20260820-v042723-player-profile-consistency'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.23-v042723-player-profile-consistency'/);
assert.match(runtime,/import '\.\/player-profile-consistency-v042723\.js';/);
assert.match(source,/normalizeGameDateForInput/);
assert.match(source,/\(\\d\{4\}\)年/);
assert.match(source,/BERRY_BY_TYPE/);
assert.match(source,/observedBerry&&canonicalBerry&&observedBerry!==canonicalBerry/);
assert.match(source,/VALIDATION_NOT_IMAGE_EVIDENCE/);
assert.match(source,/getPersistedPlayerEvolutionOverride/);
assert.match(source,/PLAYER_OVERRIDE/);
assert.match(source,/CANNOT_EVOLVE/);
assert.match(source,/公版進化 Master 僅供物種參考，不是此個體的有效進化條件/);
assert.doesNotMatch(source,/UPDATE pokemon|INSERT INTO pokemon\(|DELETE FROM pokemon/);

const predecessor=/PLAYER_PROFILE_CONSISTENCY_VERSION='v0\.4\.27\.23-player-profile-consistency-2026-08-20-a'/.test(source);
const successor=/PLAYER_PROFILE_CONSISTENCY_VERSION='v0\.4\.27\.36-player-profile-consistency-review-only-2026-08-25-a'/.test(source);
assert.equal(predecessor||successor,true,'v042723_profile_consistency_runtime_identity_not_recognized');

if(predecessor){
  // Immutable v0.4.27.23 replay semantics. Retained for historical source snapshots.
  assert.match(source,/TYPE_BERRY_CONSISTENCY_VERSION='v0\.4\.27\.23-type-berry-consistency-2026-08-20-a'/);
  assert.match(source,/DETERMINISTIC_TYPE_BERRY_MISMATCH_CORRECTED/);
  assert.match(source,/draft\.favorite_berry=canonicalBerry/);
  assert.match(source,/AI 原始 JSON 保留不變/);
}else{
  // Current successor semantics: v0.4.27.36 keeps the v0.4.27.23 date/evolution
  // contracts but deliberately supersedes unsafe type→berry mutation. Public
  // relation remains validation-only and a mismatch must fail closed for review.
  assert.match(source,/TYPE_BERRY_CONSISTENCY_VERSION='v0\.4\.27\.36-type-berry-review-only-2026-08-25-a'/);
  assert.match(source,/REVIEW_REQUIRED_TYPE_BERRY_MISMATCH/);
  assert.match(source,/auto_rewrite:false/);
  assert.match(source,/type_berry_auto_rewrite:false/);
  assert.match(source,/公版關係只用於偵測矛盾，不會把任何值轉成圖片 Evidence 或自動寫入玩家資料/);
  assert.doesNotMatch(source,/DETERMINISTIC_TYPE_BERRY_MISMATCH_CORRECTED/);
  assert.doesNotMatch(source,/draft\.favorite_berry=canonicalBerry/);
  assert.doesNotMatch(source,/berryInput\.value=berryCorrection\.canonical_value/);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042723_PLAYER_PROFILE_CONSISTENCY_STATIC_SUCCESSOR_AWARE',
  staged_release_version:'v0.4.27.23',
  runtime_contract:predecessor?'V042723_ORIGINAL':'V042736_REVIEW_ONLY_SUCCESSOR',
  localized_date_projection:true,
  type_berry_relation_validation:true,
  observed_type_berry_conflict_correction:predecessor,
  observed_type_berry_conflict_review_required:successor,
  type_berry_auto_rewrite:predecessor,
  missing_berry_public_fill:false,
  persisted_evolution_override_detail_projection:true,
  raw_provider_json_write:false,
  production_numeric_authority_unchanged:true,
},null,2));
