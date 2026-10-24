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
// G479-R exact .24 -> .23 successor; preserve G14.1 historical assertions.

// G479-R2 .25 is an exact CSS-only .24 successor; do not weaken frozen assertions.
// G295 exact .26 successor inherits .25 G14.1 authority; no inferred capability writes.
// G479 .27 debug-history scope successor: preserve .26 and G14 derived-state lineage.
// G479 .28 exact post-sync authority successor: preserve .27 and G14.1 .13.
// G6.2 .29 exact successor: preserve .28 public hydration and frozen G14.1 lineage.
if(appVersion==='v0.4.27.55.3.3.29'){
  assert.equal(appBuild,'20261024-v0427553329-g62-persistence-uncertain-hold');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.29-v0427553329-g62-persistence-uncertain-hold');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.28'"));
  assert.ok(versionSource.includes("// app_build: '20261024-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.28-v0427553328-g479-public-catalog-postsync-readback'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.13'"));
}else if(appVersion==='v0.4.27.55.3.3.28'){
  assert.equal(appBuild,'20261024-v0427553328-g479-public-catalog-postsync-readback');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.28-v0427553328-g479-public-catalog-postsync-readback');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.27'"));
  assert.ok(versionSource.includes("// app_build: '20261024-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.13'"));
}else if(appVersion==='v0.4.27.55.3.3.27'){
  assert.equal(appBuild,'20261024-v0427553327-g479-debug-session-history-scope');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.26'"));
  assert.ok(versionSource.includes("// app_build: '20261023-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.26-v0427553326-g295-watchdog-lifecycle'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.13'"));
}else if(appVersion==='v0.4.27.55.3.3.26'){
  assert.equal(appBuild,'20261023-v0427553326-g295-watchdog-lifecycle');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.26-v0427553326-g295-watchdog-lifecycle');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.25'"));
  assert.ok(versionSource.includes("// app_build: '20261023-v0427553325-weekly-pot-capacity-containment'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.25-v0427553325-weekly-pot-capacity-containment'"));
}else if(appVersion==='v0.4.27.55.3.3.25'){
  assert.equal(appBuild,'20261023-v0427553325-weekly-pot-capacity-containment');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.25-v0427553325-weekly-pot-capacity-containment');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.24'"));
  assert.ok(versionSource.includes("// app_build: '20261017-v0427553324-mobile-warroom-knowledge-containment'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment'"));
}else if(appVersion==='v0.4.27.55.3.3.24'){
  assert.equal(appBuild,'20261017-v0427553324-mobile-warroom-knowledge-containment');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.23'"));
  assert.ok(versionSource.includes("// app_build: '20261017-v0427553323-g479-startup-stage-ownership'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.23-v0427553323-g479-startup-stage-ownership'"));
}else if(appVersion==='v0.4.27.55.3.3.23'){
  assert.equal(appBuild,'20261017-v0427553323-g479-startup-stage-ownership');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.23-v0427553323-g479-startup-stage-ownership');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.21'"));
  assert.ok(versionSource.includes("// app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
}else if(appVersion==='v0.4.27.55.3.3.22'){
  assert.equal(appBuild,'20261012-v0427553322-g9-official-event-auto-refresh');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.22-v0427553322-g9-official-event-auto-refresh');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.21'"));
  assert.ok(versionSource.includes("// app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
}else if(appVersion==='v0.4.27.55.3.3.21'){
  assert.equal(appBuild,'20261011-v0427553321-ingredient-review-weekly-bonuses');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.20'"));
  assert.ok(versionSource.includes("// app_build: '20261011-v0427553320-unlock-planner-inventory-parity'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.20-v0427553320-unlock-planner-inventory-parity'"));
}else if(appVersion==='v0.4.27.55.3.3.20'){
  assert.equal(appBuild,'20261011-v0427553320-unlock-planner-inventory-parity');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.20-v0427553320-unlock-planner-inventory-parity');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.19'"));
  assert.ok(versionSource.includes("// app_build: '20261005-v0427553319-g62-recipe-attempt-feedback'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.19-v0427553319-g62-recipe-attempt-feedback'"));
}else if(appVersion==='v0.4.27.55.3.3.19'){
  assert.equal(appBuild,'20261005-v0427553319-g62-recipe-attempt-feedback');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.19-v0427553319-g62-recipe-attempt-feedback');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.18'"));
  assert.ok(versionSource.includes("// app_build: '20261004-v0427553318-g52-recipe-state-import-hardening'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.18-v0427553318-g52-recipe-state-import-hardening'"));
}else if(appVersion==='v0.4.27.55.3.3.18'){
  assert.equal(appBuild,'20261004-v0427553318-g52-recipe-state-import-hardening');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.18-v0427553318-g52-recipe-state-import-hardening');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.17'"));
  assert.ok(versionSource.includes("// app_build: '20261002-v0427553317-weekly-berry-evidence-resolution'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.17-v0427553317-weekly-berry-evidence-resolution'"));
}else if(appVersion==='v0.4.27.55.3.3.17'){
  assert.equal(appBuild,'20261002-v0427553317-weekly-berry-evidence-resolution');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.17-v0427553317-weekly-berry-evidence-resolution');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.16'"));
  assert.ok(versionSource.includes("// app_build: '20261001-v0427553316-personal-recipe-retirement-hotfix'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.16-v0427553316-personal-recipe-retirement-hotfix'"));
}else if(appVersion==='v0.4.27.55.3.3.16'){
  assert.equal(appBuild,'20261001-v0427553316-personal-recipe-retirement-hotfix');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.16-v0427553316-personal-recipe-retirement-hotfix');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.15'"));
  assert.ok(versionSource.includes("// app_build: '20260930-v0427553315-canonical-recipe-state-authority'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.15-v0427553315-canonical-recipe-state-authority'"));
}else if(appVersion==='v0.4.27.55.3.3.15'){
  assert.equal(appBuild,'20260930-v0427553315-canonical-recipe-state-authority');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.15-v0427553315-canonical-recipe-state-authority');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.14'"));
  assert.ok(versionSource.includes("// app_build: '20260927-v0427553314-g51-personal-recipe-real-device-closure'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.14-v0427553314-g51-personal-recipe-real-device-closure'"));
}else if(appVersion==='v0.4.27.55.3.3.14'){
  assert.equal(appBuild,'20260927-v0427553314-g51-personal-recipe-real-device-closure');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.14-v0427553314-g51-personal-recipe-real-device-closure');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.13'"));
  assert.ok(versionSource.includes("// app_build: '20260926-v0427553313-g14-derived-state-authority'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.13-v0427553313-g14-derived-state-authority'"));
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3.13');
  assert.equal(appBuild,'20260926-v0427553313-g14-derived-state-authority');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.13-v0427553313-g14-derived-state-authority');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.3.3.12'"));
  assert.ok(versionSource.includes("// app_build: '20260920-v0427553312-weekly-review-navigation-real-device-closure'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.12-v0427553312-weekly-review-navigation-real-device-closure'"));
}

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
