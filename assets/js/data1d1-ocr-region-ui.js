import {OCR_REGION_PRESETS,buildRegionConfig,buildAiConsentQueue,validateAiConsent,recordAiConsentTrace} from './data1d1-ocr-region-ai-consent.js';

const DEFAULT_MODEL='gemini-3.6-flash';
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function itemId(item){return String(item?.sha256||item?.source_image_ref||item?.path||'');}
function itemName(item){return String(item?.path||item?.source_image_ref||'未命名圖片');}
function isDefaultReviewItem(item){return item?.requires_review===true||['low_confidence','conflict','failed'].includes(item?.classification_status);}
function isDuplicateReviewCandidate(item){return item?.status==='duplicate'||item?.classification_status==='skipped';}
function reviewCandidates(inventory){return (inventory?.items||[]).filter(item=>itemId(item)&&(isDefaultReviewItem(item)||isDuplicateReviewCandidate(item)));}
function presetOptions(selected){return Object.entries(OCR_REGION_PRESETS).map(([key,preset])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(preset.label)}</option>`).join('');}
function regionBoxes(config){return config.regions.map((region,index)=>`<div class="ocr-region-box" style="left:${region.x*100}%;top:${region.y*100}%;width:${region.width*100}%;height:${region.height*100}%"><span>${index+1}. ${escapeHtml(region.label)}</span></div>`).join('');}

export function createOcrRegionAiReviewPanel({inventory,model=DEFAULT_MODEL,projectAlias='主要 Project',onPrepared=()=>{}}={}){
  const root=document.createElement('section');root.className='ocr-region-ai-panel';
  let preset='full_image';let selected=new Set();let confirmed=false;let acknowledgedUpload=false;let previewUrl='';let previewItem=null;let disposed=false;
  const releasePreview=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}previewItem=null;};
  const onPreview=event=>{const detail=event?.detail||{};if(disposed||!(detail.blob instanceof Blob))return;releasePreview();previewUrl=URL.createObjectURL(detail.blob);previewItem=detail.item||null;preset=detail.preset||preset;globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_region_preview_rendered',{status:'completed',details:{path:itemName(previewItem),blob_size:detail.blob.size,preset}});render();};
  const onPreviewClear=event=>{if(disposed)return;releasePreview();globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_region_preview_released',{status:'completed',details:{reason:event?.detail?.reason||'clear'}});render();};

  const render=()=>{
    const config=buildRegionConfig({preset});
    const items=reviewCandidates(inventory);
    const queue=buildAiConsentQueue(items,{selectedIds:[...selected],model,projectAlias});
    const validation=validateAiConsent({confirmed,acknowledgedUpload,queue});
    const rows=items.slice(0,150).map(item=>{
      const id=itemId(item);const duplicate=isDuplicateReviewCandidate(item);
      const note=duplicate?'此圖片已存在；系統預設不重跑。人工勾選後仍可加入 AI 覆判 Queue。':((item.classification_evidence||[]).join('、')||item.ocr_error||'需要人工覆核');
      return `<label class="ocr-ai-candidate ${duplicate?'ocr-ai-candidate-duplicate':''}"><input type="checkbox" data-ai-item="${escapeHtml(id)}" ${selected.has(id)?'checked':''}><span><strong>${escapeHtml(itemName(item))}</strong><br>分類：${escapeHtml(item.suggested_category||'未判定')}；信心度：${typeof item.classification_confidence==='number'?Math.round(item.classification_confidence*100)+'%':'—'}${duplicate?'<br><strong>重複圖片：需人工勾選才覆判</strong>':''}<br>${escapeHtml(note)}</span></label>`;
    }).join('');
    const previewImage=previewUrl?`<img class="ocr-region-preview-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(itemName(previewItem))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">`:'<div class="ocr-region-preview-empty" style="display:grid;place-items:center;width:100%;height:100%;padding:12px;text-align:center;">點選下方待覆核圖片以載入本機預覽</div>';
    root.innerHTML=`<h4>OCR 分區與 AI 覆核準備</h4><label>辨識區域 preset<select id="ocrRegionPreset">${presetOptions(preset)}</select></label><div class="ocr-region-preview" aria-label="OCR 裁切區域預覽" style="position:relative;overflow:hidden;">${previewImage}${regionBoxes(config)}</div>${previewItem?`<div class="notice">目前預覽：${escapeHtml(itemName(previewItem))}</div>`:''}<div class="ocr-region-list">${config.regions.map((r,i)=>`<div><strong>${i+1}. ${escapeHtml(r.label)}</strong><br>x ${r.x.toFixed(2)} / y ${r.y.toFixed(2)} / w ${r.width.toFixed(2)} / h ${r.height.toFixed(2)}</div>`).join('')}</div><h5>待覆核圖片</h5><div class="notice">已存在的重複圖片不會自動重跑，但可逐張人工勾選加入 AI 覆判 Queue。</div><div class="ocr-ai-selection-actions"><button type="button" id="ocrAiSelectAll" class="secondary">全選一般待覆核</button><button type="button" id="ocrAiClear" class="secondary">清除選取</button></div><div class="ocr-ai-candidates">${rows||'<div class="notice">目前沒有可覆核項目。</div>'}</div><div class="notice">預計建立 Queue ${queue.selected_count} 張；其中人工重複覆判 ${queue.manual_duplicate_count||0} 張；模型 ${escapeHtml(model)}；Project ${escapeHtml(projectAlias)}。</div><div class="notice"><strong>目前此按鈕只建立待送 Queue，不會呼叫 AI。</strong> API Key 測試僅確認 Key 與模型可用；實際 AI 執行器將由下一階段串接。</div><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiConsent" ${confirmed?'checked':''}>我明確同意將勾選項目交由 AI 覆核。</label><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiUploadAck" ${acknowledgedUpload?'checked':''}>我了解實際執行時圖片會上傳至 AI Provider，且 API Key 僅暫存於本瀏覽器工作階段。</label><button type="button" id="prepareAiReviewBtn" ${validation.ok?'':'disabled'}>建立 AI 覆核 Queue（尚不送出）</button>${validation.ok?'':'<div class="notice">需先選取圖片並完成兩項同意。</div>'}`;

    root.querySelector('#ocrRegionPreset')?.addEventListener('change',event=>{preset=event.target.value;globalThis.DebugTrace?.record?.('ocr_region','ocr_region_preset_changed',{status:'completed',details:{preset,region_count:buildRegionConfig({preset}).regions.length}});render();});
    root.querySelectorAll('[data-ai-item]').forEach(input=>input.addEventListener('change',()=>{input.checked?selected.add(input.dataset.aiItem):selected.delete(input.dataset.aiItem);const item=items.find(candidate=>itemId(candidate)===input.dataset.aiItem);if(item&&isDuplicateReviewCandidate(item)&&input.checked){globalThis.DebugTrace?.record?.('ai_review','duplicate_ai_review_manually_selected',{status:'completed',details:{item_id:itemId(item),source_image_ref:itemName(item)}});}render();}));
    root.querySelector('#ocrAiSelectAll')?.addEventListener('click',()=>{selected=new Set(items.filter(isDefaultReviewItem).map(itemId).filter(Boolean));render();});
    root.querySelector('#ocrAiClear')?.addEventListener('click',()=>{selected.clear();render();});
    root.querySelector('#ocrAiConsent')?.addEventListener('change',event=>{confirmed=event.target.checked;render();});
    root.querySelector('#ocrAiUploadAck')?.addEventListener('change',event=>{acknowledgedUpload=event.target.checked;render();});
    root.querySelector('#prepareAiReviewBtn')?.addEventListener('click',()=>{const latestQueue=buildAiConsentQueue(items,{selectedIds:[...selected],model,projectAlias});const latestValidation=validateAiConsent({confirmed,acknowledgedUpload,queue:latestQueue});recordAiConsentTrace(latestQueue,{confirmed:latestValidation.ok});if(latestValidation.ok){globalThis.DebugTrace?.record?.('ai_review','ai_review_queue_ready',{status:'completed',details:{selected_count:latestQueue.selected_count,manual_duplicate_count:latestQueue.manual_duplicate_count||0,model:latestQueue.model,project_alias:latestQueue.project_alias,request_sent:false}});onPrepared({queue:latestQueue,region_config:config,consent:{confirmed,acknowledged_upload:acknowledgedUpload}});}});
  };

  globalThis.addEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreview);
  globalThis.addEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewClear);
  root.dispose=()=>{if(disposed)return;disposed=true;releasePreview();globalThis.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreview);globalThis.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewClear);};
  render();return root;
}

export {DEFAULT_MODEL,isDefaultReviewItem,isDuplicateReviewCandidate,reviewCandidates};
