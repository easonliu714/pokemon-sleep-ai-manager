// G265 local-only SQLite named planner draft persistence adapter.
// Not imported by runtime UI until a separate explicit-user-action Gate is accepted.
import {rows,run,begin,commit,rollback,persist,snapshot,isDatabaseReady,isRescueReadonly} from './database.js';
import {classifyNamedTeamDraftEligibility} from './war-room-named-team-draft-contract.js';

const PREFIX='war-room:named-team-draft:v1:';
const UNCERTAIN_KEY='pokemon-sleep-g265-named-draft-uncertain-v1';
const DRAFT_ID=/^draft_[A-Za-z0-9_-]{16,80}$/;
let inFlight=false;
let pendingUncertain=null;
const error=(code)=>Object.assign(new Error(code),{code});
const key=id=>PREFIX+id;
function markerRead(){
  try{
    const value=JSON.parse(globalThis.sessionStorage?.getItem(UNCERTAIN_KEY)||'null');
    return DRAFT_ID.test(value?.draft_id||'')?{draft_id:value.draft_id}:null;
  }catch{return null;}
}
function markerWrite(value){
  pendingUncertain=value;
  try{globalThis.sessionStorage?.setItem(UNCERTAIN_KEY,JSON.stringify(value));}catch{}
}
function markerClear(){
  try{globalThis.sessionStorage?.removeItem(UNCERTAIN_KEY);}catch{}
}
function requireReady(){
  if(!isDatabaseReady())throw error('DATABASE_NOT_READY');
  if(isRescueReadonly())throw error('RESCUE_READONLY');
}
function decodeRow(row,id){
  if(!row)return null;
  let record;
  try{record=JSON.parse(row.value_json);}catch{throw error('DRAFT_ROW_INVALID');}
  if(record?.schema!=='pokemon-sleep-named-team-draft-local-record/1.0'
    ||record?.draft_id!==id||record?.payload?.schema!=='pokemon-sleep-named-team-draft/1.0'
    ||record?.payload?.game_applied!==false||record?.payload?.local_only!==true
    ||record?.payload?.members?.length!==5)throw error('DRAFT_ROW_INVALID');
  return record;
}
function readRecord(id){
  const found=rows('SELECT value_json FROM settings WHERE key=?',[key(id)]);
  return decodeRow(found[0]||null,id);
}
function signature(payload){
  return JSON.stringify([payload.team_name,payload.goal_profile_id,payload.optimizer_result_fingerprint,
    payload.team_id,payload.team_input_fingerprint,payload.optimizer_version,
    payload.members.map(member=>[member.slot_index,member.pokemon_id,member.pokemon_instance_id])]);
}
export function getNamedTeamDraftPersistenceStatus(){
  const marker=pendingUncertain||markerRead();
  if(!marker)return Object.freeze({status:'CLEAR'});
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({status:'UNVERIFIED',draft_id:marker.draft_id});
  try{
    const record=readRecord(marker.draft_id);
    if(pendingUncertain)return Object.freeze({status:'UNVERIFIED',draft_id:marker.draft_id,recovery:'RELOAD_AND_READBACK'});
    markerClear();
    return Object.freeze({status:record?'PERSISTED':'NOT_PERSISTED',draft_id:marker.draft_id,source:'RELOADED_SQLITE_READBACK'});
  }catch{return Object.freeze({status:'UNVERIFIED',draft_id:marker.draft_id});}
}
export function readNamedTeamDraft(draftId){
  requireReady();
  if(!DRAFT_ID.test(String(draftId||'')))throw error('INVALID_DRAFT_ID');
  return readRecord(draftId);
}
export async function saveNamedTeamDraftLocal({draftId,name,projection,team,goalDraftState='clean',capturedAt=null}={}){
  if(inFlight)throw error('NAMED_DRAFT_SAVE_IN_FLIGHT');
  requireReady();
  if(getNamedTeamDraftPersistenceStatus().status==='UNVERIFIED')throw error('PERSISTENCE_UNCERTAIN');
  if(!DRAFT_ID.test(String(draftId||'')))throw error('INVALID_DRAFT_ID');
  const eligibility=classifyNamedTeamDraftEligibility({name,projection,team,goalDraftState,capturedAt});
  if(!eligibility.eligible)throw error('ELIGIBILITY_'+eligibility.reason);
  const active=rows('SELECT goal_profile_id FROM strategy_goal_profile WHERE is_active=1 ORDER BY updated_at DESC LIMIT 1')[0];
  if(active?.goal_profile_id!==eligibility.payload.goal_profile_id)throw error('ACTIVE_GOAL_PROFILE_CHANGED');
  const previous=readRecord(draftId);
  if(previous){
    if(signature(previous.payload)!==signature(eligibility.payload))throw error('DRAFT_ID_COLLISION');
    return Object.freeze({status:'ALREADY_PERSISTED',draft_id:draftId,game_applied:false,local_only:true});
  }
  const at=new Date().toISOString();
  const record={schema:'pokemon-sleep-named-team-draft-local-record/1.0',
    draft_id:draftId,payload:eligibility.payload,saved_at:at,game_applied:false,local_only:true};
  inFlight=true;
  try{
    // Snapshot must succeed before any player SQLite mutation.
    await snapshot('war-room:named-team-draft:'+draftId);
    begin();
    try{
      run('INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)',
        [key(draftId),JSON.stringify(record),at]);
      commit();
    }catch(e){rollback();throw e;}
    // SQLite COMMIT is not proof that IndexedDB received the exported database.
    try{
      await persist();
      const readback=readRecord(draftId);
      if(!readback||signature(readback.payload)!==signature(record.payload))throw error('POST_PERSIST_READBACK_MISMATCH');
    }catch(e){
      markerWrite({draft_id:draftId});
      throw Object.assign(error('PERSISTENCE_UNCERTAIN'),{cause:e,recovery:'RELOAD_AND_READBACK'});
    }
    return Object.freeze({status:'PERSISTED',draft_id:draftId,game_applied:false,local_only:true});
  }finally{inFlight=false;}
}
