import {rows,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {currentEvaluationMasterVersions} from './pokemon-evaluation-store.js';
import {projectPokemonCandidateFeatures} from './pokemon-candidate-feature-projection.js';
import {scorePokemonCandidateFeatures} from './pokemon-scoring-engine.js';
import {currentWeeklyContext} from './weekly-context-store.js';

function detailsForPokemon(pokemonRows){
  return pokemonRows.map(row=>({
    pokemon_id:row.pokemon_id,
    ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level,ingredient_name',[row.pokemon_id]),
    subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level,subskill_name',[row.pokemon_id]),
  }));
}

export function buildLocalPokemonCandidateFeatures(){
  if(isRescueReadonly())return {
    schema:'pokemon-sleep-candidate-feature-projection/1.0',projection_status:'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,
    summary:{candidate_count:0,rank_eligible_count:0,hard_constraint_counts:{REVIEW:1},weekly_ingredient_demand_total:0},
    candidates:[],missing_inputs:['player_database'],numeric_scores_generated:false,player_data_write:false,
  };
  const pokemon=rows("SELECT * FROM pokemon WHERE status='active' ORDER BY pokemon_id");
  const weeklyContext=currentWeeklyContext(),goalProfile=getActiveStrategyGoalProfile(),recipeStrategyProjection=buildLocalRecipeStrategyProjection();
  const collectionTargets=rows("SELECT * FROM collection_targets WHERE status='active' ORDER BY priority,species,target_id");
  return {
    ...projectPokemonCandidateFeatures({
      pokemon,pokemonDetails:detailsForPokemon(pokemon),weeklyContext,goalProfile,recipeStrategyProjection,collectionTargets,
      masterVersions:currentEvaluationMasterVersions(),
    }),
    projection_status:'READY',
  };
}

export function buildLocalPokemonCandidateScoring(){
  const featureProjection=buildLocalPokemonCandidateFeatures();
  if(featureProjection.projection_status!=='READY')return {
    schema:'pokemon-sleep-evidence-gated-scoring/1.0',
    projection_status:'PLAYER_DATA_UNAVAILABLE',
    feature_fingerprint:null,
    active_numeric_dimensions:[],
    candidates:[],
    ranked_candidates:[],
    summary:{candidate_count:0,rank_eligible_count:0,scored_candidate_count:0},
    missing_inputs:['player_database'],
    player_data_write:false,
  };
  return {...scorePokemonCandidateFeatures(featureProjection),projection_status:'READY'};
}
