import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {AI_OBSERVATION_PROMPT} from '../assets/js/ai-observation.js';
import {DEFAULT_PROMPT,PROMPT_VERSION,projectObservationV2ForLegacy} from '../assets/js/ai-review-queue-executor.js';

assert.equal(DEFAULT_PROMPT,AI_OBSERVATION_PROMPT,'internal Gemini must consume the same governed Observation v2 prompt as external prompt mode');
for(const token of [
  'schema_version 固定 2.0-observation',
  'SECTION_HEADING->PROFILE_VALUE',
  'PARTIAL_DURATION->HELPER_SECONDS',
  'Public Master 只能在平台端做事後一致性查核',
  '好眠番茄',
  '放鬆可可',
  '技能機率提升S',
])assert.ok(DEFAULT_PROMPT.includes(token),`internal Observation v2 prompt missing safety token: ${token}`);
assert.equal(PROMPT_VERSION,'pokemon-sleep-observation-v2/2026-08-18-internal-parity');

const valid={
  schema_version:'2.0-observation',prompt_policy_version:'pokemon-visual-prompt-policy-2026-08-15-b-partial-visibility',
  update_id:'TEST-G13-6',generated_at:'2026-08-18T05:18:02.000Z',source:'ai_screenshot_observation',
  observations:[{
    incoming_ref:'pokemon-image-001',requested_action:'resolve_on_import',identity:{},
    profile:{header_name_text:'小鍛匠',species:null,species_observation_basis:null,nickname:null,level:14,sp:467,specialty:'樹果',type:'妖精',nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',main_skill:'能量填充M',main_skill_level:1,helper_seconds:3944,carry_limit:12,favorite_berry:'桃桃果',sleep_time_text:'0分鐘',sleep_hours:0},
    ingredients:[{unlock_level:1,ingredient_name:'好眠番茄',quantity:1},{unlock_level:30,ingredient_name:'放鬆可可',quantity:2},{unlock_level:60,ingredient_name:'放鬆可可',quantity:3}],
    subskills:[{unlock_level:10,subskill_name:'技能機率提升S'},{unlock_level:25,subskill_name:'樹果數量S'},{unlock_level:50,subskill_name:'食材機率提升S'},{unlock_level:70,subskill_name:'活力回復獎勵'},{unlock_level:80,subskill_name:'持有上限提升S'}],
    audit_candidates:[],evidence:{source_image_refs:['image-001','image-002'],field_confidence:{},unreadable_fields:[],notes:null},visual_evidence:null,
  }]
};
const projected=projectObservationV2ForLegacy(valid);
assert.equal(projected.contract_status,'OBSERVATION_V2_ACCEPTED');
assert.equal(projected.analysis.schema_version,'2.0-observation');
assert.equal(projected.analysis.pokemon_name,'小鍛匠');
assert.equal(projected.analysis.specialty,'樹果');
assert.equal(projected.analysis.type,'妖精');
assert.equal(projected.analysis.main_skill.name,'能量填充M');
assert.equal(projected.analysis.ingredients[0].name,'好眠番茄');
assert.equal(projected.analysis.ingredients[1].name,'放鬆可可');
assert.equal(projected.analysis.sub_skills[0].name,'技能機率提升S');
assert.equal(projected.analysis.helper_seconds,3944);
assert.equal(projected.analysis.sleep_hours,0,'numeric zero must remain a valid observed value');
assert.equal(projected.analysis.internal_compatibility.rejected_model_values.length,0);

const bad=structuredClone(valid);
bad.observations[0].ingredients[0].ingredient_name='蜜桃蕃茄';
bad.observations[0].ingredients[1].ingredient_name='華麗可可';
const rejected=projectObservationV2ForLegacy(bad);
assert.equal(rejected.contract_status,'REVIEW_REQUIRED');
assert.equal(rejected.analysis.ingredients[0].name,null,'non-canonical hallucinated ingredient must fail closed');
assert.equal(rejected.analysis.ingredients[1].name,null,'non-canonical hallucinated ingredient must fail closed');
assert.ok(rejected.analysis.uncertain_fields.includes('ingredients.Lv1.ingredient_name'));
assert.ok(rejected.analysis.uncertain_fields.includes('ingredients.Lv30.ingredient_name'));

const oldLegacy=projectObservationV2ForLegacy({screen_type:'pokemon_details',pokemon_name:'小鍛匠',specialty:'食材',ingredients:[{level:1,name:'蜜桃蕃茄',count:1}]});
assert.equal(oldLegacy.contract_status,'REVIEW_REQUIRED','legacy simplified Gemini shape must no longer be accepted as internal authority');
assert.equal(oldLegacy.analysis.pokemon_name,null);
assert.equal(oldLegacy.analysis.specialty,null);
assert.equal(oldLegacy.analysis.ingredients.length,0);

const executorSource=fs.readFileSync('assets/js/ai-review-queue-executor.js','utf8');
assert.equal(executorSource.includes('pokemon-sleep-image-review/1.2'),false,'obsolete simplified internal prompt must be removed');
assert.ok(executorSource.includes("import {AI_OBSERVATION_PROMPT,normalizeObservationPayload}"));
assert.ok(executorSource.includes('NON_CANONICAL_DIRECT_VALUE_REJECTED'));

const progressSource=fs.readFileSync('assets/js/ai-review-executor-status-ui.js','utf8');
for(const token of ['data-unified-analysis-progress','辨識進度',"['OCR',unifiedState.ocr]","['AI',unifiedState.ai]","['Cross Check',unifiedState.cross]",'pokemon-sleep:analysis-cross-check-ready'])assert.ok(progressSource.includes(token),`feature-local progress UI missing: ${token}`);

const authoritySource=fs.readFileSync('assets/js/version-authority.js','utf8');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox,{filename:'version-authority.js'});
assert.equal(sandbox.PokemonSleepVersionAuthority.app_version,'v0.4.27.6');
assert.equal(sandbox.PokemonSleepVersionAuthority.app_build,'20260818-v04276-g13-internal-observation-parity-progress-ux');
assert.equal(sandbox.PokemonSleepVersionAuthority.cache_name,'pokemon-sleep-ai-v0.4.27.6-v04276-g13-internal-observation-parity-progress-ux');

console.log(JSON.stringify({
  status:'PASS',gate:'G13.6_INTERNAL_OBSERVATION_V2_PARITY_PROGRESS_UX',
  internal_external_prompt_parity:true,legacy_internal_shape_rejected:true,noncanonical_names_fail_closed:true,
  zero_preserved:true,feature_local_ocr_ai_cross_check_progress:true,visible_version:'v0.4.27.6',player_write_authority:false,
},null,2));