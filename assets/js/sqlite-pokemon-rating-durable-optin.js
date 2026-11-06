// G14.RATE.4 isolated disposable-SQLite writer; NEVER imported by the PWA.
// The fixture marker and independently durable snapshot are mandatory. This
// does NOT admit 23 legacy production writers or authorize player DB Apply.
import {reviewPokemonRatingApplyIntent} from './pokemon-rating-apply-preflight.js';
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';
import {sha256SqliteBytes} from './sqlite-cross-tab-write-admission.js';

const fail=code=>Object.assign(new Error(code),{code});
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const objects=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(
    result.columns.map((name,index)=>[name,values[index]])))||[];
};
const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
const copy=value=>value instanceof Uint8Array?new Uint8Array(value):
  value instanceof ArrayBuffer?new Uint8Array(value.slice(0)):null;
const FIXTURE_MARKER='G14_RATE4_DISPOSABLE_SQLITE_ONLY';
const rowQuery='SELECT pokemon_id,pokemon_instance_id,rating,level,status FROM pokemon WHERE pokemon_id=?';
const auditQuery='SELECT batch_id,pokemon_id,pokemon_instance_id,previous_rating,proposed_rating,rule_version,before_sha256,consent_digest,applied_at,level FROM g14_rate4_rating_audit WHERE batch_id=? AND pokemon_id=?';

/**
 * Safe Source/Test bridge: user-confirmed diff -> immutable independent SQLite
 * byte snapshot -> G265 native Web Lock + fresh durable CAS + synchronous SQL.js
 * transaction -> atomic pair -> independent logical reload readback.
 * A disposable-only schema marker prevents accidental production admission.
 */
