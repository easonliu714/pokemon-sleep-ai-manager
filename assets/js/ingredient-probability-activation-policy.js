export const INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID='ingredient-probability-activation-policy-2026-08-14-a';
export const INGREDIENT_PROBABILITY_ACTIVATION_POLICY_VERSION='ingredient-probability-activation-policy-v1';
export const INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831';

export const INGREDIENT_PROBABILITY_EVIDENCE_CLASS=Object.freeze({
  OFFICIAL_EXACT_NUMERIC_PUBLICATION:'OFFICIAL_EXACT_NUMERIC_PUBLICATION',
  COMMUNITY_RESEARCH_DERIVED:'COMMUNITY_RESEARCH_DERIVED',
  INDEPENDENT_CURRENT_CROSSCHECK:'INDEPENDENT_CURRENT_CROSSCHECK',
  SOURCE_DECLARED_SUSPICIOUS:'SOURCE_DECLARED_SUSPICIOUS',
  MODEL_FIT_OR_PLACEHOLDER:'MODEL_FIT_OR_PLACEHOLDER',
  UNKNOWN:'UNKNOWN',
});

export const INGREDIENT_PROBABILITY_ACTIVATION_REQUIREMENTS=Object.freeze([
  'VERSIONED_LOCAL_ACTIVATION_MASTER',
  'COMPLETE_CURRENT_SPECIES_FORM_COVERAGE',
  'EXPLICIT_SOURCE_COMMIT_AND_PATH_PER_ROW',
  'FORM_SAFE_CANONICAL_IDENTITY_PER_ROW',
  'NO_SOURCE_DECLARED_SUSPICIOUS_OR_MODEL_FIT_VALUES',
  'INDEPENDENT_CURRENT_CROSSCHECK_PER_ACTIVATION_ROW_OR_EXPLICIT_REVIEW_HOLD',
  'DISCREPANCY_REPORT_ZERO_UNRESOLVED_ACTIVATION_CONFLICTS',
  'NATURE_AND_SUBSKILL_COMPOSITION_ORDER_CONTRACT_ACCEPTED',
  'UNKNOWN_OR_AMBIGUOUS_FORM_FAILS_CLOSED',
  'NO_RUNTIME_NETWORK_FETCH',
  'NO_PLAYER_OR_SQLITE_WRITE',
  'NO_AI_NUMERIC_AUTHORITY',
]);

export const INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS=Object.freeze([
  Object.freeze({
    source_key:'MEW',
    pokedex_number:151,
    source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
    source_path:'common/src/types/pokemon/all-pokemon.ts',
    field:'ingredientPercentage',
    evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS,
    exclusion_reason:'SOURCE_COMMENT_DECLARIES_VALUE_SUSPICIOUS_AND_USED_TO_FIT_RP_MODEL',
    eligible_for_numeric_activation:false,
    requires_independent_replacement_evidence:true,
  }),
]);

const text=value=>String(value??'').normalize('NFKC').trim();
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const freeze=value=>Object.freeze(value);

export function knownIngredientProbabilitySourceExclusion(sourceKey){
  const key=text(sourceKey).toUpperCase();
  return INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS.find(row=>row.source_key===key)||null;
}

