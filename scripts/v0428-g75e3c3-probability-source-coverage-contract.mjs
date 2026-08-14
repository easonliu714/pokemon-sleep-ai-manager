import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_SPECIES_FORM_ROSTER_VERSION,currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const artifactPath=process.argv.find(arg=>arg.startsWith('--artifact='))?.slice('--artifact='.length)||'artifacts/v0428_g75e3c3_probability_source_coverage.json';
assert.ok(fs.existsSync(artifactPath),`SOURCE_COVERAGE_ARTIFACT_MISSING:${artifactPath}`);
const artifact=JSON.parse(fs.readFileSync(artifactPath,'utf8'));
const roster=currentPublicSpeciesFormRoster();

assert.equal(artifact.schema,'pokemon-sleep-ingredient-probability-source-coverage-audit/1.1');
assert.equal(artifact.roster_version,PUBLIC_SPECIES_FORM_ROSTER_VERSION);
assert.equal(artifact.roster_count,242);
assert.equal(roster.row_count,242);
assert.equal(roster.activation_coverage_denominator_ready,true);
assert.equal(artifact.source_commit,'fc36317b195125c63bf56d3777fa3ed1a9548831');
assert.deepEqual(Object.fromEntries(Object.entries(artifact.source_files).map(([path,row])=>[path,row.blob_sha])),{
  'common/src/types/pokemon/berry-pokemon.ts':'c52f331fce50904e0246faa2a72346bc45b3e3e2',
  'common/src/types/pokemon/ingredient-pokemon.ts':'ef3c631e11a86969db6b0febbb087612b7d4cb71',
  'common/src/types/pokemon/skill-pokemon.ts':'5b718ecf8421ad0e9ed144fd928ab398c015b865',
  'common/src/types/pokemon/all-pokemon.ts':'2cc625de693a0bdb7eeabd8f91e6ff6a50079dba',
});
assert.equal(artifact.summary.expected_roster_count,242);
assert.equal(artifact.summary.extracted_value_count,242);
assert.equal(artifact.summary.explicit_value_count,235);
assert.equal(artifact.summary.inherited_value_count,7);
assert.equal(artifact.summary.missing_value_count,0);
assert.equal(artifact.summary.duplicate_source_key_count,0);
assert.equal(artifact.summary.unexpected_source_key_count,0);
assert.equal(artifact.summary.source_value_coverage_ratio,1);
assert.equal(artifact.summary.activation_row_evidence_ready_count,0,'source extraction alone must not create activation-ready rows');
assert.equal(artifact.summary.activation_ready_coverage_ratio,0);
assert.equal(artifact.summary.independent_crosschecked_row_count,0);
assert.equal(artifact.summary.excluded_from_activation_count,1,'known Mew source exclusion must be the only policy-level hard exclusion at source extraction stage');
assert.equal(artifact.summary.review_required_count,241);
assert.equal(artifact.activation_decision,'HOLD_SOURCE_VALUES_UNCROSSCHECKED');
for(const key of ['runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority','artifact_values_activate_runtime'])assert.equal(artifact.safety[key],false,`unsafe artifact flag: ${key}`);
assert.equal(artifact.safety.inherited_values_require_explicit_source_lineage,true);

assert.equal(artifact.rows.length,242);
const keys=artifact.rows.map(row=>row.source_key);
assert.equal(new Set(keys).size,242);
assert.equal(new Set(artifact.rows.map(row=>row.canonical_species_form_id)).size,242);
assert.ok(artifact.rows.every(row=>Number.isFinite(row.ingredient_percentage)&&row.ingredient_percentage>0&&row.ingredient_percentage<100));
assert.ok(artifact.rows.every(row=>Number.isFinite(row.base_ingredient_probability)&&row.base_ingredient_probability>0&&row.base_ingredient_probability<1));
assert.ok(artifact.rows.every(row=>row.source_commit===artifact.source_commit));
assert.ok(artifact.rows.every(row=>row.independent_current_crosscheck_count===0));
assert.ok(artifact.rows.every(row=>row.eligible_for_numeric_activation===false));
assert.ok(artifact.rows.every(row=>Number.isInteger(row.declaration_line)&&row.declaration_line>0));
assert.ok(artifact.rows.every(row=>Number.isInteger(row.source_line)&&row.source_line>0));

