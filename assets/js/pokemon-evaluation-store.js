import {rows,run,persist,snapshot,isRescueReadonly} from './database.js';
import {localIso} from './time-utils.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {planSnapshotLifecycle,EVALUATION_REFRESH_PLAN_VERSION} from './evaluation-refresh-plan.js';
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
function activePokemonIds(pokemonIds=null){
  const source=(pokemonIds?.length?pokemonIds.map(id=>({pokemon_id:id})):rows("SELECT pokemon_id FROM pokemon WHERE status='active' ORDER BY pokemon_id"));
  return [...new Set(source.map(row=>String(row.pokemon_id||'')).filter(Boolean))];
}
function evaluationEnvironment(){
  return {profile:getActiveStrategyGoalProfile(),weeklyContext:latestWeeklyContext(),masterVersions:currentEvaluationMasterVersions()};
}
function targetFingerprint(pokemonId,environment){
  const detail=pokemonDetail(pokemonId);if(!detail)return null;
  const input={...detail,weeklyContext:environment.weeklyContext,goalProfile:environment.profile,masterVersions:environment.masterVersions,ruleVersion:POKEMON_EVALUATION_RULE_VERSION};
  return {pokemon_id:pokemonId,input_fingerprint:pokemonEvaluationFingerprint(input)};
}

export function getCurrentPokemonEvaluationSnapshot(pokemonId){
  if(isRescueReadonly())return null;
  return deserialize(rows(`SELECT * FROM pokemon_evaluation_snapshot
    WHERE pokemon_id=? AND stale_at IS NULL ORDER BY evaluated_at DESC LIMIT 1`,[pokemonId])[0]||null);
}

export function listCurrentPokemonEvaluationSnapshots(){
  if(isRescueReadonly())return [];
  return rows(`SELECT * FROM pokemon_evaluation_snapshot WHERE stale_at IS NULL ORDER BY evaluated_at DESC,pokemon_id`).map(deserialize);
}

export function planFactEvaluationSnapshotRefresh({pokemonIds=null,force=false}={}){
  if(isRescueReadonly())return Object.freeze({
    status:'PLAYER_DATA_UNAVAILABLE',plan_version:EVALUATION_REFRESH_PLAN_VERSION,target_count:0,current_snapshot_count:0,
    refresh_count:0,reused_count:0,stale_count:0,refresh_required:false,write_required:false,force:Boolean(force),
    refresh_targets:Object.freeze([]),reused_targets:Object.freeze([]),stale_snapshot_ids:Object.freeze([]),skipped:0,
  });
  const environment=evaluationEnvironment(),targets=[],ids=activePokemonIds(pokemonIds);let skipped=0;
  for(const pokemonId of ids){const target=targetFingerprint(pokemonId,environment);if(target)targets.push(target);else skipped+=1;}
  const current=rows(`SELECT evaluation_id,pokemon_id,input_fingerprint FROM pokemon_evaluation_snapshot
    WHERE stale_at IS NULL ORDER BY pokemon_id,evaluated_at DESC`);
  const plan=planSnapshotLifecycle({targets,currentSnapshots:current,force});
  const status=!targets.length&&!current.length?'NO_ACTIVE_POKEMON':'READY';
  return Object.freeze({...plan,status,skipped,goal_profile_id:environment.profile?.goal_profile_id||null,context_id:environment.weeklyContext.context_id||null,rule_version:POKEMON_EVALUATION_RULE_VERSION});
}

export async function refreshFactEvaluationSnapshots({pokemonIds=null,force=false}={}){
  if(isRescueReadonly())return {status:'PLAYER_DATA_UNAVAILABLE',created:0,reused:0,staled:0,skipped:0,write_performed:false,snapshot_created:false,player_rows_modified:false};
  const plan=planFactEvaluationSnapshotRefresh({pokemonIds,force});
  if(plan.status==='NO_ACTIVE_POKEMON')return {status:'NO_ACTIVE_POKEMON',created:0,reused:0,staled:0,skipped:plan.skipped||0,write_performed:false,snapshot_created:false,player_rows_modified:false};
  if(!plan.write_required&&!force)return {
    status:'READY',created:0,reused:plan.reused_count,staled:0,skipped:plan.skipped||0,rule_version:POKEMON_EVALUATION_RULE_VERSION,
    goal_profile_id:plan.goal_profile_id||null,context_id:plan.context_id||null,write_performed:false,snapshot_created:false,player_rows_modified:false,
  };

  const profile=getActiveStrategyGoalProfile(),weeklyContext=latestWeeklyContext(),masterVersions=currentEvaluationMasterVersions();
  const refreshIds=force?activePokemonIds(pokemonIds):plan.refresh_targets.map(row=>row.pokemon_id);
  const refreshSet=new Set(refreshIds);
  const evaluatedAt=localIso();
  await snapshot('war-room:evaluation-snapshots');
  let created=0,reused=force?0:plan.reused_count,staled=0,skipped=plan.skipped||0;

  for(const evaluationId of plan.stale_snapshot_ids){
    run('UPDATE pokemon_evaluation_snapshot SET stale_at=? WHERE evaluation_id=? AND stale_at IS NULL',[evaluatedAt,evaluationId]);
    staled+=1;
  }

  for(const pokemonId of refreshIds){
    const detail=pokemonDetail(pokemonId);if(!detail){skipped+=1;continue;}
    const input={...detail,weeklyContext,goalProfile:profile,masterVersions,ruleVersion:POKEMON_EVALUATION_RULE_VERSION};
    const fingerprint=pokemonEvaluationFingerprint(input);
    if(!force&&!refreshSet.has(pokemonId)){reused+=1;continue;}
    if(force){
      const staleRows=rows(`SELECT evaluation_id FROM pokemon_evaluation_snapshot
        WHERE pokemon_id=? AND stale_at IS NULL AND input_fingerprint<>?`,[pokemonId,fingerprint]);
      for(const row of staleRows){run('UPDATE pokemon_evaluation_snapshot SET stale_at=? WHERE evaluation_id=? AND stale_at IS NULL',[evaluatedAt,row.evaluation_id]);staled+=1;}
    }
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
  return {status:'READY',created,reused,staled,skipped,rule_version:POKEMON_EVALUATION_RULE_VERSION,goal_profile_id:profile?.goal_profile_id||null,context_id:weeklyContext.context_id||null,write_performed:true,snapshot_created:true,player_rows_modified:false};
}
