import {rows,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {currentEvaluationMasterVersions} from './pokemon-evaluation-store.js';
import {buildStrategyContextPackage} from './strategy-context-package.js';
import {normalizeGeminiStrategyResponse} from './strategy-gemini-contract.js';
import {currentWeeklyContext} from './weekly-context-store.js';

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

export function normalizeLocalStrategyResponse(input,preview){
  const payload=preview?.payload||{};
  const validCandidateRefs=(payload.candidate_pokemon||[]).map(row=>row.candidate_ref).filter(Boolean);
  const validRecipeIds=(payload.recipe_gap_summary||[]).map(row=>row.recipe_id).filter(Boolean);
  return normalizeGeminiStrategyResponse(input,{validCandidateRefs,validRecipeIds});
}
