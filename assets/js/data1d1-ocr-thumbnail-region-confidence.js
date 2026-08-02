const THUMBNAIL_SCHEMA='pokemon-sleep-ocr-thumbnail/1.0';
const REGION_CONFIDENCE_SCHEMA='pokemon-sleep-ocr-region-confidence/1.0';

function clamp01(value){return Math.max(0,Math.min(1,Number(value)||0));}
function safeLabel(value,fallback){return String(value||fallback||'').slice(0,120);}

export class OcrThumbnailUrlPool{
  constructor({maxActive=12}={}){this.maxActive=Math.max(1,Number(maxActive)||12);this.entries=new Map();this.order=[];}
  create(id,blob){
    const key=String(id||'');
    if(!key||!(blob instanceof Blob))throw new Error('thumbnail_invalid_input');
    this.release(key);
    const url=URL.createObjectURL(blob);
    this.entries.set(key,url);
    this.order.push(key);
    while(this.order.length>this.maxActive)this.release(this.order[0]);
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_created',{status:'completed',details:{active_count:this.entries.size,max_active:this.maxActive}});
    return {schema:THUMBNAIL_SCHEMA,id:key,url};
  }
  release(id){
    const key=String(id||'');
    const url=this.entries.get(key);
    if(url){URL.revokeObjectURL(url);this.entries.delete(key);}
    this.order=this.order.filter(item=>item!==key);
  }
  releaseAll(){for(const url of this.entries.values())URL.revokeObjectURL(url);this.entries.clear();this.order=[];globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_pool_released',{status:'completed',details:{active_count:0}});}
  get activeCount(){return this.entries.size;}
}

export function normalizeRegionConfidence(region,index=0){
  const confidence=Number.isFinite(Number(region?.confidence))?clamp01(region.confidence):null;
  const status=region?.error?'failed':confidence===null?'not_run':confidence<0.55?'low_confidence':'completed';
  return {
    schema:REGION_CONFIDENCE_SCHEMA,
    region_id:String(region?.region_id||region?.id||`region_${index+1}`),
    label:safeLabel(region?.label,`區域 ${index+1}`),
    confidence,
    confidence_percent:confidence===null?null:Math.round(confidence*100),
    status,
    error:region?.error?safeLabel(region.error,'ocr_failed'):null,
    text_length:Math.max(0,Number(region?.text_length)||0)
  };
}

export function buildRegionConfidenceSummary(regions=[]){
  const items=(regions||[]).map(normalizeRegionConfidence);
  const completed=items.filter(item=>item.status==='completed').length;
  const lowConfidence=items.filter(item=>item.status==='low_confidence').length;
  const failed=items.filter(item=>item.status==='failed').length;
  const measured=items.filter(item=>typeof item.confidence==='number');
  const averageConfidence=measured.length?measured.reduce((sum,item)=>sum+item.confidence,0)/measured.length:null;
  return {schema:REGION_CONFIDENCE_SCHEMA,items,summary:{total:items.length,completed,low_confidence:lowConfidence,failed,not_run:items.length-completed-lowConfidence-failed,average_confidence:averageConfidence}};
}

export {THUMBNAIL_SCHEMA,REGION_CONFIDENCE_SCHEMA};
