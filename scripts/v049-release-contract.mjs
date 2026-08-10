import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STRATEGY_ANALYSIS_PACK_VERSION,STRATEGY_ANALYSIS_PROMPT_VERSION} from '../assets/js/external-strategy-analysis-pack.js';
import {STRATEGY_ANALYSIS_PRIVACY_VERSION} from '../assets/js/external-strategy-analysis-privacy.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.9');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v049-external-strategy-analysis-pack');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.9-v049-external-strategy-analysis-pack');
assert.equal(STRATEGY_ANALYSIS_PACK_VERSION,'strategy-analysis-pack-2026-08-10-a');
assert.equal(STRATEGY_ANALYSIS_PROMPT_VERSION,'strategy-analysis-prompt-2026-08-10-a');
assert.equal(STRATEGY_ANALYSIS_PRIVACY_VERSION,'strategy-analysis-privacy-2026-08-10-a');

const pack=read('assets/js/external-strategy-analysis-pack.js');
for(const token of ['candidate_ref','missing_rules','public_master_versions','rule_versions','direct_apply_allowed:false','ai_numeric_source_of_truth:false','convertible_candy_in_physical_totals:false','derived_options:Object.freeze([])','FACT / DETERMINISTIC / AI_INFERENCE'])assert.ok(pack.includes(token),`v0.4.9 pack contract missing ${token}`);
const privacy=read('assets/js/external-strategy-analysis-privacy.js');
for(const token of ['sanitizeGoalProfileForExternal','UNRESOLVED_LOCAL_REFERENCE','assertNoStablePokemonIds','stable_pokemon_ids_in_pack:false'])assert.ok(privacy.includes(token),`v0.4.9 privacy contract missing ${token}`);
const local=read('assets/js/external-strategy-analysis-local.js');
for(const token of ['buildUnifiedResourceSnapshot','buildLocalCandidateScoring','buildLocalTeamOptimization','buildLocalRecipeStrategy','buildLocalRecipeDiscoveryStockpile','assertNoStablePokemonIds','forbiddenKeyPaths'])assert.ok(local.includes(token),`v0.4.9 local adapter missing ${token}`);
for(const forbidden of ['fetch(','Gemini','applyPayload('])assert.equal(local.includes(forbidden),false,`v0.4.9 local pack must remain provider/apply independent: ${forbidden}`);
const ui=read('assets/js/war-room-strategy-analysis-pack-ui.js');
for(const token of ['產生可信分析包','複製 AI 提示詞','下載 JSON','下載 Markdown','navigator.share','資料已變更，請重新產生'])assert.ok(ui.includes(token),`v0.4.9 UI missing ${token}`);
assert.equal(ui.includes('applyPayload('),false,'v0.4.9 UI must not contain direct Apply');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
assert.ok(recipeLocal.includes("import('./war-room-strategy-analysis-pack-ui.js')"),'War Room must load Analysis Pack UI');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.9 must not add SQLite migration 10');
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'Analysis Pack dynamic modules require supported online-load-once network-first JS caching');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.9_RELEASE_CONTRACT',app_version:'v0.4.9',build:'20260810-v049-external-strategy-analysis-pack',
  strategy_analysis_pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,privacy_version:STRATEGY_ANALYSIS_PRIVACY_VERSION,
  provider_neutral:true,offline_generation:true,ephemeral_candidate_refs:true,stable_pokemon_id_export:false,candy_double_count_guard:true,missing_rules_explicit:true,direct_apply_path:false,sqlite_migration_added:false,
},null,2));
