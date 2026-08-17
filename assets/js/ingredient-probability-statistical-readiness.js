import {FIRST_PARTY_OBSERVATION_STATUS,wilsonBinomialInterval} from './ingredient-probability-first-party-observation-contract.js';

export const INGREDIENT_PROBABILITY_STATISTICAL_READINESS_ID='ingredient-probability-statistical-readiness-2026-08-17-a';
export const INGREDIENT_PROBABILITY_STATISTICAL_READINESS_VERSION='ingredient-probability-statistical-readiness-v1';
export const INGREDIENT_PROBABILITY_STATISTICAL_SEMANTICS='BERNOULLI_HELP_EVENT_SPLIT_OBSERVATION';

export const INGREDIENT_PROBABILITY_READINESS_STATUS=Object.freeze({
  HOLD_NO_ACCEPTED_OBSERVATIONS:'HOLD_NO_ACCEPTED_OBSERVATIONS',
  HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED:'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED',
  HOLD_REFERENCE_CROSSCHECK_NOT_READY:'HOLD_REFERENCE_CROSSCHECK_NOT_READY',
  HOLD_INSUFFICIENT_EVIDENCE:'HOLD_INSUFFICIENT_EVIDENCE',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
  READY_FOR_EXPLICIT_PROMOTION_REVIEW:'READY_FOR_EXPLICIT_PROMOTION_REVIEW',
});

export const INGREDIENT_PROBABILITY_REFERENCE_STATUS=Object.freeze({
  ACCEPTED_INDEPENDENT_REFERENCE:'ACCEPTED_INDEPENDENT_REFERENCE',
  NOT_ACCEPTED:'NOT_ACCEPTED',
});

const text=value=>String(value??'').normalize('NFKC').trim();
const freeze=value=>Object.freeze(value);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const nonNegativeInteger=value=>{const n=Number(value);return Number.isInteger(n)&&n>=0?n:null;};
const positiveInteger=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const optionalPositiveInteger=value=>value===null||value===undefined?null:positiveInteger(value);
const optionalUnitInterval=value=>{
  if(value===null||value===undefined)return null;
  const n=finite(value);
  return n!==null&&n>=0&&n<=1?n:null;
};

