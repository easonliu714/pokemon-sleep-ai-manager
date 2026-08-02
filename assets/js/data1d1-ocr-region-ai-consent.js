const REGION_SCHEMA='pokemon-sleep-ocr-region-config/1.0';
const AI_CONSENT_SCHEMA='pokemon-sleep-ai-consent-queue/1.0';

export const OCR_REGION_PRESETS=Object.freeze({
  full_image:{label:'全圖辨識',regions:[{id:'full',label:'全圖',x:0,y:0,width:1,height:1}]},
  pokemon_profile:{label:'寶可夢資訊截圖',regions:[
    {id:'header',label:'名稱／等級',x:0.04,y:0.03,width:0.92,height:0.18},
    {id:'main_skill',label:'主技能',x:0.05,y:0.22,width:0.9,height:0.24},
    {id:'sub_skills',label:'副技能',x:0.05,y:0.46,width:0.9,height:0.36},
    {id:'nature',label:'性格',x:0.05,y:0.82,width:0.9,height:0.15}
  ]},
  recipe:{label:'料理／食譜截圖',regions:[
    {id:'recipe_name',label:'料理名稱',x:0.04,y:0.04,width:0.92,height:0.18},
    {id:'ingredients',label:'食材需求',x:0.04,y:0.23,width:0.92,height:0.58},
    {id:'power',label:'能量／加成',x:0.04,y:0.82,width:0.92,height:0.14}
  ]}
});

function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
export function normalizeRegion(region,index=0){
  const x=clamp(region?.x,0,1),y=clamp(region?.y,0,1);
  return {id:String(region?.id||`region_${index+1}`),label:String(region?.label||`區域 ${index+1}`),x,y,width:clamp(region?.width,0.01,1-x),height:clamp(region?.height,0.01,1-y)};
}
export function buildRegionConfig({preset='full_image',regions=null}={}){
  const selected=OCR_REGION_PRESETS[preset]||OCR_REGION_PRESETS.full_image;
  const source=Array.isArray(regions)&&regions.length?regions:selected.regions;
  return {schema:REGION_SCHEMA,preset:OCR_REGION_PRESETS[preset]?preset:'full_image',regions:source.map(normalizeRegion),created_at:new Date().toISOString()};
}

export function buildAiConsentQueue(items,{selectedIds=[],model='gemini-3.6-flash',projectAlias=null}={}){
  const selected=new Set((selectedIds||[]).map(String));
  const eligible=(items||[]).filter(item=>item?.requires_review===true||['low_confidence','conflict','failed'].includes(item?.classification_status));
  const queue=eligible.filter(item=>selected.has(String(item.sha256||item.source_image_ref||item.path||''))).map(item=>({
    item_id:String(item.sha256||item.source_image_ref||item.path||''),
    source_image_ref:item.source_image_ref||item.path||null,
    sha256:item.sha256||null,
    suggested_category:item.suggested_category||null,
    classification_confidence:Number.isFinite(item.classification_confidence)?item.classification_confidence:null,
    reason:(item.classification_evidence||[]).slice(0,8),
    consent_required:true
  }));
  return {schema:AI_CONSENT_SCHEMA,model,project_alias:projectAlias||null,selected_count:queue.length,contains_image_bytes:false,contains_api_key:false,items:queue};
}

export function validateAiConsent({confirmed=false,acknowledgedUpload=false,queue}={}){
  const errors=[];
  if(!queue?.items?.length)errors.push('no_items_selected');
  if(!confirmed)errors.push('explicit_consent_required');
  if(!acknowledgedUpload)errors.push('image_upload_acknowledgement_required');
  return {ok:errors.length===0,errors};
}

export function recordAiConsentTrace(queue,{confirmed=false}={}){
  globalThis.DebugTrace?.record?.('ai_review','ai_review_consent_prepared',{status:confirmed?'completed':'blocked',details:{selected_count:queue?.selected_count||0,model:queue?.model||null,project_alias:queue?.project_alias||null,contains_api_key:false}});
}

export {REGION_SCHEMA,AI_CONSENT_SCHEMA};
