import {currentProductionAuthorityRegistry} from './production-authority-registry.js';
import {resolveBerryStrengthForTypeAtLevel} from './public-berry-strength-master.js';
import {resolveFavoriteBerryMultiplierFromMatch} from './favorite-berry-multiplier-contract.js';

export const TEAM_OBJECTIVE_EVALUATOR_VERSION='team-objective-evaluator-2026-08-13-b';
const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function verified(registry,dimension){return registry?.rules?.[dimension]?.status==='ACTIVE_VERIFIED';}

export function projectMemberProductionEvidence(candidate,{productionRegistry=currentProductionAuthorityRegistry()}={}){
  const unlockedIngredients=(candidate?.unlocked_ingredients||[]).map(row=>Object.freeze({
    unlock_level:num(row.unlock_level),ingredient_name:text(row.ingredient_name),quantity:num(row.quantity),
  })).filter(row=>row.ingredient_name);
  const berryStrength=verified(productionRegistry,'berry_energy_per_berry')?resolveBerryStrengthForTypeAtLevel(candidate?.type,candidate?.level):null;
  const favoriteMultiplier=verified(productionRegistry,'favorite_berry_multiplier')?resolveFavoriteBerryMultiplierFromMatch(candidate?.favorite_berry_match):null;
  const baseBerryEnergy=berryStrength?.status==='ACTIVE_VERIFIED'?num(berryStrength.strength):null;
  const favoriteMultiplierValue=favoriteMultiplier?.status==='ACTIVE_VERIFIED'?num(favoriteMultiplier.multiplier):null;
  const favoriteAdjustedBerryEnergy=baseBerryEnergy!==null&&favoriteMultiplierValue!==null?baseBerryEnergy*favoriteMultiplierValue:null;
  const berryRateReady=verified(productionRegistry,'berry_output_per_help')&&verified(productionRegistry,'berry_energy_per_berry')&&verified(productionRegistry,'favorite_berry_multiplier')&&favoriteMultiplierValue!==null;
  const evidence=Object.freeze({
    pokemon_id:text(candidate?.pokemon_id),species:text(candidate?.species),level:num(candidate?.level),specialty:text(candidate?.specialty)||null,type:text(candidate?.type)||null,
    helper_seconds:num(candidate?.helper_seconds),favorite_berry:text(candidate?.favorite_berry)||null,favorite_berry_match:candidate?.favorite_berry_match??null,
    berry_name:berryStrength?.berry_name||text(candidate?.favorite_berry)||null,
    berry_energy_per_berry:baseBerryEnergy,
    berry_energy_per_berry_status:berryStrength?.status||'NOT_YET_VERIFIED',
    favorite_berry_multiplier:favoriteMultiplierValue,
    favorite_berry_multiplier_status:favoriteMultiplier?.status||'NOT_YET_VERIFIED',
    favorite_adjusted_berry_energy_per_berry:favoriteAdjustedBerryEnergy,
    favorite_adjusted_berry_energy_status:favoriteAdjustedBerryEnergy!==null?'ACTIVE_VERIFIED_PARTIAL_COMPONENT':'NOT_YET_VERIFIED',
    main_skill:text(candidate?.main_skill)||null,main_skill_level:num(candidate?.main_skill_level),unlocked_ingredients:Object.freeze(unlockedIngredients),
    berry_energy_per_hour:null,ingredient_per_hour_by_name:null,skill_energy_per_hour:null,
    berry_rate_status:berryRateReady?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
    ingredient_rate_status:verified(productionRegistry,'ingredient_probability_per_help')&&verified(productionRegistry,'ingredient_slot_distribution')?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
    skill_rate_status:verified(productionRegistry,'main_skill_trigger_probability')&&verified(productionRegistry,'main_skill_effect_value')?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
  });
  const supplied=candidate?.verified_production&&typeof candidate.verified_production==='object'?candidate.verified_production:{};
  return Object.freeze({
    ...evidence,
    berry_energy_per_hour:evidence.berry_rate_status==='ACTIVE_VERIFIED'?num(supplied.berry_energy_per_hour):null,
    ingredient_per_hour_by_name:evidence.ingredient_rate_status==='ACTIVE_VERIFIED'&&supplied.ingredient_per_hour_by_name&&typeof supplied.ingredient_per_hour_by_name==='object'?Object.freeze(stable(supplied.ingredient_per_hour_by_name)):null,
    skill_energy_per_hour:evidence.skill_rate_status==='ACTIVE_VERIFIED'?num(supplied.skill_energy_per_hour):null,
  });
}

