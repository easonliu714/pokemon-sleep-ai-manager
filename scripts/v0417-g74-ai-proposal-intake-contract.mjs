import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STRATEGY_OPTIMIZATION_AI_RESPONSE_SCHEMA,
  buildExternalOptimizationPrompt,
  intakeOptimizationAiResponse,
  adaptOptimizationAiResponse,
} from '../assets/js/strategy-optimization-ai-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const successors=['v0.4.18','v0.4.19','v0.4.20','v0.4.21','v0.4.22','v0.4.22.1'];
assert.ok(['v0.4.17.1',...successors].includes(appVersion),`unexpected G7.4 release/successor version ${appVersion}`);
if(successors.includes(appVersion))assert.ok(version.includes("// app_version: 'v0.4.17.1'"),`${appVersion} must retain v0.4.17.1 lineage bridge`);
if(appVersion==='v0.4.22.1')assert.ok(version.includes("// app_version: 'v0.4.22'"),'v0.4.22.1 must retain v0.4.22 lineage bridge');

const candidateRefs=['cand_001','cand_003','cand_004','cand_005','cand_006','cand_007','cand_008','cand_009','cand_010','cand_012','cand_014','cand_015','cand_016','cand_017','cand_019'];
const candidates=candidateRefs.map((candidate_ref,index)=>({candidate_ref,species:`S${index+1}`,level:30,specialty:index%3===0?'樹果':index%3===1?'食材':'技能',helper_seconds:2500+index*50,unlocked_ingredients:[]}));
const payload={
  context_fingerprint:'strategy_context:aa95f501',optimization_fingerprint:'strategy_optimization:test',
  goal_profile:{primary_goal:'max_snorlax_energy',hard_constraints:{must_include:{candidate_refs:['cand_005','cand_008','cand_012'],species:[]},exclude:{candidate_refs:[],species:[]},must_include_role:[],max_same_species:2,preserve_current_team_slots:[],sleep_evolution_member_at_night:{candidate_refs:[],species:[]}}},
  seed_team:{candidate_refs:['cand_005','cand_008','cand_012','cand_001','cand_015']},candidate_production_readiness:candidates,recipe_gap_summary:[{recipe_id:'r1'},{recipe_id:'r2'}],
};
const preview={payload};
const legacy={$schema:'pokemon-sleep-team-proposals-pack/1.0',pack_version:'team-proposal-pack-2026-08-12-a',context_fingerprint:'strategy_context:aa95f501',authority_status:{numeric_rate_model_status:'NOT_YET_VERIFIED',required_rules_to_verify:['verified_berry_energy_rule','verified_ingredient_probability_rule']},proposals:[
  {proposal_id:'prop_001',proposal_name:'最愛樹果與雙重技能響應隊',team_slots:['cand_005','cand_008','cand_012','cand_001','cand_015'],qualitative_focus:'FAVORITE_BERRY_SKILL_MATCH',trade_off_description:'定性方案',missing_data_dependencies:['verified_berry_energy_rule']},
  {proposal_id:'prop_002',proposal_name:'近門檻食譜隊',team_slots:['cand_005','cand_008','cand_012','cand_004','cand_010'],qualitative_focus:'RECIPE_GAP',trade_off_description:'定性方案',missing_data_dependencies:['verified_ingredient_probability_rule']},
  {proposal_id:'prop_003',proposal_name:'食材隊',team_slots:['cand_005','cand_008','cand_012','cand_003','cand_017'],qualitative_focus:'INGREDIENT',trade_off_description:'定性方案',missing_data_dependencies:['verified_ingredient_probability_rule']},
  {proposal_id:'prop_004',proposal_name:'樹果隊',team_slots:['cand_005','cand_008','cand_012','cand_014','cand_016'],qualitative_focus:'BERRY',trade_off_description:'定性方案',missing_data_dependencies:['verified_berry_energy_rule']},
  {proposal_id:'prop_005',proposal_name:'技能隊',team_slots:['cand_005','cand_008','cand_012','cand_009','cand_019'],qualitative_focus:'SKILL',trade_off_description:'定性方案',missing_data_dependencies:['verified_main_skill_trigger_rule']},
  {proposal_id:'prop_006',proposal_name:'稀有食材隊',team_slots:['cand_005','cand_008','cand_012','cand_006','cand_007'],qualitative_focus:'RARE_INGREDIENT',trade_off_description:'定性方案',missing_data_dependencies:['verified_ingredient_slot_distribution_rule']},
],evaluation_note:'所有精確數值都必須由 deterministic evaluator 重算。'};

