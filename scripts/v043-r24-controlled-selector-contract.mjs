import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CONTROLLED_SELECTOR_VERSION,
  normalizeControlledOptions,
  reconcileControlledValues,
  filterControlledOptions,
} from '../assets/js/controlled-selector.js';
import {
  WAR_ROOM_CONTROLLED_OPTIONS_VERSION,
  WAR_ROOM_ROLE_OPTIONS,
  getWarRoomPokemonOptions,
  getWarRoomIngredientOptions,
  getWarRoomRecipeOptions,
  getWarRoomMainSkillOptions,
  warRoomControlledOptionCoverage,
} from '../assets/js/war-room-controlled-options.js';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

assert.equal(CONTROLLED_SELECTOR_VERSION,'controlled-selector-2026-08-09-a');
assert.equal(WAR_ROOM_CONTROLLED_OPTIONS_VERSION,'war-room-controlled-options-2026-08-09-a');

const duplicateSpecies=normalizeControlledOptions([
  {value:'poke_001',label:'六尾 · Lv11 · 樹果 · 個體 01',aliases:['六尾','instance_a'],group:'樹果'},
  {value:'poke_002',label:'六尾 · Lv7 · 樹果 · 個體 02',aliases:['六尾','instance_b'],group:'樹果'},
  {value:'poke_003',label:'仙子伊布 · Lv36 · 技能 · 個體 03',aliases:['仙子伊布','instance_c'],group:'技能'},
]);
assert.equal(duplicateSpecies.length,3);

const exact=reconcileControlledValues(['poke_002'],duplicateSpecies);
assert.deepEqual(exact.selected.map(row=>row.value),['poke_002']);
assert.equal(exact.unresolved.length,0);

const uniqueLegacy=reconcileControlledValues(['仙子伊布'],duplicateSpecies);
assert.deepEqual(uniqueLegacy.selected.map(row=>row.value),['poke_003']);
assert.equal(uniqueLegacy.selected[0].legacy_value,'仙子伊布');
assert.equal(uniqueLegacy.unresolved.length,0);

const ambiguousLegacy=reconcileControlledValues(['六尾'],duplicateSpecies);
assert.deepEqual(ambiguousLegacy.selected.map(row=>row.value),['六尾']);
assert.equal(ambiguousLegacy.unresolved.length,1);
assert.equal(ambiguousLegacy.unresolved[0].reason,'AMBIGUOUS_LEGACY_VALUE');

const unknownLegacy=reconcileControlledValues(['不存在的寶可夢'],duplicateSpecies);
assert.equal(unknownLegacy.unresolved[0].reason,'UNKNOWN_LEGACY_VALUE');

const filtered=filterControlledOptions(duplicateSpecies,'Lv36',[]);
assert.deepEqual(filtered.map(row=>row.value),['poke_003']);
const aliasFiltered=filterControlledOptions(duplicateSpecies,'instance_b',[]);
assert.deepEqual(aliasFiltered.map(row=>row.value),['poke_002']);
const selectedFiltered=filterControlledOptions(duplicateSpecies,'六尾',['poke_001']);
assert.deepEqual(selectedFiltered.map(row=>row.value),['poke_002']);

assert.deepEqual(WAR_ROOM_ROLE_OPTIONS.map(row=>row.value),['樹果','食材','技能']);
const recipes=getWarRoomRecipeOptions();
assert.equal(recipes.length,76,'controlled recipe options must use all canonical ACTIVE recipes');
assert.equal(new Set(recipes.map(row=>row.value)).size,76,'recipe selector values must be stable unique recipe IDs');
const corn=recipes.find(row=>row.value==='curry_soft_corn');
assert.equal(corn?.label,'柔軟玉米濃湯');
assert.equal(corn?.aliases.includes('玉米濃湯'),true,'legacy recipe name must remain searchable');
const warmMilk=recipes.find(row=>row.value==='dessert_warm_milk');
assert.equal(warmMilk?.label,'哞哞熱鮮奶');
assert.equal(warmMilk?.aliases.includes('溫熱哞哞鮮奶'),true);
const skills=getWarRoomMainSkillOptions();
assert.ok(skills.length>=20,'main skill controlled registry unexpectedly small');
assert.ok(skills.some(row=>row.value==='活力全體療癒S'));

// Node contract has no player DB; adapters must return empty instead of querying an unready DB.
assert.deepEqual(getWarRoomPokemonOptions(),[]);
assert.deepEqual(getWarRoomIngredientOptions(),[]);
const coverage=warRoomControlledOptionCoverage();
assert.equal(coverage.player_database_available,false);
assert.equal(coverage.pokemon_count,0);
assert.equal(coverage.ingredient_count,0);
assert.equal(coverage.recipe_count,76);
assert.equal(coverage.role_count,3);

const ui=read('assets/js/war-room-goal-profile-ui.js');
for(const removed of [
  'textarea name="must_include_pokemon"',
  'textarea name="exclude_pokemon"',
  'textarea name="must_include_role"',
  'textarea name="sleep_evolution_member_at_night"',
  'textarea name="ingredient_safe_reserve"',
  'parseReserve(',
]) assert.equal(ui.includes(removed),false,`legacy free-text constraint remains: ${removed}`);
for(const required of [
  "from './controlled-selector.js'",
  "from './war-room-controlled-options.js'",
  'createControlledSelector(root.querySelector(\'#warRoomMustIncludePokemon\')',
  'createControlledSelector(root.querySelector(\'#warRoomExcludePokemon\')',
  'createControlledSelector(root.querySelector(\'#warRoomMustIncludeRole\')',
  'createControlledSelector(root.querySelector(\'#warRoomNightPokemon\')',
  'createControlledNumberMapEditor(root.querySelector(\'#warRoomIngredientSafeReserve\')',
]) assert.equal(ui.includes(required),true,`controlled selector wiring missing: ${required}`);

const component=read('assets/js/controlled-selector.js');
for(const required of ['AMBIGUOUS_LEGACY_VALUE','UNKNOWN_LEGACY_VALUE','REVIEW','aria-multiselectable','data-cs-search','data-cs-remove','maxSelections'])assert.equal(component.includes(required),true,`selector contract token missing: ${required}`);
const css=read('assets/css/editor.css');
for(const required of ['.controlled-selector','.controlled-chip.review','.controlled-option','.controlled-number-map-row'])assert.equal(css.includes(required),true,`selector CSS missing: ${required}`);

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'R2.4_CONTROLLED_SEARCHABLE_SELECTOR_CONTRACT',
  component_version:CONTROLLED_SELECTOR_VERSION,
  option_registry_version:WAR_ROOM_CONTROLLED_OPTIONS_VERSION,
  duplicate_species_individual_identity:true,
  ambiguous_legacy_species_preserved_as_review:true,
  canonical_recipe_options:recipes.length,
  legacy_recipe_name_searchable:true,
  main_skill_options:skills.length,
  role_options:WAR_ROOM_ROLE_OPTIONS.length,
  free_text_hard_constraint_inputs_removed:5,
  player_db_query_before_ready:false,
},null,2)}\n`);
