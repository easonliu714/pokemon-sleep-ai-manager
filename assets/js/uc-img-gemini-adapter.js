import {executeWithProjectPool} from './ai-project-pool-runtime.js';
import {buildUpdatePackageJsonSchema} from './update-package-contract.js';
import {buildPublicMasterRecognitionJsonSchema,supportsPublicMasterRecognition} from './public-master-recognition.js';
import {isUcImgOwnedMemoryBlob} from './uc-img-image-runtime.js';
import {
  applyUcImgWeeklyPlatformAuthority,
  buildUcImgWeeklyPlatformAuthority,
  buildUcImgWeeklyPlatformPromptInstruction,
  constrainUcImgWeeklyJsonSchema,
} from './uc-img-weekly-platform-authority.js';

export const UC_IMG_GEMINI_ADAPTER_VERSION='uc-img-gemini-2026-08-12-b-shared-transport-diagnostic';
export const UC_IMG_DIAGNOSTIC_SCHEMA='pokemon-sleep-uc-img-ai-diagnostic/1.1';

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
    const blob=fileMap.get(entry.entry_id);
    if(!blob)throw new Error(`${entry.image_ref} 圖片 bytes 已不存在；重新整理後使用內部 Gemini 前，請重新選取該圖片。`);
    if(!isUcImgOwnedMemoryBlob(blob))throw new Error(`${entry.image_ref} 尚未建立平台記憶體圖片快照；請重新選取該圖片。`);
    images.push({imageRef:entry.image_ref,fileName:entry.file_name,mimeType:clean(blob.type)||clean(entry.mime_type)||'image/png',data:await blobToBase64(blob)});
  }
  if(!images.length)throw new Error('此情境沒有可送往 Gemini 的圖片。');
  return images;
}

export function buildUcImgGeminiSchema(config,scenarioKey,{platformAuthority=null}={}){
  if(!config?.scenario||!Array.isArray(config.entities))throw new Error('UC.IMG Gemini scenario contract 不完整');
  if(supportsPublicMasterRecognition(config.scenario))return buildPublicMasterRecognitionJsonSchema(config.scenario);
  const schema=buildUpdatePackageJsonSchema({scenario:config.scenario,entities:config.entities,weekly:scenarioKey==='weekly'});
  return scenarioKey==='weekly'&&platformAuthority?constrainUcImgWeeklyJsonSchema(schema,platformAuthority):schema;
}

function safeAttemptFailureMessage(outcome){
  const failed=[...(outcome?.attempts||[])].reverse().find(item=>item?.status==='FAILED')||outcome?.failure||null;
  const label=failed?.error_class||outcome?.reason||'all_projects_unavailable';
  const status=Number(failed?.http_status||0);
  const suffix=status?` (HTTP ${status})`:failed?.transport_kind==='fetch_exception'?' (browser transport)':'';
  return `Gemini 分析暫停：${label}${suffix}`;
}

export async function analyzeUcImgScenarioWithGemini({scenarioKey,config,entries,fileMap,prompt,poolData,execute=executeWithProjectPool,onTrace=()=>{},platformNow=null}={}){
  if(!poolData?.projects?.length)throw new Error('尚未設定 Gemini API Key。請先到「使用說明 → AI API Key 與備援 Project」設定並測試 Key。');
  const model=clean(poolData.model);if(!model)throw new Error('尚未選擇 Gemini 模型。');
  const platformAuthority=scenarioKey==='weekly'?buildUcImgWeeklyPlatformAuthority(platformNow||new Date()):null;
  const images=await prepareGeminiImages(entries,fileMap);
  const responseJsonSchema=buildUcImgGeminiSchema(config,scenarioKey,{platformAuthority});
  const effectivePrompt=platformAuthority?`${prompt}${buildUcImgWeeklyPlatformPromptInstruction(platformAuthority)}`:prompt;
  const trace=(event,details={})=>onTrace(event,{scenario_key:scenarioKey,scenario:config?.scenario||null,adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,...details});
  const outcome=await execute({projects:poolData.projects,model,prompt:effectivePrompt,images,responseJsonSchema,onTrace:trace});
  if(Array.isArray(outcome?.projects)){
    try{poolData.projects=outcome.projects;}catch{}
  }
  if(!outcome?.ok){
    const error=new Error(safeAttemptFailureMessage(outcome));
    error.uc_img_attempts=[...(outcome?.attempts||[])];
    error.uc_img_failure=outcome?.failure||null;
    error.uc_img_projects=outcome?.projects||poolData.projects;
    throw error;
  }
  const parsed=parseGeminiJsonPayload(outcome.payload);
  const payload=platformAuthority?applyUcImgWeeklyPlatformAuthority(parsed.payload,platformAuthority):parsed.payload;
  const platformAuthorityAudit=platformAuthority?{
    authority_version:platformAuthority.authority_version,
    week_start:platformAuthority.week_start,
    context_id:platformAuthority.context_id,
    generated_at:platformAuthority.generated_at,
    update_id:platformAuthority.update_id,
    provider_original_generated_at:parsed.payload?.generated_at||null,
    provider_original_week_start:parsed.payload?.operations?.find(item=>item?.entity==='weekly_context')?.data?.week_start||null,
  }:null;
  return {
    adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
    payload,
    raw_json:JSON.stringify(payload,null,2),
    raw_provider_text:parsed.text,
    response_contract:supportsPublicMasterRecognition(config.scenario)?'public-master-recognition':'update-package-v1.1',
    model,
    project_alias:outcome.used_alias||null,
    projects:outcome.projects||poolData.projects,
    attempts:outcome.attempts||[],
    image_count:images.length,
    platform_authority:platformAuthorityAudit,
    completed_at:nowIso(),
  };
}

