const REGION_SCHEMA='pokemon-sleep-ocr-region-config/1.1';
const AI_CONSENT_SCHEMA='pokemon-sleep-ai-consent-queue/1.1';

export const OCR_REGION_PRESETS=Object.freeze({
  full_image:{label:'全圖辨識',regions:[{id:'full',label:'全圖',x:0,y:0,width:1,height:1,scale:1}]},
  pokemon_basic_profile:{label:'寶可夢基本資訊頁',regions:[
    {id:'top_sp',label:'頂部 SP／屬性',x:0.00,y:0.00,width:0.55,height:0.16,scale:3},
    {id:'identity_level_name',label:'名稱／Lv／EXP',x:0.08,y:0.32,width:0.84,height:0.22,scale:3},
    {id:'berry_ingredient',label:'樹果／食材',x:0.04,y:0.56,width:0.92,height:0.25,scale:2},
    {id:'helping_capacity',label:'幫忙間隔／持有上限',x:0.04,y:0.78,width:0.92,height:0.18,scale:2}
  ]},
  pokemon_skill_detail:{label:'寶可夢技能／能力詳情頁',regions:[
    {id:'floating_identity_card',label:'浮動身份卡 SP／Lv／名稱',x:0.00,y:0.03,width:0.62,height:0.15,scale:3},
    {id:'main_skill',label:'主技能',x:0.04,y:0.19,width:0.92,height:0.22,scale:2},
    {id:'sub_skills',label:'副技能',x:0.04,y:0.38,width:0.92,height:0.30,scale:2},
    {id:'nature_history',label:'性格／相遇／一起睡覺時間',x:0.04,y:0.66,width:0.92,height:0.30,scale:2}
  ]},
  pokemon_profile:{label:'寶可夢資訊截圖（相容）',regions:[
    {id:'header',label:'名稱／等級',x:0.04,y:0.03,width:0.92,height:0.18,scale:2},
    {id:'main_skill',label:'主技能',x:0.05,y:0.22,width:0.9,height:0.24,scale:2},
    {id:'sub_skills',label:'副技能',x:0.05,y:0.46,width:0.9,height:0.36,scale:2},
    {id:'nature',label:'性格',x:0.05,y:0.82,width:0.9,height:0.15,scale:2}
  ]},
  recipe:{label:'料理／食譜截圖',regions:[
    {id:'recipe_name',label:'料理名稱',x:0.04,y:0.04,width:0.92,height:0.18,scale:2},
    {id:'ingredients',label:'食材需求',x:0.04,y:0.23,width:0.92,height:0.58,scale:2},
    {id:'power',label:'能量／加成',x:0.04,y:0.82,width:0.92,height:0.14,scale:2}
  ]}
});

function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
function itemId(item){return String(item?.sha256||item?.source_image_ref||item?.path||'');}
function defaultEligible(item){return item?.requires_review===true||['low_confidence','conflict','failed'].includes(item?.classification_status);}
function duplicateCandidate(item){return item?.status==='duplicate'||item?.classification_status==='skipped';}

export function normalizeRegion(region,index=0){
  const x=clamp(region?.x,0,1),y=clamp(region?.y,0,1);
  return {id:String(region?.id||`region_${index+1}`),label:String(region?.label||`區域 ${index+1}`),x,y,width:clamp(region?.width,0.01,1-x),height:clamp(region?.height,0.01,1-y),scale:clamp(region?.scale||1,1,4)};
}

export function buildRegionConfig({preset='full_image',regions=null}={}){
  const selected=OCR_REGION_PRESETS[preset]||OCR_REGION_PRESETS.full_image;
  const source=Array.isArray(regions)&&regions.length?regions:selected.regions;
  return {schema:REGION_SCHEMA,preset:OCR_REGION_PRESETS[preset]?preset:'full_image',regions:source.map(normalizeRegion),created_at:new Date().toISOString()};
}

export function buildAiConsentQueue(items,{selectedIds=[],model='gemini-3.6-flash',projectAlias=null}={}){
  const selected=new Set((selectedIds||[]).map(String));
  const eligible=(items||[]).filter(item=>defaultEligible(item)||(selected.has(itemId(item))&&duplicateCandidate(item)));
  const queue=eligible.filter(item=>selected.has(itemId(item))).map(item=>({item_id:itemId(item),source_image_ref:item.source_image_ref||item.path||null,sha256:item.sha256||null,suggested_category:item.suggested_category||null,classification_confidence:Number.isFinite(item.classification_confidence)?item.classification_confidence:null,reason:(item.classification_evidence||[]).slice(0,8),manual_duplicate_override:duplicateCandidate(item),consent_required:true}));
  return {schema:AI_CONSENT_SCHEMA,model,project_alias:projectAlias||null,selected_count:queue.length,manual_duplicate_count:queue.filter(item=>item.manual_duplicate_override).length,contains_image_bytes:false,contains_api_key:false,items:queue};
}

export function validateAiConsent({confirmed=false,acknowledgedUpload=false,queue}={}){const errors=[];if(!queue?.items?.length)errors.push('no_items_selected');if(!confirmed)errors.push('explicit_consent_required');if(!acknowledgedUpload)errors.push('image_upload_acknowledgement_required');return {ok:errors.length===0,errors};}
export function recordAiConsentTrace(queue,{confirmed=false}={}){globalThis.DebugTrace?.record?.('ai_review','ai_review_consent_prepared',{status:confirmed?'completed':'blocked',details:{selected_count:queue?.selected_count||0,manual_duplicate_count:queue?.manual_duplicate_count||0,model:queue?.model||null,project_alias:queue?.project_alias||null,contains_api_key:false}});}
export {REGION_SCHEMA,AI_CONSENT_SCHEMA,defaultEligible,duplicateCandidate};
