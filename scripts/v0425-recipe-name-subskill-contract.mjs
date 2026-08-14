import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_RECIPE_MASTER as PREVIOUS_RECIPE_MASTER,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_INGREDIENT_IDENTITY_VERSION,
  PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT,
} from '../assets/js/public-recipe-current-authority.js';
import {PUBLIC_RECIPE_ZH_TW_NAME_AUDIT} from '../assets/js/public-recipe-name-audit-v0425.js';
import {isRecipeAutomaticIdentityMatch,recipeAliasesForCanonical} from '../assets/js/public-recipe-alias-master.js';
import {PUBLIC_INGREDIENT_IDENTITY_VERSION,PUBLIC_INGREDIENT_LEGACY_ALIASES} from '../assets/js/public-ingredient-identity.js';
import {
  SUBSKILL_NUMERIC_MODIFIER_VERSION,
  SUBSKILL_HELP_SPEED_REDUCTION_CAP,
  resolvePokemonProductionModifierProfile,
} from '../assets/js/pokemon-master-options.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');
assert.equal(PUBLIC_RECIPE_INGREDIENT_IDENTITY_VERSION,`recipe-ingredient-identity@${PUBLIC_INGREDIENT_IDENTITY_VERSION}`);
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.length,38);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.migration_baseline_current_authority_count,0);
assert.equal(PUBLIC_RECIPE_MASTER.filter(row=>row.source_type==='migration_baseline').length,0);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.formulas_mutated,false);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.player_rows_mutated,false);

const previousById=new Map(PREVIOUS_RECIPE_MASTER.map(row=>[String(row.recipe_id),row]));
const currentById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[String(row.recipe_id),row]));
const canonicalIngredientName=name=>PUBLIC_INGREDIENT_LEGACY_ALIASES[String(name)]||String(name);
const canonicalIngredientRows=recipe=>(recipe.ingredients||[]).map(row=>({...row,ingredient_name:canonicalIngredientName(row.ingredient_name)}));
let renamedCount=0,ingredientIdentityNormalizedCount=0;
for(const [id,current] of currentById){
  const previous=previousById.get(id);assert.ok(previous,`previous recipe missing: ${id}`);
  assert.equal(current.base_energy,previous.base_energy,`base energy changed: ${id}`);
  assert.equal(current.total_ingredients,previous.total_ingredients,`ingredient total changed: ${id}`);
  assert.deepEqual(current.ingredients,canonicalIngredientRows(previous),`formula changed outside reviewed ingredient identity normalization: ${id}`);
  if(current.recipe_name!==previous.recipe_name)renamedCount+=1;
  ingredientIdentityNormalizedCount+=Number(current.ingredient_identity_canonicalized_count||0);
}
assert.equal(renamedCount,18,'v0.4.25 audit should correct exactly the verified stale display names');
assert.equal(ingredientIdentityNormalizedCount,4,'current Recipe authority should canonicalize exactly four historical avocado relation labels');
assert.equal(PUBLIC_RECIPE_MASTER.some(row=>(row.ingredients||[]).some(item=>item.ingredient_name==='特選酪梨')),false);

const spicy=currentById.get('curry_spicy_leek'),spicyPrevious=previousById.get('curry_spicy_leek');
assert.equal(spicy.recipe_name,'辣味蔥勁十足咖哩');
assert.deepEqual(Object.fromEntries(spicy.ingredients.map(row=>[row.ingredient_name,row.quantity])),{'粗枝大蔥':14,'暖暖薑':10,'火辣香草':8});
assert.ok(PUBLIC_RECIPE_ALIASES.some(row=>row.recipe_id==='curry_spicy_leek'&&row.alias_value==='微辣蔥咖哩'&&row.is_auto_replace_safe===true));
assert.ok(recipeAliasesForCanonical('curry_spicy_leek',spicyPrevious.recipe_name).includes('辣味蔥勁十足咖哩'),'old recognition snapshot must accept current in-game name');
assert.equal(isRecipeAutomaticIdentityMatch('辣味蔥勁十足咖哩',spicyPrevious),true);

