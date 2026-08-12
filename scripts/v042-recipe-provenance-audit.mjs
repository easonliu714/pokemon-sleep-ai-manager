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
assert([76,78].includes(PUBLIC_RECIPE_MASTER.length),`reviewed_active_recipe_count_unexpected:${PUBLIC_RECIPE_MASTER.length}`);
assert(PUBLIC_RECIPE_PROVENANCE.length===PUBLIC_RECIPE_MASTER.length,'active_provenance_count_mismatch');
const activationActive=PUBLIC_RECIPE_MASTER.length===78;

const masterById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const provenanceIds=new Set();
const activeNameEvidence={};
const activeFormulaEvidence={};
const historicalScreenshotNameIds=[];
const currentScreenshotNameIds=[];
const currentScreenshotFormulaIds=[];
const activatedRecipeIds=[];
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

  if(master.activation_contract_version){
    assert(activationActive,'activation provenance present before canonical activation');
    assert(['curry_greengrass_bun','curry_bounce_udon'].includes(row.recipe_id),`unexpected_activation_recipe:${row.recipe_id}`);
    assert(row.name_evidence==='GAME_SCREENSHOT_VERIFIED',`activation_name_not_screenshot_verified:${row.recipe_id}`);
    assert(row.name_source_ref==='internal:v04132-recipe-activation-evidence+#172',`activation_name_source_drift:${row.recipe_id}`);
    assert(row.name_observed_at==='2026-08-12',`activation_name_date_drift:${row.recipe_id}`);
    assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',`activation_formula_evidence_drift:${row.recipe_id}`);
    assert(row.formula_source_ref==='internal:v04132-recipe-activation-evidence+#172',`activation_formula_source_drift:${row.recipe_id}`);
    assert(row.formula_verified_at==='2026-08-12',`activation_formula_date_drift:${row.recipe_id}`);
    activatedRecipeIds.push(row.recipe_id);
  }else{
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
      assert(row.formula_evidence==='REFERENCE_VERIFIED',`unexpected_historical_formula_evidence:${row.recipe_id}:${row.formula_evidence}`);
      assert(row.formula_source_ref==='https://www.serebii.net/pokemonsleep/dishes.shtml',`unexpected_formula_source:${row.recipe_id}`);
      assert(row.formula_verified_at==='2026-08-09',`formula_review_date_missing:${row.recipe_id}`);
    }
  }
  assert(row.name_source_ref,'missing_name_source_ref');
  assert(row.provenance_version===PUBLIC_RECIPE_PROVENANCE_VERSION,'provenance_version_mismatch');
}
for(const recipe of PUBLIC_RECIPE_MASTER)assert(provenanceIds.has(recipe.recipe_id),`master_without_provenance:${recipe.recipe_id}`);

assert(historicalScreenshotNameIds.length===33,`expected_original_33_screenshot_names:${historicalScreenshotNameIds.length}`);
assert(JSON.stringify(currentScreenshotNameIds)===JSON.stringify(['curry_dizzy_punch']),'only current-game dizzy-punch name may extend the historical 33-name baseline before Aug-12 activation');
assert(JSON.stringify(currentScreenshotFormulaIds)===JSON.stringify(['curry_parent_child']),'only current-game parent-child formula may supersede the historical reference formula');
assert(activeNameEvidence.GAME_SCREENSHOT_VERIFIED===(activationActive?36:34),`screenshot_verified_name_count:${JSON.stringify(activeNameEvidence)}`);
assert(activeNameEvidence.SANITIZED_USER_REFERENCE===42,`historical_name_count:${JSON.stringify(activeNameEvidence)}`);
assert(activeFormulaEvidence.REFERENCE_VERIFIED===75,`reference_formula_count:${JSON.stringify(activeFormulaEvidence)}`);
assert(activeFormulaEvidence.GAME_SCREENSHOT_VERIFIED===1,`screenshot_formula_count:${JSON.stringify(activeFormulaEvidence)}`);
assert((activeFormulaEvidence.GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK||0)===(activationActive?2:0),`activation_formula_count:${JSON.stringify(activeFormulaEvidence)}`);
assert(new Set(activatedRecipeIds).size===(activationActive?2:0),'activation pair provenance must transition atomically');
if(activationActive)assert(new Set(activatedRecipeIds).has('curry_greengrass_bun')&&new Set(activatedRecipeIds).has('curry_bounce_udon'),'activation pair IDs drifted');

assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,`upcoming_evidence_count:${PUBLIC_RECIPE_UPCOMING_EVIDENCE.length}`);
const upcomingNames=new Set();
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
  assert(!upcomingNames.has(row.external_name),`duplicate_upcoming:${row.external_name}`);upcomingNames.add(row.external_name);
  const ingredientTotal=row.ingredients.reduce((sum,item)=>sum+Number(item.quantity||0),0);assert(ingredientTotal>0,`upcoming_empty_formula:${row.external_name}`);
  assert(row.activation_check_not_before==='2026-08-10',`unexpected_activation_check_date:${row.external_name}`);
  if(activationActive){
    assert(row.lifecycle==='PROMOTED_TO_CANONICAL',`promoted_evidence_lifecycle:${row.external_name}`);
    assert(row.canonical_name_zh_tw,`promoted_missing_zh_tw_name:${row.external_name}`);
    assert(row.canonical_recipe_id&&masterById.has(row.canonical_recipe_id),`promoted_missing_canonical_recipe:${row.external_name}`);
    assert(row.formula_evidence==='GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',`promoted_formula_status:${row.external_name}`);
    assert(row.effective_from==='2026-08-10',`promoted_effective_date:${row.external_name}`);
    assert(row.activation_status==='PROMOTED_ACTIVE_2026_08_12',`promoted_status:${row.external_name}`);
  }else{
    assert(!row.canonical_name_zh_tw,'pending_has_unverified_zh_tw_canonical_name');
    assert(row.lifecycle==='UPCOMING_REFERENCE_DISCOVERED',`unexpected_pending_lifecycle:${row.external_name}`);
    assert(row.formula_evidence==='REFERENCE_VERIFIED_PRE_RELEASE',`unexpected_pending_formula_status:${row.external_name}`);
    assert(row.effective_from===null,`pending_effective_date_was_guessed:${row.external_name}`);
    assert(row.activation_status==='BLOCKED_PENDING_ZH_TW_NAME_AND_LIVE_EFFECTIVE_VERIFICATION',`pending_not_blocked:${row.external_name}`);
  }
}
assert(upcomingNames.has('Greengrass Curry Bun'),'missing_greengrass_curry_bun_evidence');
assert(upcomingNames.has('Bounce Curry Udon'),'missing_bounce_curry_udon_evidence');

const coverage=recipeProvenanceCoverage();
assert(coverage.active_recipe_count===PUBLIC_RECIPE_MASTER.length,'coverage_active_count_mismatch');
assert(coverage.upcoming_evidence_count===(activationActive?0:2),'coverage_upcoming_count_mismatch');
assert(coverage.promoted_historical_evidence_count===(activationActive?2:0),'coverage_promoted_count_mismatch');
assert(coverage.lifecycle.ACTIVE===PUBLIC_RECIPE_MASTER.length,'coverage_active_lifecycle_mismatch');
if(activationActive)assert(coverage.lifecycle.PROMOTED_TO_CANONICAL===2,'coverage_promoted_lifecycle_mismatch');
else assert(coverage.lifecycle.UPCOMING_REFERENCE_DISCOVERED===2,'coverage_upcoming_lifecycle_mismatch');
assert(coverage.name_evidence.GAME_SCREENSHOT_VERIFIED===(activationActive?36:34),'coverage_screenshot_name_evidence_mismatch');
assert(coverage.name_evidence.SANITIZED_USER_REFERENCE===42,'coverage_historical_name_evidence_mismatch');
assert(coverage.formula_evidence.REFERENCE_VERIFIED===75,'coverage_reference_formula_evidence_mismatch');
assert(coverage.formula_evidence.GAME_SCREENSHOT_VERIFIED===1,'coverage_screenshot_formula_evidence_mismatch');
if(activationActive)assert(coverage.formula_evidence.GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK===4,'coverage activation evidence includes 2 ACTIVE + 2 retained historical rows');

console.log(JSON.stringify({
  status:'PASS',schema:'pokemon-sleep-recipe-provenance-audit/1.3-activation-successor-aware',
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,activation_active:activationActive,
  active_name_evidence:activeNameEvidence,active_formula_evidence:activeFormulaEvidence,
  original_screenshot_name_count:historicalScreenshotNameIds.length,current_screenshot_name_ids:currentScreenshotNameIds,current_screenshot_formula_ids:currentScreenshotFormulaIds,
  activated_recipe_ids:activatedRecipeIds,evidence_audit_rows:PUBLIC_RECIPE_UPCOMING_EVIDENCE.length,
  pending_evidence_count:coverage.upcoming_evidence_count,promoted_historical_evidence_count:coverage.promoted_historical_evidence_count,
  historical_76_provenance_preserved:true,player_data_read:false,player_data_write:false,
},null,2));