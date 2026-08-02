const CLASSIFIER_SCHEMA='pokemon-sleep-ocr-first-classifier/1.3';
const DEFAULT_REVIEW_THRESHOLD=0.78;
const CATEGORY_RULES={
  pokemon:{label:'寶可夢資訊',tokens:['主技能','副技能','幫忙速度','食材機率','持有上限','性格','等級','lv.','lv ','sp']},
  recipe:{label:'料理／食譜',tokens:['食譜','料理','所需食材','鍋子','能量','美味','大成功']},
  ingredient:{label:'食材',tokens:['食材庫存','食材','蘋果','牛奶','蜂蜜','香腸','可可','咖啡','油']},
  item:{label:'道具',tokens:['道具包','道具','糖果','主技能種子','副技能種子','夢之碎片']},
  capacity:{label:'容量資訊',tokens:['容量','上限','擴充','寶可夢盒','食材包','道具包']},
  account:{label:'帳號資訊',tokens:['研究者代碼','玩家名稱','睡眠點數','帳號','好友','研究等級']}
};
const POKEMON_WEAK_TOKENS=new Set(['等級','lv.','lv ','sp']);
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const safeEvidence=value=>normalize(value).slice(0,120);
function tokenMatches(normalized,token){
  const normalizedToken=normalize(token);
  if(normalizedToken==='sp')return /(^|[^a-z0-9])sp([^a-z0-9]|$)/i.test(normalized);
  return normalized.includes(normalizedToken);
}
function scorePokemonHits(hits){
  const strongHits=hits.filter(token=>!POKEMON_WEAK_TOKENS.has(token));
  const hasLevel=hits.some(token=>['等級','lv.','lv '].includes(token));
  const hasSp=hits.includes('sp');
  if(!strongHits.length&&!(hasLevel&&hasSp))return 0;
  let score=strongHits.length;
  if(hasLevel)score+=0.35;
  if(hasSp)score+=0.35;
  if(hasLevel&&hasSp)score+=1.3;
  return score;
}