const adapted=adaptOptimizationAiResponse(legacy);assert.equal(adapted.adapter,'LEGACY_GEMINI_TEAM_SLOTS');assert.deepEqual(adapted.canonical.team_proposals[0].candidate_refs,legacy.proposals[0].team_slots);
const evaluationFixture=()=>({objective_status:'NUMERIC_MODEL_NOT_ACTIVE',objective_score:null,input_fingerprint:'team_objective:fixture',missing_inputs:['berry_energy_per_hour:NOT_YET_VERIFIED']});
const legacyIntake=intakeOptimizationAiResponse(legacy,{optimizationPreview:preview,evaluateProposal:evaluationFixture});
assert.equal(legacyIntake.intake_status,'READY_FOR_REVIEW');assert.equal(legacyIntake.context_fingerprint_match,true);assert.equal(legacyIntake.accepted_proposals.length,6);assert.equal(legacyIntake.rejected_proposals.length,0);assert.ok(legacyIntake.accepted_proposals.every(row=>row.hard_constraints_status==='PASS'));assert.ok(legacyIntake.accepted_proposals.every(row=>row.deterministic_re_evaluation_status==='HOLD'&&row.objective_score===null));assert.ok(legacyIntake.accepted_proposals.every(row=>row.apply_allowed===false&&row.direct_player_write_allowed===false));assert.equal(legacyIntake.numeric_authority,false);assert.equal(legacyIntake.player_data_write,false);

const canonical={context_fingerprint:payload.context_fingerprint,strategy_summary:'canonical',warnings:[],missing_inputs:['production rates'],team_proposals:[{proposal_id:'canonical_1',proposal_name:'Canonical',candidate_refs:['cand_005','cand_008','cand_012','cand_001','cand_015'],target_recipe_ids:['r1'],qualitative_focus:'BALANCED',rationale:'候選',expected_tradeoff:'tradeoff',missing_data_dependencies:['production rates']}]};
const canonicalIntake=intakeOptimizationAiResponse(canonical,{optimizationPreview:preview,evaluateProposal:evaluationFixture});assert.equal(canonicalIntake.adapter,'CANONICAL');assert.equal(canonicalIntake.accepted_proposals.length,1);assert.equal(canonicalIntake.accepted_proposals[0].target_recipe_ids[0],'r1');assert.equal(canonicalIntake.accepted_proposals[0].objective_score,null);assert.equal(canonicalIntake.accepted_proposals[0].deterministic_re_evaluation_status,'HOLD');
const zeroIntake=intakeOptimizationAiResponse(canonical,{optimizationPreview:preview,evaluateProposal:()=>({objective_status:'ACTIVE_VERIFIED',objective_score:0,input_fingerprint:'team_objective:zero'})});assert.equal(zeroIntake.accepted_proposals[0].objective_score,0);assert.equal(zeroIntake.accepted_proposals[0].deterministic_re_evaluation_status,'READY');
const stale=intakeOptimizationAiResponse({...canonical,context_fingerprint:'strategy_context:stale'},{optimizationPreview:preview,evaluateProposal:evaluationFixture});assert.equal(stale.intake_status,'BLOCKED_CONTEXT_MISMATCH');assert.equal(stale.accepted_proposals.length,0);assert.equal(stale.rejected_proposals[0].reasons[0],'context_fingerprint_mismatch');
const unknown=intakeOptimizationAiResponse({...canonical,team_proposals:[{...canonical.team_proposals[0],candidate_refs:['cand_005','cand_008','cand_012','cand_001','cand_999']}]},{optimizationPreview:preview,evaluateProposal:evaluationFixture});assert.equal(unknown.accepted_proposals.length,0);assert.ok(unknown.rejected_proposals[0].reasons.includes('unknown_candidate_ref:cand_999'));
const duplicate=intakeOptimizationAiResponse({...canonical,team_proposals:[{...canonical.team_proposals[0],candidate_refs:['cand_005','cand_008','cand_012','cand_001','cand_001']}]},{optimizationPreview:preview,evaluateProposal:evaluationFixture});assert.equal(duplicate.accepted_proposals.length,0);assert.ok(duplicate.rejected_proposals[0].reasons.some(reason=>reason.startsWith('team_size:'))||duplicate.rejected_proposals[0].reasons.includes('duplicate_member'));
const excludedPayload={...payload,goal_profile:{...payload.goal_profile,hard_constraints:{...payload.goal_profile.hard_constraints,exclude:{candidate_refs:['cand_019'],species:[]}}}};const excluded=intakeOptimizationAiResponse({...canonical,team_proposals:[{...canonical.team_proposals[0],candidate_refs:['cand_005','cand_008','cand_012','cand_009','cand_019']}]},{optimizationPreview:{payload:excludedPayload},evaluateProposal:evaluationFixture});assert.equal(excluded.accepted_proposals.length,0);assert.ok(excluded.rejected_proposals[0].reasons.includes('excluded_member:cand_019'));

