import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_SPECIES_INGREDIENT_CANDIDATE_STATUS,
  PUBLIC_SPECIES_INGREDIENT_CANDIDATE_POLICY,
  currentPublicSpeciesIngredientCandidateSourceRows,
  publicSpeciesIngredientCandidatesBySourceKey,
  equivalentCandidateSetAcrossSourceKeys,
} from '../assets/js/public-species-ingredient-candidate-authority.js';

const artifact=JSON.parse(fs.readFileSync('artifacts/public-species-ingredient-candidate-source.json','utf8'));
const runtimeRows=currentPublicSpeciesIngredientCandidateSourceRows();
assert.equal(PUBLIC_SPECIES_INGREDIENT_CANDIDATE_STATUS,'ACTIVE_STRUCTURAL_SOURCE_KEY_AUTHORITY');
assert.equal(runtimeRows.length,242);
assert.equal(artifact.mapped_row_count,242);
assert.equal(artifact.extraction_failures.length,0);
assert.equal(PUBLIC_SPECIES_INGREDIENT_CANDIDATE_POLICY.zh_tw_species_identity_authority,false,'source-key authority must not pretend zh-TW identity is resolved');
for(const flag of ['player_slot_identity_generated','ingredient_probability_authority','production_slot_distribution_authority','ingredient_quantity_authority','specialty_inference','runtime_network_fetch','private_player_data_used'])assert.equal(PUBLIC_SPECIES_INGREDIENT_CANDIDATE_POLICY[flag],false,`unsafe policy flag ${flag}`);

for(const source of artifact.rows){
  for(const [level,artifactKey] of [[1,'level_1'],[30,'level_30'],[60,'level_60']]){
    const actual=publicSpeciesIngredientCandidatesBySourceKey(source.source_key,level);
    assert.equal(actual.status,'ACTIVE_STRUCTURAL_SOURCE_KEY_AUTHORITY',`${source.source_key}@${level} runtime missing`);
    const expected=source.candidates[artifactKey].map(row=>row.canonical_name_zh_tw);
    assert.deepEqual(actual.candidates,expected,`${source.source_key}@${level} candidate drift`);
    assert.equal(actual.player_slot_identity_generated,false);
    assert.equal(actual.ingredient_probability_authority,false);
    assert.equal(actual.production_slot_distribution_authority,false);
  }
}

const missing=publicSpeciesIngredientCandidatesBySourceKey('NOT_A_REAL_SOURCE_KEY',30);
assert.equal(missing.status,'REVIEW_REQUIRED');
assert.equal(missing.candidates,null);
const invalidLevel=publicSpeciesIngredientCandidatesBySourceKey('DRATINI',25);
assert.equal(invalidLevel.status,'REVIEW_REQUIRED');
assert.equal(invalidLevel.reason,'INGREDIENT_SLOT_LEVEL_INVALID');

const pumpkaboo=equivalentCandidateSetAcrossSourceKeys(['PUMPKABOO_SMALL','PUMPKABOO_MEDIUM','PUMPKABOO_LARGE','PUMPKABOO_JUMBO'],60);
assert.equal(pumpkaboo.status,'MATCHABLE_EQUIVALENT_FORM_SET');
assert.deepEqual(pumpkaboo.candidates,['沉甸甸南瓜','萌綠大豆','窩心洋芋']);
const toxtricity=equivalentCandidateSetAcrossSourceKeys(['TOXTRICITY_AMPED','TOXTRICITY_LOW_KEY'],60);
assert.equal(toxtricity.status,'MATCHABLE_EQUIVALENT_FORM_SET');
assert.deepEqual(toxtricity.candidates,['哞哞鮮奶','特選蘋果','粗枝大蔥']);
const deliberatelyDifferent=equivalentCandidateSetAcrossSourceKeys(['DRATINI','CATERPIE'],60);
assert.equal(deliberatelyDifferent.status,'REVIEW_REQUIRED');
assert.equal(deliberatelyDifferent.reason,'AMBIGUOUS_FORM_CANDIDATE_SETS_DIFFER');

console.log(JSON.stringify({
  status:'PASS',gate:'PUBLIC_SPECIES_INGREDIENT_CANDIDATE_RUNTIME_PARITY',
  artifact_rows:artifact.mapped_row_count,runtime_rows:runtimeRows.length,
  exact_slot_parity:true,ambiguous_equivalent_form_sets_supported:true,
  unknown_source_key_fail_closed:true,invalid_slot_level_fail_closed:true,
  zh_tw_species_identity_authority:false,player_slot_identity_generated:false,
  ingredient_probability_authority:false,production_slot_distribution_authority:false,
},null,2));
