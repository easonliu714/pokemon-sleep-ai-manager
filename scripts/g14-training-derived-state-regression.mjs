import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  G14_TRAINING_DERIVED_STATE_AUTHORITY_VERSION,
  derivePokemonTrainingCapabilityState,
  ingredientSlotUnlocked,
  subskillSlotUnlocked,
} from '../assets/js/training-derived-state-authority.js';

const pokemon={pokemon_id:'P-G14-1',pokemon_instance_id:'instance-g14-1',level:25};
const ingredients=[
  {pokemon_id:'P-G14-1',unlock_level:1,ingredient_name:'蘋果',quantity:2},
  {pokemon_id:'P-G14-1',unlock_level:30,ingredient_name:'可可',quantity:3},
  {pokemon_id:'P-G14-1',unlock_level:60,ingredient_name:'玉米',quantity:5},
];
const subskills=[
  {pokemon_id:'P-G14-1',unlock_level:10,subskill_name:'幫忙速度S',is_unlocked:0},
  {pokemon_id:'P-G14-1',unlock_level:25,subskill_name:'持有上限提升S',is_unlocked:0},
  {pokemon_id:'P-G14-1',unlock_level:50,subskill_name:'食材機率提升M',is_unlocked:1},
];

const inputBefore=JSON.stringify({pokemon,ingredients,subskills});
assert.equal(G14_TRAINING_DERIVED_STATE_AUTHORITY_VERSION,'g14-training-derived-state-2026-09-26-a');

assert.equal(ingredientSlotUnlocked(pokemon,ingredients[0]),true);
assert.equal(ingredientSlotUnlocked(pokemon,ingredients[1]),false,'Lv25 must not count a Lv30 ingredient as current');
assert.equal(subskillSlotUnlocked(pokemon,subskills[0]),true,'current level must activate a Lv10 subskill even if legacy is_unlocked=0');
assert.equal(subskillSlotUnlocked(pokemon,subskills[1]),true,'current level must activate a Lv25 subskill even if legacy is_unlocked=0');
assert.equal(subskillSlotUnlocked(pokemon,subskills[2]),false,'legacy is_unlocked=1 must not activate a Lv50 subskill while current level is 25');

const state=derivePokemonTrainingCapabilityState({pokemon,ingredientRows:ingredients,subskillRows:subskills});
assert.equal(state.readonly_projection,true);
assert.equal(state.pokemon_id,'P-G14-1');
assert.equal(state.pokemon_instance_id,'instance-g14-1');
assert.equal(state.current_level,25);
assert.deepEqual(state.current_ingredient_rows.map(row=>row.ingredient_name),['蘋果']);
assert.deepEqual(state.future_ingredient_rows.map(row=>row.ingredient_name),['可可','玉米']);
assert.deepEqual(state.current_subskill_rows.map(row=>row.subskill_name),['幫忙速度S','持有上限提升S']);
assert.deepEqual(state.future_subskill_rows.map(row=>row.subskill_name),['食材機率提升M']);
assert.equal(state.next_unlock_level,30);
assert.equal(state.legacy_unlock_observation_conflicts.length,3,'legacy flags are audit evidence and must expose all contradictions instead of changing authority');
assert.ok(state.current_ingredient_rows.every(row=>row.unlock_authority==='CURRENT_LEVEL_VS_UNLOCK_LEVEL'));
assert.ok(state.current_subskill_rows.every(row=>row.unlock_authority==='CURRENT_LEVEL_VS_UNLOCK_LEVEL'));
assert.ok(state.future_subskill_rows.every(row=>row.derived_state==='FUTURE'));
assert.equal(JSON.stringify({pokemon,ingredients,subskills}),inputBefore,'derived-state projection must not mutate inputs');

const versionSource=readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(appVersion,'v0.4.27.55.3.3.13');
assert.equal(appBuild,'20260926-v0427553313-g14-derived-state-authority');
assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.13-v0427553313-g14-derived-state-authority');
assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.12'"));
assert.ok(versionSource.includes("// app_build: '20260920-v0427553312-weekly-review-navigation-real-device-closure'"));
assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.12-v0427553312-weekly-review-navigation-real-device-closure'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'G14_1_DERIVED_UNLOCK_STATE_AUTHORITY',
  authority_version:G14_TRAINING_DERIVED_STATE_AUTHORITY_VERSION,
  app_version:appVersion,
  current_level:state.current_level,
  current_ingredients:state.current_ingredient_rows.length,
  future_ingredients:state.future_ingredient_rows.length,
  current_subskills:state.current_subskill_rows.length,
  future_subskills:state.future_subskill_rows.length,
  next_unlock_level:state.next_unlock_level,
  legacy_flag_conflicts:state.legacy_unlock_observation_conflicts.length,
  db_write:false,
},null,2));
