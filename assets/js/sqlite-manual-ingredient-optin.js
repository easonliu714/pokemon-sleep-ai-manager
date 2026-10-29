// G265 ninth manual-editor.js::saveIngredient() isolated opt-in only.
// The production legacy writer is unchanged and this module is never imported by the app.
// Native Web Lock + fresh durable SQL.js transaction + generation/SHA atomic CAS.
// Private ingredient and audit rows share one transaction; no Public Master mutations.
// This is NOT an independently restorable crash snapshot or all-writer containment.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const nonempty=(value,max)=>typeof value==='string'&&value.trim()===value
  &&value.length>0&&value.length<=max;
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const records=(sql,query,params=[])=>sql.exec(query,params)?.[0]?.values||[];
const objects=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(result.columns.map((key,i)=>[key,values[i]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const REASON='前端手動修改食材庫存與解鎖狀態';
const normalizeUnlock=value=>{
  if(value===undefined||value===null||value==='')return null;
  if(value===1||value===true||value==='1')return 1;
  if(value===0||value===false||value==='0')return 0;
  throw fail('G265_MANUAL_INGREDIENT_UNLOCK_INVALID');
};

export function createManualIngredientOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    name,quantity,unlockInput=undefined,updatedAt,auditId,
    expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_MANUAL_INGREDIENT_UNVERIFIED_RELOAD_REQUIRED');
    if(!nonempty(name,128)||!Number.isSafeInteger(quantity)||quantity<0)
      throw fail('G265_MANUAL_INGREDIENT_INPUT_INVALID');
    const requestedUnlock=normalizeUnlock(unlockInput);
    if(quantity>0&&requestedUnlock===0)
      throw fail('G265_MANUAL_INGREDIENT_UNLOCK_CONTRADICTION');
    if(!utc(updatedAt)||!nonempty(auditId,128)
      ||!/^MANUAL-[A-Za-z0-9-]+$/.test(auditId))
      throw fail('G265_MANUAL_INGREDIENT_AUDIT_PROVENANCE_INVALID');
    let before=null,after=null,unlocked=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:manual-ingredient:'+name,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        // Read-only Public Master identity must exist before any private write.
        if(records(sql,'SELECT 1 FROM ingredient_master WHERE ingredient_name=?',[name]).length!==1)
          throw fail('G265_MANUAL_INGREDIENT_MASTER_IDENTITY_MISSING');
        if(records(sql,'SELECT 1 FROM import_batches WHERE update_id=?',[auditId]).length
          ||records(sql,'SELECT 1 FROM import_changes WHERE update_id=?',[auditId]).length)
          throw fail('G265_MANUAL_INGREDIENT_AUDIT_ID_REPLAY');
        const prior=objects(sql,'SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name]);
        if(prior.length>1)throw fail('G265_MANUAL_INGREDIENT_AMBIGUOUS_PRIOR');
        before=prior[0]||null;
        // Match exact legacy semantics: quantity>0 implies unlocked;
        // zero + omitted unlock preserves the latest durable prior state (or UNKNOWN).
        unlocked=quantity>0?1:unlockInput===undefined?(before?.unlocked??null):requestedUnlock;
        sql.run('INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at,source_update_id) VALUES(?,?,?,?,?) ON CONFLICT(ingredient_name) DO UPDATE SET quantity=excluded.quantity,unlocked=excluded.unlocked,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id',
          [name,quantity,unlocked,updatedAt,'MANUAL-EDIT']);
        const next=objects(sql,'SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name]);
        if(next.length!==1)throw fail('G265_MANUAL_INGREDIENT_MUTATED_ROW_MISSING');
        after=next[0];
        sql.run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',
          [auditId,'manual-1.0',updatedAt,updatedAt,'manual_frontend_edit',1,
            JSON.stringify({status:'applied',reason:REASON})]);
        sql.run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',
          [auditId,0,'ingredient_inventory','manual_update',JSON.stringify({ingredient_name:name}),
            JSON.stringify(before),JSON.stringify(after),'applied',REASON]);
      }
    });
    // Pair ACK alone is insufficient: reopen durable bytes and verify ingredient
    // and BOTH private audit records against the exact committed revision.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_MANUAL_INGREDIENT_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const ingredients=objects(sql,'SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[name]);
        const batches=records(sql,'SELECT schema_version,generated_at,imported_at,source,operation_count,result_json FROM import_batches WHERE update_id=?',[auditId]);
        const changes=records(sql,'SELECT operation_index,entity,action,key_json,before_json,after_json,status,message FROM import_changes WHERE update_id=?',[auditId]);
        if(ingredients.length!==1||!same(ingredients[0],after)
          ||ingredients[0].quantity!==quantity||ingredients[0].unlocked!==unlocked
          ||ingredients[0].source_update_id!=='MANUAL-EDIT'
          ||batches.length!==1||!same(batches[0],[
            'manual-1.0',updatedAt,updatedAt,'manual_frontend_edit',1,
            JSON.stringify({status:'applied',reason:REASON})
          ])
          ||changes.length!==1||!same(changes[0],[
            0,'ingredient_inventory','manual_update',JSON.stringify({ingredient_name:name}),
            JSON.stringify(before),JSON.stringify(after),'applied',REASON
          ]))
          throw fail('G265_MANUAL_INGREDIENT_POST_ACK_ROW_OR_AUDIT_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,name,quantity,unlocked,auditId});
  }
  return Object.freeze({execute,status});
}
