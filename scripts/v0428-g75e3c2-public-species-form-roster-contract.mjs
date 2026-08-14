import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_SPECIES_FORM_ROSTER_VERSION,
  PUBLIC_SPECIES_FORM_ROSTER_STATUS,
  PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE,
  PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT,
  PUBLIC_SPECIES_FORM_ROSTER_ROWS,
  PUBLIC_SPECIES_FORM_ROSTER_SOURCE_GROUPS,
  PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS,
  PUBLIC_SPECIES_FORM_ROSTER_ANNOUNCED_PENDING,
  currentPublicSpeciesFormRoster,
  publicSpeciesFormRosterRow,
} from '../assets/js/public-pokemon-species-form-roster.js';
import {
  PUBLIC_SPECIES_FORM_ROSTER_AUTHORITY_STATUS,
  currentPublicSpeciesFormRosterReadiness,
} from '../assets/js/public-pokemon-species-form-roster-readiness.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';

const read=path=>fs.readFileSync(path,'utf8');
const roster=currentPublicSpeciesFormRoster();
assert.equal(roster.schema,'pokemon-sleep-public-species-form-roster/1.0');
assert.equal(roster.version,PUBLIC_SPECIES_FORM_ROSTER_VERSION);
assert.equal(roster.version,'public-species-form-roster-2026-08-14-a');
assert.equal(roster.status,PUBLIC_SPECIES_FORM_ROSTER_STATUS);
assert.equal(roster.status,'ACTIVE_GOVERNED_CATALOG_REFERENCE');
assert.equal(roster.scope_date,PUBLIC_SPECIES_FORM_ROSTER_SCOPE_DATE);
assert.equal(roster.scope_date,'2026-08-14');
assert.equal(roster.source_commit,PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT);
assert.equal(roster.source_commit,'fc36317b195125c63bf56d3777fa3ed1a9548831');
assert.equal(roster.row_count,242);
assert.deepEqual(roster.specialty_group_counts,{BERRY:68,INGREDIENT:85,SKILL:87,ALL:2});
assert.equal(roster.unique_source_key_count,242);
assert.equal(roster.unique_canonical_id_count,242);
assert.deepEqual(roster.duplicate_source_keys,[]);
assert.deepEqual(roster.duplicate_canonical_ids,[]);
assert.equal(roster.official_recency_anchor_count,8);
assert.equal(roster.official_recency_anchor_species_form_count,20);
assert.deepEqual(roster.official_recency_anchor_missing,[]);
assert.equal(roster.announced_pending_count,4);
assert.equal(roster.complete_current_catalog_reference,true);
assert.equal(roster.activation_coverage_denominator_ready,true);
assert.equal(roster.expected_current_species_form_count,242);
assert.equal(roster.rate_authority,false);
assert.equal(roster.policy.expected_row_count,242);
assert.equal(roster.policy.rate_values_in_scope,false);
assert.equal(roster.policy.player_roster_in_scope,false);
assert.equal(roster.policy.runtime_network_fetch,false);
assert.equal(roster.policy.ai_inferred_missing_rows,false);

const groupTotal=Object.values(PUBLIC_SPECIES_FORM_ROSTER_SOURCE_GROUPS).reduce((sum,row)=>sum+row.source_keys.length,0);
assert.equal(groupTotal,242);
assert.equal(PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,242);
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.active_in_current_roster===true));
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.rate_authority===false));
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.player_observation===false));
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.source_commit===PUBLIC_SPECIES_FORM_ROSTER_SOURCE_COMMIT));
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.source_path.startsWith('common/src/types/pokemon/')));
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ROWS.every(row=>row.canonical_species_form_id===`neroli:${row.source_key.toLowerCase()}`));

const recentExpected=['CUTIEFLY','RIBOMBEE','NOIBAT','NOIVERN','LATIAS','SANDSHREW','SANDSLASH','TYRUNT','TYRANTRUM','DRAMPA','LATIOS','TURTWIG','GROTLE','TORTERRA','CHIMCHAR','MONFERNO','INFERNAPE','PIPLUP','PRINPLUP','EMPOLEON'];
const anchoredKeys=new Set(PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.flatMap(row=>row.source_keys));
assert.equal(anchoredKeys.size,20);
for(const key of recentExpected){
  assert.ok(anchoredKeys.has(key),`official recent arrival anchor missing ${key}`);
  assert.ok(publicSpeciesFormRosterRow(key),`official recent arrival missing from roster ${key}`);
}
assert.equal(PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.at(-1).appearing_from,'2026-07-13');
assert.deepEqual(PUBLIC_SPECIES_FORM_ROSTER_OFFICIAL_RECENCY_ANCHORS.at(-1).source_keys,['TURTWIG','GROTLE','TORTERRA','CHIMCHAR','MONFERNO','INFERNAPE','PIPLUP','PRINPLUP','EMPOLEON']);

