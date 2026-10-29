// G265 eighth exact legacy manual-editor.js::saveItem() isolated opt-in only.
// Never imported by the production application. The original legacy writer remains unchanged.
// Uses the existing version-neutral pair gate for native Web Lock, in-lock fresh durable bytes,
// synchronous SQL.js BEGIN/COMMIT or ROLLBACK, generation/SHA CAS and pair readback.
// Private item + audit rows are committed together. No player DB, migration or Public Master write.
// This is not an independent pre-transaction crash snapshot or all-writer containment.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const nonempty=(value,max)=>typeof value==='string'&&value.trim()===value
  &&value.length>0&&value.length<=max;
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const records=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values||[];
};
const objects=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(result.columns.map((key,i)=>[key,values[i]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const REASON='前端手動修改道具資料';

export function createManualItemOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    name,quantity,reserve,recommendation='',updatedAt,auditId,
    expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_MANUAL_ITEM_UNVERIFIED_RELOAD_REQUIRED');
    if(!nonempty(name,128)||!Number.isSafeInteger(quantity)||quantity<0
      ||!Number.isSafeInteger(reserve)||reserve<0)
      throw fail('G265_MANUAL_ITEM_INPUT_INVALID');
    if(typeof recommendation!=='string'||recommendation.length>1024||!utc(updatedAt)
      ||!nonempty(auditId,128)||!/^MANUAL-[A-Za-z0-9-]+$/.test(auditId))
      throw fail('G265_MANUAL_ITEM_AUDIT_PROVENANCE_INVALID');
    let before=null,after=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:manual-item:'+name,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        // Public Master is read-only and must already contain this exact item.
        if(records(sql,'SELECT 1 FROM item_master WHERE item_name=?',[name]).length!==1)
          throw fail('G265_MANUAL_ITEM_MASTER_IDENTITY_MISSING');
        if(records(sql,'SELECT 1 FROM import_batches WHERE update_id=?',[auditId]).length
          ||records(sql,'SELECT 1 FROM import_changes WHERE update_id=?',[auditId]).length)
          throw fail('G265_MANUAL_ITEM_AUDIT_ID_REPLAY');
        const prior=objects(sql,'SELECT * FROM item_inventory WHERE item_name=?',[name]);
        if(prior.length>1)throw fail('G265_MANUAL_ITEM_AMBIGUOUS_PRIOR');
        before=prior[0]||null;
        sql.run('INSERT INTO item_inventory(item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id) VALUES(?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET quantity=excluded.quantity,safe_reserve=excluded.safe_reserve,recommendation=excluded.recommendation,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id',
          [name,quantity,reserve,recommendation,updatedAt,'MANUAL-EDIT']);
        const next=objects(sql,'SELECT * FROM item_inventory WHERE item_name=?',[name]);
        if(next.length!==1)throw fail('G265_MANUAL_ITEM_MUTATED_ROW_MISSING');
        after=next[0];
        const resultJson=JSON.stringify({status:'applied',reason:REASON});
        sql.run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',
          [auditId,'manual-1.0',updatedAt,updatedAt,'manual_frontend_edit',1,resultJson]);
        sql.run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',
          [auditId,0,'item_inventory','manual_update',JSON.stringify({item_name:name}),
            JSON.stringify(before),JSON.stringify(after),'applied',REASON]);
      }
    });
    // Pair ACK is not sufficient: independently reopen verified persisted bytes
    // and check the logical item and BOTH private audit rows.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_MANUAL_ITEM_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const items=objects(sql,'SELECT * FROM item_inventory WHERE item_name=?',[name]);
        const batches=records(sql,'SELECT schema_version,generated_at,imported_at,source,operation_count,result_json FROM import_batches WHERE update_id=?',[auditId]);
        const changes=records(sql,'SELECT operation_index,entity,action,key_json,before_json,after_json,status,message FROM import_changes WHERE update_id=?',[auditId]);
        if(items.length!==1||!same(items[0],after)
          ||items[0].quantity!==quantity||items[0].safe_reserve!==reserve
          ||items[0].recommendation!==recommendation||items[0].source_update_id!=='MANUAL-EDIT'
          ||batches.length!==1||!same(batches[0],[
            'manual-1.0',updatedAt,updatedAt,'manual_frontend_edit',1,
            JSON.stringify({status:'applied',reason:REASON})
          ])
          ||changes.length!==1||!same(changes[0],[
            0,'item_inventory','manual_update',JSON.stringify({item_name:name}),
            JSON.stringify(before),JSON.stringify(after),'applied',REASON
          ]))
          throw fail('G265_MANUAL_ITEM_POST_ACK_ROW_OR_AUDIT_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,name,auditId});
  }
  return Object.freeze({execute,status});
}
