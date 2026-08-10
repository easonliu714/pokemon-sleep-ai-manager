import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  WEEKLY_EVENT_EFFECT_REGISTRY,
  WEEKLY_EVENT_RULE_STATUS,
  WEEKLY_EVENT_EFFECT_KEYS,
  projectWeeklyEventEffects,
  validateWeeklyEventEffectsByRegistry,
} from '../assets/js/weekly-event-effect-registry.js';
import {
  normalizeWeeklyContext,
  weeklyContextStrategyFingerprintInput,
} from '../assets/js/weekly-context-normalization.js';
import {validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';
import {validateWorkflow,approveReviewed} from '../assets/js/ai-workflow.js';
import {pokemonEvaluationFingerprint} from '../assets/js/pokemon-evaluation-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const NOW=new Date('2026-08-10T16:00:00+08:00');
const clone=value=>JSON.parse(JSON.stringify(value));

assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,'weekly-event-effect-registry-2026-08-10-a');
assert.equal(new Set(WEEKLY_EVENT_EFFECT_KEYS).size,WEEKLY_EVENT_EFFECT_KEYS.length,'event registry keys must be unique');
assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY.length,WEEKLY_EVENT_EFFECT_KEYS.length);
for(const row of WEEKLY_EVENT_EFFECT_REGISTRY){
  assert.ok(row.effect_key&&row.value_type&&row.scope&&row.unit&&row.rule_status&&row.effective_semantics,'registry row incomplete');
  assert.equal(row.registry_version,WEEKLY_EVENT_EFFECT_REGISTRY_VERSION);
  assert.ok(Object.values(WEEKLY_EVENT_RULE_STATUS).includes(row.rule_status),`invalid rule status: ${row.effect_key}`);
}
for(const key of ['meal_category_forced','recipe_final_energy_multiplier','sunday_pot_multiplier']){
  assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY.find(row=>row.effect_key===key)?.rule_status,'ACTIVE_VERIFIED',`${key} must remain deterministic`);
}
for(const key of ['extra_tasty_multiplier','sunday_extra_tasty_multiplier','boosted_pokemon_types','limited_feature']){
  assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY.find(row=>row.effect_key===key)?.rule_status,'FEATURE_ONLY',`${key} must not silently become deterministic`);
}
assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY.find(row=>row.effect_key==='unknown_effects')?.rule_status,'REVIEW_REQUIRED');

const known={
  meal_category_forced:true,
  recipe_final_energy_multiplier:1.5,
  sunday_pot_multiplier:2,
  extra_tasty_multiplier:3,
  boosted_pokemon_types:['水','飛行'],
  limited_feature:'古月鳥扭糖機',
  unknown_effects:[{source_text:'活動期間，某項尚未建模的效果提升',source_image_ref:'synthetic-event.png',observed_value:'提升'}],
};
assert.deepEqual(validateWeeklyEventEffectsByRegistry(known),[]);
const projection=projectWeeklyEventEffects(known);
assert.deepEqual(Object.keys(projection.deterministic_effects).sort(),['meal_category_forced','recipe_final_energy_multiplier','sunday_pot_multiplier']);
assert.equal(projection.feature_only_effects.extra_tasty_multiplier,3);
assert.equal(projection.feature_only_effects.limited_feature,'古月鳥扭糖機');
assert.equal(projection.review_effects.length,1);
assert.equal(projection.has_review_required,true);
assert.equal(Object.hasOwn(projection.deterministic_effects,'unknown_effects'),false);
assert.equal(Object.hasOwn(projection.deterministic_effects,'extra_tasty_multiplier'),false);

for(const [key,value] of [
  ['meal_category_forced','true'],['recipe_final_energy_multiplier','1.5'],['sunday_pot_multiplier',0],['new_recipe_count',1.5],['boosted_pokemon_types','水'],
]){
  const issues=validateWeeklyEventEffectsByRegistry({[key]:value});
  assert.ok(issues.length>0,`wrong type/value must fail closed: ${key}=${value}`);
}
const arbitrary=validateWeeklyEventEffectsByRegistry({candy_gain_multiplier:2});
assert.ok(arbitrary.some(issue=>issue.includes('unknown_effects[]')),'unknown root key must point to evidence container');
const nestedUnknown=validateWeeklyEventEffectsByRegistry({unknown_effects:[{source_text:'活動原文',observed_value:{guessed_multiplier:2}}]});
assert.ok(nestedUnknown.length>0,'unknown observed_value must not contain semantic nested object');

function weeklyPayload(eventEffects,reviewRequired=false){return {
  schema_version:'1.1',update_id:`UPD-WAR3B-${Math.random().toString(16).slice(2)}`,generated_at:'2026-08-10T08:00:00.000Z',source:'fixture',scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',profile_audit_confirmations:[],
  operations:[{operation_id:'OP-001',entity:'weekly_context',action:'upsert',key:{context_id:'weekly_context_2026-08-10_import'},data:{week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'fixture',event_effects:eventEffects,pot_size:57,updated_at:'2026-08-10T08:00:00.000Z'},clear_fields:[],evidence:{source_type:'fixture',source_image_ref:'synthetic.png',confidence:1},review_required:reviewRequired,user_audit:{accepted_current_observation:false}}],
};}

