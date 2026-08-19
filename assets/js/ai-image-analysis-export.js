export const AI_IMAGE_ANALYSIS_EXPORT_SCHEMA='pokemon-sleep-ai-image-analysis-export/1.2';

const clean=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const sensitiveKey=key=>/^(?:api[_-]?key|key|authorization|access[_-]?token|refresh[_-]?token|secret)$/i.test(clean(key));

function redact(value){
  if(Array.isArray(value))return value.map(redact);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [key,item] of Object.entries(value))out[key]=sensitiveKey(key)?'[REDACTED]':redact(item);
  return out;
}

function sanitizeModelEvent(row={}){
  const event=clean(row.event||row.type)||null;
  const detail=row.detail&&typeof row.detail==='object'?row.detail:row;
  return {
    event,
    model:clean(detail.model)||null,
    from_model:clean(detail.from_model)||null,
    to_model:clean(detail.to_model)||null,
    error_class:clean(detail.error_class)||null,
    candidate_number:Number(detail.candidate_number||0)||null,
    candidate_count:Number(detail.candidate_count||0)||null,
    feature:clean(detail.feature)||null,
    timestamp:row.timestamp||detail.timestamp||null,
  };
}

function safeTargetContext(revision){
  const context=revision?.identity_context||null;
  if(!context)return null;
  return {
    mode:context.mode||null,
    platform_identity_authority:true,
    existing_instance_bound:Boolean(context.target_pokemon_instance_id),
    new_capture_group_bound:Boolean(context.capture_group_id),
    provider_visible:false,
    private_identity_values_included:false,
    existing_baseline_reference_sent:Boolean(context.mode==='existing'&&context.baseline_reference_provider_visible&&context.baseline_reference),
    baseline_reference_values_exported:false,
  };
}

export function buildPerImageAnalysisExport({item={},revision=null,execution=null,selectedModel=null,modelEvents=[],failure=null,generatedAt=null}={}){
  const result=execution?.outcome?.results?.[0]||execution?.result||null;
  const actualModel=clean(result?.model||execution?.used_model||revision?.model)||null;
  const preferredModel=clean(result?.preferred_model||selectedModel)||null;
  const analysis=result?.analysis??revision?.result?.analysis??revision?.result??null;
  const observationV2=result?.observation_v2??(analysis?.schema_version==='2.0-observation'?analysis:null);
  const events=(Array.isArray(modelEvents)?modelEvents:[]).map(sanitizeModelEvent).filter(row=>row.event);
  const exported={
    schema:AI_IMAGE_ANALYSIS_EXPORT_SCHEMA,
    generated_at:generatedAt||nowIso(),
    item:{
      item_id:clean(item?.sha256||item?.source_image_ref||item?.path)||null,
      file_name:clean(item?.file_name||item?.path||item?.source_image_ref)||null,
      source_image_ref:clean(item?.source_image_ref||item?.path)||null,
    },
    revision:revision?{
      analysis_id:revision.analysis_id||null,
      revision_no:Number(revision.revision_no||0)||null,
      analysis_type:revision.analysis_type||'ai',
      provider:revision.provider||'gemini',
      model:revision.model||actualModel,
      prompt_version:revision.prompt_version||revision.promptVersion||null,
      created_at:revision.created_at||null,
    }:null,
    analysis_target:safeTargetContext(revision),
    provider_process:{
      selected_model:preferredModel,
      actual_model:actualModel,
      model_fallback_used:Boolean(result?.model_fallback_used||events.some(row=>row.event==='ai_model_failover')),
      project_alias:clean(result?.project_alias||execution?.project_alias)||null,
      provider_elapsed_ms:Number(result?.provider_elapsed_ms||execution?.provider_elapsed_ms||0)||null,
      model_events:events,
    },
    result:{
      observation_v2:clone(observationV2),
      analysis_json:clone(analysis),
      observation_contract_status:result?.observation_contract_status||null,
      observation_contract_warnings:clone(result?.observation_contract_warnings||[]),
      baseline_reference_used:Boolean(result?.baseline_reference_used||execution?.outcome?.baseline_reference_used||execution?.baseline_reference_used),
      baseline_prompt_policy_version:result?.baseline_prompt_policy_version||execution?.outcome?.baseline_prompt_policy_version||execution?.baseline_prompt_policy_version||null,
      baseline_reference_values_exported:false,
    },
    failure:failure?redact({
      error_class:failure.error_class||failure.reason||null,
      http_status:Number(failure.http_status||0)||null,
      message:failure.message||failure.error_message||String(failure),
    }):null,
    safety:{
      secret_redaction:true,
      api_key_included:false,
      screenshot_bytes_included:false,
      screenshot_base64_included:false,
      private_platform_identity_values_included:false,
      baseline_reference_values_exported:false,
    },
  };
  return redact(exported);
}

export function downloadPerImageAnalysisJson(payload,{documentRef=globalThis.document,urlRef=globalThis.URL}={}){
  if(!documentRef||typeof Blob==='undefined'||!urlRef?.createObjectURL)return false;
  const name=clean(payload?.item?.file_name||'image').replace(/[^a-z0-9._-]+/gi,'_')||'image';
  const revision=Number(payload?.revision?.revision_no||0)||'latest';
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=urlRef.createObjectURL(blob),anchor=documentRef.createElement('a');
  anchor.href=url;anchor.download=`${name}.ai-revision-${revision}.json`;anchor.click();
  setTimeout(()=>urlRef.revokeObjectURL(url),1000);
  return true;
}
