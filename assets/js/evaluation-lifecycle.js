import {isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {localWeekStart,weeklyContextMatchesEpoch,EVALUATION_WEEK_VERSION} from './evaluation-week.js';
import {planFactEvaluationSnapshotRefresh,refreshFactEvaluationSnapshots} from './pokemon-evaluation-store.js';
import {currentWeeklyContext} from './weekly-context-store.js';

export const EVALUATION_LIFECYCLE_VERSION='evaluation-lifecycle-2026-08-10-b';

export function inspectEvaluationLifecycle({now=new Date(),pokemonIds=null,force=false}={}){
  if(isRescueReadonly())return Object.freeze({
    lifecycle_version:EVALUATION_LIFECYCLE_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,status:'PLAYER_DATA_UNAVAILABLE',
    week_epoch:localWeekStart(now),context_id:null,goal_profile_id:null,refresh_required:false,write_required:false,auto_refresh_allowed:false,
    target_count:0,refresh_count:0,reused_count:0,stale_count:0,write_performed:false,player_rows_modified:false,
  });
  const weeklyContext=currentWeeklyContext({date:now}),profile=getActiveStrategyGoalProfile(),epoch=localWeekStart(now);
  if(!profile)return Object.freeze({
    lifecycle_version:EVALUATION_LIFECYCLE_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,status:'GOAL_PROFILE_MISSING',week_epoch:epoch,
    context_id:weeklyContext.context_id||null,goal_profile_id:null,weekly_context_authority:weeklyContext.authority_source||'MISSING',refresh_required:false,write_required:false,auto_refresh_allowed:false,
    target_count:0,refresh_count:0,reused_count:0,stale_count:0,write_performed:false,player_rows_modified:false,
  });
  if(!weeklyContext.context_id||!String(weeklyContext.week_start||'').trim())return Object.freeze({
    lifecycle_version:EVALUATION_LIFECYCLE_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,status:'WEEKLY_CONTEXT_MISSING',week_epoch:epoch,
    context_id:weeklyContext.context_id||null,goal_profile_id:profile.goal_profile_id||null,weekly_context_authority:weeklyContext.authority_source||'MISSING',refresh_required:false,write_required:false,auto_refresh_allowed:false,
    target_count:0,refresh_count:0,reused_count:0,stale_count:0,write_performed:false,player_rows_modified:false,
  });
  if(!weeklyContextMatchesEpoch(weeklyContext,epoch))return Object.freeze({
    lifecycle_version:EVALUATION_LIFECYCLE_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,status:'WEEKLY_CONTEXT_EPOCH_MISMATCH',week_epoch:epoch,
    stored_week_start:String(weeklyContext.week_start||''),context_id:weeklyContext.context_id||null,goal_profile_id:profile.goal_profile_id||null,weekly_context_authority:weeklyContext.authority_source||'MISSING',
    refresh_required:false,write_required:false,auto_refresh_allowed:false,target_count:0,refresh_count:0,reused_count:0,stale_count:0,
    write_performed:false,player_rows_modified:false,
  });
  const plan=planFactEvaluationSnapshotRefresh({pokemonIds,force});
  const status=plan.status==='NO_ACTIVE_POKEMON'?'NO_ACTIVE_POKEMON':plan.refresh_required?'REFRESH_REQUIRED':'CURRENT';
  return Object.freeze({
    lifecycle_version:EVALUATION_LIFECYCLE_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,status,week_epoch:epoch,
    context_id:weeklyContext.context_id||null,goal_profile_id:profile.goal_profile_id||null,weekly_context_authority:weeklyContext.authority_source||'MISSING',auto_refresh_allowed:true,
    target_count:plan.target_count,refresh_count:plan.refresh_count,reused_count:plan.reused_count,stale_count:plan.stale_count,
    refresh_required:plan.refresh_required,write_required:plan.write_required,force:Boolean(force),write_performed:false,player_rows_modified:false,
  });
}

export async function refreshEvaluationLifecycle({reason='unspecified',now=new Date(),pokemonIds=null,force=false}={}){
  const inspection=inspectEvaluationLifecycle({now,pokemonIds,force});
  if(!inspection.auto_refresh_allowed||(!inspection.write_required&&!force))return Object.freeze({...inspection,reason,write_performed:false,snapshot_created:false});
  const result=await refreshFactEvaluationSnapshots({pokemonIds,force});
  return Object.freeze({
    ...inspection,reason,status:result.status==='READY'?'CURRENT':result.status,
    refresh_required:false,write_required:false,created:result.created||0,reused:result.reused||0,staled:result.staled||0,skipped:result.skipped||0,
    write_performed:Boolean(result.write_performed),snapshot_created:Boolean(result.snapshot_created),player_rows_modified:false,
  });
}
