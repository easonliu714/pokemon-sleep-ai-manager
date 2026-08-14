import {resolvePokemonProductionModifierProfile} from './pokemon-master-options.js';
import {resolveReferenceSpeciesIngredientRate,SPECIES_INGREDIENT_RATE_REFERENCE_VERSION} from './public-species-ingredient-rate-reference.js';

export const INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION='ingredient-probability-reference-contract-2026-08-14-a';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const freezeResult=value=>Object.freeze(value);

export function composeIngredientProbabilityReference({base_probability,nature_multiplier=1,subskill_probability_multipliers=[]}={}){
  const base=finite(base_probability),nature=finite(nature_multiplier);
  if(base===null||base<0||base>1)return freezeResult({ok:false,reason:'BASE_PROBABILITY_INVALID',effective_probability:null,berry_result_probability:null});
  if(nature===null||nature<=0)return freezeResult({ok:false,reason:'NATURE_MULTIPLIER_INVALID',effective_probability:null,berry_result_probability:null});
  let subskillDelta=0;
  for(const value of subskill_probability_multipliers||[]){
    const multiplier=finite(value);
    if(multiplier===null||multiplier<1)return freezeResult({ok:false,reason:'SUBSKILL_MULTIPLIER_INVALID',effective_probability:null,berry_result_probability:null});
    subskillDelta+=multiplier-1;
  }
  const subskill_multiplier=1+subskillDelta;
  const effective=base*nature*subskill_multiplier;
  if(!Number.isFinite(effective)||effective<0||effective>1)return freezeResult({ok:false,reason:'EFFECTIVE_PROBABILITY_OUT_OF_RANGE',effective_probability:null,berry_result_probability:null,subskill_multiplier});
  return freezeResult({ok:true,reason:null,base_probability:base,nature_multiplier:nature,subskill_multiplier,effective_probability:effective,berry_result_probability:1-effective});
}

function ingredientNatureMultiplier(profile){
  const rows=profile?.modifiers||[];
  const row=rows.find(item=>item.source_type==='NATURE'&&item.dimension==='ingredient_probability_per_help');
  if(!row)return 1;
  return row.numeric_status==='ACTIVE_VERIFIED'&&row.numeric_operator==='PROBABILITY_MULTIPLIER'&&Number.isFinite(Number(row.multiplier))?Number(row.multiplier):null;
}

function ingredientSubskillMultipliers(profile){
  return (profile?.modifiers||[])
    .filter(item=>item.source_type==='SUBSKILL'&&item.dimension==='ingredient_probability_per_help')
    .map(item=>item.numeric_status==='ACTIVE_VERIFIED'&&item.numeric_operator==='PROBABILITY_MULTIPLIER'&&Number.isFinite(Number(item.multiplier))?Number(item.multiplier):null);
}

export function resolveIngredientProbabilityReferenceProjection(candidate={}){
  const reference=resolveReferenceSpeciesIngredientRate(candidate);
  const modifier_profile=resolvePokemonProductionModifierProfile(candidate);
  const baseMeta={
    schema:'pokemon-sleep-ingredient-probability-reference-projection/1.0',
    contract_version:INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION,
    reference_version:SPECIES_INGREDIENT_RATE_REFERENCE_VERSION,
    production_authority_status:'NOT_YET_VERIFIED',
    eligible_for_numeric_activation:false,
    numeric_activation:false,
    missing_is_zero:false,
    runtime_network_fetch:false,
    ai_numeric_authority:false,
  };
  if(reference.status!=='REFERENCE_IDENTIFIED')return freezeResult({...baseMeta,status:reference.status,reason:reference.reason,reference_resolution:reference,modifier_profile,effective_probability:null,berry_result_probability:null});
  if(modifier_profile.status==='REVIEW_REQUIRED')return freezeResult({...baseMeta,status:'REVIEW_REQUIRED',reason:'MODIFIER_PROFILE_REVIEW_REQUIRED',reference_resolution:reference,modifier_profile,effective_probability:null,berry_result_probability:null});
  const nature=ingredientNatureMultiplier(modifier_profile);
  const subskills=ingredientSubskillMultipliers(modifier_profile);
  if(nature===null||subskills.some(value=>value===null))return freezeResult({...baseMeta,status:'REVIEW_REQUIRED',reason:'INGREDIENT_MODIFIER_NUMERIC_EVIDENCE_INCOMPLETE',reference_resolution:reference,modifier_profile,effective_probability:null,berry_result_probability:null});
  const composed=composeIngredientProbabilityReference({base_probability:reference.row.base_ingredient_probability,nature_multiplier:nature,subskill_probability_multipliers:subskills});
  if(!composed.ok)return freezeResult({...baseMeta,status:'REVIEW_REQUIRED',reason:composed.reason,reference_resolution:reference,modifier_profile,effective_probability:null,berry_result_probability:null});
  return freezeResult({...baseMeta,status:'REFERENCE_PROJECTION_ONLY',reason:'BASE_RATE_REFERENCE_NOT_ACTIVATION_AUTHORITY',reference_resolution:reference,modifier_profile,...composed});
}
