import {run,rows,persist,snapshot} from './database.js';

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
export async function saveAnalysisRevision({imageSha256,sourceImageRef=null,analysisType,forced=false,provider=null,model=null,promptVersion=null,regionPreset=null,result}={}){
  if(!imageSha256||!analysisType)throw new Error('analysis_revision_identity_missing');ensure();
  const previous=rows('SELECT analysis_id,revision_no FROM image_analysis_revision WHERE image_sha256=? AND analysis_type=? ORDER BY revision_no DESC LIMIT 1',[imageSha256,analysisType])[0]||null;
  const record={analysis_id:uuid(),image_sha256:imageSha256,source_image_ref:sourceImageRef,analysis_type:analysisType,revision_no:Number(previous?.revision_no||0)+1,forced:forced?1:0,provider,model,prompt_version:promptVersion,region_preset:regionPreset,result_json:JSON.stringify(result??null),created_at:new Date().toISOString(),supersedes_analysis_id:previous?.analysis_id||null};
  await snapshot(`before_analysis_revision_${analysisType}`);
  run('INSERT INTO image_analysis_revision (analysis_id,image_sha256,source_image_ref,analysis_type,revision_no,forced,provider,model,prompt_version,region_preset,result_json,created_at,supersedes_analysis_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[record.analysis_id,record.image_sha256,record.source_image_ref,record.analysis_type,record.revision_no,record.forced,record.provider,record.model,record.prompt_version,record.region_preset,record.result_json,record.created_at,record.supersedes_analysis_id]);
  await persist();return {...record,result};
}
export {TABLE_SQL};