const subskillProfile=resolvePokemonProductionModifierProfile({
  nature:'勤奮',
  unlocked_subskills:[
    {unlock_level:10,subskill_name:'幫手獎勵'},
    {unlock_level:25,subskill_name:'幫忙速度S'},
    {unlock_level:50,subskill_name:'幫忙速度M'},
    {unlock_level:75,subskill_name:'食材機率提升S'},
    {unlock_level:100,subskill_name:'技能機率提升M'},
  ],
});
const modifier=name=>subskillProfile.modifiers.find(row=>row.source_name===name);
assert.equal(subskillProfile.schema,'pokemon-sleep-production-modifier-profile/1.2');
assert.equal(subskillProfile.subskill_numeric_registry_version,SUBSKILL_NUMERIC_MODIFIER_VERSION);
assert.equal(subskillProfile.numeric_activation,false);
assert.equal(modifier('幫手獎勵').scope,'TEAM');
assert.equal(modifier('幫手獎勵').reduction,0.05);
assert.equal(modifier('幫忙速度S').reduction,0.07);
assert.equal(modifier('幫忙速度M').reduction,0.14);
assert.equal(modifier('幫忙速度M').stack_cap,SUBSKILL_HELP_SPEED_REDUCTION_CAP);
assert.equal(modifier('食材機率提升S').multiplier,1.18);
assert.equal(modifier('技能機率提升M').multiplier,1.36);
for(const name of ['幫手獎勵','幫忙速度S','幫忙速度M','食材機率提升S','技能機率提升M'])assert.equal(modifier(name).numeric_status,'ACTIVE_VERIFIED');

const berryDelegated=resolvePokemonProductionModifierProfile({nature:'勤奮',unlocked_subskills:[{unlock_level:10,subskill_name:'樹果數量S'}]});
assert.equal(berryDelegated.modifiers[0].numeric_status,'ACTIVE_VERIFIED_DELEGATED');
const mismatch=resolvePokemonProductionModifierProfile({nature:'固執',nature_bonus:'食材機率',nature_penalty:'食材機率',unlocked_subskills:[]});
assert.equal(mismatch.status,'REVIEW_REQUIRED');
assert.equal(mismatch.nature_reconciliation.status,'REVIEW_REQUIRED');
assert.equal(mismatch.nature_reconciliation.auto_rewrite_player_observation,false);

const registry=currentProductionAuthorityRegistry();
const baseNumeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const active=baseNumeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
const slotSuccessor=registry.rules.ingredient_slot_distribution?.status==='ACTIVE_VERIFIED';
if(slotSuccessor){assert.equal(registry.rules.ingredient_slot_distribution.rule_version,'ingredient-slot-distribution-v1');assert.equal(registry.rules.ingredient_slot_distribution.runtime_numeric_activation,true);}
assert.deepEqual(active,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier',...(slotSuccessor?['ingredient_slot_distribution']:[])],'Recipe/Subskill authority must not promote Production dimensions; only exact E3B slot successor is allowed');
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.main_skill_trigger_probability.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.main_skill_effect_value.status,'NOT_YET_VERIFIED');
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const displayEvidenceSource=fs.readFileSync('assets/js/recipe-display-name-evidence.js','utf8');
assert.match(displayEvidenceSource,/recipe_display_name_evidence/);
assert.match(displayEvidenceSource,/USER_CONFIRMED_MATCH/);
assert.match(displayEvidenceSource,/canonical_resolution_log/);
assert.doesNotMatch(displayEvidenceSource,/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+recipe_master\b/i);
assert.doesNotMatch(displayEvidenceSource,/UPDATE\s+recipe_master\b/i);
const catalogSource=fs.readFileSync('assets/js/public-catalog-workbench.js','utf8');
assert.match(catalogSource,/applyConfirmedRecipeDisplayNames/);
const syncSource=fs.readFileSync('assets/js/public-recipe-master-sync.js','utf8');
assert.match(syncSource,/public-recipe-current-authority\.js/);
assert.match(syncSource,/player_rows_modified:false/);

console.log(JSON.stringify({
  status:'PASS',gate:'V0425_RECIPE_NAME_SUBSKILL_SUCCESSOR_INGREDIENT_IDENTITY',recipe_count:78,audited_migration_baseline_count:38,
  corrected_name_count:renamedCount,spicy_leek_name:spicy.recipe_name,formula_mutated:false,
  ingredient_identity_version:PUBLIC_RECIPE_INGREDIENT_IDENTITY_VERSION,ingredient_identity_normalized_count:ingredientIdentityNormalizedCount,
  historical_formula_quantities_preserved:true,migration_baseline_current_authority_count:0,user_confirmed_display_evidence_local_only:true,
  subskill_numeric_registry_version:SUBSKILL_NUMERIC_MODIFIER_VERSION,helping_bonus_reduction:0.05,
  helping_speed_reductions:[0.07,0.14],subskill_help_speed_cap:SUBSKILL_HELP_SPEED_REDUCTION_CAP,
  ingredient_finder_s_multiplier:1.18,skill_trigger_m_multiplier:1.36,
  base_numeric_dimensions_active:`${active.length}/7`,ingredient_slot_successor:slotSuccessor,overall_numeric_model_status:registry.numeric_rate_model_status,
  nature_mismatch_auto_rewrite:false,sqlite_player_public_master_overwrite:false,
},null,2));