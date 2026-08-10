import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STRATEGY_ANALYSIS_PACK_VERSION,STRATEGY_ANALYSIS_PROMPT_VERSION} from '../assets/js/external-strategy-analysis-pack.js';
import {STRATEGY_ANALYSIS_PRIVACY_VERSION} from '../assets/js/external-strategy-analysis-privacy.js';
import {STRATEGY_ANALYSIS_LOCAL_VERSION} from '../assets/js/external-strategy-analysis-local.js';
import {STRATEGY_ANALYSIS_PACK_UI_VERSION} from '../assets/js/war-room-strategy-analysis-pack-ui.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.9','v0.4.9.1'].includes(appVersion),`v0.4.9 historical contract received unsupported successor ${appVersion}`);
if(appVersion==='v0.4.9'){
  assert.equal(appBuild,'20260810-v049-external-strategy-analysis-pack');
  assert.equal(STRATEGY_ANALYSIS_PACK_VERSION,'strategy-analysis-pack-2026-08-10-b');
  assert.equal(STRATEGY_ANALYSIS_PROMPT_VERSION,'strategy-analysis-prompt-2026-08-10-b');
  assert.equal(STRATEGY_ANALYSIS_LOCAL_VERSION,'strategy-analysis-local-2026-08-10-b');
  assert.equal(STRATEGY_ANALYSIS_PACK_UI_VERSION,'strategy-analysis-pack-ui-2026-08-10-b');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.9'"),'successor must retain v0.4.9 legacy parser bridge');
  assert.equal(STRATEGY_ANALYSIS_PACK_VERSION,'strategy-analysis-pack-2026-08-10-c');
  assert.equal(STRATEGY_ANALYSIS_PROMPT_VERSION,'strategy-analysis-prompt-2026-08-10-c');
  assert.equal(STRATEGY_ANALYSIS_LOCAL_VERSION,'strategy-analysis-local-2026-08-10-c');
  assert.equal(STRATEGY_ANALYSIS_PACK_UI_VERSION,'strategy-analysis-pack-ui-2026-08-10-c');
}
assert.equal(STRATEGY_ANALYSIS_PRIVACY_VERSION,'strategy-analysis-privacy-2026-08-10-b');
assert.ok(version.includes("// app_version: 'v0.4.8.5'"),'v0.4.9 lineage must retain v0.4.8.5 legacy parser bridge');

const privacy=read('assets/js/external-strategy-analysis-privacy.js');
for(const token of ['forbiddenKeyPaths','assertNoForbiddenKeyPaths','stablePokemonIdLeaks','source_image_refs_in_pack:false','identity_fingerprint_in_pack:false'])assert.ok(privacy.includes(token),`v0.4.9 privacy contract missing ${token}`);
const pack=read('assets/js/external-strategy-analysis-pack.js');
for(const token of ['candidate_ref','missing_rules','public_master_versions','rule_versions','direct_apply_allowed:false','ai_numeric_source_of_truth:false','convertible_candy_in_physical_totals:false','derived_options:Object.freeze([])','replaceStableIds'])assert.ok(pack.includes(token),`v0.4.9 pack contract missing ${token}`);
const local=read('assets/js/external-strategy-analysis-local.js');
for(const token of ['buildUnifiedResourceSnapshot','buildLocalPokemonCandidateScoring','buildLocalTeamOptimization','buildLocalRecipeStrategyProjection','buildLocalRecipeDiscoveryStockpile','getActiveStrategyGoalProfile','projectWeeklyEventEffects','forbiddenKeyPaths','assertNoForbiddenKeyPaths'])assert.ok(local.includes(token),`v0.4.9 local adapter missing ${token}`);
for(const obsolete of ['activeGoalProfile','buildLocalCandidateScoring','buildLocalRecipeStrategy(','RECIPE_STRATEGY_PROJECTION_VERSION','CURRENT_READINESS_RULE_VERSION'])assert.equal(local.includes(obsolete),false,`v0.4.9 local adapter must not use obsolete API ${obsolete}`);
for(const forbidden of ['fetch(','Gemini','applyPayload('])assert.equal(local.includes(forbidden),false,`v0.4.9 local pack must remain provider/apply independent: ${forbidden}`);
const ui=read('assets/js/war-room-strategy-analysis-pack-ui.js');
for(const token of ['產生可信分析包','複製 AI 提示詞','下載 JSON','下載 Markdown','資料或分析要求已變更，請重新產生','source image ref','identity fingerprint'])assert.ok(ui.includes(token),`v0.4.9 UI missing ${token}`);
assert.equal(ui.includes('applyPayload('),false,'v0.4.9 UI must not contain direct Apply');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
assert.ok(recipeLocal.includes("import('./war-room-strategy-analysis-pack-ui.js')"),'War Room must load Analysis Pack UI');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.9 lineage must not add SQLite migration 10');
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'Analysis Pack dynamic modules require supported online-load-once network-first JS caching');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.9_HISTORICAL_RELEASE_CONTRACT',active_app_version:appVersion,
  strategy_analysis_pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,privacy_version:STRATEGY_ANALYSIS_PRIVACY_VERSION,
  provider_neutral:true,offline_generation_after_online_load:true,ephemeral_candidate_refs:true,stable_pokemon_id_export:false,structural_privacy_guard:true,
  candy_double_count_guard:true,missing_rules_explicit:true,direct_apply_path:false,sqlite_migration_added:false,v0485_legacy_bridge_preserved:true,
},null,2));
