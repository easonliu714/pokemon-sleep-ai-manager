// G265 evaluation snapshot legacy writer: isolated opt-in only.
// Not imported by the PWA; original refreshFactEvaluationSnapshots remains unchanged.
// Native Web Lock + verified latest durable SQL.js + synchronous transaction +
// atomic generation/digest CAS + independent logical ACK readback.
// Crash-restorable independent pre-transaction snapshot and all-writer admission HOLD.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const safe=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max
  &&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const identifier=(value,prefix='')=>safe(value,160)
  &&new RegExp('^'+prefix+'[A-Za-z0-9_-]+$').test(value);
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const objects=(sql,query,params=[])=>{
  const result=sql.exec(query,params)?.[0];
  return result?.values.map(values=>Object.fromEntries(
    result.columns.map((name,index)=>[name,values[index]])))||[];
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const columns=['evaluation_id','pokemon_id','input_fingerprint','context_id',
  'goal_profile_id','master_versions_json','rule_version','intrinsic_score',
  'current_readiness_score','weekly_fit_score','roster_marginal_value_score',
  'training_roi_score','score_breakdown_json','reasons_json','missing_inputs_json',
  'hard_constraint_status','failed_constraints_json','evaluation_status',
  'evaluated_at','stale_at'];
const currentQuery='SELECT evaluation_id,input_fingerprint FROM pokemon_evaluation_snapshot WHERE pokemon_id=? AND stale_at IS NULL';
const rowQuery='SELECT evaluation_id,pokemon_id,input_fingerprint,evaluated_at,stale_at FROM pokemon_evaluation_snapshot WHERE evaluation_id=?';

export function createEvaluationSnapshotOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({pokemonId,evaluationId,inputFingerprint,evaluatedAt,
    expectedCurrentEvaluationId=null,expectedGeneration,expectedFingerprint,
    ruleVersion='SYNTHETIC_OPTIN_RULE',scores={}}={}){
    if(sticky)throw fail('G265_EVALUATION_UNVERIFIED_RELOAD_REQUIRED');
    if(!identifier(pokemonId)||!identifier(evaluationId,'eval_')
      ||!safe(inputFingerprint,256)||!safe(ruleVersion,128)
      ||!utc(evaluatedAt)||(expectedCurrentEvaluationId!==null
        &&!identifier(expectedCurrentEvaluationId,'eval_')))
      throw fail('G265_EVALUATION_INVALID_INPUT');
    const scoreKeys=['intrinsic','readiness','weekly','marginal','roi'];
    if(!scores||scoreKeys.some(key=>!Number.isFinite(scores[key])
      ||scores[key]<0||scores[key]>100))
      throw fail('G265_EVALUATION_INVALID_SCORE');
    const values=[evaluationId,pokemonId,inputFingerprint,null,null,'{}',ruleVersion,
      scores.intrinsic,scores.readiness,scores.weekly,scores.marginal,scores.roi,
      '{}','[]','[]','PASS','[]','READY',evaluatedAt,null];
    let committed=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:evaluation-snapshot:'+pokemonId,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const active=objects(sql,'SELECT status FROM pokemon WHERE pokemon_id=?',[pokemonId]);
        if(active.length!==1||active[0].status!=='active')
          throw fail('G265_EVALUATION_POKEMON_NOT_ACTIVE');
        const prior=objects(sql,currentQuery,[pokemonId]);
        if(prior.length>1||(prior[0]?.evaluation_id??null)!==expectedCurrentEvaluationId
          ||prior[0]?.input_fingerprint===inputFingerprint)
          throw fail('G265_EVALUATION_CURRENT_REVISION_CHANGED');
        if(prior.length){
          sql.run('UPDATE pokemon_evaluation_snapshot SET stale_at=? WHERE evaluation_id=? AND stale_at IS NULL',
            [evaluatedAt,prior[0].evaluation_id]);
        }
        sql.run('INSERT INTO pokemon_evaluation_snapshot('+columns.join(',')+') VALUES('+
          columns.map(()=>'?').join(',')+')',values);
        const inserted=objects(sql,rowQuery,[evaluationId]);
        if(inserted.length!==1||inserted[0].pokemon_id!==pokemonId
          ||inserted[0].input_fingerprint!==inputFingerprint
          ||inserted[0].evaluated_at!==evaluatedAt||inserted[0].stale_at!==null)
          throw fail('G265_EVALUATION_MUTATED_ROW_MISMATCH');
        committed={inserted:inserted[0],priorId:prior[0]?.evaluation_id??null};
      }
    });
    // CAS ACK is not a logical ACK until an independent durable readback succeeds.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_EVALUATION_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const inserted=objects(sql,rowQuery,[evaluationId]);
        if(inserted.length!==1||!same(inserted[0],committed.inserted))
          throw fail('G265_EVALUATION_POST_ACK_ROW_MISMATCH');
        if(committed.priorId){
          const prior=objects(sql,'SELECT stale_at FROM pokemon_evaluation_snapshot WHERE evaluation_id=?',[committed.priorId]);
          if(prior.length!==1||prior[0].stale_at!==evaluatedAt)
            throw fail('G265_EVALUATION_POST_ACK_STALE_MISMATCH');
        }
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,evaluationId,pokemonId});
  }
  return Object.freeze({execute,status});
}