function diagnosticResponse(rawResponse){
  if(!rawResponse)return null;
  try{return JSON.parse(rawResponse);}catch{return {raw_text:String(rawResponse),parse_failed:true};}
}

function assignedImageSummary(session,scenarioKey){
  const rows=(session?.entries||[]).filter(entry=>entry?.scenario_key===scenarioKey);
  return {
    assigned_image_count:rows.length,
    assigned_image_refs:rows.map(entry=>entry.image_ref).filter(Boolean),
    ready_image_count:rows.filter(entry=>entry?.byte_state==='READY').length,
    byte_states:rows.map(entry=>({image_ref:entry.image_ref||null,byte_state:entry.byte_state||null,byte_snapshot_size:Number(entry.byte_snapshot_size||0)})),
  };
}

function diagnosticTraceRows(scenarioKey,debugTrace=globalThis.DebugTrace){
  const events=Array.isArray(debugTrace?.events)?debugTrace.events:[];
  return events.filter(event=>event?.category==='uc_img_gemini'&&event?.details?.scenario_key===scenarioKey).slice(-30).map(event=>({
    timestamp:event.timestamp||null,
    event:event.event||null,
    status:event.status||null,
    details:event.details||null,
  }));
}

function currentAttemptFromTrace(rows=[]){
  const terminal=[...rows].reverse().find(row=>row.event==='ai_request_failed'||row.event==='ai_request_completed');
  if(!terminal)return null;
  const d=terminal.details||{};
  return {
    status:terminal.event==='ai_request_failed'?'FAILED':'COMPLETED',
    finished_at:terminal.timestamp||d.completed_at||null,
    attempt_number:Number(d.attempt_number||0)||null,
    project_attempt_number:Number(d.project_attempt_number||0)||null,
    provider:'gemini',
    model:d.model||null,
    project_alias:d.alias||null,
    project_fingerprint:d.fingerprint||null,
    image_count:Number(d.image_count||0),
    structured_output:Boolean(d.structured_output),
    failure:terminal.event==='ai_request_failed'?{
      error_class:d.error_class||null,
      transport_kind:d.transport_kind||null,
      http_status:Number(d.http_status||0)||null,
      http_status_text:d.http_status_text||null,
      retry_after:d.retry_after||null,
      retryable:Boolean(d.retryable),
      failover:Boolean(d.failover),
      error_name:d.error_name||null,
      error_message:d.error_message||null,
      elapsed_ms:Number(d.elapsed_ms||0),
    }:null,
    elapsed_ms:Number(d.elapsed_ms||0),
  };
}

export function buildUcImgDiagnosticBundle({appVersion=null,session,scenarioKey,config,coverage,rawResponse='',validation=null,providerMeta=null,debugTrace=globalThis.DebugTrace}={}){
  const state=session?.scenario_state?.[scenarioKey]||{};
  const imageSummary=assignedImageSummary(session,scenarioKey);
  const attemptTrace=diagnosticTraceRows(scenarioKey,debugTrace);
  const currentAttempt=currentAttemptFromTrace(attemptTrace);
  const failed=Boolean(state?.last_ai_error)||currentAttempt?.status==='FAILED';
  const previousSuccess=diagnosticResponse(rawResponse);
  return {
    schema:UC_IMG_DIAGNOSTIC_SCHEMA,
    app_version:appVersion||null,
    adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
    session_id:session?.session_id||null,
    scenario_key:scenarioKey||null,
    scenario:config?.scenario||null,
    coverage:coverage||null,
    ...imageSummary,
    current_attempt:currentAttempt,
    last_ai_error:state?.last_ai_error||null,
    attempt_trace:attemptTrace,
    response_is_current:!failed&&Boolean(previousSuccess),
    current_attempt_response:failed?null:previousSuccess,
    previous_success:failed&&previousSuccess?{
      provider:providerMeta?.provider||null,
      model:providerMeta?.model||null,
      project_alias:providerMeta?.project_alias||null,
      response_contract:providerMeta?.response_contract||null,
      image_count:Number(providerMeta?.image_count||0),
      completed_at:providerMeta?.completed_at||null,
      response:previousSuccess,
    }:null,
    provider:currentAttempt?.provider||providerMeta?.provider||null,
    model:currentAttempt?.model||providerMeta?.model||null,
    project_alias:currentAttempt?.project_alias||providerMeta?.project_alias||null,
    response_contract:providerMeta?.response_contract||null,
    image_count:Number(currentAttempt?.image_count||imageSummary.assigned_image_count||0),
    response:failed?null:previousSuccess,
    validation:validation?{
      ok:Boolean(validation.ok),
      errors:[...(validation.errors||[])],
      warnings:[...(validation.warnings||[])],
      review_count:Number(validation.review?.length||0),
      summary:validation.summary||{},
    }:null,
    platform_authority:providerMeta?.platform_authority||null,
    generated_at:nowIso(),
    safety:{api_key_included:false,screenshot_bytes_included:false,screenshot_base64_included:false,sqlite_export_included:false,full_prompt_included:false},
  };
}
