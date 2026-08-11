import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_UPCOMING_EVIDENCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  REVIEWED_RECIPE_MASTER_VERSION,
  recipeProvenanceCoverage,
} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};

assert(PUBLIC_RECIPE_MASTER_VERSION===REVIEWED_RECIPE_MASTER_VERSION,
  `provenance_stale_master_version:${PUBLIC_RECIPE_MASTER_VERSION}:${REVIEWED_RECIPE_MASTER_VERSION}`);
assert(PUBLIC_RECIPE_MASTER.length===76,`reviewed_active_recipe_count_changed:${PUBLIC_RECIPE_MASTER.length}`);
assert(PUBLIC_RECIPE_PROVENANCE.length===PUBLIC_RECIPE_MASTER.length,'active_provenance_count_mismatch');

const masterById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const provenanceIds=new Set();
const activeNameEvidence={};
const activeFormulaEvidence={};
const historicalScreenshotNameIds=[];
const currentScreenshotNameIds=[];
const currentScreenshotFormulaIds=[];
for(const row of PUBLIC_RECIPE_PROVENANCE){
  assert(!provenanceIds.has(row.recipe_id),`duplicate_provenance:${row.recipe_id}`);
  provenanceIds.add(row.recipe_id);
  const master=masterById.get(row.recipe_id);
  assert(master,`provenance_without_master:${row.recipe_id}`);
  assert(row.recipe_name_zh_tw===master.recipe_name,`provenance_name_drift:${row.recipe_id}`);
  assert(row.category===master.category,`provenance_category_drift:${row.recipe_id}`);
  assert(row.lifecycle==='ACTIVE',`active_master_nonactive_lifecycle:${row.recipe_id}:${row.lifecycle}`);
  assert(['SANITIZED_USER_REFERENCE','GAME_SCREENSHOT_VERIFIED'].includes(row.name_evidence),`unexpected_name_evidence:${row.recipe_id}:${row.name_evidence}`);
  activeNameEvidence[row.name_evidence]=(activeNameEvidence[row.name_evidence]||0)+1;
  activeFormulaEvidence[row.formula_evidence]=(activeFormulaEvidence[row.formula_evidence]||0)+1;

  if(master.source_type==='game_screenshot_verified'){
    assert(row.name_evidence==='GAME_SCREENSHOT_VERIFIED',`screenshot_canonical_name_not_provenance_verified:${row.recipe_id}`);
    if(row.recipe_id==='curry_dizzy_punch'){
      assert(row.name_source_ref==='internal:v04114-android-live-current-recipe-name-evidence',`unexpected_current_screenshot_name_source:${row.recipe_id}`);
      assert(row.name_observed_at==='2026-08-11',`unexpected_current_screenshot_name_date:${row.recipe_id}`);
      currentScreenshotNameIds.push(row.recipe_id);
    }else{
      assert(row.name_source_ref==='internal:public-recipe-zh-tw-screenshot-evidence-2026-08-09',`unexpected_historical_screenshot_name_source:${row.recipe_id}`);
      assert(row.name_observed_at==='2026-08-09',`unexpected_historical_screenshot_name_date:${row.recipe_id}`);
      historicalScreenshotNameIds.push(row.recipe_id);
    }
  }

  if(row.recipe_id==='curry_parent_child'){
    assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED',`parent_child_formula_not_current_screenshot_verified:${row.formula_evidence}`);
    assert(row.formula_source_ref==='internal:v04114-android-live-current-recipe-formula-evidence','parent_child_formula_source_drift');
    assert(row.formula_verified_at==='2026-08-11','parent_child_formula_date_drift');
    currentScreenshotFormulaIds.push(row.recipe_id);
  }else{
    assert(row.formula_evidence==='REFERENCE_VERIFIED',`unexpected_non_parent_formula_evidence:${row.recipe_id}:${row.formula_evidence}`);
    assert(row.formula_source_ref==='https://www.serebii.net/pokemonsleep/dishes.shtml',`unexpected_formula_source:${row.recipe_id}`);
    assert(row.formula_verified_at==='2026-08-09',`formula_review_date_missing:${row.recipe_id}`);
  }
  assert(row.name_source_ref,'missing_name_source_ref');
  assert(row.provenance_version===PUBLIC_RECIPE_PROVENANCE_VERSION,'provenance_version_mismatch');
}
for(const recipe of PUBLIC_RECIPE_MASTER)assert(provenanceIds.has(recipe.recipe_id),`master_without_provenance:${recipe.recipe_id}`);

