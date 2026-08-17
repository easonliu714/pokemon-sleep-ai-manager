import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SOURCE_LINEAGE_CLASS,
  INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEWS,
  currentIngredientProbabilitySourceLineageReview,
} from '../assets/js/ingredient-probability-independent-source-lineage-review.js';
import {
  INDEPENDENT_SOURCE_ADMISSION_STATUS,
  currentIndependentIngredientProbabilitySourceAdmissionContract,
  evaluateIndependentIngredientProbabilitySourceAdmission,
} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {currentIngredientProbabilityIndependentSourceReadiness} from '../assets/js/ingredient-probability-independent-source-readiness.js';
import {currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const review=currentIngredientProbabilitySourceLineageReview();
assert.equal(review.schema,'pokemon-sleep-ingredient-probability-source-lineage-review/1.0');
assert.ok(review.reviewed_candidate_count>=2,'E3C-5 predecessor candidates must remain reviewed');
assert.ok(review.rejected_candidate_count>=2,'E3C-5 predecessor rejected lineages must remain rejected');
assert.equal(review.accepted_independent_source_count,0);
assert.ok([
  'HOLD_NEED_NEW_INDEPENDENT_SOURCE_CANDIDATE',
  'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT',
].includes(review.status),'E3C-5 lineage review must remain HOLD while accepted independent source count is zero');
assert.equal(review.production_probability_activation_allowed,false);

const byId=new Map(review.reviews.map(row=>[row.source_id,row]));
const raenonx=byId.get('RAENONX_PRODUCTION_RATES');
assert.ok(raenonx);
assert.equal(raenonx.lineage_class,SOURCE_LINEAGE_CLASS.UPSTREAM_OR_SHARED_PRIMARY_NUMERIC_LINEAGE);
assert.equal(raenonx.overlaps_primary_numeric_lineage,true);
assert.equal(raenonx.may_count_as_independent_crosscheck,false);
assert.equal(raenonx.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(raenonx.admission_reason,'OVERLAPPING_PRIMARY_NUMERIC_LINEAGE_CANNOT_BE_INDEPENDENT');
assert.ok(raenonx.evidence_refs.some(ref=>ref.includes('63b0a17e2e92fc9e5d4be03c695e5896be8a0f25')),'Shelgon ing% RaenonX lineage evidence missing');
assert.ok(raenonx.evidence_refs.some(ref=>ref.includes('6f366273d0ecf231f0adaa0a3861025c24000b81')),'Pumpkaboo/Gourgeist RaenonX lineage evidence missing');
assert.ok(raenonx.evidence_refs.some(ref=>ref.includes('fc36317b195125c63bf56d3777fa3ed1a9548831')),'pinned Neroli credits evidence missing');

const wiki=byId.get('POKEMON_SLEEP_VERIFICATION_WIKI');
assert.ok(wiki);
assert.equal(wiki.lineage_class,SOURCE_LINEAGE_CLASS.DOWNSTREAM_TRANSCRIPTION_OF_OVERLAPPING_LINEAGE);
assert.equal(wiki.overlaps_primary_numeric_lineage,true);
assert.equal(wiki.may_count_as_independent_crosscheck,false);
assert.equal(wiki.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.ok(wiki.evidence_refs.some(ref=>ref.includes('TRANSCRIBE_VALUES_FROM_RAENONX')),'Wiki transcription evidence missing');

const sleepApi=byId.get('SLEEPAPI_GITHUB_FORK');
if(sleepApi){
  assert.equal(sleepApi.lineage_class,SOURCE_LINEAGE_CLASS.FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE);
  assert.equal(sleepApi.mirror_of_neroli_primary,true);
  assert.equal(sleepApi.may_count_as_independent_crosscheck,false);
  assert.equal(sleepApi.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
  assert.equal(sleepApi.admission_reason,'PRIMARY_LINEAGE_OR_MIRROR_CANNOT_BE_INDEPENDENT');
}

const admission=currentIndependentIngredientProbabilitySourceAdmissionContract();
assert.equal(admission.schema,'pokemon-sleep-ingredient-probability-independent-source-admission/1.0');
assert.equal(admission.safety.upstream_primary_supplier_counts_as_independent,false);
assert.equal(admission.safety.downstream_transcription_counts_as_independent,false);
const overlapFixture=evaluateIndependentIngredientProbabilitySourceAdmission({source_id:'overlap-fixture',overlaps_primary_numeric_lineage:true});
assert.equal(overlapFixture.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(overlapFixture.may_count_as_independent_crosscheck,false);

const predecessor=currentIngredientProbabilityIndependentSourceReadiness();
assert.equal(predecessor.accepted_source_count,0);
assert.ok([
  'HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE',
  'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT',
].includes(predecessor.status),'E3C-5 predecessor readiness must remain HOLD while accepted independent source count is zero');
assert.ok(INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEWS.length>=2);

const roster=currentPublicSpeciesFormRoster();
assert.equal(roster.row_count,242);
assert.equal(roster.activation_coverage_denominator_ready,true);
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

for(const file of ['assets/js/ingredient-probability-independent-source-lineage-review.js','assets/js/ingredient-probability-independent-source-admission.js','assets/js/ingredient-probability-independent-source-readiness.js']){
  const source=read(file);
  for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden runtime/write path: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C5_SOURCE_LINEAGE_REVIEW',
  reviewed_candidates:review.reviewed_candidate_count,
  rejected_candidates:review.rejected_candidate_count,
  accepted_independent_sources:review.accepted_independent_source_count,
  successor_hold_reason_refinement_supported:true,
  raenonx_lineage:raenonx.lineage_class,
  verification_wiki_lineage:wiki.lineage_class,
  sleepapi_lineage:sleepApi?.lineage_class||'PREDECESSOR_NOT_PRESENT',
  source_status:review.status,
  public_roster_count:roster.row_count,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
},null,2));
