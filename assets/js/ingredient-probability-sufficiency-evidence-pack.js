export const INGREDIENT_PROBABILITY_SUFFICIENCY_EVIDENCE_PACK_ID='ingredient-probability-sufficiency-evidence-pack-2026-08-17-a';
export const INGREDIENT_PROBABILITY_SUFFICIENCY_EVIDENCE_PACK_VERSION='ingredient-probability-sufficiency-evidence-pack-v1';
export const SUFFICIENCY_DISTRIBUTION_QUANTILE_METHOD='TYPE7_LINEAR_INTERPOLATION_P_N_MINUS_1';

const freeze=value=>Object.freeze(value);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const text=value=>String(value??'').normalize('NFKC').trim();

function sortedFinite(values=[]){return (Array.isArray(values)?values:[]).map(finite).filter(value=>value!==null).sort((a,b)=>a-b);}
export function empiricalQuantile(values=[],p=0.5){
  const list=sortedFinite(values),q=Number(p);
  if(!list.length||!Number.isFinite(q)||q<0||q>1)return null;
  if(list.length===1)return list[0];
  const index=q*(list.length-1),lower=Math.floor(index),upper=Math.ceil(index),weight=index-lower;
  return list[lower]+(list[upper]-list[lower])*weight;
}

export function summarizeEmpiricalDistribution(values=[]){
  const list=sortedFinite(values);
  if(!list.length)return freeze({count:0,min:null,q1:null,median:null,q3:null,max:null,mean:null,quantile_method:SUFFICIENCY_DISTRIBUTION_QUANTILE_METHOD});
  const mean=list.reduce((sum,value)=>sum+value,0)/list.length;
  return freeze({
    count:list.length,
    min:list[0],
    q1:empiricalQuantile(list,0.25),
    median:empiricalQuantile(list,0.5),
    q3:empiricalQuantile(list,0.75),
    max:list[list.length-1],
    mean,
    quantile_method:SUFFICIENCY_DISTRIBUTION_QUANTILE_METHOD,
  });
}

function reasonCounts(groups=[],field){
  const counts={};
  for(const group of groups){
    for(const reason of Array.isArray(group?.[field])?group[field]:[]){const key=text(reason);if(key)counts[key]=(counts[key]||0)+1;}
  }
  return freeze(Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a.localeCompare(b))));
}

export function buildIngredientProbabilitySufficiencyEvidencePack(readiness={},options={}){
  const groups=Array.isArray(readiness?.groups)?readiness.groups:[];
  const generatedAt=text(options.generatedAt)||null;
  const referenceGroups=groups.filter(group=>group?.reference?.accepted_for_comparison===true&&finite(group?.reference?.absolute_delta)!==null);
  const i2Groups=groups.filter(group=>finite(group?.heterogeneity?.i2)!==null);
  const wilsonGroups=groups.filter(group=>finite(group?.wilson_95?.width)!==null);
  const statusCounts={};
  for(const group of groups){const key=text(group?.status)||'UNKNOWN';statusCounts[key]=(statusCounts[key]||0)+1;}
  const policy=readiness?.policy||{};
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-sufficiency-evidence-pack/1.0',
    contract_id:INGREDIENT_PROBABILITY_SUFFICIENCY_EVIDENCE_PACK_ID,
    contract_version:INGREDIENT_PROBABILITY_SUFFICIENCY_EVIDENCE_PACK_VERSION,
    generated_at:generatedAt,
    source:'LOCAL_DEIDENTIFIED_STATISTICAL_READINESS',
    readiness_contract_id:readiness?.contract_id||null,
    readiness_contract_version:readiness?.contract_version||null,
    readiness_status:readiness?.status||null,
    policy_authority_status:policy?.policy_authority_status||'NOT_YET_DEFINED',
    governed_thresholds_defined:policy?.thresholds_defined===true,
    evidence_counts:freeze({
      accepted_observations:Number(readiness?.accepted_observation_count)||0,
      rejected_observations:Number(readiness?.rejected_observation_count)||0,
      statistical_groups:groups.length,
      ready_groups:Number(readiness?.ready_group_count)||0,
      hold_groups:Number(readiness?.hold_group_count)||0,
      review_required_groups:Number(readiness?.review_required_group_count)||0,
      groups_with_wilson_95:wilsonGroups.length,
      groups_with_computable_i2:i2Groups.length,
      groups_with_accepted_reference:referenceGroups.length,
    }),
    empirical_distributions:freeze({
      observation_count:summarizeEmpiricalDistribution(groups.map(group=>group?.observation_count)),
      total_help_event_count:summarizeEmpiricalDistribution(groups.map(group=>group?.total_help_event_count)),
      wilson_95_width:summarizeEmpiricalDistribution(wilsonGroups.map(group=>group?.wilson_95?.width)),
      i2:summarizeEmpiricalDistribution(i2Groups.map(group=>group?.heterogeneity?.i2)),
      independent_reference_absolute_delta:summarizeEmpiricalDistribution(referenceGroups.map(group=>group?.reference?.absolute_delta)),
    }),
    status_counts:freeze(Object.fromEntries(Object.entries(statusCounts).sort(([a],[b])=>a.localeCompare(b)))),
    blocker_counts:reasonCounts(groups,'blockers'),
    hold_reason_counts:reasonCounts(groups,'holds'),
    threshold_candidate_values:freeze({
      minimum_observation_count:null,
      minimum_total_help_events:null,
      maximum_wilson_95_width:null,
      maximum_i2:null,
      maximum_reference_absolute_delta:null,
    }),
    threshold_proposal_status:'EVIDENCE_ONLY_NO_GOVERNED_THRESHOLD_PROPOSAL',
    threshold_recommendation_authority:false,
    promotion_authority_granted:false,
    activation_authority_granted:false,
    runtime_numeric_activation:false,
    production_active_dimensions:'4/7',
    next_governance_requirements:freeze([
      'REVIEW_EMPIRICAL_DISTRIBUTIONS_BEFORE_SETTING_ANY_THRESHOLD',
      'ACCEPT_GENUINELY_INDEPENDENT_REFERENCE_SOURCE_BEFORE_REFERENCE_TOLERANCE_GOVERNANCE',
      'DOCUMENT_THRESHOLD_METHOD_AND_SCOPE_IN_VERSIONED_GOVERNED_POLICY',
      'EXPLICIT_PROMOTION_REVIEW_AFTER_POLICY_AND_EVIDENCE_PASS',
    ]),
    privacy:freeze({
      raw_observations_included:false,
      source_keys_included:false,
      canonical_species_form_ids_included:false,
      evidence_refs_included:false,
      player_identity_included:false,
      pokemon_instance_ids_included:false,
    }),
    safety:freeze({
      threshold_invented:false,
      empirical_quantile_used_as_threshold:false,
      evidence_pack_implies_readiness:false,
      readiness_implies_activation:false,
      runtime_network_fetch:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