export function classifyOcrText(text,{reviewThreshold=DEFAULT_REVIEW_THRESHOLD}={}){
  const normalized=normalize(text);
  if(!normalized)return {classification_status:'not_analyzed',suggested_category:null,confirmed_category:null,classification_source:'none',classification_confidence:null,classification_evidence:[],classifier_version:CLASSIFIER_SCHEMA,requires_review:false};
  const scored=Object.entries(CATEGORY_RULES).map(([category,rule])=>{
    const hits=rule.tokens.filter(token=>tokenMatches(normalized,token));
    const score=category==='pokemon'?scorePokemonHits(hits):hits.length;
    return {category,label:rule.label,hits,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.category.localeCompare(b.category));
  if(!scored.length)return {classification_status:'suggested',suggested_category:'other',confirmed_category:null,classification_source:'ocr_rules',classification_confidence:0.35,classification_evidence:['OCR 已完成，但未命中足夠的已知版面關鍵字'],classifier_version:CLASSIFIER_SCHEMA,requires_review:true};
  const top=scored[0],second=scored[1];const conflict=Boolean(second&&second.score===top.score);const confidence=Math.min(0.98,0.5+top.score*0.12-(conflict?0.18:0));
  return {classification_status:'suggested',suggested_category:top.category,confirmed_category:null,classification_source:'ocr_rules',classification_confidence:Number(confidence.toFixed(2)),classification_evidence:top.hits.slice(0,6).map(token=>`OCR 命中「${safeEvidence(token)}」`),classifier_version:CLASSIFIER_SCHEMA,requires_review:conflict||confidence<reviewThreshold};
}

export function resolveOcrProvider(provider=globalThis.PokemonSleepOCR){return provider?.recognize&&typeof provider.recognize==='function'?provider:null;}
function cancelled(signal,shouldCancel){return Boolean(signal?.aborted||shouldCancel?.());}
async function recognizeWithRegions(ocrProvider,buffer,item,{regions=[]}={}){
  const baseOptions={mimeType:item.mime_type||'image/png',language:'chi_tra+eng'};
  if(regions.length&&typeof ocrProvider.recognizeRegion==='function'){
    const regionResults=[];
    for(const region of regions){const result=await ocrProvider.recognizeRegion(buffer,{...baseOptions,region});regionResults.push(typeof result==='string'?result:(result?.text||''));}
    return {text:regionResults.join('\n'),region_count:regionResults.length};
  }
  const result=await ocrProvider.recognize(buffer,baseOptions);
  return {text:typeof result==='string'?result:(result?.text||''),region_count:0};
}

export async function classifyInventoryWithOcr(archive,manifest,{ocrProvider=resolveOcrProvider(),onProgress=()=>{},reviewThreshold=DEFAULT_REVIEW_THRESHOLD,signal=null,shouldCancel=()=>false,regions=[]}={}){
  const items=[];const sourceItems=manifest?.items||[];let wasCancelled=false;
  for(let index=0;index<sourceItems.length;index+=1){
    const item=sourceItems[index];
    if(cancelled(signal,shouldCancel)){wasCancelled=true;for(let rest=index;rest<sourceItems.length;rest+=1)items.push({...sourceItems[rest],classification_status:'cancelled',suggested_category:null,confirmed_category:null,classification_source:'user_cancelled',classification_confidence:null,classification_evidence:['使用者取消 OCR 批次處理'],classifier_version:CLASSIFIER_SCHEMA,requires_review:false});break;}
    if(item.status==='duplicate'||item.status==='ignored'||item.status==='unreadable')items.push({...item,classification_status:'skipped',suggested_category:null,confirmed_category:null,classification_source:'duplicate_gate',classification_confidence:null,classification_evidence:[],classifier_version:CLASSIFIER_SCHEMA,requires_review:false});
    else if(!ocrProvider)items.push({...item,classification_status:'not_analyzed',suggested_category:null,confirmed_category:null,classification_source:'ocr_unavailable',classification_confidence:null,classification_evidence:['裝置尚未載入本機 OCR 引擎'],classifier_version:CLASSIFIER_SCHEMA,requires_review:false});
    else try{
      const buffer=await archive.readImage(item.path,{type:'arraybuffer'});
      const recognized=await recognizeWithRegions(ocrProvider,buffer,item,{regions});
      const classified=classifyOcrText(recognized.text,{reviewThreshold});
      items.push({...item,...classified,ocr_text_length:normalize(recognized.text).length,ocr_engine:ocrProvider.name||'local_ocr',ocr_region_count:recognized.region_count,ocr_completed_at:new Date().toISOString()});
    }catch(error){items.push({...item,classification_status:'failed',suggested_category:null,confirmed_category:null,classification_source:'ocr_failed',classification_confidence:null,classification_evidence:[],classifier_version:CLASSIFIER_SCHEMA,requires_review:true,ocr_error:error?.message||String(error)});}
    onProgress({current:index+1,total:sourceItems.length,percent:sourceItems.length?Math.round((index+1)/sourceItems.length*100):100,cancelled:false});
  }
  const analyzed=items.filter(item=>item.classification_status==='suggested');
  const category_counts=Object.fromEntries(['pokemon','recipe','ingredient','item','capacity','account','other'].map(category=>[category,analyzed.filter(item=>item.suggested_category===category).length]));
  return {...manifest,items,classification_schema:CLASSIFIER_SCHEMA,classification_policy:'ocr_first_ai_opt_in_only',classified_at:new Date().toISOString(),classification_summary:{total:items.length,analyzed:analyzed.length,not_analyzed:items.filter(item=>item.classification_status==='not_analyzed').length,failed:items.filter(item=>item.classification_status==='failed').length,skipped:items.filter(item=>item.classification_status==='skipped').length,cancelled:items.filter(item=>item.classification_status==='cancelled').length,requires_review:items.filter(item=>item.requires_review).length,ai_requests:0,was_cancelled:wasCancelled,region_mode:regions.length>0,category_counts}};
}

export {CLASSIFIER_SCHEMA,DEFAULT_REVIEW_THRESHOLD,CATEGORY_RULES,POKEMON_WEAK_TOKENS,tokenMatches,scorePokemonHits};
