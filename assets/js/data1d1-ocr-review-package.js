import {attachRuntimeVersion,buildVersionedExportFilename} from './runtime-version.js';

const OCR_REVIEW_SCHEMA='pokemon-sleep-private-ocr-review/1.0';

function safeItem(item={}){
  return {source_image_ref:item.source_image_ref||null,path:item.path||null,sha256:item.sha256||null,status:item.status||null,classification_status:item.classification_status||null,suggested_category:item.suggested_category||null,classification_confidence:item.classification_confidence??null,classification_evidence:Array.isArray(item.classification_evidence)?item.classification_evidence.slice(0,8):[],requires_review:Boolean(item.requires_review),ocr_engine:item.ocr_engine||null,ocr_text_length:Number(item.ocr_text_length||0),ocr_error:item.ocr_error||null,ocr_region_count:Number(item.ocr_region_count||0)};
}

export function buildOcrReviewQueue(manifest,{threshold=0.78}={}){
  return (manifest?.items||[]).filter(item=>item?.classification_status==='failed'||item?.requires_review===true||(typeof item?.classification_confidence==='number'&&item.classification_confidence<threshold)).map(safeItem);
}

export function buildPrivateOcrReviewPackage(manifest,options={}){
  const queue=buildOcrReviewQueue(manifest,options);
  return attachRuntimeVersion({schema:OCR_REVIEW_SCHEMA,generated_at:new Date().toISOString(),source_manifest_schema:manifest?.schema||null,source_archive_name:manifest?.archive?.name||null,classification_schema:manifest?.classification_schema||null,classification_policy:manifest?.classification_policy||'ocr_first_ai_opt_in_only',summary:{total:Number(manifest?.items?.length||0),review_required:queue.length,failed:queue.filter(item=>item.classification_status==='failed').length,low_confidence:queue.filter(item=>typeof item.classification_confidence==='number').length,contains_image_bytes:false,contains_ocr_full_text:false,ai_requests:Number(manifest?.classification_summary?.ai_requests||0)},items:queue});
}

export function downloadPrivateOcrReviewPackage(manifest,{fileName=null,threshold=0.78}={}){
  const payload=buildPrivateOcrReviewPackage(manifest,{threshold});
  const resolved=fileName||buildVersionedExportFilename('private_ocr_review',{sourceName:manifest?.archive?.name});
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=resolved;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
  globalThis.DebugTrace?.record?.('data1d1','ocr_review_package_exported',{status:'completed',details:{file_name:resolved,total:payload.summary.total,review_required:payload.summary.review_required,failed:payload.summary.failed}});
  return payload;
}

export {OCR_REVIEW_SCHEMA};
