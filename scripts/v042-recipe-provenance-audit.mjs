import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-current-authority.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_UPCOMING_EVIDENCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  REVIEWED_RECIPE_MASTER_VERSION,
  recipeProvenanceCoverage,
} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(PUBLIC_RECIPE_MASTER_VERSION===REVIEWED_RECIPE_MASTER_VERSION,`provenance_stale_master_version:${PUBLIC_RECIPE_MASTER_VERSION}:${REVIEWED_RECIPE_MASTER_VERSION}`);
assert(PUBLIC_RECIPE_MASTER.length===78,`reviewed_active_recipe_count_unexpected:${PUBLIC_RECIPE_MASTER.length}`);
assert(PUBLIC_RECIPE_PROVENANCE.length===78,'active_provenance_count_mismatch');

const expectedNameEvidenceBySourceType={
  current_reference_crosscheck:'CURRENT_REFERENCE_CROSSCHECK',
  game_screenshot_verified:'GAME_SCREENSHOT_VERIFIED',
  game_screenshot_reference_crosscheck:'GAME_SCREENSHOT_REFERENCE_CROSSCHECK',
};
const masterById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const provenanceIds=new Set(),activeNameEvidence={},activeFormulaEvidence={},sourceTypeCounts={};
const correctedFormulaIds=[],activatedRecipeIds=[];
for(const row of PUBLIC_RECIPE_PROVENANCE){
  assert(!provenanceIds.has(row.recipe_id),`duplicate_provenance:${row.recipe_id}`);provenanceIds.add(row.recipe_id);
  const master=masterById.get(row.recipe_id);assert(master,`provenance_without_master:${row.recipe_id}`);
  assert(row.recipe_name_zh_tw===master.recipe_name,`provenance_name_drift:${row.recipe_id}`);
  assert(row.category===master.category,`provenance_category_drift:${row.recipe_id}`);
  assert(row.lifecycle==='ACTIVE',`active_master_nonactive_lifecycle:${row.recipe_id}:${row.lifecycle}`);
  const expectedEvidence=expectedNameEvidenceBySourceType[master.source_type];
  assert(expectedEvidence,`unexpected_current_name_source_type:${row.recipe_id}:${master.source_type}`);
  assert(row.name_evidence===expectedEvidence,`name_evidence_source_mismatch:${row.recipe_id}:${row.name_evidence}:${expectedEvidence}`);
  assert(row.name_source_type===master.source_type,`name_source_type_drift:${row.recipe_id}`);
  assert(row.name_source_name===master.source_name,`name_source_name_drift:${row.recipe_id}`);
  assert(row.name_source_ref===master.source_ref,`name_source_ref_drift:${row.recipe_id}`);
  assert(row.name_observed_at===master.verified_at,`name_verified_at_drift:${row.recipe_id}`);
  assert(row.name_source_ref&&row.name_observed_at,`current_name_provenance_incomplete:${row.recipe_id}`);
  activeNameEvidence[row.name_evidence]=(activeNameEvidence[row.name_evidence]||0)+1;
  activeFormulaEvidence[row.formula_evidence]=(activeFormulaEvidence[row.formula_evidence]||0)+1;
  sourceTypeCounts[master.source_type]=(sourceTypeCounts[master.source_type]||0)+1;

  if(master.activation_contract_version){
    assert(['curry_greengrass_bun','curry_bounce_udon'].includes(row.recipe_id),`unexpected_activation_recipe:${row.recipe_id}`);
    assert(row.name_evidence==='GAME_SCREENSHOT_REFERENCE_CROSSCHECK',`activation_name_evidence_drift:${row.recipe_id}`);
    assert(row.name_source_ref==='internal:v04132-recipe-activation-evidence+#172',`activation_name_source_drift:${row.recipe_id}`);
    assert(row.name_observed_at==='2026-08-12',`activation_name_date_drift:${row.recipe_id}`);
    assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',`activation_formula_evidence_drift:${row.recipe_id}`);
    assert(row.formula_source_ref==='internal:v04132-recipe-activation-evidence+#172',`activation_formula_source_drift:${row.recipe_id}`);
    assert(row.formula_verified_at==='2026-08-12',`activation_formula_date_drift:${row.recipe_id}`);
    activatedRecipeIds.push(row.recipe_id);
  }else if(row.recipe_id==='curry_parent_child'){
    assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',`parent_child_formula_not_corrected_crosscheck:${row.formula_evidence}`);
    assert(row.formula_source_ref==='internal:v04221-parent-child-current-game-formula-evidence+reference-crosscheck','parent_child_formula_source_drift');
    assert(row.formula_verified_at==='2026-08-13','parent_child_formula_date_drift');
    correctedFormulaIds.push(row.recipe_id);
  }else{
    assert(row.formula_evidence==='REFERENCE_VERIFIED',`unexpected_historical_formula_evidence:${row.recipe_id}:${row.formula_evidence}`);
    assert(row.formula_source_ref==='https://www.serebii.net/pokemonsleep/dishes.shtml',`unexpected_formula_source:${row.recipe_id}`);
    assert(row.formula_verified_at==='2026-08-13',`audited_formula_review_date_missing:${row.recipe_id}`);
  }
  assert(row.provenance_version===PUBLIC_RECIPE_PROVENANCE_VERSION,'provenance_version_mismatch');
  assert(row.reviewed_recipe_master_version===PUBLIC_RECIPE_MASTER_VERSION,'reviewed_master_version_mismatch');
}
for(const recipe of PUBLIC_RECIPE_MASTER)assert(provenanceIds.has(recipe.recipe_id),`master_without_provenance:${recipe.recipe_id}`);