export function currentIngredientProbabilityStatisticalReadinessPolicy(){
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-statistical-readiness-policy/1.0',
    contract_id:INGREDIENT_PROBABILITY_STATISTICAL_READINESS_ID,
    contract_version:INGREDIENT_PROBABILITY_STATISTICAL_READINESS_VERSION,
    policy_authority_status:'NOT_YET_DEFINED',
    minimum_observation_count:null,
    minimum_total_help_events:null,
    maximum_wilson_95_width:null,
    maximum_i2:null,
    maximum_reference_absolute_delta:null,
    required_reference_status:INGREDIENT_PROBABILITY_REFERENCE_STATUS.ACCEPTED_INDEPENDENT_REFERENCE,
    sufficiency_semantics:freeze([
      'MINIMUM_COMPATIBLE_OBSERVATION_COUNT',
      'MINIMUM_TOTAL_HELP_EVENT_COUNT',
      'MAXIMUM_WILSON_95_INTERVAL_WIDTH',
      'MAXIMUM_CROSS_OBSERVATION_I2',
      'MAXIMUM_ABSOLUTE_DELTA_FROM_ACCEPTED_INDEPENDENT_REFERENCE',
    ]),
    activation_authority_granted:false,
    production_active_dimensions:'4/7',
    safety:freeze({
      threshold_invented:false,
      missing_threshold_implies_pass:false,
      missing_reference_implies_match:false,
      readiness_implies_runtime_activation:false,
      player_raw_observation_export:false,
      runtime_network_fetch:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}

function normalizePolicy(input){
  const source=input&&typeof input==='object'?input:{};
  const policy={
    policy_authority_status:text(source.policy_authority_status)||'NOT_YET_DEFINED',
    minimum_observation_count:optionalPositiveInteger(source.minimum_observation_count),
    minimum_total_help_events:optionalPositiveInteger(source.minimum_total_help_events),
    maximum_wilson_95_width:optionalUnitInterval(source.maximum_wilson_95_width),
    maximum_i2:optionalUnitInterval(source.maximum_i2),
    maximum_reference_absolute_delta:optionalUnitInterval(source.maximum_reference_absolute_delta),
    required_reference_status:text(source.required_reference_status)||INGREDIENT_PROBABILITY_REFERENCE_STATUS.ACCEPTED_INDEPENDENT_REFERENCE,
  };
  const thresholdsDefined=policy.policy_authority_status==='ACCEPTED_GOVERNED_POLICY'&&[
    policy.minimum_observation_count,
    policy.minimum_total_help_events,
    policy.maximum_wilson_95_width,
    policy.maximum_i2,
    policy.maximum_reference_absolute_delta,
  ].every(value=>value!==null);
  return freeze({...policy,thresholds_defined:thresholdsDefined});
}

function normalizeStatisticalObservation(row={}){
  const sourceKey=text(row.source_key).toUpperCase();
  const canonicalId=text(row.canonical_species_form_id);
  const semantics=text(row.statistical_semantics);
  const ingredient=nonNegativeInteger(row.ingredient_help_event_count);
  const total=positiveInteger(row.total_help_event_count);
  const acceptedStatus=text(row.status)===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION;
  const eligible=row.eligible_for_statistical_aggregation===true||Number(row.eligible_for_statistical_aggregation)===1;
  const blockers=[];
  if(!sourceKey)blockers.push('SOURCE_KEY_MISSING');
  if(!canonicalId)blockers.push('CANONICAL_SPECIES_FORM_ID_MISSING');
  if(semantics!==INGREDIENT_PROBABILITY_STATISTICAL_SEMANTICS)blockers.push('STATISTICAL_SEMANTICS_INCOMPATIBLE');
  if(!acceptedStatus||!eligible)blockers.push('OBSERVATION_NOT_ACCEPTED_FOR_AGGREGATION');
  if(ingredient===null||total===null||ingredient>total)blockers.push('INVALID_BINOMIAL_COUNTS');
  return freeze({
    source_key:sourceKey||null,
    canonical_species_form_id:canonicalId||null,
    statistical_semantics:semantics||null,
    ingredient_help_event_count:ingredient,
    total_help_event_count:total,
    observed_fraction:ingredient!==null&&total!==null&&ingredient<=total?ingredient/total:null,
    accepted:blockers.length===0,
    blockers:freeze(blockers),
  });
}

export function pearsonBinomialHeterogeneity(observations=[]){
  const rows=(Array.isArray(observations)?observations:[]).filter(row=>row?.accepted===true);
  const total=rows.reduce((sum,row)=>sum+row.total_help_event_count,0);
  const successes=rows.reduce((sum,row)=>sum+row.ingredient_help_event_count,0);
  if(!rows.length||total<=0)return null;
  const pooled=successes/total;
  if(rows.length===1)return freeze({method:'PEARSON_BINOMIAL_HETEROGENEITY_APPROX',observation_count:1,q:0,degrees_of_freedom:0,i2:0,pooled_fraction:pooled,status:'NOT_APPLICABLE_SINGLE_OBSERVATION'});
  if(pooled<=0||pooled>=1)return freeze({method:'PEARSON_BINOMIAL_HETEROGENEITY_APPROX',observation_count:rows.length,q:null,degrees_of_freedom:rows.length-1,i2:null,pooled_fraction:pooled,status:'DEGENERATE_POOLED_PROBABILITY'});
  let q=0;
  for(const row of rows){
    const expected=row.total_help_event_count*pooled;
    const variance=row.total_help_event_count*pooled*(1-pooled);
    const delta=row.ingredient_help_event_count-expected;
    q+=(delta*delta)/variance;
  }
  const df=rows.length-1;
  const i2=q>0?Math.max(0,(q-df)/q):0;
  return freeze({method:'PEARSON_BINOMIAL_HETEROGENEITY_APPROX',observation_count:rows.length,q,degrees_of_freedom:df,i2,pooled_fraction:pooled,status:'COMPUTED'});
}

function normalizeReferenceRows(rows=[]){
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const sourceKey=text(row?.source_key).toUpperCase();
    const probability=finite(row?.reference_probability);
    const status=text(row?.reference_status)||INGREDIENT_PROBABILITY_REFERENCE_STATUS.NOT_ACCEPTED;
    if(!sourceKey||probability===null||probability<0||probability>1)continue;
    if(map.has(sourceKey)){
      const existing=map.get(sourceKey);
      map.set(sourceKey,freeze({...existing,duplicate_reference_conflict:true}));
      continue;
    }
    map.set(sourceKey,freeze({source_key:sourceKey,reference_probability:probability,reference_status:status,reference_version:text(row?.reference_version)||null,duplicate_reference_conflict:false}));
  }
  return map;
}

function evaluateGroup(group,policy,reference){
  const successes=group.observations.reduce((sum,row)=>sum+row.ingredient_help_event_count,0);
  const total=group.observations.reduce((sum,row)=>sum+row.total_help_event_count,0);
  const interval=wilsonBinomialInterval(successes,total);
  const heterogeneity=pearsonBinomialHeterogeneity(group.observations);
  const observed=interval?.estimate??null;
  const intervalWidth=interval?interval.upper-interval.lower:null;
  const referenceAccepted=reference?.reference_status===policy.required_reference_status&&!reference?.duplicate_reference_conflict;
  const referenceDelta=referenceAccepted&&observed!==null?Math.abs(observed-reference.reference_probability):null;
  const blockers=[];
  const holds=[];
  if(group.scope_conflict)blockers.push('SOURCE_KEY_HAS_MULTIPLE_CANONICAL_SCOPES');
  if(reference?.duplicate_reference_conflict)blockers.push('DUPLICATE_REFERENCE_ROWS');
  if(!policy.thresholds_defined)holds.push('GOVERNED_SUFFICIENCY_THRESHOLDS_NOT_DEFINED');
  if(!referenceAccepted)holds.push('ACCEPTED_INDEPENDENT_REFERENCE_NOT_AVAILABLE');
  if(policy.thresholds_defined){
    if(group.observation_count<policy.minimum_observation_count)holds.push('MINIMUM_OBSERVATION_COUNT_NOT_MET');
    if(total<policy.minimum_total_help_events)holds.push('MINIMUM_TOTAL_HELP_EVENTS_NOT_MET');
    if(intervalWidth===null||intervalWidth>policy.maximum_wilson_95_width)holds.push('WILSON_95_INTERVAL_TOO_WIDE');
    if(heterogeneity?.i2===null)blockers.push('HETEROGENEITY_NOT_COMPUTABLE');
    else if(heterogeneity.i2>policy.maximum_i2)blockers.push('CROSS_OBSERVATION_HETEROGENEITY_EXCEEDS_POLICY');
    if(referenceAccepted&&referenceDelta>policy.maximum_reference_absolute_delta)blockers.push('INDEPENDENT_REFERENCE_DISAGREEMENT_EXCEEDS_POLICY');
  }
  let status=INGREDIENT_PROBABILITY_READINESS_STATUS.READY_FOR_EXPLICIT_PROMOTION_REVIEW;
  if(blockers.length)status=INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED;
  else if(holds.includes('GOVERNED_SUFFICIENCY_THRESHOLDS_NOT_DEFINED'))status=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED;
  else if(holds.includes('ACCEPTED_INDEPENDENT_REFERENCE_NOT_AVAILABLE'))status=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_REFERENCE_CROSSCHECK_NOT_READY;
  else if(holds.length)status=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_INSUFFICIENT_EVIDENCE;
  return freeze({
    source_key:group.source_key,
    canonical_species_form_id:group.canonical_species_form_id,
    statistical_semantics:group.statistical_semantics,
    observation_count:group.observation_count,
    ingredient_help_event_count:successes,
    total_help_event_count:total,
    observed_fraction:observed,
    wilson_95:interval?freeze({lower:interval.lower,upper:interval.upper,width:intervalWidth}):null,
    heterogeneity,
    reference:reference?freeze({reference_probability:reference.reference_probability,reference_status:reference.reference_status,reference_version:reference.reference_version,absolute_delta:referenceDelta,accepted_for_comparison:referenceAccepted}):null,
    status,
    blockers:freeze(blockers),
    holds:freeze(holds),
    ready_for_explicit_promotion_review:status===INGREDIENT_PROBABILITY_READINESS_STATUS.READY_FOR_EXPLICIT_PROMOTION_REVIEW,
    activation_authority_granted:false,
    runtime_numeric_activation:false,
  });
}

export function auditIngredientProbabilityStatisticalReadiness({observations=[],reference_rows=[],policy=null}={}){
  const normalizedPolicy=normalizePolicy(policy||currentIngredientProbabilityStatisticalReadinessPolicy());
  const normalized=(Array.isArray(observations)?observations:[]).map(normalizeStatisticalObservation);
  const invalid=normalized.filter(row=>!row.accepted);
  const accepted=normalized.filter(row=>row.accepted);
  const sourceScopes=new Map();
  for(const row of accepted){
    if(!sourceScopes.has(row.source_key))sourceScopes.set(row.source_key,new Set());
    sourceScopes.get(row.source_key).add(row.canonical_species_form_id);
  }
  const groups=new Map();
  for(const row of accepted){
    const key=[row.source_key,row.canonical_species_form_id,row.statistical_semantics].join('|');
    if(!groups.has(key))groups.set(key,{source_key:row.source_key,canonical_species_form_id:row.canonical_species_form_id,statistical_semantics:row.statistical_semantics,observations:[]});
    groups.get(key).observations.push(row);
  }
  const referenceMap=normalizeReferenceRows(reference_rows);
  const evaluated=[...groups.values()].map(group=>evaluateGroup({
    ...group,
    observation_count:group.observations.length,
    scope_conflict:(sourceScopes.get(group.source_key)?.size||0)>1,
  },normalizedPolicy,referenceMap.get(group.source_key)||null)).sort((a,b)=>a.source_key.localeCompare(b.source_key)||a.canonical_species_form_id.localeCompare(b.canonical_species_form_id));
  const ready=evaluated.filter(row=>row.ready_for_explicit_promotion_review);
  const review=evaluated.filter(row=>row.status===INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED);
  const holds=evaluated.filter(row=>row.status!==INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED&&!row.ready_for_explicit_promotion_review);
  let overall=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_NO_ACCEPTED_OBSERVATIONS;
  if(evaluated.length){
    if(review.length)overall=INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED;
    else if(holds.some(row=>row.status===INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED))overall=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED;
    else if(holds.some(row=>row.status===INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_REFERENCE_CROSSCHECK_NOT_READY))overall=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_REFERENCE_CROSSCHECK_NOT_READY;
    else if(holds.length)overall=INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_INSUFFICIENT_EVIDENCE;
    else overall=INGREDIENT_PROBABILITY_READINESS_STATUS.READY_FOR_EXPLICIT_PROMOTION_REVIEW;
  }
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-statistical-readiness-audit/1.0',
    contract_id:INGREDIENT_PROBABILITY_STATISTICAL_READINESS_ID,
    contract_version:INGREDIENT_PROBABILITY_STATISTICAL_READINESS_VERSION,
    status:overall,
    policy:normalizedPolicy,
    accepted_observation_count:accepted.length,
    rejected_observation_count:invalid.length,
    rejected_reason_counts:freeze(invalid.reduce((acc,row)=>{for(const reason of row.blockers)acc[reason]=(acc[reason]||0)+1;return acc;},{})),
    group_count:evaluated.length,
    ready_group_count:ready.length,
    review_required_group_count:review.length,
    hold_group_count:holds.length,
    groups:freeze(evaluated),
    promoted_subset_scope:freeze({
      status:ready.length?'CANDIDATE_SCOPE_ONLY_REQUIRES_EXPLICIT_PROMOTION':'NO_PROMOTION_CANDIDATE',
      source_keys:freeze(ready.map(row=>row.source_key)),
      canonical_species_form_ids:freeze(ready.map(row=>row.canonical_species_form_id)),
    }),
    activation_authority_granted:false,
    runtime_numeric_activation:false,
    production_active_dimensions:'4/7',
    production_promotion_allowed:false,
    explicit_promotion_review_required:true,
    safety:freeze({
      raw_player_observations_exported:false,
      evidence_refs_exported:false,
      threshold_invented:false,
      missing_threshold_implies_pass:false,
      statistical_readiness_implies_activation:false,
      runtime_network_fetch:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
