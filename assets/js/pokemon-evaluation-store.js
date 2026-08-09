import {rows,run,persist,snapshot,isRescueReadonly} from './database.js';
import {localIso} from './time-utils.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {
  POKEMON_EVALUATION_RULE_VERSION,
  pokemonEvaluationFingerprint,
  buildFactOnlyPokemonEvaluation,
} from './pokemon-evaluation-contract.js';

const parse=(value,fallback)=>{try{return JSON.parse(value??'')??fallback;}catch{return fallback;}};
const setting=key=>parse(rows('SELECT value_json FROM settings WHERE key=?',[key])[0]?.value_json,null);

export function currentEvaluationMasterVersions(){
  if(isRescueReadonly())return {};
  return {
    shared_master_version:setting('shared_master_version'),
    public_recipe_master_version:setting('public_recipe_master_version'),
    public_item_master_version:setting('public_item_master_version'),
    canonical_registry_version:setting('canonical_registry_version'),
    public_pokemon_knowledge_version:setting('public_pokemon_knowledge_version'),
  };
}

function latestWeeklyContext(){return rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0]||{};}
function pokemonDetail(pokemonId){
  const pokemon=rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null;
  if(!pokemon)return null;
  return {
    pokemon,
    ingredients:rows('SELECT * FROM pokemon_ingredients WHERE pokemon_id=? ORDER BY unlock_level,ingredient_name',[pokemonId]),
    subskills:rows('SELECT * FROM pokemon_subskills WHERE pokemon_id=? ORDER BY unlock_level,subskill_name',[pokemonId]),
  };
}
function deserialize(row){
  if(!row)return null;
  return {
    ...row,
    master_versions:parse(row.master_versions_json,{}),
    score_breakdown:parse(row.score_breakdown_json,{}),
    reasons:parse(row.reasons_json,[]),
    missing_inputs:parse(row.missing_inputs_json,[]),
    failed_constraints:parse(row.failed_constraints_json,[]),
    reused:false,
  };
}
function snapshotId(pokemonId,fingerprint){return `eval_${String(pokemonId).replace(/[^a-zA-Z0-9_-]/g,'_')}_${fingerprint.split(':').pop()}`;}

export function getCurrentPokemonEvaluationSnapshot(pokemonId){
  if(isRescueReadonly())return null;
  return deserialize(rows(`SELECT * FROM pokemon_evaluation_snapshot
    WHERE pokemon_id=? AND stale_at IS NULL ORDER BY evaluated_at DESC LIMIT 1`,[pokemonId])[0]||null);
}

export function listCurrentPokemonEvaluationSnapshots(){
  if(isRescueReadonly())return [];
  return rows(`SELECT * FROM pokemon_evaluation_snapshot WHERE stale_at IS NULL ORDER BY evaluated_at DESC,pokemon_id`).map(deserialize);
}

export async function refreshFactEvaluationSnapshots({pokemonIds=null,force=false}={}){
  if(isRescueReadonly())return {status:'PLAYER_DATA_UNAVAILABLE',created:0,reused:0,staled:0,player_rows_modified:false};
  const profile=getActiveStrategyGoalProfile();
  const weeklyContext=latestWeeklyContext();
  const masterVersions=currentEvaluationMasterVersions();
  const source=(pokemonIds?.length?pokemonIds.map(id=>({pokemon_id:id})):rows("SELECT pokemon_id FROM pokemon WHERE status='active' ORDER BY pokemon_id"));
  const targets=[...new Set(source.map(row=>String(row.pokemon_id||'')).filter(Boolean))];
  if(!targets.length)return {status:'NO_ACTIVE_POKEMON',created:0,reused:0,staled:0,player_rows_modified:false};
  await snapshot('war-room:evaluation-snapshots');
  const evaluatedAt=localIso();
  let created=0,reused=0,staled=0,skipped=0;
  for(const pokemonId of targets){
    const detail=pokemonDetail(pokemonId);if(!detail){skipped+=1;continue;}
    const input={...detail,weeklyContext,goalProfile:profile,masterVersions,ruleVersion:POKEMON_EVALUATION_RULE_VERSION};
    const fingerprint=pokemonEvaluationFingerprint(input);
    const existing=rows(`SELECT * FROM pokemon_evaluation_snapshot
      WHERE pokemon_id=? AND input_fingerprint=? AND stale_at IS NULL LIMIT 1`,[pokemonId,fingerprint])[0];
    if(existing&&!force){reused+=1;continue;}
    const staleRows=rows(`SELECT evaluation_id FROM pokemon_evaluation_snapshot
      WHERE pokemon_id=? AND stale_at IS NULL AND input_fingerprint<>?`,[pokemonId,fingerprint]);
    if(staleRows.length){run(`UPDATE pokemon_evaluation_snapshot SET stale_at=? WHERE pokemon_id=? AND stale_at IS NULL AND input_fingerprint<>?`,[evaluatedAt,pokemonId,fingerprint]);staled+=staleRows.length;}
    const result=buildFactOnlyPokemonEvaluation(input),evaluationId=snapshotId(pokemonId,fingerprint);
    run(`INSERT INTO pokemon_evaluation_snapshot(
      evaluation_id,pokemon_id,input_fingerprint,context_id,goal_profile_id,master_versions_json,rule_version,
      intrinsic_score,current_readiness_score,weekly_fit_score,roster_marginal_value_score,training_roi_score,
      score_breakdown_json,reasons_json,missing_inputs_json,hard_constraint_status,failed_constraints_json,
      evaluation_status,evaluated_at,stale_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
    ON CONFLICT(pokemon_id,input_fingerprint) DO UPDATE SET
      context_id=excluded.context_id,goal_profile_id=excluded.goal_profile_id,master_versions_json=excluded.master_versions_json,
      rule_version=excluded.rule_version,intrinsic_score=excluded.intrinsic_score,current_readiness_score=excluded.current_readiness_score,
      weekly_fit_score=excluded.weekly_fit_score,roster_marginal_value_score=excluded.roster_marginal_value_score,
      training_roi_score=excluded.training_roi_score,score_breakdown_json=excluded.score_breakdown_json,
      reasons_json=excluded.reasons_json,missing_inputs_json=excluded.missing_inputs_json,
      hard_constraint_status=excluded.hard_constraint_status,failed_constraints_json=excluded.failed_constraints_json,
      evaluation_status=excluded.evaluation_status,evaluated_at=excluded.evaluated_at,stale_at=NULL`,[
      evaluationId,pokemonId,fingerprint,weeklyContext.context_id||null,profile?.goal_profile_id||null,JSON.stringify(masterVersions),POKEMON_EVALUATION_RULE_VERSION,
      result.intrinsic_score,result.current_readiness_score,result.weekly_fit_score,result.roster_marginal_value_score,result.training_roi_score,
      JSON.stringify(result.score_breakdown),JSON.stringify(result.reasons),JSON.stringify(result.missing_inputs),result.hard_constraint_status,
      JSON.stringify(result.failed_constraints),result.evaluation_status,evaluatedAt,
    ]);
    created+=1;
  }
  await persist();
  window.dispatchEvent?.(new CustomEvent('pokemon-sleep:evaluation-snapshots-changed',{detail:{created,reused,staled,skipped,rule_version:POKEMON_EVALUATION_RULE_VERSION}}));
  return {status:'READY',created,reused,staled,skipped,rule_version:POKEMON_EVALUATION_RULE_VERSION,goal_profile_id:profile?.goal_profile_id||null,context_id:weeklyContext.context_id||null,player_rows_modified:false};
}
