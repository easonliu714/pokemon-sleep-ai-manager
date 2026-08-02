import {OcrThumbnailUrlPool,buildRegionConfidenceSummary} from './data1d1-ocr-thumbnail-region-confidence.js';
import {buildRegionConfig} from './data1d1-ocr-region-ai-consent.js';

const OVERLAY_SCHEMA='pokemon-sleep-ocr-thumbnail-overlay/1.0';

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));}
function itemId(item,index){return String(item?.sha256||item?.source_image_ref||item?.path||`item_${index+1}`);}
function regionStatusLabel(status){return ({completed:'完成',low_confidence:'低信心',failed:'失敗',not_run:'未執行'})[status]||status;}

export function createOcrThumbnailOverlayController({maxActive=8}={}){
  const pool=new OcrThumbnailUrlPool({maxActive});
  const active=new Map();

  function release(id){const key=String(id||'');pool.release(key);active.delete(key);}
  function releaseAll(){pool.releaseAll();active.clear();}

  async function attach({item,index=0,blob,preset='full_image',regions=[]}={}){
    const id=itemId(item,index);
    if(!(blob instanceof Blob))throw new Error('thumbnail_overlay_blob_required');
    release(id);
    const thumbnail=pool.create(id,blob);
    const regionConfig=buildRegionConfig({preset});
    const confidence=buildRegionConfidenceSummary(regions);
    const model={schema:OVERLAY_SCHEMA,id,thumbnail_url:thumbnail.url,preset,regions:regionConfig.regions,confidence};
    active.set(id,model);
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_attached',{status:'completed',details:{preset,region_count:model.regions.length,active_count:pool.activeCount}});
    return model;
  }

  function render(model){
    if(!model)return '<div class="notice">尚未建立縮圖預覽。</div>';
    const boxes=model.regions.map((region,index)=>`<div class="ocr-region-box" style="left:${region.x*100}%;top:${region.y*100}%;width:${region.width*100}%;height:${region.height*100}%"><span>${index+1}. ${escapeHtml(region.label)}</span></div>`).join('');
    const rows=model.confidence.items.map(item=>`<div class="ocr-region-confidence-row"><strong>${escapeHtml(item.label)}</strong><span>${regionStatusLabel(item.status)}</span><span>${item.confidence_percent===null?'—':item.confidence_percent+'%'}</span>${item.error?`<small>${escapeHtml(item.error)}</small>`:''}</div>`).join('');
    return `<div class="ocr-thumbnail-overlay" data-overlay-id="${escapeHtml(model.id)}"><div class="ocr-thumbnail-frame"><img src="${escapeHtml(model.thumbnail_url)}" alt="OCR 縮圖預覽">${boxes}</div><div class="ocr-region-confidence-list">${rows||'<div class="notice">尚無分區 OCR 結果。</div>'}</div></div>`;
  }

  return {schema:OVERLAY_SCHEMA,attach,render,release,releaseAll,get activeCount(){return pool.activeCount;}};
}

export {OVERLAY_SCHEMA};
