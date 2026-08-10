import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  WEEKLY_EVENT_RULE_STATUS,
  weeklyEventEffectDefinition,
  projectWeeklyEventEffects,
} from '../assets/js/weekly-event-effect-registry.js';
import {normalizeWeeklyContext,weeklyContextStrategyFingerprintInput} from '../assets/js/weekly-context-normalization.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v048-typed-event-effect-registry');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.8-v048-typed-event-effect-registry');
assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,'weekly-event-effect-registry-2026-08-10-a');
assert.equal(weeklyEventEffectDefinition('meal_category_forced')?.value_type,'boolean');
assert.equal(weeklyEventEffectDefinition('meal_category_forced')?.rule_status,WEEKLY_EVENT_RULE_STATUS.ACTIVE_VERIFIED);
assert.equal(weeklyEventEffectDefinition('recipe_final_energy_multiplier')?.rule_status,WEEKLY_EVENT_RULE_STATUS.ACTIVE_VERIFIED);
assert.equal(weeklyEventEffectDefinition('sunday_pot_multiplier')?.rule_status,WEEKLY_EVENT_RULE_STATUS.ACTIVE_VERIFIED);
assert.equal(weeklyEventEffectDefinition('extra_tasty_multiplier')?.rule_status,WEEKLY_EVENT_RULE_STATUS.FEATURE_ONLY);
assert.equal(weeklyEventEffectDefinition('unknown_effects')?.rule_status,WEEKLY_EVENT_RULE_STATUS.REVIEW_REQUIRED);

const projected=projectWeeklyEventEffects({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2,limited_feature:'功能',unknown_effects:[{source_text:'尚未建模活動效果'}]});
assert.deepEqual(Object.keys(projected.deterministic_effects).sort(),['recipe_final_energy_multiplier','sunday_pot_multiplier']);
assert.equal(projected.feature_only_effects.limited_feature,'功能');
assert.equal(projected.review_effects.length,1);
assert.equal(projected.has_review_required,true);

const base={context_id:'weekly_context_2026-08-10_import',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',favorite_berry_1:'靛莓果',favorite_berry_2:'橙橙果',favorite_berry_3:'芒芒果',pot_size:57};
const a=normalizeWeeklyContext({...base,event_name:'A',event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,limited_feature:'A'})});
const b=normalizeWeeklyContext({...base,event_name:'B',event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,limited_feature:'B',unknown_effects:[{source_text:'unknown'}]})});
const c=normalizeWeeklyContext({...base,event_effects:JSON.stringify({recipe_final_energy_multiplier:2,limited_feature:'A'})});
assert.deepEqual(weeklyContextStrategyFingerprintInput(a),weeklyContextStrategyFingerprintInput(b),'non-deterministic Weekly effects must not alter strategy fingerprint input');
assert.notDeepEqual(weeklyContextStrategyFingerprintInput(a),weeklyContextStrategyFingerprintInput(c),'ACTIVE_VERIFIED effects must alter strategy fingerprint input');

const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['unknown_effects','不要自行創造新的 root key','不要輸出 rule_status'])assert.ok(prompt.includes(token),`typed Weekly prompt missing ${token}`);
const ui=read('assets/js/weekly-context-ui-bridge.js');
for(const token of ['活動效果 Typed Registry','ACTIVE_VERIFIED','FEATURE_ONLY','REVIEW_REQUIRED'])assert.ok(ui.includes(token),`typed Weekly UI missing ${token}`);
const evaluation=read('assets/js/pokemon-evaluation-contract.js');
const candidates=read('assets/js/pokemon-candidate-feature-projection.js');
const discovery=read('assets/js/recipe-discovery-stockpile.js');
assert.ok(evaluation.includes('weeklyContextStrategyFingerprintInput(weeklyContext)'));
assert.ok(candidates.includes('weeklyContextStrategyFingerprintInput(weeklyContext)'));
assert.ok(discovery.includes('weeklyContextStrategyFingerprintInput(week)'));
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.8 must not add SQLite migration 10');
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.8_RELEASE_CONTRACT',app_version:'v0.4.8',build:'20260810-v048-typed-event-effect-registry',
  event_registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,unknown_effects_review_safe:true,unknown_effects_numeric_source:false,
  strategy_fingerprint_scoped:true,evaluation_candidate_discovery_fingerprints_aligned:true,sqlite_migration_added:false,
},null,2));