export function createPokemonRatingDurableOptIn({
  pairGate,openSqlite,snapshotStore,fingerprint=sha256SqliteBytes
}={}){
  if(typeof pairGate?.readVerified!=='function'||typeof pairGate?.write!=='function'
    ||typeof openSqlite!=='function'||typeof snapshotStore?.write!=='function'
    ||typeof snapshotStore?.read!=='function'||typeof fingerprint!=='function')
    throw new TypeError('G14_RATE4_INVALID_ISOLATED_ADAPTER');
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let state='READY';
  const verifySnapshot=async(record,revision,requestDigest,beforeBytes)=>{
    const bytes=copy(record?.bytes);
    if(!bytes||!bytes.length||record.generation!==revision.generation
      ||record.sha256!==revision.sha256||record.requestDigest!==requestDigest
      ||record.fixture_marker!==FIXTURE_MARKER
      ||await fingerprint(bytes)!==revision.sha256||!equal(bytes,beforeBytes))
      throw fail('G14_RATE4_SNAPSHOT_READBACK_MISMATCH');
    return bytes;
  };
  async function execute(input={}){
    if(state!=='READY')throw fail('G14_RATE4_UNVERIFIED_RELOAD_REQUIRED');
    // Freeze a JSON-only request before the first await; no caller object is
    // forwarded to a later transaction after asynchronous snapshot persistence.
    let bound;
    try{bound=JSON.parse(JSON.stringify(input));}
    catch{throw fail('G14_RATE4_INVALID_REQUEST');}
    const {preview,freshView,selectedPokemonIds,confirmation,expectedGeneration,
      expectedFingerprint,batchId,appliedAt}=bound||{};
    if(!id(batchId)||!batchId.startsWith('rate_')||batchId.length<17
      ||!utc(appliedAt)||!Number.isSafeInteger(expectedGeneration)
      ||expectedGeneration<0||!digest(expectedFingerprint)
      ||!Array.isArray(selectedPokemonIds)||selectedPokemonIds.length>1000)
      throw fail('G14_RATE4_INVALID_REQUEST');
    const review=reviewPokemonRatingApplyIntent({
      preview,freshView,selectedPokemonIds,confirmation
    });
    if(review.status!=='HOLD_DURABLE_SNAPSHOT_AND_WRITER_ADMISSION'
      ||review.reviewed_diffs.length!==selectedPokemonIds.length)
      throw fail('G14_RATE4_PREAPPLY_REJECTED');
    const byId=new Map(freshView.rows.map(row=>[row.pokemon_id,row]));
    const selected=review.reviewed_diffs.map(diff=>{
      const row=byId.get(diff.pokemon_id);
      if(!row||!Number.isSafeInteger(row.level)||row.level<1
        ||!id(diff.pokemon_id)||!id(diff.pokemon_instance_id))
        throw fail('G14_RATE4_INVALID_SELECTED_ROW');
      return Object.freeze({...diff,level:row.level});
    });
    state='CAPTURING';
    try{
      const requestDigest=await fingerprint(new TextEncoder().encode(JSON.stringify({
        batchId,appliedAt,expectedGeneration,expectedFingerprint,
        selectedPokemonIds,confirmation,selected,
        selectedEvidence:selectedPokemonIds.map(pokemonId=>byId.get(pokemonId))
      })));
      if(!digest(requestDigest))throw fail('G14_RATE4_INVALID_CONSENT_DIGEST');
      const before=await pairGate.readVerified();
      if(before.generation!==expectedGeneration||before.sha256!==expectedFingerprint)
        throw fail('G14_RATE4_STALE_DURABLE_BEFORE_SNAPSHOT');
      const snapshotBytes=copy(before.bytes);
      if(!snapshotBytes||!snapshotBytes.length
        ||await fingerprint(snapshotBytes)!==expectedFingerprint)
        throw fail('G14_RATE4_INVALID_DURABLE_BASE');
      await snapshotStore.write({generation:before.generation,sha256:before.sha256,
        requestDigest,fixture_marker:FIXTURE_MARKER,bytes:snapshotBytes.slice().buffer});
      await verifySnapshot(await snapshotStore.read(),before,requestDigest,snapshotBytes);
      const latest=await pairGate.readVerified();
      if(latest.generation!==before.generation||latest.sha256!==before.sha256
        ||!equal(latest.bytes,snapshotBytes))
        throw fail('G14_RATE4_DURABLE_CHANGED_AFTER_SNAPSHOT');
      state='IN_FLIGHT';
      const result=await transaction.execute({
        reason:'g14:rate4:disposable:'+batchId,
        expectedGeneration,expectedFingerprint,
        mutate:sql=>{
          const marker=objects(sql,
            'SELECT marker FROM g14_rate4_fixture_authority WHERE marker=?',
            [FIXTURE_MARKER]);
          if(marker.length!==1||marker[0].marker!==FIXTURE_MARKER)
            throw fail('G14_RATE4_PRODUCTION_SCHEMA_NOT_ADMITTED');
          // Check EVERY selected record before ANY update; one transaction
          // rolls back the whole batch on a late identity or old-value change.
          for(const item of selected){
            const rows=objects(sql,rowQuery,[item.pokemon_id]);
            if(rows.length!==1||rows[0].status!=='active'
              ||rows[0].pokemon_instance_id!==item.pokemon_instance_id
              ||rows[0].rating!==item.previous_rating
              ||rows[0].level!==item.level)
              throw fail('G14_RATE4_DURABLE_RECORD_STALE');
            if(objects(sql,auditQuery,[batchId,item.pokemon_id]).length)
              throw fail('G14_RATE4_AUDIT_REPLAY');
          }
          for(const item of selected){
            sql.run('UPDATE pokemon SET rating=? WHERE pokemon_id=? AND pokemon_instance_id=? AND rating IS ? AND level=? AND status=?',
              [item.proposed_rating,item.pokemon_id,item.pokemon_instance_id,
                item.previous_rating,item.level,'active']);
            if(objects(sql,'SELECT changes() AS changed')[0]?.changed!==1)
              throw fail('G14_RATE4_UPDATE_CAS_FAILED');
            sql.run('INSERT INTO g14_rate4_rating_audit(batch_id,pokemon_id,pokemon_instance_id,previous_rating,proposed_rating,rule_version,before_sha256,consent_digest,applied_at,level) VALUES(?,?,?,?,?,?,?,?,?,?)',
              [batchId,item.pokemon_id,item.pokemon_instance_id,
                item.previous_rating,item.proposed_rating,item.rule_version,
                expectedFingerprint,requestDigest,appliedAt,item.level]);
          }
        }
      });
      if(result.status!=='PERSISTED'||result.generation!==expectedGeneration+1)
        throw fail('G14_RATE4_DURABLE_ACK_UNVERIFIED');
      const persisted=await pairGate.readVerified();
      if(persisted.generation!==result.generation||persisted.sha256!==result.sha256)
        throw fail('G14_RATE4_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(persisted.bytes));
      try{
        for(const item of selected){
          const rows=objects(sql,rowQuery,[item.pokemon_id]);
          const audits=objects(sql,auditQuery,[batchId,item.pokemon_id]);
          if(rows.length!==1||rows[0].rating!==item.proposed_rating
            ||rows[0].pokemon_instance_id!==item.pokemon_instance_id
            ||audits.length!==1||audits[0].previous_rating!==item.previous_rating
            ||audits[0].proposed_rating!==item.proposed_rating
            ||audits[0].rule_version!==item.rule_version
            ||audits[0].consent_digest!==requestDigest
            ||audits[0].before_sha256!==expectedFingerprint)
            throw fail('G14_RATE4_POST_ACK_LOGICAL_READBACK_MISMATCH');
        }
      }finally{sql.close();}
      await verifySnapshot(await snapshotStore.read(),before,requestDigest,snapshotBytes);
      state='ACKED_ISOLATED';
      return Object.freeze({status:'ISOLATED_PERSISTED',batchId,
        recordCount:selected.length,generation:result.generation,sha256:result.sha256,
        snapshotPreserved:true,productionApply:false,player_data_write:false,
        next_gate:'HOLD_PRODUCTION_ALL_WRITER_ADMISSION_AND_ANDROID_UAT'});
    }catch(error){state='UNVERIFIED_RELOAD_REQUIRED';throw error;}
  }
  async function inspectRecovery(){
    const saved=await snapshotStore.read(),bytes=copy(saved?.bytes);
    if(!bytes||!digest(saved?.sha256)||await fingerprint(bytes)!==saved.sha256)
      throw fail('G14_RATE4_RECOVERY_SNAPSHOT_UNVERIFIED');
    const current=await pairGate.readVerified();
    return Object.freeze({classification:current.sha256===saved.sha256
      &&current.generation===saved.generation?'NO_DURABLE_DELTA':'DURABLE_CHANGED_HOLD',
      snapshotGeneration:saved.generation,currentGeneration:current.generation,
      restoreAuthorized:false});
  }
  async function restore(){throw fail('G14_RATE4_RESTORE_BLOCKED_PRODUCTION_WRITERS_UNADMITTED');}
  return Object.freeze({execute,inspectRecovery,restore,
    status:()=>Object.freeze({status:state,productionApply:false})});
}
