import {run,rows,persist,snapshot,begin,commit,rollback} from './database.js';
import {withPrimarySqliteMutationLock} from './storage.js';
import {beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation} from './sqlite-direct-write-window-guard.js';

const TABLE_SQL=`CREATE TABLE IF NOT EXISTS image_analysis_revision (
  analysis_id TEXT PRIMARY KEY,
  image_sha256 TEXT NOT NULL,
  source_image_ref TEXT,
  analysis_type TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  forced INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  region_preset TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_analysis_id TEXT
)`;
let ready=false;
function ensure(){if(!ready){run(TABLE_SQL);run('CREATE INDEX IF NOT EXISTS idx_image_analysis_revision_lookup ON image_analysis_revision(image_sha256,analysis_type,revision_no DESC)');ready=true;}}
function uuid(){return globalThis.crypto?.randomUUID?.()||`analysis-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
export function listAnalysisRevisions(imageSha256,analysisType=null){ensure();return rows(`SELECT * FROM image_analysis_revision WHERE image_sha256=? ${analysisType?'AND analysis_type=?':''} ORDER BY revision_no DESC`,analysisType?[imageSha256,analysisType]:[imageSha256]).map(row=>({...row,result:JSON.parse(row.result_json||'null')}));}
// G265: the production analysis-revision writer must hold the same native
// primary lease before schema/previous-revision reads, snapshot, SQL and ACK.
// A post-COMMIT ACK loss is uncertain: never roll back a possibly durable row.
export async function saveAnalysisRevision({imageSha256,sourceImageRef=null,analysisType,forced=false,provider=null,model=null,promptVersion=null,regionPreset=null,result}={}){
  if(!imageSha256||!analysisType)throw new Error('analysis_revision_identity_missing');
  const close=beginSqliteExclusiveWriteWindow();
  let acknowledged=false;
  try{
    return await withPrimarySqliteMutationLock(async lease=>{
      withSqliteCoordinatedMutation(ensure);
      const previous=rows('SELECT analysis_id,revision_no FROM image_analysis_revision WHERE image_sha256=? AND analysis_type=? ORDER BY revision_no DESC LIMIT 1',[imageSha256,analysisType])[0]||null;
      const record={analysis_id:uuid(),image_sha256:imageSha256,source_image_ref:sourceImageRef,analysis_type:analysisType,revision_no:Number(previous?.revision_no||0)+1,forced:forced?1:0,provider,model,prompt_version:promptVersion,region_preset:regionPreset,result_json:JSON.stringify(result??null),created_at:new Date().toISOString(),supersedes_analysis_id:previous?.analysis_id||null};
      await snapshot(`before_analysis_revision_${analysisType}`);
      withSqliteCoordinatedMutation(begin);
      try{
        withSqliteCoordinatedMutation(()=>run('INSERT INTO image_analysis_revision (analysis_id,image_sha256,source_image_ref,analysis_type,revision_no,forced,provider,model,prompt_version,region_preset,result_json,created_at,supersedes_analysis_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[record.analysis_id,record.image_sha256,record.source_image_ref,record.analysis_type,record.revision_no,record.forced,record.provider,record.model,record.prompt_version,record.region_preset,record.result_json,record.created_at,record.supersedes_analysis_id]));
        withSqliteCoordinatedMutation(commit);
      }catch(error){
        withSqliteCoordinatedMutation(rollback);
        throw error;
      }
      // Reuse the admission lease for primary IDB CAS/durable ACK.
      // Do not attempt SQL rollback after COMMIT on an ambiguous ACK.
      await withSqliteCoordinatedMutation(()=>persist({primaryMutationLease:lease}));
      acknowledged=true;
      const completed={...record,result};
      // A listener exception cannot convert a durable success into a retry.
      try{globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:analysis-revision-saved',{detail:completed}));}catch{}
      return completed;
    });
  }finally{
    close({uncertainOutcome:!acknowledged});
  }
}
export {TABLE_SQL};
