import {isDatabaseReady,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {optimizeTeam,TEAM_OPTIMIZER_VERSION} from './team-optimizer.js';

const text=value=>String(value??'').normalize('NFKC').trim();
const unique=value=>[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))];

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
  const optimized=optimizeTeam({scoringProjection,goalProfile,maxAlternatives});
  const mandatoryTokens=unique(goalProfile?.hard_constraints?.must_include_pokemon);
  const satisfiedMandatory=new Set((optimized.primary?.satisfied_constraints||[]).filter(value=>String(value).startsWith('mandatory_member:')).map(value=>String(value).slice('mandatory_member:'.length)));
  return Object.freeze({
    ...optimized,
    projection_status:'READY',goal_profile_id:goalProfile?.goal_profile_id||null,
    mandatory_member_count:mandatoryTokens.length,
    mandatory_satisfied_count:mandatoryTokens.filter(value=>satisfiedMandatory.has(value)).length,
  });
}