assert(historicalScreenshotNameIds.length===33,`expected_original_33_screenshot_names:${historicalScreenshotNameIds.length}`);
assert.deepEqual(currentScreenshotNameIds,['curry_dizzy_punch'],'only current-game dizzy-punch name may extend the historical 33-name baseline');
assert.deepEqual(currentScreenshotFormulaIds,['curry_parent_child'],'only current-game parent-child formula may supersede reference formula in this release');
assert(activeNameEvidence.GAME_SCREENSHOT_VERIFIED===34,`expected_34_screenshot_verified_names:${JSON.stringify(activeNameEvidence)}`);
assert(activeNameEvidence.SANITIZED_USER_REFERENCE===42,`expected_42_remaining_historical_names:${JSON.stringify(activeNameEvidence)}`);
assert(activeFormulaEvidence.REFERENCE_VERIFIED===75,`expected_75_reference_verified_formulas:${JSON.stringify(activeFormulaEvidence)}`);
assert(activeFormulaEvidence.GAME_SCREENSHOT_VERIFIED===1,`expected_1_screenshot_verified_formula:${JSON.stringify(activeFormulaEvidence)}`);

assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,`upcoming_evidence_count:${PUBLIC_RECIPE_UPCOMING_EVIDENCE.length}`);
const upcomingNames=new Set();
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
  assert(!row.canonical_name_zh_tw,'upcoming_has_unverified_zh_tw_canonical_name');
  assert(row.lifecycle==='UPCOMING_REFERENCE_DISCOVERED',`unexpected_upcoming_lifecycle:${row.external_name}`);
  assert(row.formula_evidence==='REFERENCE_VERIFIED_PRE_RELEASE',`unexpected_upcoming_formula_status:${row.external_name}`);
  assert(row.effective_from===null,`upcoming_effective_date_was_guessed:${row.external_name}`);
  assert(row.activation_check_not_before==='2026-08-10',`unexpected_activation_check_date:${row.external_name}`);
  assert(row.activation_status==='BLOCKED_PENDING_ZH_TW_NAME_AND_LIVE_EFFECTIVE_VERIFICATION',`upcoming_not_blocked:${row.external_name}`);
  assert(!upcomingNames.has(row.external_name),`duplicate_upcoming:${row.external_name}`);
  upcomingNames.add(row.external_name);
  const ingredientTotal=row.ingredients.reduce((sum,item)=>sum+Number(item.quantity||0),0);
  assert(ingredientTotal>0,`upcoming_empty_formula:${row.external_name}`);
}
assert(upcomingNames.has('Greengrass Curry Bun'),'missing_greengrass_curry_bun_upcoming');
assert(upcomingNames.has('Bounce Curry Udon'),'missing_bounce_curry_udon_upcoming');

const activeNames=new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_name));
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE)assert(!activeNames.has(row.external_name),`upcoming_leaked_into_active_master:${row.external_name}`);

const coverage=recipeProvenanceCoverage();
assert(coverage.active_recipe_count===76,'coverage_active_count_mismatch');
assert(coverage.upcoming_evidence_count===2,'coverage_upcoming_count_mismatch');
assert(coverage.lifecycle.ACTIVE===76,'coverage_active_lifecycle_mismatch');
assert(coverage.lifecycle.UPCOMING_REFERENCE_DISCOVERED===2,'coverage_upcoming_lifecycle_mismatch');
assert(coverage.name_evidence.GAME_SCREENSHOT_VERIFIED===34,'coverage_screenshot_name_evidence_mismatch');
assert(coverage.name_evidence.SANITIZED_USER_REFERENCE===42,'coverage_historical_name_evidence_mismatch');
assert(coverage.formula_evidence.REFERENCE_VERIFIED===75,'coverage_reference_formula_evidence_mismatch');
assert(coverage.formula_evidence.GAME_SCREENSHOT_VERIFIED===1,'coverage_screenshot_formula_evidence_mismatch');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-recipe-provenance-audit/1.2-successor-aware',
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
  active_recipe_count:76,
  active_name_evidence:activeNameEvidence,
  active_formula_evidence:activeFormulaEvidence,
  original_screenshot_name_count:historicalScreenshotNameIds.length,
  current_screenshot_name_ids:currentScreenshotNameIds,
  current_screenshot_formula_ids:currentScreenshotFormulaIds,
  upcoming_evidence_count:2,
  upcoming_external_names:[...upcomingNames],
  upcoming_in_active_runtime:false,
  guessed_zh_tw_names:0,
  guessed_effective_dates:0,
  player_data_read:false,
  player_data_write:false,
},null,2));