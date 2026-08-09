import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES,
  PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS,
} from '../assets/js/public-recipe-canonical-authority.js';
import {CONTROLLED_SELECTOR_VERSION} from '../assets/js/controlled-selector.js';
import {WAR_ROOM_CONTROLLED_OPTIONS_VERSION,getWarRoomRecipeOptions} from '../assets/js/war-room-controlled-options.js';
import {TEAM_OPTIMIZER_VERSION,TEAM_SIZE} from '../assets/js/team-optimizer.js';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const versionSource=read('assets/js/version-authority.js');
const versionMatch=versionSource.match(/app_version:\s*'([^']+)'/);
const buildMatch=versionSource.match(/app_build:\s*'([^']+)'/);
const cacheMatch=versionSource.match(/cache_name:\s*'([^']+)'/);
assert.match(versionMatch?.[1]||'',/^v0\.4\.3(?:\.\d+)?$/,'v0.4.3 historical contract only accepts v0.4.3 patch line');
assert.match(buildMatch?.[1]||'',/^20260809-v043(?:1-)?/,'unexpected v0.4.3 patch build authority');
assert.match(cacheMatch?.[1]||'',/^pokemon-sleep-ai-v0\.4\.3(?:\.\d+)?-/,'unexpected v0.4.3 patch cache authority');

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-09-b');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,33);
assert.equal(PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,2);
assert.equal(getWarRoomRecipeOptions().length,76);
assert.match(CONTROLLED_SELECTOR_VERSION,/^controlled-selector-2026-08-09-[a-z]+$/,'unexpected controlled selector component family');
assert.equal(WAR_ROOM_CONTROLLED_OPTIONS_VERSION,'war-room-controlled-options-2026-08-09-a');
assert.equal(TEAM_OPTIMIZER_VERSION,'team-optimizer-2026-08-09-a');
assert.equal(TEAM_SIZE,5);

const sw=read('service-worker.js');
assert.ok(sw.includes("const {app_version:APP_VERSION,app_build:APP_BUILD,cache_name:CACHE}=self.PokemonSleepVersionAuthority"));
const assetsMatch=sw.match(/const\s+ASSETS\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(assetsMatch,'service worker ASSETS array not found');
const assets=vm.runInNewContext(`(${assetsMatch[1]})`,Object.create(null),{timeout:1000});
assert.ok(Array.isArray(assets));
const missing=[];
for(const asset of assets){
  if(asset==='./')continue;
  if(!String(asset).startsWith('./'))continue;
  const localPath=path.join(root,String(asset).slice(2));
  if(!fs.existsSync(localPath))missing.push(asset);
}
assert.deepEqual(missing,[],`service worker precache contains missing files: ${missing.join(', ')}`);

const mustPrecache=[
  './assets/js/public-recipe-canonical-authority.js',
  './assets/js/controlled-selector.js',
  './assets/js/war-room-controlled-options.js',
  './assets/js/war-room-goal-profile-ui.js',
  './assets/js/war-room-goal-profile-bootstrap.js',
  './assets/js/pokemon-candidate-feature-projection.js',
  './assets/js/pokemon-scoring-engine.js',
  './assets/js/team-optimizer.js',
  './assets/js/team-optimizer-local.js',
  './assets/js/war-room-team-optimizer-ui.js',
  './assets/js/war-room-team-optimizer-bootstrap.js',
  './assets/js/war-room-candidate-feature-ui.js',
  './assets/js/war-room-candidate-feature-bootstrap.js',
  './assets/js/strategy-context-package.js',
  './assets/js/strategy-context-local.js',
  './assets/js/strategy-gemini-contract.js',
  './assets/js/war-room-strategy-context-ui.js',
  './assets/js/war-room-strategy-context-bootstrap.js',
];
for(const asset of mustPrecache)assert.ok(assets.includes(asset),`v0.4.3 core runtime not precached: ${asset}`);

const strategyContextLocal=read('assets/js/strategy-context-local.js');
assert.ok(strategyContextLocal.includes("from './strategy-gemini-contract.js'"),'Strategy Context must use committed Gemini response normalizer');
assert.equal(strategyContextLocal.includes('strategy-context-response.js'),false,'Strategy Context references nonexistent response module');
assert.ok(strategyContextLocal.includes('normalizeGeminiStrategyResponse'));

const goalUi=read('assets/js/war-room-goal-profile-ui.js');
for(const required of ['createControlledSelector','createControlledNumberMapEditor','warRoomMustIncludePokemon','warRoomExcludePokemon','warRoomMustIncludeRole','warRoomNightPokemon','warRoomIngredientSafeReserve']){
  assert.ok(goalUi.includes(required),`controlled Goal Profile wiring missing: ${required}`);
}
for(const legacy of ['textarea name="must_include_pokemon"','textarea name="exclude_pokemon"','textarea name="must_include_role"','textarea name="sleep_evolution_member_at_night"','textarea name="ingredient_safe_reserve"']){
  assert.equal(goalUi.includes(legacy),false,`legacy free text reintroduced: ${legacy}`);
}

const teamUi=read('assets/js/war-room-team-optimizer-ui.js');
const teamBootstrap=read('assets/js/war-room-team-optimizer-bootstrap.js');
const candidateUi=read('assets/js/war-room-candidate-feature-ui.js');
for(const required of ['隊長（呈現槽位）','主要建議','查看替代隊伍','精準能量模型尚未啟用'])assert.ok(teamUi.includes(required));
assert.ok(teamBootstrap.includes('if(!isDatabaseReady())return'));
assert.ok(candidateUi.includes('候選／替補池'));
assert.ok(candidateUi.includes('<details class="war-candidate-pool">'));

const optimizer=read('assets/js/team-optimizer.js');
for(const forbidden of ['ai-project-pool-runtime','fetch(','persist(','snapshot(','INSERT INTO teams','UPDATE teams']){
  assert.equal(optimizer.includes(forbidden),false,`optimizer impurity: ${forbidden}`);
}
assert.ok(optimizer.includes('estimated_energy:null'));
assert.ok(optimizer.includes('PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS'));

const privateSourceSentinel=['Pokemon_Sleep_PRIVATE_','RECIPES_FROM_ZIP_20260731.json'].join('');
const privateGuardTargets=[
  'assets/data/public-recipe-zh-tw-screenshot-evidence-2026-08-09.json',
  'scripts/v043-recipe-zh-tw-evidence-audit.mjs',
  'scripts/v043-r22-recipe-canonical-name-contract.mjs',
];
for(const target of privateGuardTargets){
  const source=read(target);
  assert.equal(source.includes(privateSourceSentinel),false,`private source filename leaked into ${target}`);
}

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'V0.4.3_RELEASE_INTEGRATION_CONTRACT',
  historical_release_line:'v0.4.3.x',
  app_version:versionMatch[1],
  build:buildMatch[1],
  cache:cacheMatch[1],
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,
  screenshot_confirmed_recipe_renames:PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,
  formula_conflicts_review_only:PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,
  controlled_selector_version:CONTROLLED_SELECTOR_VERSION,
  team_optimizer_version:TEAM_OPTIMIZER_VERSION,
  team_size:TEAM_SIZE,
  service_worker_asset_count:assets.length,
  missing_precache_assets:missing,
  core_war_room_precache_complete:true,
  strategy_context_response_contract_fixed:true,
  precise_energy_claim:false,
  player_team_write:false,
  private_raw_source_committed:false,
  patch_forward_compatible:true,
},null,2)}\n`);
