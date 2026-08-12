import {rows,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {currentEvaluationMasterVersions} from './pokemon-evaluation-store.js';
import {buildStrategyContextPackage} from './strategy-context-package.js';
import {normalizeGeminiStrategyResponse} from './strategy-gemini-contract.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {buildLocalTeamOptimization} from './team-optimizer-local.js';
import {buildLocalRecipePortfolioContention} from './recipe-portfolio-contention-local.js';
import {currentProductionAuthorityRegistry} from './production-authority-registry.js';
import {evaluateTeamObjective} from './team-objective-evaluator.js';
import {buildStrategyOptimizationPack} from './strategy-optimization-pack.js';
import {buildExternalOptimizationPrompt,normalizeOptimizationAiResponse,intakeOptimizationAiResponse} from './strategy-optimization-ai-contract.js';

export function buildLocalStrategyContextPreview({includeEventText=false,candidateLimit=20,recipeLimit=10}={}){
  if(isRescueReadonly())return {status:'PLAYER_DATA_UNAVAILABLE',payload:null,resolver:{},privacy_manifest:{raw_sqlite_in_payload:false,api_key_in_payload:false},missing_inputs:['player_database']};
  const weeklyContext=currentWeeklyContext(),goalProfile=getActiveStrategyGoalProfile();
  const candidateScoring=buildLocalPokemonCandidateScoring(),recipeStrategy=buildLocalRecipeStrategyProjection();
  const currentTeamPokemonIds=rows("SELECT pokemon_id FROM pokemon WHERE status='active' AND is_main=1 ORDER BY pokemon_id").map(row=>row.pokemon_id);
  const packageResult=buildStrategyContextPackage({
    weeklyContext,goalProfile,candidateScoring,recipeStrategy,masterVersions:currentEvaluationMasterVersions(),currentTeamPokemonIds,
    includeEventText,candidateLimit,recipeLimit,
  });
  const missing_inputs=[];
  if(!goalProfile)missing_inputs.push('active_goal_profile');
  if(!weeklyContext.context_id)missing_inputs.push('weekly_context');
  if(!currentTeamPokemonIds.length)missing_inputs.push('current_team_selection');
  return {...packageResult,status:'READY',missing_inputs,weekly_context_authority:weeklyContext.authority_source||'MISSING'};
}

export function buildLocalOptimizationStrategyPreview({includeEventText=false,candidateLimit=20,recipeLimit=12,searchBudget={}}={}){
  const base=buildLocalStrategyContextPreview({includeEventText,candidateLimit,recipeLimit});
  if(base.status!=='READY')return {...base,external_prompt:null,optimization_pack:false};
  const candidateScoring=buildLocalPokemonCandidateScoring(),teamOptimization=buildLocalTeamOptimization({maxAlternatives:3});
  const portfolio=buildLocalRecipePortfolioContention({objective:'maximize_verified_energy',maxMeals:3,maxAlternatives:3,beamWidth:64});
  const productionRegistry=currentProductionAuthorityRegistry();
  const pack=buildStrategyOptimizationPack({
    strategyContextResult:base,candidateScoring,teamOptimization,teamSupplyReadiness:portfolio?.team_supply_readiness||null,productionRegistry,searchBudget,
  });
  if(pack.status!=='READY')return {...pack,external_prompt:null,missing_inputs:[...(base.missing_inputs||[])]};
  const missing_inputs=[...(base.missing_inputs||[])];
  if(productionRegistry.numeric_rate_model_status!=='ACTIVE_VERIFIED')missing_inputs.push('production_rate_model:NOT_YET_VERIFIED');
  if(teamOptimization?.primary?.team_status!=='READY')missing_inputs.push(`seed_team:${teamOptimization?.primary?.team_status||'UNAVAILABLE'}`);
  return {
    ...pack,status:'READY',missing_inputs:[...new Set(missing_inputs)].sort(),external_prompt:buildExternalOptimizationPrompt(pack.payload),
    production_rate_model_status:productionRegistry.numeric_rate_model_status,team_search_execution_status:productionRegistry.numeric_rate_model_status==='ACTIVE_VERIFIED'?'READY_FOR_NUMERIC_SEARCH':'HOLD_NUMERIC_MODEL_NOT_ACTIVE',
  };
}

export function normalizeLocalStrategyResponse(input,preview){
  const payload=preview?.payload||{};
  const validCandidateRefs=(payload.candidate_pokemon||[]).map(row=>row.candidate_ref).filter(Boolean);
  const validRecipeIds=(payload.recipe_gap_summary||[]).map(row=>row.recipe_id).filter(Boolean);
  return normalizeGeminiStrategyResponse(input,{validCandidateRefs,validRecipeIds});
}

export function normalizeLocalOptimizationResponse(input,preview){
  const payload=preview?.payload||{};
  const validCandidateRefs=(payload.candidate_production_readiness||[]).map(row=>row.candidate_ref).filter(Boolean);
  const validRecipeIds=(payload.recipe_gap_summary||[]).map(row=>row.recipe_id).filter(Boolean);
  return normalizeOptimizationAiResponse(input,{validCandidateRefs,validRecipeIds});
}

export function intakeLocalOptimizationResponse(input,preview){
  const resolver=preview?.resolver||{};
  const candidateScoring=buildLocalPokemonCandidateScoring();
  const goalProfile=getActiveStrategyGoalProfile();
  const productionRegistry=currentProductionAuthorityRegistry();
  return intakeOptimizationAiResponse(input,{
    optimizationPreview:preview,
    evaluateProposal:(candidateRefs,row)=>{
      const pokemonIds=candidateRefs.map(ref=>resolver?.[ref]?.pokemon_id).filter(Boolean);
      if(pokemonIds.length!==5)return {objective_status:'RESOLVER_MISMATCH',objective_score:null,missing_inputs:['candidate_resolver']};
      const team={team_id:`ai_proposal:${row?.proposal_id||candidateRefs.join('-')}`,slots:pokemonIds.map((pokemon_id,index)=>({slot_index:index+1,pokemon_id}))};
      return evaluateTeamObjective({team,candidateFeatures:candidateScoring,goalProfile,productionRegistry,cookingProjection:null});
    },
  });
}
