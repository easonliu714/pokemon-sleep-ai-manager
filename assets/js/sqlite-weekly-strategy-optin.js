// G265 tenth g3-planning.js::warroomForm() isolated opt-in weekly strategy writer.
// Never imported by the production app; the original legacy path is unchanged.
// Latest durable bytes inside native Web Lock -> synchronous SQL.js transaction ->
// generation/SHA-256 atomic IndexedDB pair CAS -> independent row ACK readback.
// NOT an independently restorable crash snapshot or all-writer containment.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validWeek=value=>value===''||(typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&!Number.isNaN(Date.parse(value+'T00:00:00.000Z'))
  &&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value);
const validText=(value,max)=>typeof value==='string'&&value.length<=max
  &&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const validEstimate=value=>value===null
  ||(typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1e12);
const getRows=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(
    result.columns.map((key,index)=>[key,values[index]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const columns=['strategy_id','week_start','team_summary','substitution_rules',
  'time_schedule','meal_strategy','ingredient_estimate','berry_estimate',
  'shard_estimate','snorlax_energy_estimate','assumptions','updated_at'];
const query='SELECT * FROM weekly_strategy WHERE strategy_id=?';

export function createWeeklyStrategyOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    weekStart='',teamSummary='',substitutionRules='',timeSchedule='',
    mealStrategy='',ingredientEstimate=null,berryEstimate=null,shardEstimate=null,
    snorlaxEnergyEstimate=null,assumptions='',updatedAt,
    expectedPreviousUpdatedAt=null,expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_WEEKLY_STRATEGY_UNVERIFIED_RELOAD_REQUIRED');
    if(!validWeek(weekStart)||!validText(teamSummary,10000)
      ||!validText(substitutionRules,10000)||!validText(timeSchedule,10000)
      ||!validText(mealStrategy,10000)||!validText(assumptions,10000)
      ||![ingredientEstimate,berryEstimate,shardEstimate,snorlaxEnergyEstimate].every(validEstimate))
      throw fail('G265_WEEKLY_STRATEGY_INPUT_INVALID');
    if(!utc(updatedAt)||(expectedPreviousUpdatedAt!==null&&!utc(expectedPreviousUpdatedAt)))
      throw fail('G265_WEEKLY_STRATEGY_PROVENANCE_INVALID');
    const strategyId='strategy_'+(weekStart||'current');
    const values=[strategyId,weekStart,teamSummary,substitutionRules,timeSchedule,
      mealStrategy,ingredientEstimate,berryEstimate,shardEstimate,
      snorlaxEnergyEstimate,assumptions,updatedAt];
    let committed=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:weekly-strategy:'+strategyId,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const prior=getRows(sql,query,[strategyId]);
        if(prior.length>1||(prior[0]?.updated_at??null)!==expectedPreviousUpdatedAt)
          throw fail('G265_WEEKLY_STRATEGY_PREVIOUS_REVISION_CHANGED');
        sql.run('INSERT INTO weekly_strategy('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+') ON CONFLICT(strategy_id) DO UPDATE SET '+
          columns.slice(1).map(column=>column+'=excluded.'+column).join(','),values);
        const after=getRows(sql,query,[strategyId]);
        if(after.length!==1||columns.some((column,i)=>after[0][column]!==values[i]))
          throw fail('G265_WEEKLY_STRATEGY_MUTATED_ROW_MISMATCH');
        committed=after[0];
      }
    });
    // ACK is provisional until the exact durable generation, digest and SQL row
    // have been independently reopened and compared after the atomic pair commit.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_WEEKLY_STRATEGY_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const persisted=getRows(sql,query,[strategyId]);
        if(persisted.length!==1||!same(persisted[0],committed))
          throw fail('G265_WEEKLY_STRATEGY_POST_ACK_ROW_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,strategyId,weekStart});
  }
  return Object.freeze({execute,status});
}