const prompt=buildExternalOptimizationPrompt(payload);assert.ok(prompt.includes('Response JSON Schema'));assert.ok(prompt.includes('team_proposals'));assert.ok(prompt.includes('candidate_refs'));assert.ok(prompt.includes(payload.context_fingerprint));assert.ok(prompt.includes('不得自行重新命名欄位'));assert.ok(STRATEGY_OPTIMIZATION_AI_RESPONSE_SCHEMA.required.includes('context_fingerprint'));
const ui=read('assets/js/war-room-strategy-context-ui.js');for(const token of ['AI Proposal Intake','warRoomOptimizationAiResponse','解析／驗證 AI 候選','Context Fingerprint','LEGACY_GEMINI_TEAM_SLOTS','不可直接 Apply'])assert.ok(ui.includes(token)||read('assets/js/strategy-optimization-ai-contract.js').includes(token),`G7.4 token missing: ${token}`);assert.equal(ui.includes('warRoomApplyOptimizationProposal'),false);assert.ok(ui.includes("score!==null&&score!==undefined&&score!==''&&Number.isFinite(Number(score))"));assert.equal(ui.includes('if(Number.isFinite(Number(score)))'),false);
const styles=read('assets/js/v0416-g73-ui.js');for(const token of ['.g74-ai-intake','overflow-wrap:anywhere','grid-template-columns:1fr'])assert.ok(styles.includes(token),`mobile intake containment missing: ${token}`);
const sw=read('service-worker.js');for(const asset of ['./assets/js/strategy-optimization-ai-contract.js','./assets/js/strategy-context-local.js','./assets/js/war-room-strategy-context-ui.js','./assets/js/v0416-g73-ui.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);
console.log(JSON.stringify({status:'PASS',gate:'V04171_AI_PROPOSAL_NULL_SCORE_RENDERING_SUCCESSOR_AWARE',app_version:appVersion,prompt_embeds_response_schema:true,context_fingerprint_fail_closed:true,legacy_gemini_adapter:true,canonical_intake:true,hard_constraints_revalidated:true,unknown_ref_rejected:true,duplicate_rejected:true,numeric_model_hold_preserved:true,ui_null_score_preserved:true,genuine_zero_preserved:true,direct_apply:false,player_write:false,gemini_numeric_authority:false,mobile_containment:true},null,2));