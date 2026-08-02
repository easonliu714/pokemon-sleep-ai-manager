import {OCR_REGION_PRESETS,buildRegionConfig,buildAiConsentQueue,validateAiConsent,recordAiConsentTrace} from './data1d1-ocr-region-ai-consent.js';

const DEFAULT_MODEL='gemini-3.6-flash';
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));}
function itemId(item){return String(item?.sha256||item?.source_image_ref||item?.path||'');}
function eligibleItems(inventory){return (inventory?.items||[]).filter(item=>item?.requires_review===true||['low_confidence','conflict','failed'].includes(item?.classification_status));}
function presetOptions(selected){return Object.entries(OCR_REGION_PRESETS).map(([key,preset])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(preset.label)}</option>`).join('');}
function regionBoxes(config){return config.regions.map((region,index)=>`<div class="ocr-region-box" style="left:${region.x*100}%;top:${region.y*100}%;width:${region.width*100}%;height:${region.height*100}%"><span>${index+1}. ${escapeHtml(region.label)}</span></div>`).join('');}

export function createOcrRegionAiReviewPanel({inventory,model=DEFAULT_MODEL,projectAlias='主要 Project',onPrepared=()=>{}}={}){
  const root=document.createElement('section');
  root.className='ocr-region-ai-panel';
  let preset='full_image';
  let selected=new Set();
  let confirmed=false;
  let acknowledgedUpload=false;
  const render=()=>{
    const config=buildRegionConfig({preset});
    const items=eligibleItems(inventory);
    const queue=buildAiConsentQueue(items,{selectedIds:[...selected],model,projectAlias});
    const validation=validateAiConsent({confirmed,acknowledgedUpload,queue});
    const rows=items.slice(0,100).map(item=>{const id=itemId(item);return `<label class="ocr-ai-candidate"><input type="checkbox" data-ai-item="${escapeHtml(id)}" ${selected.has(id)?'checked':''}><span><strong>${escapeHtml(item.path||item.source_image_ref||'未命名圖片')}</strong><br>分類：${escapeHtml(item.suggested_category||'未判定')}；信心度：${typeof item.classification_confidence==='number'?Math.round(item.classification_confidence*100)+'%':'—'}<br>${escapeHtml((item.classification_evidence||[]).join('、')||item.ocr_error||'需要人工覆核')}</span></label>`;}).join('');
    root.innerHTML=`<h4>OCR 分區與 AI 覆核準備</h4><label>辨識區域 preset<select id="ocrRegionPreset">${presetOptions(preset)}</select></label><div class="ocr-region-preview" aria-label="OCR 裁切區域預覽">${regionBoxes(config)}</div><div class="ocr-region-list">${config.regions.map((r,i)=>`<div><strong>${i+1}. ${escapeHtml(r.label)}</strong><br>x ${r.x.toFixed(2)} / y ${r.y.toFixed(2)} / w ${r.width.toFixed(2)} / h ${r.height.toFixed(2)}</div>`).join('')}</div><h5>待覆核圖片</h5><div class="ocr-ai-selection-actions"><button type="button" id="ocrAiSelectAll" class="secondary">全選待覆核</button><button type="button" id="ocrAiClear" class="secondary">清除選取</button></div><div class="ocr-ai-candidates">${rows||'<div class="notice">目前沒有低信心、衝突或失敗項目。</div>'}</div><div class="notice">預計送出 ${queue.selected_count} 張；模型 ${escapeHtml(model)}；Project ${escapeHtml(projectAlias)}。</div><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiConsent" ${confirmed?'checked':''}>我明確同意將勾選項目交由 AI 覆核。</label><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiUploadAck" ${acknowledgedUpload?'checked':''}>我了解圖片會上傳至 AI Provider，且 API Key 僅暫存於本瀏覽器工作階段。</label><button type="button" id="prepareAiReviewBtn" ${validation.ok?'':'disabled'}>準備 AI 覆核 Queue</button>${validation.ok?'':'<div class="notice">需先選取圖片並完成兩項同意。</div>'}`;
    root.querySelector('#ocrRegionPreset')?.addEventListener('change',event=>{preset=event.target.value;globalThis.DebugTrace?.record?.('ocr_region','ocr_region_preset_changed',{status:'completed',details:{preset,region_count:buildRegionConfig({preset}).regions.length}});render();});
    root.querySelectorAll('[data-ai-item]').forEach(input=>input.addEventListener('change',()=>{input.checked?selected.add(input.dataset.aiItem):selected.delete(input.dataset.aiItem);render();}));
    root.querySelector('#ocrAiSelectAll')?.addEventListener('click',()=>{selected=new Set(items.map(itemId).filter(Boolean));render();});
    root.querySelector('#ocrAiClear')?.addEventListener('click',()=>{selected.clear();render();});
    root.querySelector('#ocrAiConsent')?.addEventListener('change',event=>{confirmed=event.target.checked;render();});
    root.querySelector('#ocrAiUploadAck')?.addEventListener('change',event=>{acknowledgedUpload=event.target.checked;render();});
    root.querySelector('#prepareAiReviewBtn')?.addEventListener('click',()=>{const latestQueue=buildAiConsentQueue(items,{selectedIds:[...selected],model,projectAlias});const latestValidation=validateAiConsent({confirmed,acknowledgedUpload,queue:latestQueue});recordAiConsentTrace(latestQueue,{confirmed:latestValidation.ok});if(latestValidation.ok)onPrepared({queue:latestQueue,region_config:config,consent:{confirmed,acknowledged_upload:acknowledgedUpload}});});
  };
  render();
  return root;
}

export {DEFAULT_MODEL};
