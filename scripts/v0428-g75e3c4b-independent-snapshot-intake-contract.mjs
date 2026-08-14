import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,
  INDEPENDENT_SNAPSHOT_INTAKE_STATUS,
  currentIndependentIngredientProbabilitySnapshotContract,
  validateIndependentIngredientProbabilitySnapshot,
} from '../assets/js/ingredient-probability-independent-snapshot-contract.js';
import {INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const contract=currentIndependentIngredientProbabilitySnapshotContract();
assert.equal(contract.schema,'pokemon-sleep-independent-ingredient-probability-snapshot-contract/1.0');
assert.equal(contract.accepted_snapshot_schema,INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA);
assert.equal(contract.source_admission_required,true);
assert.equal(contract.form_safe_roster_mapping_required,true);
assert.equal(contract.source_row_ref_required,true);
assert.equal(contract.unit,'PERCENT');
assert.equal(contract.published_precision_preserved,true);
assert.equal(contract.activation_authority_granted,false);

const roster=currentPublicSpeciesFormRoster();
const rosterKeys=roster.policy.expected_row_count===242?rosterRows():[];
function rosterRows(){
  const source=read('assets/js/public-pokemon-species-form-roster.js');
  const keys=[...source.matchAll(/source_keys:Object\.freeze\(\[([\s\S]*?)\]\)/g)].flatMap(match=>[...match[1].matchAll(/'([A-Z0-9_]+)'/g)].map(value=>value[1]));
  return [...new Set(keys)];
}
assert.equal(rosterKeys.length,242);

const admittedSource=(mapped)=>({
  source_id:'fixture-independent-source',derived_from_neroli_primary:false,mirror_of_neroli_primary:false,ai_generated_numeric_source:false,untraceable_summary:false,
  lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_ACCEPTED,lineage_evidence_refs:['fixture://lineage'],
  snapshot_hash_algorithm:'sha256',snapshot_hash:'fixturehash',snapshot_scope_date:'2026-08-14',source_version:'fixture-v1',parser_version:'fixture-parser-v1',
  mapped_row_count:mapped,roster_row_count:242,form_safe_mapping_audit_passed:true,published_numeric_precision_preserved:true,partial_coverage_reported_explicitly:true,
});
const row=(source_key,value='25.700')=>({source_key,ingredient_percentage:value,unit:'PERCENT',source_row_ref:`fixture://row/${source_key}`});

const partialSnapshot={schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(3),rows:[row(rosterKeys[0]),row(rosterKeys[1],'20'),row(rosterKeys[2],'.5')]};
const partial=validateIndependentIngredientProbabilitySnapshot({snapshot:partialSnapshot,rosterKeys});
assert.equal(partial.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.ADMITTED_PARTIAL_CROSSCHECK_SNAPSHOT);
assert.equal(partial.row_count,3);
assert.equal(partial.valid_mapped_row_count,3);
assert.equal(partial.unique_mapped_row_count,3);
assert.equal(partial.coverage_ratio,3/242);
assert.equal(partial.complete_coverage,false);
assert.equal(partial.activation_authority_granted,false);
assert.deepEqual(partial.problems,[]);
assert.equal(partial.normalized_rows[0].ingredient_percentage_published,'25.700');
assert.equal(partial.normalized_rows[0].ingredient_percentage_normalized,'25.7');
assert.equal(partial.normalized_rows[2].ingredient_percentage_normalized,'0.5');
for(const key of ['partial_coverage_implies_complete','admitted_snapshot_implies_activation','published_precision_rewritten','unknown_roster_keys_accepted','duplicate_source_keys_accepted','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(partial.safety[key],false,`unsafe partial snapshot flag ${key}`);

const completeRows=rosterKeys.map((key,index)=>row(key,index%2?'20.0':'25.700'));
const complete=validateIndependentIngredientProbabilitySnapshot({snapshot:{schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(242),rows:completeRows},rosterKeys});
assert.equal(complete.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.ADMITTED_COMPLETE_CROSSCHECK_SNAPSHOT);
assert.equal(complete.row_count,242);
assert.equal(complete.unique_mapped_row_count,242);
assert.equal(complete.coverage_ratio,1);
assert.equal(complete.complete_coverage,true);
assert.equal(complete.activation_authority_granted,false,'complete independent snapshot does not itself activate Production');

const unreviewed=validateIndependentIngredientProbabilitySnapshot({snapshot:{...partialSnapshot,source:{...partialSnapshot.source,lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.NOT_REVIEWED}},rosterKeys});
assert.equal(unreviewed.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SOURCE_ADMISSION_NOT_READY);
assert.equal(unreviewed.reason,'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_MISSING');
assert.equal(unreviewed.activation_authority_granted,false);
const wrongSchema=validateIndependentIngredientProbabilitySnapshot({snapshot:{...partialSnapshot,schema:'other/1.0'},rosterKeys});
assert.equal(wrongSchema.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.equal(wrongSchema.reason,'SNAPSHOT_SCHEMA_NOT_ACCEPTED');
const duplicate=validateIndependentIngredientProbabilitySnapshot({snapshot:{schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(2),rows:[row(rosterKeys[0]),row(rosterKeys[0])]},rosterKeys});
assert.equal(duplicate.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.ok(duplicate.problems.includes('DUPLICATE_SOURCE_KEYS'));
const unknown=validateIndependentIngredientProbabilitySnapshot({snapshot:{schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(1),rows:[row('NOT_IN_ROSTER')]},rosterKeys});
assert.equal(unknown.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.ok(unknown.problems.includes('UNKNOWN_ROSTER_KEYS'));
const invalidValue=validateIndependentIngredientProbabilitySnapshot({snapshot:{schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(1),rows:[row(rosterKeys[0],'25.7%')]},rosterKeys});
assert.equal(invalidValue.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.ok(invalidValue.problems.some(value=>value.includes('PUBLISHED_NUMERIC_VALUE_INVALID')));
const missingRef=validateIndependentIngredientProbabilitySnapshot({snapshot:{schema:INDEPENDENT_INGREDIENT_PROBABILITY_SNAPSHOT_SCHEMA,source:admittedSource(1),rows:[{...row(rosterKeys[0]),source_row_ref:''}]},rosterKeys});
assert.equal(missingRef.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.ok(missingRef.problems.some(value=>value.includes('SOURCE_ROW_REF_MISSING')));
const wrongMappedCount=validateIndependentIngredientProbabilitySnapshot({snapshot:{...partialSnapshot,source:admittedSource(4)},rosterKeys});
assert.equal(wrongMappedCount.status,INDEPENDENT_SNAPSHOT_INTAKE_STATUS.SNAPSHOT_REVIEW_REQUIRED);
assert.ok(wrongMappedCount.problems.includes('ADMISSION_MAPPED_ROW_COUNT_MISMATCH'));

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=read('assets/js/ingredient-probability-independent-snapshot-contract.js');
for(const forbidden of ['fetch(', 'raw.githubusercontent.com', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`snapshot intake contract owns forbidden path ${forbidden}`);

console.log(JSON.stringify({status:'PASS',gate:'V0428_G75E3C4B_INDEPENDENT_SNAPSHOT_INTAKE',public_roster_count:242,partial_fixture_coverage:'3/242',complete_fixture_coverage:'242/242',complete_snapshot_grants_activation:false,duplicate_key_rejected:true,unknown_key_rejected:true,published_precision_preserved:true,source_admission_required:true,production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