export function evaluateIngredientProbabilityActivationRow(row={}){
  const sourceKey=text(row.source_key).toUpperCase();
  const exclusion=knownIngredientProbabilitySourceExclusion(sourceKey);
  if(exclusion)return freeze({
    status:'EXCLUDED_FROM_ACTIVATION',
    reason:exclusion.exclusion_reason,
    eligible_for_numeric_activation:false,
    evidence_class:exclusion.evidence_class,
  });

  const probability=number(row.base_ingredient_probability);
  if(probability===null||probability<=0||probability>=1)return freeze({status:'REVIEW_REQUIRED',reason:'INVALID_OR_MISSING_BASE_PROBABILITY',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  if(!sourceKey)return freeze({status:'REVIEW_REQUIRED',reason:'SOURCE_KEY_MISSING',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  if(text(row.source_commit)!==INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT)return freeze({status:'REVIEW_REQUIRED',reason:'SOURCE_COMMIT_NOT_PINNED',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  if(!text(row.source_path))return freeze({status:'REVIEW_REQUIRED',reason:'SOURCE_PATH_MISSING',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  if(!text(row.canonical_species_form_id))return freeze({status:'REVIEW_REQUIRED',reason:'FORM_SAFE_CANONICAL_IDENTITY_MISSING',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  if(row.form_identity_ambiguous===true)return freeze({status:'REVIEW_REQUIRED',reason:'FORM_IDENTITY_AMBIGUOUS',eligible_for_numeric_activation:false,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN});
  const evidenceClass=text(row.evidence_class)||INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN;
  if([INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.MODEL_FIT_OR_PLACEHOLDER,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.UNKNOWN].includes(evidenceClass))return freeze({status:'REVIEW_REQUIRED',reason:'NUMERIC_EVIDENCE_CLASS_NOT_ACCEPTED',eligible_for_numeric_activation:false,evidence_class:evidenceClass});
  const crosscheckCount=Number.isInteger(Number(row.independent_current_crosscheck_count))?Number(row.independent_current_crosscheck_count):0;
  if(crosscheckCount<1)return freeze({status:'REVIEW_REQUIRED',reason:'INDEPENDENT_CURRENT_CROSSCHECK_MISSING',eligible_for_numeric_activation:false,evidence_class:evidenceClass});
  if(row.unresolved_numeric_conflict===true)return freeze({status:'REVIEW_REQUIRED',reason:'UNRESOLVED_NUMERIC_EVIDENCE_CONFLICT',eligible_for_numeric_activation:false,evidence_class:evidenceClass});
  return freeze({status:'ACTIVATION_ROW_EVIDENCE_READY',reason:null,eligible_for_numeric_activation:true,evidence_class:evidenceClass});
}

export function evaluateIngredientProbabilityActivationMaster({rows=[],expected_current_species_form_count=null}={}){
  const list=Array.isArray(rows)?rows:[];
  const evaluated=list.map(row=>freeze({source_key:text(row?.source_key),...evaluateIngredientProbabilityActivationRow(row)}));
  const expected=Number.isInteger(Number(expected_current_species_form_count))&&Number(expected_current_species_form_count)>0?Number(expected_current_species_form_count):null;
  const ready=evaluated.filter(row=>row.eligible_for_numeric_activation).length;
  const excluded=evaluated.filter(row=>row.status==='EXCLUDED_FROM_ACTIVATION').length;
  const review=evaluated.filter(row=>row.status==='REVIEW_REQUIRED').length;
  const complete=expected!==null&&list.length===expected&&ready===expected;
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-activation-master-audit/1.0',
    policy_id:INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID,
    policy_version:INGREDIENT_PROBABILITY_ACTIVATION_POLICY_VERSION,
    expected_current_species_form_count:expected,
    row_count:list.length,
    ready_row_count:ready,
    excluded_row_count:excluded,
    review_required_row_count:review,
    complete_current_species_form_coverage:complete,
    activation_decision:complete?'READY_FOR_EXPLICIT_AUTHORITY_PROMOTION':'HOLD_ACTIVATION_MASTER_INCOMPLETE_OR_UNRESOLVED',
    rows:freeze(evaluated),
    safety:freeze({
      missing_is_zero:false,
      infer_from_specialty:false,
      source_declared_suspicious_values_activate:false,
      model_fit_or_placeholder_values_activate:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}

export function currentIngredientProbabilityActivationPolicy(){
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-activation-policy/1.0',
    policy_id:INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID,
    policy_version:INGREDIENT_PROBABILITY_ACTIVATION_POLICY_VERSION,
    pinned_source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
    activation_status:'POLICY_DEFINED_ACTIVATION_STILL_BLOCKED',
    requirements:INGREDIENT_PROBABILITY_ACTIVATION_REQUIREMENTS,
    known_source_exclusions:INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS,
    complete_catalog_required:true,
    unresolved_conflict_count_required:0,
    independent_current_crosscheck_required_per_activation_row:true,
    safety:freeze({missing_is_zero:false,infer_from_specialty:false,runtime_network_fetch:false,player_data_write:false,sqlite_write:false,ai_numeric_authority:false}),
  });
}
