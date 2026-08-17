import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {RECIPE_RECOGNITION_EXACT_RECOVERY_VERSION} from '../assets/js/recipe-recognition-exact-recovery.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION} from '../assets/js/uc-img-gemini-adapter.js';
import {UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION,buildUcImgWeeklySemanticDataProperties} from '../assets/js/uc-img-weekly-platform-authority.js';
import {PUBLIC_BERRY_STRENGTH_VERSION,canonicalBerryName} from '../assets/js/public-berry-strength-master.js';
import {BERRY_BY_TYPE} from '../assets/js/pokemon-master-options.js';
import {POKEMON_ROSTER_FILTER_CONTRACT_VERSION} from '../assets/js/pokemon-roster-filter-contract.js';
import {POKEMON_CANDIDATE_FEATURE_VERSION,POKEMON_CANDIDATE_BERRY_IDENTITY_VERSION} from '../assets/js/pokemon-candidate-feature-projection.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {E3C6B_SCHEMA_MIGRATION_VERSION} from '../assets/js/migrations.js';
import {INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION} from '../assets/js/ingredient-inventory-integrity-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.equal(authority.app_version,'v0.4.27.4');
assert.equal(authority.app_build,'20260817-v04274-live-s2-s4-hotfix');
assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix');
for(const token of [
  "// app_version: 'v0.4.27.3'",
  "// app_build: '20260817-v04273-weekly-recipe-semantic-intake-hotfix'",
  "// cache_name: 'pokemon-sleep-ai-v0.4.27.3-v04273-weekly-recipe-semantic-intake-hotfix'",
])assert.ok(versionSource.includes(token),`v0.4.27.3 lineage missing ${token}`);

assert.equal(RECIPE_RECOGNITION_EXACT_RECOVERY_VERSION,'recipe-recognition-exact-recovery-2026-08-17-b-prompt');
assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-17-d-live-recovery-schema');
assert.equal(UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION,'uc-img-weekly-platform-authority-2026-08-17-d-structured-semantic-schema');
const weeklyProps=buildUcImgWeeklySemanticDataProperties();
for(const key of ['camp','dish_category','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes'])assert.ok(weeklyProps[key],`weekly semantic property missing ${key}`);
assert.equal(Object.hasOwn(weeklyProps,'pot_size'),false,'Internal Weekly semantic schema must not reclaim base pot authority');

assert.equal(PUBLIC_BERRY_STRENGTH_VERSION,'public-berry-strength-2026-08-17-c-canonical-projection');
assert.equal(canonicalBerryName('葡萄果'),'萄葡果');
assert.equal(BERRY_BY_TYPE['電'],'萄葡果');
assert.equal(POKEMON_ROSTER_FILTER_CONTRACT_VERSION,'pokemon-roster-unlocked-filters-2026-08-17-b-berry-canonical-projection');
assert.equal(POKEMON_CANDIDATE_FEATURE_VERSION,'pokemon-candidate-features-2026-08-09-b','historical feature topology contract stays stable');
assert.equal(POKEMON_CANDIDATE_BERRY_IDENTITY_VERSION,'pokemon-candidate-berry-identity-2026-08-17-a-canonical-grepa');

const rosterUi=read('assets/js/pokemon-roster-filter-ui.js');
assert.ok(rosterUi.includes("POKEMON_ROSTER_FILTER_UI_VERSION='pokemon-roster-unlocked-filters-ui-2026-08-17-b-berry-canonical-projection'"),'Pokémon roster UI successor version missing');
for(const token of ['canonicalizeDetailBerry','pokemonDetailBackdrop','pokemonBerrySelect'])assert.ok(rosterUi.includes(token),`Pokémon detail berry projection missing ${token}`);
const recovery=read('assets/js/recipe-recognition-exact-recovery.js');
for(const token of ['PARTIALLY_OCCLUDED_BY_UI','PLATFORM_EXACT_UNLOCKED_RECIPE_RECOVERY','unlocked!==true'])assert.ok(recovery.includes(token),`exact recipe recovery safety marker missing ${token}`);
const weekly=read('assets/js/uc-img-weekly-platform-authority.js');
for(const token of ['紅色／粉紅色活動公告','unknown_effects','UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY','additionalProperties=false'])assert.ok(weekly.includes(token),`weekly semantic intake marker missing ${token}`);

assert.equal(E3C6B_SCHEMA_MIGRATION_VERSION,11);
assert.equal(INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,13);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'migration 10 remains historical sentinel');
const production=currentProductionAuthorityRegistry();
assert.equal(production.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(production.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(production.active_verified_dimensions.length,4);

const sw=read('service-worker.js');
for(const token of [
  'pokemon-sleep-ai-v0.4.27.3-v04273-weekly-recipe-semantic-intake-hotfix',
  "'./assets/js/recipe-recognition-exact-recovery.js'",
  "'./assets/js/uc-img-weekly-platform-authority.js'",
  "'./assets/js/pokemon-roster-filter-contract.js'",
  "'./assets/js/pokemon-roster-filter-ui.js'",
  "'./assets/js/public-berry-strength-master.js'",
])assert.ok(sw.includes(token),`v0.4.27.4 PWA cache contract missing ${token}`);
const predecessor=read('scripts/v0423-predecessor-contract-runner.mjs');assert.ok(predecessor.includes("current==='v0.4.27.4'"),'historical Production bridge missing v0.4.27.4');
const workflows=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name));assert.equal(workflows.length,12,'v0.4.27.4 must not alter consolidated workflow topology');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.4_RELEASE_CONTRACT',
  app_version:authority.app_version,
  exact_unlocked_recipe_platform_recovery:true,
  weekly_structured_semantic_schema:true,
  weekly_platform_only_fail_closed:true,
  weekly_base_pot_authority:false,
  pokemon_berry_canonical_projection:'葡萄果->萄葡果',
  player_sqlite_mass_rewrite:false,
  schema_migration_added:false,
  production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',
  workflow_count:workflows.length,
  android_pwa_live_validation_required:true,
},null,2));