assert(sourceTypeCounts.current_reference_crosscheck===40,`current_reference_name_count:${JSON.stringify(sourceTypeCounts)}`);
assert(sourceTypeCounts.game_screenshot_verified===35,`game_screenshot_name_count:${JSON.stringify(sourceTypeCounts)}`);
assert(sourceTypeCounts.game_screenshot_reference_crosscheck===3,`game_screenshot_crosscheck_name_count:${JSON.stringify(sourceTypeCounts)}`);
assert(activeNameEvidence.CURRENT_REFERENCE_CROSSCHECK===40,`current_reference_evidence_count:${JSON.stringify(activeNameEvidence)}`);
assert(activeNameEvidence.GAME_SCREENSHOT_VERIFIED===35,`screenshot_evidence_count:${JSON.stringify(activeNameEvidence)}`);
assert(activeNameEvidence.GAME_SCREENSHOT_REFERENCE_CROSSCHECK===3,`screenshot_crosscheck_evidence_count:${JSON.stringify(activeNameEvidence)}`);
assert((activeNameEvidence.CURRENT_AUTHORITY_OTHER||0)===0,`unclassified_current_name_evidence:${JSON.stringify(activeNameEvidence)}`);
assert(activeFormulaEvidence.REFERENCE_VERIFIED===75,`reference_formula_count:${JSON.stringify(activeFormulaEvidence)}`);
assert((activeFormulaEvidence.GAME_SCREENSHOT_VERIFIED||0)===0,`stale_screenshot_only_formula_authority:${JSON.stringify(activeFormulaEvidence)}`);
assert(activeFormulaEvidence.GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK===3,`crosschecked_formula_count:${JSON.stringify(activeFormulaEvidence)}`);
assert(JSON.stringify(correctedFormulaIds)===JSON.stringify(['curry_parent_child']),'parent-child corrected formula provenance missing');
assert(new Set(activatedRecipeIds).size===2,'activation pair provenance must remain atomic');
assert(new Set(activatedRecipeIds).has('curry_greengrass_bun')&&new Set(activatedRecipeIds).has('curry_bounce_udon'),'activation pair IDs drifted');

assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,`upcoming_evidence_count:${PUBLIC_RECIPE_UPCOMING_EVIDENCE.length}`);
const upcomingNames=new Set();
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
  assert(!upcomingNames.has(row.external_name),`duplicate_upcoming:${row.external_name}`);upcomingNames.add(row.external_name);
  assert(row.ingredients.reduce((sum,item)=>sum+Number(item.quantity||0),0)>0,`upcoming_empty_formula:${row.external_name}`);
  assert(row.activation_check_not_before==='2026-08-10',`unexpected_activation_check_date:${row.external_name}`);
  assert(row.lifecycle==='PROMOTED_TO_CANONICAL',`promoted_evidence_lifecycle:${row.external_name}`);
  assert(row.canonical_name_zh_tw,`promoted_missing_zh_tw_name:${row.external_name}`);
  assert(row.canonical_recipe_id&&masterById.has(row.canonical_recipe_id),`promoted_missing_canonical_recipe:${row.external_name}`);
  assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',`promoted_formula_status:${row.external_name}`);
  assert(row.effective_from==='2026-08-10',`promoted_effective_date:${row.external_name}`);
  assert(row.activation_status==='PROMOTED_ACTIVE_2026_08_12',`promoted_status:${row.external_name}`);
}
assert(upcomingNames.has('Greengrass Curry Bun'),'missing_greengrass_curry_bun_evidence');
assert(upcomingNames.has('Bounce Curry Udon'),'missing_bounce_curry_udon_evidence');

const coverage=recipeProvenanceCoverage();
assert(coverage.active_recipe_count===78,'coverage_active_count_mismatch');
assert(coverage.upcoming_evidence_count===0,'coverage_upcoming_count_mismatch');
assert(coverage.promoted_historical_evidence_count===2,'coverage_promoted_count_mismatch');
assert(coverage.lifecycle.ACTIVE===78,'coverage_active_lifecycle_mismatch');
assert(coverage.lifecycle.PROMOTED_TO_CANONICAL===2,'coverage_promoted_lifecycle_mismatch');
assert(coverage.name_evidence.CURRENT_REFERENCE_CROSSCHECK===40,'coverage_current_reference_name_evidence_mismatch');
assert(coverage.name_evidence.GAME_SCREENSHOT_VERIFIED===35,'coverage_screenshot_name_evidence_mismatch');
assert(coverage.name_evidence.GAME_SCREENSHOT_REFERENCE_CROSSCHECK===3,'coverage_screenshot_crosscheck_name_evidence_mismatch');
assert((coverage.name_evidence.CURRENT_AUTHORITY_OTHER||0)===0,'coverage_unclassified_name_evidence_remained');
assert(coverage.formula_evidence.REFERENCE_VERIFIED===75,'coverage_reference_formula_evidence_mismatch');
assert((coverage.formula_evidence.GAME_SCREENSHOT_VERIFIED||0)===0,'coverage_stale_screenshot_only_formula_evidence_remained');
assert(coverage.formula_evidence.GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK===5,'coverage_crosscheck_evidence_count_mismatch');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-recipe-provenance-audit/1.5-current-78-name-authority',
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,
  current_name_source_type_counts:sourceTypeCounts,
  active_name_evidence:activeNameEvidence,
  active_formula_evidence:activeFormulaEvidence,
  corrected_formula_ids:correctedFormulaIds,
  activated_recipe_ids:activatedRecipeIds,
  pending_evidence_count:coverage.upcoming_evidence_count,
  promoted_historical_evidence_count:coverage.promoted_historical_evidence_count,
  current_name_provenance_complete:true,
  player_data_read:false,
  player_data_write:false,
},null,2));