const expectedInherited={
  WARTORTLE:['SQUIRTLE','SQUIRTLE'],
  RATICATE:['RATTATA','RATTATA'],
  DODRIO:['DODUO','DODUO'],
  NINETALES_ALOLAN:['VULPIX_ALOLAN','VULPIX_ALOLAN'],
  CROCONAW:['TOTODILE','TOTODILE'],
  DRAGONAIR:['DRATINI','DRATINI'],
  TOGEKISS:['TOGETIC','TOGETIC'],
};
assert.equal(artifact.inherited_rows.length,7);
assert.deepEqual(artifact.inherited_rows.map(row=>row.source_key).sort(),Object.keys(expectedInherited).sort());
for(const [key,[parent,origin]] of Object.entries(expectedInherited)){
  const summaryRow=artifact.inherited_rows.find(row=>row.source_key===key);
  const fullRow=artifact.rows.find(row=>row.source_key===key);
  assert.ok(summaryRow&&fullRow,`inherited row missing ${key}`);
  assert.equal(fullRow.value_origin,'INHERITED');
  assert.equal(fullRow.immediate_parent_source_key,parent);
  assert.equal(fullRow.value_origin_source_key,origin);
  assert.deepEqual(fullRow.inheritance_lineage,[key,parent]);
  assert.equal(summaryRow.immediate_parent_source_key,parent);
  assert.equal(summaryRow.value_origin_source_key,origin);
  assert.deepEqual(summaryRow.inheritance_lineage,[key,parent]);
  assert.equal(fullRow.ingredient_percentage,artifact.rows.find(row=>row.source_key===parent).ingredient_percentage,`${key} inherited value must equal pinned parent source value`);
}
assert.equal(artifact.rows.filter(row=>row.value_origin==='EXPLICIT').length,235);
assert.equal(artifact.rows.filter(row=>row.value_origin==='INHERITED').length,7);

const mew=artifact.rows.find(row=>row.source_key==='MEW');
assert.ok(mew,'MEW extraction row missing');
assert.equal(mew.ingredient_percentage,20);
assert.equal(mew.source_path,'common/src/types/pokemon/all-pokemon.ts');
assert.ok((mew.source_comment||'').toLowerCase().includes('suspicious'));
assert.ok(mew.quality_markers.includes('SUSPICIOUS'));
assert.equal(mew.policy_status,'EXCLUDED_FROM_ACTIVATION');
assert.equal(mew.policy_reason,'SOURCE_COMMENT_DECLARES_VALUE_SUSPICIOUS_AND_USED_TO_FIT_RP_MODEL');
assert.equal(mew.eligible_for_numeric_activation,false);
const flaggedMew=artifact.flagged_rows.find(row=>row.source_key==='MEW');
assert.ok(flaggedMew,'MEW must appear in flagged source rows');
assert.equal(flaggedMew.policy_status,'EXCLUDED_FROM_ACTIVATION');
assert.ok(artifact.summary.quality_flagged_row_count>=1);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.rule_version,null);
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C3_PROBABILITY_SOURCE_COVERAGE',roster_count:242,source_value_coverage:'242/242',explicit_values:235,inherited_values:7,
  quality_flagged_row_count:artifact.summary.quality_flagged_row_count,excluded_from_activation_count:artifact.summary.excluded_from_activation_count,
  review_required_count:artifact.summary.review_required_count,activation_ready_count:artifact.summary.activation_row_evidence_ready_count,
  mew_source_excluded:true,inherited_lineage_verified:true,production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_decision:artifact.activation_decision,runtime_values_activated:false,
},null,2));
