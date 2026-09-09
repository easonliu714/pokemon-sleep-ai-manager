import {readG121BDeterministicEvolutionStatus} from './g121b-evolution-status-read-api.js';

export const G121C_RECOMMENDATION_SCHEMA='evolution-recommendation/1.0';
export const G121C_RECOMMENDATION_STATUS=Object.freeze({
  RECOMMEND_NOW:'recommend_now',
  DEFER:'defer',
  DATA_INCOMPLETE:'data_incomplete',
});

const text=value=>String(value??'').trim();
const nonNegativeInteger=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isInteger(number)&&number>=0?number:null;
};
const verifiedBoolean=row=>row?.authority_status==='VERIFIED'&&typeof row.value==='boolean'?row.value:null;
const exactGap=requirement=>{
  const required=Number(requirement?.required);
  const current=Number(requirement?.current);
  return Number.isFinite(required)&&Number.isFinite(current)?Math.max(0,required-current):null;
};
const requirementView=requirement=>({
  kind:requirement.kind,
  item_name:requirement.item_name||null,
  candy_family_id:requirement.candy_family_id||null,
  required:requirement.required??null,
  current:requirement.current??null,
  gap:exactGap(requirement),
  satisfied:requirement.kind==='other_requirement'
    ?requirement.satisfied===true
    :exactGap(requirement)===0,
});

function acquisitionAuthority(snapshot,itemName){
  if(!itemName)return {status:'NOT_REQUIRED',guidance:[]};
  const rows=(Array.isArray(snapshot?.item_acquisition_rows)?snapshot.item_acquisition_rows:[])
    .filter(row=>text(row.item_name)===itemName);
  if(!rows.length||rows.some(row=>['','UNKNOWN','MISSING_AUTHORITY'].includes(text(row.authority_status)))){
    return {status:'MISSING_AUTHORITY',guidance:[]};
  }
  const now=Date.parse(snapshot?.now||'');
  const guidance=[];
  for(const row of rows){
    const type=text(row.acquisition_type);
    const until=row.effective_until?Date.parse(row.effective_until):null;
    const from=row.effective_from?Date.parse(row.effective_from):null;
    if((row.effective_until&&(!Number.isFinite(until)||(Number.isFinite(now)&&now>until)))||
       (row.effective_from&&(!Number.isFinite(from)||(Number.isFinite(now)&&now<from)))){
      return {status:'TIME_AUTHORITY_UNAVAILABLE',guidance:[]};
    }
    if(type==='regular_sleep_point_exchange'||type==='premium_sleep_point_exchange'){
      const cost=nonNegativeInteger(row.sleep_point_cost);
      if(cost===null)return {status:'MISSING_COST_AUTHORITY',guidance:[]};
      guidance.push({type,cost_resource:'sleep_points',cost,verified_at:row.verified_at||null});
    }else if(type==='diamond_shop_fixed'||type==='diamond_bundle_limited'){
      const cost=nonNegativeInteger(row.diamond_cost);
      if(cost===null)return {status:'MISSING_COST_AUTHORITY',guidance:[]};
      guidance.push({type,cost_resource:'diamonds',cost,verified_at:row.verified_at||null});
    }else if(['mission','achievement','event_reward','research_reward','unavailable_now'].includes(type)){
      guidance.push({type,cost_resource:null,cost:null,verified_at:row.verified_at||null});
    }else{
      return {status:'AMBIGUOUS_AUTHORITY',guidance:[]};
    }
  }
  return {status:'VERIFIED',guidance};
}

function sleepProjection(statusResult,nightlySleepAuthority){
  const sleepRequirement=(statusResult.requirements||[]).find(row=>row.kind==='sleep_hours');
  const remaining=sleepRequirement?exactGap(sleepRequirement):null;
  if(remaining===null)return {sleep_hours_remaining:null,remaining_nights:null,completion_date:null,projection_status:'NOT_APPLICABLE'};
  if(remaining===0)return {sleep_hours_remaining:0,remaining_nights:0,completion_date:null,projection_status:'COMPLETE'};
  const nightly=Number(nightlySleepAuthority?.nightly_sleep_hours);
  if(nightlySleepAuthority?.authority_status!=='VERIFIED'||!Number.isFinite(nightly)||nightly<=0){
    return {sleep_hours_remaining:remaining,remaining_nights:null,completion_date:null,projection_status:'MISSING_AUTHORITY'};
  }
  const remainingNights=Math.ceil(remaining/nightly);
  let completionDate=null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(text(nightlySleepAuthority?.projection_start_date))){
    const start=new Date(`${nightlySleepAuthority.projection_start_date}T00:00:00.000Z`);
    if(Number.isFinite(start.getTime())){
      start.setUTCDate(start.getUTCDate()+remainingNights-1);
      completionDate=start.toISOString().slice(0,10);
    }
  }
  return {sleep_hours_remaining:remaining,remaining_nights:remainingNights,completion_date:completionDate,projection_status:'VERIFIED'};
}

