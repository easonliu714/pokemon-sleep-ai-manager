import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-master.js';
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
for(const row of PUBLIC_RECIPE_PROVENANCE){
  assert(!provenanceIds.has(row.recipe_id),`duplicate_provenance:${row.recipe_id}`);
  provenanceIds.add(row.recipe_id);
  const master=masterById.get(row.recipe_id);
  assert(master,`provenance_without_master:${row.recipe_id}`);
  assert(row.recipe_name_zh_tw===master.recipe_name,`provenance_name_drift:${row.recipe_id}`);
  assert(row.category===master.category,`provenance_category_drift:${row.recipe_id}`);
  assert(row.lifecycle==='ACTIVE',`active_master_nonactive_lifecycle:${row.recipe_id}:${row.lifecycle}`);
  assert(row.name_evidence==='SANITIZED_USER_REFERENCE',`unexpected_name_evidence:${row.recipe_id}`);
  assert(row.formula_evidence==='REFERENCE_VERIFIED',`unverified_active_formula:${row.recipe_id}`);
  assert(row.name_source_ref,'missing_name_source_ref');
  assert(row.formula_source_ref==='https://www.serebii.net/pokemonsleep/dishes.shtml',`unexpected_formula_source:${row.recipe_id}`);
  assert(row.formula_verified_at==='2026-08-09',`formula_review_date_missing:${row.recipe_id}`);
  assert(row.provenance_version===PUBLIC_RECIPE_PROVENANCE_VERSION,'provenance_version_mismatch');
}
for(const recipe of PUBLIC_RECIPE_MASTER){
  assert(provenanceIds.has(recipe.recipe_id),`master_without_provenance:${recipe.recipe_id}`);
}

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

// Upcoming rows must remain outside the current runtime master and therefore
// cannot enter SQLite, Ingredient Gap or War Room candidate generation today.
const activeNames=new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_name));
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
  assert(!activeNames.has(row.external_name),`upcoming_leaked_into_active_master:${row.external_name}`);
}

const coverage=recipeProvenanceCoverage();
assert(coverage.active_recipe_count===76,'coverage_active_count_mismatch');
assert(coverage.upcoming_evidence_count===2,'coverage_upcoming_count_mismatch');
assert(coverage.lifecycle.ACTIVE===76,'coverage_active_lifecycle_mismatch');
assert(coverage.lifecycle.UPCOMING_REFERENCE_DISCOVERED===2,'coverage_upcoming_lifecycle_mismatch');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-recipe-provenance-audit/1.0',
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
  active_recipe_count:76,
  active_name_evidence:{SANITIZED_USER_REFERENCE:76},
  active_formula_evidence:{REFERENCE_VERIFIED:76},
  upcoming_evidence_count:2,
  upcoming_external_names:[...upcomingNames],
  upcoming_in_active_runtime:false,
  guessed_zh_tw_names:0,
  guessed_effective_dates:0,
  player_data_read:false,
  player_data_write:false,
},null,2));
