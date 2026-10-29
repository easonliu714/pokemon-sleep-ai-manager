// G265 fifth exact legacy writer: saveAnalysisRevision() isolated opt-in only.
// NOT imported by production. No migration, player SQLite, Public Master or app wiring.
// A defensive copy of the latest durable bytes is held inside the lock before SQL.js
// BEGIN/COMMIT. This is NOT a durable recovery snapshot or all-writer containment.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const nonempty=(value,max)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max;
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const nullable=(value,max)=>value===null||(typeof value==='string'&&value.length<=max);
const one=(sql,query,params)=>sql.exec(query,params)?.[0]?.values||[];

export function createAnalysisRevisionOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    analysisId,imageSha256,analysisType,sourceImageRef=null,forced=false,
    provider=null,model=null,promptVersion=null,regionPreset=null,
    result=null,createdAt,expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_ANALYSIS_UNVERIFIED_RELOAD_REQUIRED');
    if(!nonempty(analysisId,128)||!(/^[a-z0-9][a-z0-9._:-]*$/i.test(analysisId)))
      throw fail('G265_ANALYSIS_EXPLICIT_ID_REQUIRED');
    if(typeof imageSha256!=='string'||!/^[a-f0-9]{64}$/.test(imageSha256)
      ||!nonempty(analysisType,64))throw fail('G265_ANALYSIS_IDENTITY_INVALID');
    if(!utc(createdAt)||typeof forced!=='boolean'
      ||![sourceImageRef,provider,model,promptVersion,regionPreset].every(x=>nullable(x,512)))
      throw fail('G265_ANALYSIS_METADATA_INVALID');
    let json;
    try{json=JSON.stringify(result);}
    catch{throw fail('G265_ANALYSIS_RESULT_NOT_SERIALIZABLE');}
    if(typeof json!=='string'||json.length>1024*1024)
      throw fail('G265_ANALYSIS_RESULT_NOT_SERIALIZABLE');
    let revisionNo=null,supersedes=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:analysis-revision:'+analysisType,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        // The schema must already exist. Never create/alter a player table here.
        const previous=one(sql,
          'SELECT analysis_id,revision_no FROM image_analysis_revision WHERE image_sha256=? AND analysis_type=? ORDER BY revision_no DESC LIMIT 2',
          [imageSha256,analysisType]);
        if(previous.length&&(!Number.isSafeInteger(previous[0][1])||previous[0][1]<1
          ||previous[0][1]===Number.MAX_SAFE_INTEGER
          ||(previous.length>1&&previous[0][1]===previous[1][1])))
          throw fail('G265_ANALYSIS_AMBIGUOUS_REVISION_HISTORY');
        if(one(sql,'SELECT analysis_id FROM image_analysis_revision WHERE analysis_id=? LIMIT 1',[analysisId]).length)
          throw fail('G265_ANALYSIS_DUPLICATE_ID_REPLAY');
        supersedes=previous[0]?.[0]||null;
        revisionNo=(previous[0]?.[1]||0)+1;
        sql.run('INSERT INTO image_analysis_revision (analysis_id,image_sha256,source_image_ref,analysis_type,revision_no,forced,provider,model,prompt_version,region_preset,result_json,created_at,supersedes_analysis_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[
          analysisId,imageSha256,sourceImageRef,analysisType,revisionNo,forced?1:0,
          provider,model,promptVersion,regionPreset,json,createdAt,supersedes
        ]);
      }
    });
    // A durable pair ACK alone does not prove the inserted logical row survived.
    // Read the verified durable pair again, then validate the exact inserted row.
    try{
      const verified=await pairGate.readVerified();
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const row=one(sql,
          'SELECT image_sha256,analysis_type,revision_no,result_json,supersedes_analysis_id FROM image_analysis_revision WHERE analysis_id=?',
          [analysisId]);
        if(row.length!==1||row[0][0]!==imageSha256||row[0][1]!==analysisType
          ||row[0][2]!==revisionNo||row[0][3]!==json||row[0][4]!==supersedes)
          throw fail('G265_ANALYSIS_POST_ACK_ROW_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,analysisId,revisionNo,supersedesAnalysisId:supersedes});
  }
  return Object.freeze({execute,status});
}
