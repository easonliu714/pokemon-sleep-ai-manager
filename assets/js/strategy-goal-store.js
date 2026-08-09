import {rows,run,persist,snapshot,isRescueReadonly} from './database.js';
import {localIso} from './time-utils.js';
import {normalizeStrategyGoalProfile,strategyGoalProfileValidation,STRATEGY_GOAL_PROFILE_VERSION} from './strategy-goal-contract.js';

const parse=(value,fallback)=>{try{return JSON.parse(value??'')??fallback;}catch{return fallback;}};
const id=()=>`goal_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;

export function deserializeStrategyGoalProfile(row){
  if(!row)return null;
  return {
    goal_profile_id:row.goal_profile_id,
    profile_name:row.profile_name||'',
    primary_goal:row.primary_goal,
    secondary_goals:parse(row.secondary_goals_json,[]),
    weights:parse(row.weights_json,{}),
    hard_constraints:parse(row.hard_constraints_json,{}),
    profile_version:row.profile_version,
    is_active:Number(row.is_active||0)===1,
    created_at:row.created_at,
    updated_at:row.updated_at,
  };
}

export function getActiveStrategyGoalProfile(){
  if(isRescueReadonly())return null;
  return deserializeStrategyGoalProfile(rows('SELECT * FROM strategy_goal_profile WHERE is_active=1 ORDER BY updated_at DESC LIMIT 1')[0]||null);
}

export function listStrategyGoalProfiles(){
  if(isRescueReadonly())return [];
  return rows('SELECT * FROM strategy_goal_profile ORDER BY is_active DESC,updated_at DESC').map(deserializeStrategyGoalProfile);
}

export async function saveStrategyGoalProfile(input,{goalProfileId=null,activate=true}={}){
  if(isRescueReadonly())throw new Error('目前為救援／唯讀狀態，無法儲存策略目標');
  const validation=strategyGoalProfileValidation(input);
  if(!validation.valid)throw new Error(`策略目標設定無效：${validation.errors.join(', ')}`);
  const normalized=normalizeStrategyGoalProfile(validation.normalized);
  const existing=goalProfileId?rows('SELECT * FROM strategy_goal_profile WHERE goal_profile_id=?',[goalProfileId])[0]:null;
  const profileId=goalProfileId||id(),createdAt=existing?.created_at||localIso(),updatedAt=localIso();
  await snapshot(`war-room:goal-profile:${profileId}`);
  if(activate)run('UPDATE strategy_goal_profile SET is_active=0 WHERE goal_profile_id<>?',[profileId]);
  run(`INSERT INTO strategy_goal_profile(
    goal_profile_id,profile_name,primary_goal,secondary_goals_json,weights_json,hard_constraints_json,
    profile_version,is_active,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(goal_profile_id) DO UPDATE SET
    profile_name=excluded.profile_name,primary_goal=excluded.primary_goal,
    secondary_goals_json=excluded.secondary_goals_json,weights_json=excluded.weights_json,
    hard_constraints_json=excluded.hard_constraints_json,profile_version=excluded.profile_version,
    is_active=excluded.is_active,updated_at=excluded.updated_at`,[
    profileId,normalized.profile_name,normalized.primary_goal,JSON.stringify(normalized.secondary_goals),
    JSON.stringify(normalized.weights),JSON.stringify(normalized.hard_constraints),STRATEGY_GOAL_PROFILE_VERSION,
    activate?1:Number(existing?.is_active||0),createdAt,updatedAt,
  ]);
  await persist();
  window.dispatchEvent?.(new CustomEvent('pokemon-sleep:strategy-goal-profile-changed',{detail:{
    goal_profile_id:profileId,fingerprint:validation.fingerprint,profile_version:STRATEGY_GOAL_PROFILE_VERSION,
  }}));
  return {...normalized,goal_profile_id:profileId,is_active:activate,created_at:createdAt,updated_at:updatedAt,fingerprint:validation.fingerprint};
}
