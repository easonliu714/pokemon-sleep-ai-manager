import {isDatabaseReady,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {optimizeTeam,TEAM_OPTIMIZER_VERSION} from './team-optimizer.js';

export function buildLocalTeamOptimization({maxAlternatives=2}={}){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({
    schema:'pokemon-sleep-team-optimizer-result/1.0',optimizer_version:TEAM_OPTIMIZER_VERSION,
    projection_status:'PLAYER_DATA_UNAVAILABLE',primary:null,alternatives:Object.freeze([]),input_fingerprint:null,
    missing_inputs:Object.freeze(['player_database']),player_data_write:false,gemini_used:false,estimated_energy:null,
  });
  const goalProfile=getActiveStrategyGoalProfile();
  const scoringProjection=buildLocalPokemonCandidateScoring();
  if(scoringProjection.projection_status!=='READY')return Object.freeze({
    schema:'pokemon-sleep-team-optimizer-result/1.0',optimizer_version:TEAM_OPTIMIZER_VERSION,
    projection_status:scoringProjection.projection_status||'PLAYER_DATA_UNAVAILABLE',primary:null,alternatives:Object.freeze([]),input_fingerprint:null,
    missing_inputs:Object.freeze([...(scoringProjection.missing_inputs||[])]),player_data_write:false,gemini_used:false,estimated_energy:null,
  });
  return Object.freeze({
    ...optimizeTeam({scoringProjection,goalProfile,maxAlternatives}),
    projection_status:'READY',goal_profile_id:goalProfile?.goal_profile_id||null,
  });
}