const pendingNames=PUBLIC_SPECIES_FORM_ROSTER_ANNOUNCED_PENDING.flatMap(row=>row.display_names);
for(const name of ["Pikachu wearing a captain’s hat",'Tinkatink','Tinkatuff','Tinkaton'])assert.ok(pendingNames.includes(name));
for(const prematureKey of ['TINKATINK','TINKATUFF','TINKATON'])assert.equal(publicSpeciesFormRosterRow(prematureKey),null,`${prematureKey} must not enter current active roster from announcement alone`);
assert.ok(PUBLIC_SPECIES_FORM_ROSTER_ANNOUNCED_PENDING.every(row=>row.inclusion_status==='ANNOUNCED_NOT_INCLUDED_WITHOUT_APPEARING_FROM_EVIDENCE'));

// Form-safe source keys must remain distinct catalog identities.
for(const key of ['VULPIX','VULPIX_ALOLAN','NINETALES','NINETALES_ALOLAN','WOOPER','WOOPER_PALDEAN','TOXTRICITY_AMPED','TOXTRICITY_LOW_KEY','PUMPKABOO_SMALL','PUMPKABOO_MEDIUM','PUMPKABOO_LARGE','PUMPKABOO_JUMBO','GOURGEIST_SMALL','GOURGEIST_MEDIUM','GOURGEIST_LARGE','GOURGEIST_JUMBO'])assert.ok(publicSpeciesFormRosterRow(key),`form-safe roster row missing ${key}`);
assert.notEqual(publicSpeciesFormRosterRow('VULPIX').canonical_species_form_id,publicSpeciesFormRosterRow('VULPIX_ALOLAN').canonical_species_form_id);
assert.notEqual(publicSpeciesFormRosterRow('TOXTRICITY_AMPED').canonical_species_form_id,publicSpeciesFormRosterRow('TOXTRICITY_LOW_KEY').canonical_species_form_id);
assert.notEqual(publicSpeciesFormRosterRow('PUMPKABOO_SMALL').canonical_species_form_id,publicSpeciesFormRosterRow('PUMPKABOO_JUMBO').canonical_species_form_id);

const readiness=currentPublicSpeciesFormRosterReadiness();
assert.equal(readiness.schema,'pokemon-sleep-public-species-form-roster-readiness/1.1');
assert.equal(readiness.authority_status,PUBLIC_SPECIES_FORM_ROSTER_AUTHORITY_STATUS);
assert.equal(readiness.authority_status,'ACTIVE_GOVERNED_CATALOG_REFERENCE');
assert.equal(readiness.expected_current_species_form_count,242);
assert.equal(readiness.activation_coverage_denominator_ready,true);
assert.equal(readiness.current_public_roster_master,PUBLIC_SPECIES_FORM_ROSTER_VERSION);
assert.equal(readiness.roster_row_count,242);
assert.equal(readiness.official_recency_anchor_count,8);
assert.equal(readiness.official_recency_anchor_species_form_count,20);
assert.equal(readiness.announced_pending_count,4);
assert.equal(readiness.blocker,null);
for(const key of ['player_roster_may_define_public_catalog','empty_seed_may_define_zero_catalog','partial_evolution_routes_may_define_complete_catalog','announced_pending_entries_auto_include','roster_values_imply_ingredient_probability','missing_species_or_forms_may_be_ai_inferred','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(readiness.safety[key],false,`unsafe readiness flag ${key}`);

// Catalog authority is only a denominator; it must not activate ingredient probability or import hidden rates.
const registry=currentProductionAuthorityRegistry();
const active=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution'];
assert.deepEqual(registry.active_verified_dimensions,active);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.rule_version,null);
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
const rateReference=currentSpeciesIngredientRateReference();
assert.equal(rateReference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(rateReference.complete_catalog,false);
assert.equal(rateReference.eligible_for_numeric_activation,false);

for(const file of ['assets/js/public-pokemon-species-form-roster.js','assets/js/public-pokemon-species-form-roster-readiness.js']){
  const source=read(file);
  for(const forbidden of ['base_ingredient_probability','ingredientPercentage','fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`${file} contains forbidden roster/rate/write path: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C2_PUBLIC_SPECIES_FORM_ROSTER',roster_version:roster.version,scope_date:roster.scope_date,
  roster_count:roster.row_count,group_counts:roster.specialty_group_counts,unique_source_keys:roster.unique_source_key_count,
  official_recency_anchor_count:roster.official_recency_anchor_count,official_recent_species_form_count:roster.official_recency_anchor_species_form_count,
  pending_announced_not_auto_included:roster.announced_pending_count,form_safe:true,coverage_denominator_ready:readiness.activation_coverage_denominator_ready,
  expected_current_species_form_count:readiness.expected_current_species_form_count,rate_authority:false,production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,overall_numeric_model_status:registry.numeric_rate_model_status,
  player_roster_used:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
