// G265 twelfth g3-planning.js::setupG3Pages() collectionAddForm isolated opt-in.
// Original legacy direct persistence remains untouched; never imported by the app.
// Native Web Lock -> latest durable SQL.js bytes -> synchronous BEGIN/COMMIT or ROLLBACK
// -> generation/SHA-256 atomic pair CAS -> independent persisted target ACK readback.
// This is NOT independent crash snapshot/recovery or 23-writer production admission.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const text=(value,max,required=false)=>typeof value==='string'
  &&value.length<=max&&(!required||(value.length>0&&value.trim()===value))
  &&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const objects=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(
    result.columns.map((key,index)=>[key,values[index]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const columns=['target_id','species','target_type','priority','camp',
  'desired_traits','capture_strategy','status','notes','updated_at'];
const query='SELECT * FROM collection_targets WHERE target_id=?';

export function createCollectionTargetOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    targetId,species,targetType='',priority='',camp='',desiredTraits='',
    captureStrategy='',updatedAt,expectedPreviousUpdatedAt=null,
    expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_COLLECTION_TARGET_UNVERIFIED_RELOAD_REQUIRED');
    if(!text(targetId,72,true)||!/^target_[A-Za-z0-9_-]{1,64}$/.test(targetId)
      ||!text(species,256,true)||!text(targetType,128)||!text(priority,32)
      ||!text(camp,256)||!text(desiredTraits,10000)||!text(captureStrategy,10000))
      throw fail('G265_COLLECTION_TARGET_INPUT_INVALID');
    if(!utc(updatedAt)||(expectedPreviousUpdatedAt!==null&&!utc(expectedPreviousUpdatedAt)))
      throw fail('G265_COLLECTION_TARGET_PROVENANCE_INVALID');
    const values=[targetId,species,targetType,priority,camp,desiredTraits,
      captureStrategy,'active','',updatedAt];
    let committed=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:collection-target:'+targetId,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const prior=objects(sql,query,[targetId]);
        if(prior.length>1||(prior[0]?.updated_at??null)!==expectedPreviousUpdatedAt)
          throw fail('G265_COLLECTION_TARGET_PREVIOUS_REVISION_CHANGED');
        sql.run('INSERT INTO collection_targets('+columns.join(',')+') VALUES('+
          columns.map(()=>'?').join(',')+') ON CONFLICT(target_id) DO UPDATE SET '+
          columns.slice(1).map(column=>column+'=excluded.'+column).join(','),values);
        const after=objects(sql,query,[targetId]);
        if(after.length!==1||columns.some((column,i)=>after[0][column]!==values[i]))
          throw fail('G265_COLLECTION_TARGET_MUTATED_ROW_MISMATCH');
        committed=after[0];
      }
    });
    // A successful CAS ACK alone is insufficient: reopen independently verified
    // durable bytes and compare the exact logical row, including provenance.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_COLLECTION_TARGET_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const persisted=objects(sql,query,[targetId]);
        if(persisted.length!==1||!same(persisted[0],committed))
          throw fail('G265_COLLECTION_TARGET_POST_ACK_ROW_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,targetId});
  }
  return Object.freeze({execute,status});
}
