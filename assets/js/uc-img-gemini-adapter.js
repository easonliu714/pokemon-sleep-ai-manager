import {executeWithProjectPool} from './ai-project-pool-runtime.js';
import {buildUpdatePackageJsonSchema} from './update-package-contract.js';

export const UC_IMG_GEMINI_ADAPTER_VERSION='uc-img-gemini-2026-08-11-a';

const clean=value=>String(value??'').trim();
const nowIso=()=>new Date().toISOString();

export async function blobToBase64(blob){
  if(!blob||typeof blob.arrayBuffer!=='function')throw new Error('UC.IMG 找不到可讀取的圖片 bytes；請重新選取圖片。');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let binary='';const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}

export function extractGeminiJsonText(payload){
  const parts=payload?.candidates?.[0]?.content?.parts;
  if(!Array.isArray(parts))throw new Error('Gemini 回應沒有 candidates[0].content.parts');
  const text=parts.map(part=>part?.text||'').join('\n').trim();
  if(!text)throw new Error('Gemini 回應沒有 JSON 文字');
  return text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
}

export function parseGeminiJsonPayload(payload){
  const text=extractGeminiJsonText(payload);
  try{return {text,payload:JSON.parse(text)};}catch(error){throw new Error(`Gemini Structured Output 無法解析為 JSON：${error.message}`);}
}

export async function prepareGeminiImages(entries=[],fileMap=new Map()){
  const images=[];
  for(const entry of entries){
    const file=fileMap.get(entry.entry_id);
    if(!file)throw new Error(`${entry.image_ref} 圖片 bytes 已不存在；重新整理後使用內部 Gemini 前，請重新選取該圖片。`);
    images.push({imageRef:entry.image_ref,fileName:entry.file_name,mimeType:clean(file.type)||clean(entry.mime_type)||'image/png',data:await blobToBase64(file)});
  }
  if(!images.length)throw new Error('此情境沒有可送往 Gemini 的圖片。');
  return images;
}

export function buildUcImgGeminiSchema(config,scenarioKey){
  if(!config?.scenario||!Array.isArray(config.entities))throw new Error('UC.IMG Gemini scenario contract 不完整');
  return buildUpdatePackageJsonSchema({scenario:config.scenario,entities:config.entities,weekly:scenarioKey==='weekly'});
}

export async function analyzeUcImgScenarioWithGemini({scenarioKey,config,entries,fileMap,prompt,poolData,execute=executeWithProjectPool,onTrace=()=>{}}={}){
  if(!poolData?.projects?.length)throw new Error('尚未設定 Gemini API Key。請先到「使用說明 → AI API Key 與備援 Project」設定並測試 Key。');
  const model=clean(poolData.model);if(!model)throw new Error('尚未選擇 Gemini 模型。');
  const images=await prepareGeminiImages(entries,fileMap);
  const responseJsonSchema=buildUcImgGeminiSchema(config,scenarioKey);
  const outcome=await execute({projects:poolData.projects,model,prompt,images,responseJsonSchema,onTrace});
  if(!outcome?.ok){
    const classes=(outcome?.attempts||[]).map(item=>item.error_class).filter(Boolean);
    throw new Error(`Gemini 分析暫停：${classes.join(' → ')||outcome?.reason||'all_projects_unavailable'}`);
  }
  const parsed=parseGeminiJsonPayload(outcome.payload);
  return {
    adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
    payload:parsed.payload,
    raw_json:JSON.stringify(parsed.payload,null,2),
    raw_provider_text:parsed.text,
    model,
    project_alias:outcome.used_alias||null,
    projects:outcome.projects||poolData.projects,
    attempts:outcome.attempts||[],
    image_count:images.length,
    completed_at:nowIso(),
  };
}

function diagnosticResponse(rawResponse){
  if(!rawResponse)return null;
  try{return JSON.parse(rawResponse);}catch{return {raw_text:String(rawResponse),parse_failed:true};}
}

export function buildUcImgDiagnosticBundle({appVersion=null,session,scenarioKey,config,coverage,rawResponse='',validation=null,providerMeta=null}={}){
  return {
    schema:'pokemon-sleep-uc-img-ai-diagnostic/1.0',
    app_version:appVersion||null,
    session_id:session?.session_id||null,
    scenario_key:scenarioKey||null,
    scenario:config?.scenario||null,
    provider:providerMeta?.provider||null,
    model:providerMeta?.model||null,
    project_alias:providerMeta?.project_alias||null,
    coverage:coverage||null,
    image_count:Number(providerMeta?.image_count||0),
    response:diagnosticResponse(rawResponse),
    validation:validation?{
      ok:Boolean(validation.ok),
      errors:[...(validation.errors||[])],
      warnings:[...(validation.warnings||[])],
      review_count:Number(validation.review?.length||0),
      summary:validation.summary||{},
    }:null,
    generated_at:nowIso(),
    safety:{api_key_included:false,screenshot_bytes_included:false,sqlite_export_included:false},
  };
}
