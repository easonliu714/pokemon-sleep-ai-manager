import assert from 'node:assert/strict';
import fs from 'node:fs';
import {currentIngredientProbabilityStatisticalReadinessPolicy} from '../assets/js/ingredient-probability-statistical-readiness.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const strategySource=fs.readFileSync('assets/js/strategy-context-local.js','utf8');
const uiSource=fs.readFileSync('assets/js/production-evidence-ui.js','utf8');
const start=strategySource.indexOf('export function buildLocalIngredientProbabilityStatisticalReadiness');
const end=strategySource.indexOf('export function buildLocalProductionEvidenceSnapshot',start);
assert.ok(start>=0&&end>start,'local E3C-7B readiness adapter missing');
const adapter=strategySource.slice(start,end);

for(const token of [
  'source_key','canonical_species_form_id','status','eligible_for_statistical_aggregation',
  'ingredient_help_event_count','total_help_event_count','statistical_semantics',
])assert.ok(adapter.includes(token),`minimal statistical projection missing ${token}`);
for(const forbidden of [
  'observation_evidence_refs','ingredient_slots','nickname','pokemon_id','pokemon_instance_id','game_pokemon_id',
  'player_name','account_id','field_evidence_json','source_image_refs_json',
])assert.equal(adapter.includes(forbidden),false,`local readiness adapter reads forbidden private/raw field ${forbidden}`);
assert.ok(adapter.includes('auditIngredientProbabilityStatisticalReadiness'));
assert.ok(adapter.includes('currentIngredientProbabilityStatisticalReadinessPolicy'));
assert.ok(adapter.includes('referenceRows=[]'),'independent reference rows must be an explicit future input, not inferred');
assert.ok(adapter.includes("ORDER BY source_key,captured_at"),'local observations should be deterministically ordered');

const legacyInlineAttachment=strategySource.includes('ingredient_probability_statistical_readiness:buildLocalIngredientProbabilityStatisticalReadiness()');
const successorSingleAuditAttachment=strategySource.includes('const readiness=buildLocalIngredientProbabilityStatisticalReadiness()')&&strategySource.includes('ingredient_probability_statistical_readiness:readiness');
assert.equal(legacyInlineAttachment||successorSingleAuditAttachment,true,'Production snapshot must expose local statistical readiness');
if(successorSingleAuditAttachment){
  assert.ok(strategySource.includes('buildLocalIngredientProbabilitySufficiencyEvidencePack({readiness})'),'E3C-7C1 successor must reuse the same readiness audit for the sufficiency pack');
  assert.ok(strategySource.includes('ingredient_probability_sufficiency_evidence_pack:sufficiencyPack'),'E3C-7C1 successor must attach the sufficiency pack to Production snapshot');
}
assert.ok(uiSource.includes('E3C-7 食材機率 Statistical Readiness'));
assert.ok(uiSource.includes('Readiness ≠ Production Activation'));
assert.ok(uiSource.includes('目前尚未核准統計充分性門檻'));
assert.ok(uiSource.includes('Promotion candidates'));
assert.ok(uiSource.includes('Wilson 95%'));
assert.ok(uiSource.includes('I²'));
assert.ok(uiSource.includes("groups.slice(0,6)"),'mobile UI must keep large readiness group lists compact');
assert.ok(uiSource.includes('進階 Evidence / JSON'));

const policy=currentIngredientProbabilityStatisticalReadinessPolicy();
assert.equal(policy.policy_authority_status,'NOT_YET_DEFINED');
assert.equal(policy.activation_authority_granted,false);
assert.equal(policy.production_active_dimensions,'4/7');
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

for(const source of [adapter,uiSource])for(const forbidden of ['fetch(', 'XMLHttpRequest', 'INSERT INTO', 'UPDATE ingredient_probability_observations', 'DELETE FROM ingredient_probability_observations'])assert.equal(source.includes(forbidden),false,`E3C-7B UI path owns forbidden authority/write path ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7B_LOCAL_STATISTICAL_READINESS_UI',
  sqlite_projection_fields:7,
  raw_evidence_refs_read:false,
  player_identity_read:false,
  local_readiness_attached_to_production_snapshot:true,
  snapshot_attachment_mode:successorSingleAuditAttachment?'SINGLE_AUDIT_REUSED_BY_READINESS_AND_SUFFICIENCY_PACK':'LEGACY_INLINE_READINESS',
  mobile_group_preview_limit:6,
  governed_thresholds_defined:false,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  sqlite_write:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
},null,2));
