// G265 sixth exact legacy writer: saveNamedTeamDraftLocal() isolated opt-in.
// Never imported by the production app; never touches a player database or game-side Apply.
// Atomic pair gate owns Web Lock, fresh durable bytes, generation/SHA CAS and readback.
// The original direct-persist writer remains unchanged and unadmitted.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';
import {classifyNamedTeamDraftEligibility} from './war-room-named-team-draft-contract.js';

const fail=code=>Object.assign(new Error(code),{code});
const DRAFT_ID=/^draft_[A-Za-z0-9_-]{16,80}$/;
const PREFIX='war-room:named-team-draft:v1:';
const one=(sql,query,params=[])=>sql.exec(query,params)?.[0]?.values||[];
const payloadSignature=payload=>JSON.stringify([
  payload.team_name,payload.goal_profile_id,payload.optimizer_result_fingerprint,
  payload.team_id,payload.team_input_fingerprint,payload.optimizer_version,
  payload.members.map(member=>[member.slot_index,member.pokemon_id,member.pokemon_instance_id])
]);

export function createNamedTeamDraftOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    draftId,name,projection,team,goalDraftState='clean',capturedAt,
    expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_NAMED_DRAFT_UNVERIFIED_RELOAD_REQUIRED');
    if(typeof draftId!=='string'||!DRAFT_ID.test(draftId))
      throw fail('G265_NAMED_DRAFT_EXPLICIT_ID_REQUIRED');
    // Require an explicit deterministic capture timestamp; no new Date inside the lock.
    if(typeof capturedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(capturedAt)
      ||!Number.isFinite(Date.parse(capturedAt))||new Date(capturedAt).toISOString()!==capturedAt)
      throw fail('G265_NAMED_DRAFT_EXACT_UTC_REQUIRED');
    const eligibility=classifyNamedTeamDraftEligibility({
      name,projection,team,goalDraftState,capturedAt
    });
    if(!eligibility.eligible)throw fail('G265_NAMED_DRAFT_ELIGIBILITY_'+eligibility.reason);
    const payload=eligibility.payload;
    const record=Object.freeze({
      schema:'pokemon-sleep-named-team-draft-local-record/1.0',
      draft_id:draftId,payload,saved_at:capturedAt,game_applied:false,local_only:true
    });
    const value=JSON.stringify(record),key=PREFIX+draftId;
    const outcome=await transaction.execute({
      reason:'g265:optin:named-team-draft:'+draftId,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const active=one(sql,'SELECT goal_profile_id FROM strategy_goal_profile WHERE is_active=1 ORDER BY updated_at DESC LIMIT 1');
        if(active.length!==1||active[0][0]!==payload.goal_profile_id)
          throw fail('G265_NAMED_DRAFT_ACTIVE_GOAL_CHANGED');
        const previous=one(sql,'SELECT value_json FROM settings WHERE key=?',[key]);
        if(previous.length)throw fail('G265_NAMED_DRAFT_DUPLICATE_OR_COLLISION_REPLAY');
        sql.run('INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)',
          [key,value,capturedAt]);
      }
    });
    // An atomic byte-pair ACK is not sufficient: re-open the independently
    // verified durable image and prove the exact logical draft survived.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_NAMED_DRAFT_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const rows=one(sql,'SELECT value_json FROM settings WHERE key=?',[key]);
        if(rows.length!==1||rows[0][0]!==value)
          throw fail('G265_NAMED_DRAFT_POST_ACK_ROW_MISMATCH');
        let readback;
        try{readback=JSON.parse(rows[0][0]);}
        catch{throw fail('G265_NAMED_DRAFT_POST_ACK_ROW_INVALID');}
        if(readback.draft_id!==draftId||readback.game_applied!==false
          ||readback.local_only!==true
          ||payloadSignature(readback.payload)!==payloadSignature(payload))
          throw fail('G265_NAMED_DRAFT_POST_ACK_ROW_INVALID');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,draftId,gameApplied:false,localOnly:true});
  }
  return Object.freeze({execute,status});
}
