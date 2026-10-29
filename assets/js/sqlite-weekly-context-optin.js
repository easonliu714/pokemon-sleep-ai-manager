// G265 eleventh g3-planning.js::weeklyForm() isolated opt-in weekly context writer.
// Never imported by the production app; original legacy persistence remains unchanged.
// Native Web Lock -> latest durable bytes -> synchronous SQL.js transaction ->
// generation/SHA-256 atomic pair CAS -> independent durable row ACK readback.
// No independently restorable crash snapshot or all-writer containment is claimed.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const validDate=value=>value===''||(typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T00:00:00.000Z'))
  &&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value);
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validText=(value,max)=>typeof value==='string'&&value.length<=max
  &&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const getRows=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(
    result.columns.map((key,index)=>[key,values[index]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const columns=['context_id','week_start','camp','dish_category',
  'favorite_berry_1','favorite_berry_2','favorite_berry_3',
  'event_name','event_effects','pot_size','base_notes','updated_at'];
const query='SELECT * FROM weekly_context WHERE context_id=?';

export function createWeeklyContextOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    weekStart='',camp='',dishCategory='',favoriteBerry1='',favoriteBerry2='',
    favoriteBerry3='',eventName='',eventEffects='',potSize=null,baseNotes='',
    updatedAt,expectedPreviousUpdatedAt=null,expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_WEEKLY_CONTEXT_UNVERIFIED_RELOAD_REQUIRED');
    const berries=[favoriteBerry1,favoriteBerry2,favoriteBerry3];
    if(!validDate(weekStart)||!validText(camp,256)||!validText(dishCategory,256)
      ||!berries.every(berry=>validText(berry,256))
      ||!validText(eventName,512)||!validText(eventEffects,10000)
      ||!validText(baseNotes,10000)
      ||!(potSize===null||(Number.isSafeInteger(potSize)&&potSize>0&&potSize<=1000000)))
      throw fail('G265_WEEKLY_CONTEXT_INPUT_INVALID');
    const nonempty=berries.filter(Boolean);
    if(new Set(nonempty).size!==nonempty.length)
      throw fail('G265_WEEKLY_CONTEXT_DUPLICATE_BERRY');
    if(!utc(updatedAt)||(expectedPreviousUpdatedAt!==null&&!utc(expectedPreviousUpdatedAt)))
      throw fail('G265_WEEKLY_CONTEXT_PROVENANCE_INVALID');
    const contextId='week_'+(weekStart||'current');
    const values=[contextId,weekStart,camp,dishCategory,...berries,eventName,
      eventEffects,potSize,baseNotes,updatedAt];
    let committed=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:weekly-context:'+contextId,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const prior=getRows(sql,query,[contextId]);
        if(prior.length>1||(prior[0]?.updated_at??null)!==expectedPreviousUpdatedAt)
          throw fail('G265_WEEKLY_CONTEXT_PREVIOUS_REVISION_CHANGED');
        sql.run('INSERT INTO weekly_context('+columns.join(',')+') VALUES('+
          columns.map(()=>'?').join(',')+') ON CONFLICT(context_id) DO UPDATE SET '+
          columns.slice(1).map(column=>column+'=excluded.'+column).join(','),values);
        const after=getRows(sql,query,[contextId]);
        if(after.length!==1||columns.some((column,i)=>after[0][column]!==values[i]))
          throw fail('G265_WEEKLY_CONTEXT_MUTATED_ROW_MISMATCH');
        committed=after[0];
      }
    });
    // The pair ACK is not sufficient: reopen exact durable bytes independently.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_WEEKLY_CONTEXT_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const persisted=getRows(sql,query,[contextId]);
        if(persisted.length!==1||!same(persisted[0],committed))
          throw fail('G265_WEEKLY_CONTEXT_POST_ACK_ROW_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,contextId,weekStart});
  }
  return Object.freeze({execute,status});
}