const failClosed=(statusResult,reason,details={})=>({
  schema:G121C_RECOMMENDATION_SCHEMA,
  recommendation_status:G121C_RECOMMENDATION_STATUS.DATA_INCOMPLETE,
  rationale:reason,
  pokemon_instance_id:statusResult?.pokemon_instance_id||null,
  route_id:statusResult?.route_id||null,
  evolution_branch_id:statusResult?.evolution_branch_id||null,
  deterministic:true,
  read_only:true,
  ai_recommendation_decision:false,
  ...details,
});

/**
 * G12.1C explains the deterministic G12.1B result without changing status.
 * Recommendation authority (cultivation value, team need, opportunity cost)
 * must itself be VERIFIED before a ready_now route can become recommend_now.
 */
export function readG121CExplainableEvolutionRecommendation(snapshot={},request={},recommendationAuthority={}){
  const statusResult=readG121BDeterministicEvolutionStatus(snapshot,request);
  if(statusResult.status==='data_incomplete'){
    return failClosed(statusResult,statusResult.reason||'g121b_data_incomplete',{
      deterministic_status:statusResult.status,
      acquisition_guidance_authority:statusResult.acquisition_guidance_suppressed?'MISSING_AUTHORITY':'NOT_EVALUATED',
      warnings:[statusResult.reason||'g121b_data_incomplete'],
    });
  }

  const requirements=(statusResult.requirements||[]).map(requirementView);
  const completedRequirements=requirements.filter(row=>row.satisfied);
  const missingRequirements=requirements.filter(row=>!row.satisfied);
  const requiredItem=requirements.find(row=>row.kind==='item')?.item_name||null;
  const acquisition=acquisitionAuthority(snapshot,requiredItem);
  const projection=sleepProjection(statusResult,recommendationAuthority.nightly_sleep);
  const authorityChecks={
    cultivation_value:verifiedBoolean(recommendationAuthority.cultivation_value),
    team_need:verifiedBoolean(recommendationAuthority.team_need),
    opportunity_cost_acceptable:verifiedBoolean(recommendationAuthority.opportunity_cost_acceptable),
  };
  const recommendationAuthorityComplete=Object.values(authorityChecks).every(value=>value!==null);

  let recommendationStatus=G121C_RECOMMENDATION_STATUS.DEFER;
  let rationale='deterministic_requirements_not_yet_satisfied';
  if(statusResult.status==='ready_now'){
    if(!recommendationAuthorityComplete){
      recommendationStatus=G121C_RECOMMENDATION_STATUS.DATA_INCOMPLETE;
      rationale='missing_recommendation_authority';
    }else if(authorityChecks.cultivation_value&&authorityChecks.team_need&&authorityChecks.opportunity_cost_acceptable){
      recommendationStatus=G121C_RECOMMENDATION_STATUS.RECOMMEND_NOW;
      rationale='ready_now_and_verified_recommendation_authority_supports_evolution';
    }else{
      recommendationStatus=G121C_RECOMMENDATION_STATUS.DEFER;
      rationale='verified_recommendation_authority_supports_deferral';
    }
  }else if(statusResult.status==='evolution_not_recommended_yet'){
    rationale='deterministic_other_requirement_not_satisfied';
  }else if(statusResult.status==='time_window_pending'){
    rationale='evolution_time_window_pending';
  }

  return {
    schema:G121C_RECOMMENDATION_SCHEMA,
    recommendation_status:recommendationStatus,
    rationale,
    deterministic_status:statusResult.status,
    pokemon_instance_id:statusResult.pokemon_instance_id||null,
    route_id:statusResult.route_id||null,
    evolution_branch_id:statusResult.evolution_branch_id||null,
    can_evolve_now:statusResult.status==='ready_now',
    completed_requirements:completedRequirements,
    missing_requirements:missingRequirements,
    ...projection,
    acquisition_guidance_authority:acquisition.status,
    acquisition_guidance:acquisition.status==='VERIFIED'?acquisition.guidance:[],
    recommendation_authority:authorityChecks,
    warnings:acquisition.status==='MISSING_AUTHORITY'||acquisition.status==='MISSING_COST_AUTHORITY'||acquisition.status==='TIME_AUTHORITY_UNAVAILABLE'||acquisition.status==='AMBIGUOUS_AUTHORITY'
      ?[`item_acquisition_${acquisition.status.toLowerCase()}`]
      :[],
    deterministic:true,
    read_only:true,
    ai_recommendation_decision:false,
  };
}