const unknownNoReview=weeklyPayload({unknown_effects:[{source_text:'尚未支援效果'}]},false);
assert.equal(validateWeeklyContextImportPayload(unknownNoReview,{now:NOW}).ok,false,'unknown evidence must require explicit review');
const unknownReview=weeklyPayload({unknown_effects:[{source_text:'尚未支援效果'}]},true);
const weeklyValidation=validateWeeklyContextImportPayload(unknownReview,{now:NOW});
assert.equal(weeklyValidation.ok,true,weeklyValidation.issues.join('\n'));
const workflowBefore=validateWorkflow(clone(unknownReview));
assert.equal(workflowBefore.errors.length,0,workflowBefore.errors.join('\n'));
assert.equal(workflowBefore.review.length,1,'unknown Weekly effect must enter Update Center review');
const approved=approveReviewed(clone(unknownReview));
const workflowAfter=validateWorkflow(approved);
assert.equal(workflowAfter.errors.length,0,workflowAfter.errors.join('\n'));
assert.equal(workflowAfter.review.length,0,'user confirmation must resolve review gate without activating a deterministic rule');

const baseContext={context_id:'weekly_context_2026-08-10_import',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',favorite_berry_1:'靛莓果',favorite_berry_2:'橙橙果',favorite_berry_3:'芒芒果',pot_size:57,event_name:'活動A',updated_at:'2026-08-10T08:00:00Z'};
const contextA=normalizeWeeklyContext({...baseContext,event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2,limited_feature:'功能A'})});
const contextFeatureChanged=normalizeWeeklyContext({...baseContext,event_name:'活動B',updated_at:'2026-08-10T09:00:00Z',event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2,limited_feature:'功能B',unknown_effects:[{source_text:'未知效果文字改變'}]})});
const contextActiveChanged=normalizeWeeklyContext({...baseContext,event_effects:JSON.stringify({recipe_final_energy_multiplier:2,sunday_pot_multiplier:2,limited_feature:'功能A'})});
assert.deepEqual(weeklyContextStrategyFingerprintInput(contextA),weeklyContextStrategyFingerprintInput(contextFeatureChanged),'FEATURE_ONLY/review metadata must not change strategy fingerprint input');
assert.notDeepEqual(weeklyContextStrategyFingerprintInput(contextA),weeklyContextStrategyFingerprintInput(contextActiveChanged),'ACTIVE_VERIFIED effect must change strategy fingerprint input');
assert.equal(contextFeatureChanged.event_effect_review_required,true);
assert.equal(contextFeatureChanged.review_event_effects.length,1);

const pokemon={pokemon_id:'pkm1',pokemon_instance_id:'pkm1',species:'皮卡丘',current_species:'皮卡丘',level:25,specialty:'樹果',type:'電',favorite_berry:'橙橙果',status:'active'};
const evalBase={pokemon,ingredients:[],subskills:[],weeklyContext:contextA,goalProfile:null,masterVersions:{public_pokemon_knowledge_version:'p1'}};
const fpA=pokemonEvaluationFingerprint(evalBase);
const fpFeature=pokemonEvaluationFingerprint({...evalBase,weeklyContext:contextFeatureChanged});
const fpActive=pokemonEvaluationFingerprint({...evalBase,weeklyContext:contextActiveChanged});
assert.equal(fpA,fpFeature,'Evaluation Snapshot fingerprint must ignore FEATURE_ONLY / REVIEW_REQUIRED Weekly effect drift');
assert.notEqual(fpA,fpActive,'Evaluation Snapshot fingerprint must react to ACTIVE_VERIFIED Weekly effect changes');

const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['unknown_effects','不要自行創造新的 root key','operation.review_required 必須為 true','不要輸出 rule_status','逐字保留活動原文'])assert.ok(prompt.includes(token),`Weekly prompt missing typed/unknown rule: ${token}`);
const weeklyUi=read('assets/js/weekly-context-ui-bridge.js');
for(const token of ['活動效果 Typed Registry','Rule Status','ACTIVE_VERIFIED','FEATURE_ONLY','REVIEW_REQUIRED','Strategy effect fingerprint'])assert.ok(weeklyUi.includes(token),`Weekly UI missing typed registry status: ${token}`);
assert.ok(weeklyUi.includes('validateWeeklyEventEffects(manualEffects)'),'manual Weekly fallback must not bypass typed validation');

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('war3b'),false,'WAR.3B must not add a release-specific SQLite migration');
assert.equal(migrations.includes('VALUES(10,'),false,'WAR.3B typed effects do not require schema migration 10');
const normalizer=read('assets/js/weekly-context-normalization.js');
assert.ok(normalizer.includes('strategy_event_effects'));
assert.ok(normalizer.includes('event_effect_strategy_fingerprint'));
assert.ok(normalizer.includes('weeklyContextStrategyFingerprintInput'));

console.log(JSON.stringify({
  status:'PASS',gate:'WAR3B_TYPED_EVENT_EFFECT_REGISTRY_CONTRACT',registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  registry_rows:WEEKLY_EVENT_EFFECT_REGISTRY.length,active_verified:projection.states.filter(row=>row.rule_status==='ACTIVE_VERIFIED').length,
  feature_only_preserved:true,unknown_effects_preserved:true,unknown_effects_require_review:true,unknown_effects_deterministic_consumption:false,
  wrong_types_fail_closed:true,manual_fallback_typed_validation:true,strategy_fingerprint_ignores_non_deterministic_effects:true,
  active_effect_changes_invalidate_evaluation:true,sqlite_migration_added:false,
},null,2));