function sumVerifiedMembers(members,field,statusField){
  if(!members.length||members.some(row=>row[statusField]!=='ACTIVE_VERIFIED'||num(row[field])===null))return null;
  return members.reduce((sum,row)=>sum+Number(row[field]),0);
}

export function evaluateTeamObjective({team=null,candidateFeatures={},goalProfile=null,productionRegistry=currentProductionAuthorityRegistry(),cookingProjection=null}={}){
  const byId=new Map((candidateFeatures?.candidates||[]).map(row=>[text(row.pokemon_id),row]));
  const members=(team?.slots||[]).map(slot=>projectMemberProductionEvidence(byId.get(text(slot.pokemon_id))||slot,{productionRegistry}));
  const berryEnergyPerHour=sumVerifiedMembers(members,'berry_energy_per_hour','berry_rate_status');
  const skillEnergyPerHour=sumVerifiedMembers(members,'skill_energy_per_hour','skill_rate_status');
  const cookingEnergyPerHour=cookingProjection?.authority_status==='ACTIVE_VERIFIED'?num(cookingProjection.projected_verified_energy_per_hour):null;
  const activeEnergyComponents=[];
  if(berryEnergyPerHour!==null)activeEnergyComponents.push(['berry_energy_per_hour',berryEnergyPerHour]);
  if(skillEnergyPerHour!==null)activeEnergyComponents.push(['skill_energy_per_hour',skillEnergyPerHour]);
  if(cookingEnergyPerHour!==null)activeEnergyComponents.push(['cooking_energy_per_hour',cookingEnergyPerHour]);
  const primaryGoal=text(goalProfile?.primary_goal)||'balanced';
  const verifiedPartialGoalValue=primaryGoal==='max_snorlax_energy'&&activeEnergyComponents.length?activeEnergyComponents.reduce((sum,[,value])=>sum+value,0):null;
  const requiredEnergyDimensions=['berry_energy_per_hour','skill_energy_per_hour','cooking_energy_per_hour'];
  const complete=primaryGoal==='max_snorlax_energy'&&requiredEnergyDimensions.every(name=>activeEnergyComponents.some(([dimension])=>dimension===name));
  const missingInputs=[];
  if(berryEnergyPerHour===null)missingInputs.push('berry_energy_per_hour:NOT_YET_VERIFIED');
  if(skillEnergyPerHour===null)missingInputs.push('skill_energy_per_hour:NOT_YET_VERIFIED');
  if(cookingEnergyPerHour===null)missingInputs.push('cooking_energy_per_hour:NOT_YET_VERIFIED');
  const objectiveStatus=primaryGoal!=='max_snorlax_energy'?'GOAL_MODEL_NOT_IMPLEMENTED':complete?'ACTIVE_VERIFIED':verifiedPartialGoalValue!==null?'PARTIAL_VERIFIED':'NUMERIC_MODEL_NOT_ACTIVE';
  const totalGoalValue=complete?verifiedPartialGoalValue:null;
  const fingerprintPayload=stable({
    version:TEAM_OBJECTIVE_EVALUATOR_VERSION,team_ids:(team?.slots||[]).map(row=>text(row.pokemon_id)),primary_goal:primaryGoal,
    production_registry_version:productionRegistry?.registry_version||null,members,active_energy_components:activeEnergyComponents,cooking_projection_fingerprint:cookingProjection?.input_fingerprint||null,
  });
  return Object.freeze({
    schema:'pokemon-sleep-team-objective-evaluation/1.0',evaluator_version:TEAM_OBJECTIVE_EVALUATOR_VERSION,input_fingerprint:`team_objective:${hash(JSON.stringify(fingerprintPayload))}`,
    team_id:team?.team_id||null,primary_goal:primaryGoal,objective_status:objectiveStatus,objective_score:totalGoalValue,total_goal_value:totalGoalValue,
    verified_partial_goal_value:verifiedPartialGoalValue,global_objective_complete:complete,
    components:Object.freeze({berry_energy_per_hour:berryEnergyPerHour,skill_energy_per_hour:skillEnergyPerHour,cooking_energy_per_hour:cookingEnergyPerHour}),
    active_verified_components:Object.freeze(activeEnergyComponents.map(([name])=>name)),missing_inputs:Object.freeze(missingInputs),members:Object.freeze(members),
    production_registry_version:productionRegistry?.registry_version||null,player_data_write:false,inventory_mutation:false,gemini_used:false,
  });
}
