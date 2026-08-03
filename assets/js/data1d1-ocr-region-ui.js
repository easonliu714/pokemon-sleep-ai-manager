import {OCR_REGION_PRESETS,buildRegionConfig,buildAiConsentQueue,validateAiConsent,recordAiConsentTrace} from './data1d1-ocr-region-ai-consent.js';

const DEFAULT_MODEL='gemini-3.6-flash';
const CANDIDATE_BATCH_SIZE=12;
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function itemId(item){return String(item?.sha256||item?.source_image_ref||item?.path||'');}
function itemName(item){return String(item?.path||item?.source_image_ref||'未命名圖片');}
function isDefaultReviewItem(item){return item?.requires_review===true||['low_confidence','conflict','failed'].includes(item?.classification_status);}
function isDuplicateReviewCandidate(item){return item?.status==='duplicate'||item?.classification_status==='skipped';}
function reviewCandidates(inventory){return (inventory?.items||[]).filter(item=>itemId(item)&&(isDefaultReviewItem(item)||isDuplicateReviewCandidate(item)));}
function presetOptions(selected){return Object.entries(OCR_REGION_PRESETS).map(([key,preset])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(preset.label)}</option>`).join('');}
function regionBoxes(config){return config.regions.map((region,index)=>`<div class="ocr-region-box" style="left:${region.x*100}%;top:${region.y*100}%;width:${region.width*100}%;height:${region.height*100}%"><span>${index+1}. ${escapeHtml(region.label)}</span></div>`).join('');}
function regionList(config){return config.regions.map((region,index)=>`<div><strong>${index+1}. ${escapeHtml(region.label)}</strong><br>x ${region.x.toFixed(2)} / y ${region.y.toFixed(2)} / w ${region.width.toFixed(2)} / h ${region.height.toFixed(2)}</div>`).join('');}
function nextFrame(){return new Promise(resolve=>requestAnimationFrame(()=>resolve()));}
function trace(event,status='completed',details={},error){globalThis.DebugTrace?.record?.('ai_review',event,{status,details,error});}

export function createOcrRegionAiReviewPanel({inventory,model=DEFAULT_MODEL,projectAlias='主要 Project',onPrepared=()=>{}}={}){
  const root=document.createElement('section');
  root.className='ocr-region-ai-panel';
  root.innerHTML='<div class="ocr-region-ai-shell"><h4>OCR 分區與 AI 覆核準備</h4><div class="notice" data-ai-bootstrap-status><strong>正在初始化單張進階覆核…</strong><br>介面將分階段載入，期間可返回上一層。</div><div class="buttons"><button type="button" class="secondary" data-ai-cancel-bootstrap>取消載入</button></div><div data-ai-core-mount></div></div>';

  let preset='full_image';
  let selected=new Set();
  let confirmed=false;
  let acknowledgedUpload=false;
  let previewUrl='';
  let previewBlob=null;
  let previewItem=null;
  let disposed=false;
  let initializationId=0;
  let initializationPromise=Promise.resolve();
  const items=reviewCandidates(inventory).slice(0,150);

  trace('advanced_review_shell_mounted','completed',{candidate_count:items.length,model,project_alias:projectAlias});

  const releasePreview=()=>{
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
    previewBlob=null;
    previewItem=null;
  };
  const previewMarkup=()=>previewUrl
    ?`<img class="ocr-region-preview-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(itemName(previewItem))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">`
    :'<div class="ocr-region-preview-empty" style="display:grid;place-items:center;width:100%;height:100%;padding:12px;text-align:center;">點選下方待覆核圖片以載入本機預覽</div>';
  const assertActive=id=>{
    if(disposed||id!==initializationId)throw new DOMException('Advanced review initialization cancelled','AbortError');
  };
  const yieldFrame=async id=>{
    await nextFrame();
    assertActive(id);
  };
  const updateBootstrapStatus=(message,kind='')=>{
    const node=root.querySelector('[data-ai-bootstrap-status]');
    if(!node)return;
    node.className=`notice ${kind}`.trim();
    node.innerHTML=message;
  };
  const updatePreviewDom=()=>{
    if(disposed)return;
    const config=buildRegionConfig({preset});
    const preview=root.querySelector('#ocrRegionPreview');
    const notice=root.querySelector('#ocrPreviewNotice');
    const list=root.querySelector('#ocrRegionList');
    if(preview)preview.innerHTML=`${previewMarkup()}${regionBoxes(config)}`;
    if(notice){notice.textContent=previewItem?`目前預覽：${itemName(previewItem)}`:'';notice.hidden=!previewItem;}
    if(list)list.innerHTML=regionList(config);
  };
  const buildQueue=()=>buildAiConsentQueue(items,{selectedIds:[...selected],model,projectAlias});
  const updateActionState=()=>{
    if(disposed)return;
    const queue=buildQueue();
    const validation=validateAiConsent({confirmed,acknowledgedUpload,queue});
    const summary=root.querySelector('[data-ai-queue-summary]');
    if(summary)summary.textContent=`預計建立 Queue ${queue.selected_count} 張；其中人工重複覆判 ${queue.manual_duplicate_count||0} 張；模型 ${model}；Project ${projectAlias}。`;
    const prepare=root.querySelector('#prepareAiReviewBtn');
    if(prepare)prepare.disabled=!validation.ok;
    const hint=root.querySelector('[data-ai-validation-hint]');
    if(hint)hint.hidden=validation.ok;
  };
  const createCandidateRow=item=>{
    const id=itemId(item);
    const duplicate=isDuplicateReviewCandidate(item);
    const note=duplicate?'此圖片已存在；系統預設不重跑。人工勾選後仍可加入 AI 覆判 Queue。':((item.classification_evidence||[]).join('、')||item.ocr_error||'需要人工覆核');
    const label=document.createElement('label');
    label.className=`ocr-ai-candidate ${duplicate?'ocr-ai-candidate-duplicate':''}`.trim();
    label.dataset.aiRow=id;
    label.innerHTML=`<input type="checkbox" data-ai-item="${escapeHtml(id)}"><span><strong>${escapeHtml(itemName(item))}</strong><br>分類：${escapeHtml(item.suggested_category||'未判定')}；信心度：${typeof item.classification_confidence==='number'?Math.round(item.classification_confidence*100)+'%':'—'}${duplicate?'<br><strong>重複圖片：需人工勾選才覆判</strong>':''}<br>${escapeHtml(note)}</span>`;
    return label;
  };
  const renderFailure=(error,id)=>{
    if(disposed||id!==initializationId)return;
    const message=error?.message||String(error);
    updateBootstrapStatus(`<strong>進階 AI 覆核初始化失敗。</strong><br>${escapeHtml(message)}<div class="buttons"><button type="button" class="secondary" data-ai-retry-bootstrap>重試</button></div>`,'error');
    root.querySelector('[data-ai-retry-bootstrap]')?.addEventListener('click',()=>startInitialization(),{once:true});
    trace('advanced_review_core_failed','failed',{phase:'progressive_initialization'},error);
  };
  const initializeCore=async id=>{
    try{
      await yieldFrame(id);
      await yieldFrame(id);
      trace('advanced_review_frame_yielded','completed',{frames:2});
      trace('advanced_review_core_started','started',{candidate_count:items.length});

      const mount=root.querySelector('[data-ai-core-mount]');
      assertActive(id);
      mount.replaceChildren();

      const regionSection=document.createElement('section');
      const config=buildRegionConfig({preset});
      regionSection.innerHTML=`<label>辨識區域 preset<select id="ocrRegionPreset">${presetOptions(preset)}</select></label><div id="ocrRegionPreview" class="ocr-region-preview" aria-label="OCR 裁切區域預覽" style="position:relative;overflow:hidden;">${previewMarkup()}${regionBoxes(config)}</div><div id="ocrPreviewNotice" class="notice" hidden></div><div id="ocrRegionList" class="ocr-region-list">${regionList(config)}</div>`;
      mount.appendChild(regionSection);
      trace('advanced_review_regions_rendered','completed',{region_count:config.regions.length,preset});
      await yieldFrame(id);

      const candidateSection=document.createElement('section');
      candidateSection.innerHTML='<h5>待覆核圖片</h5><div class="notice">已存在的重複圖片不會自動重跑，但可逐張人工勾選加入 AI 覆判 Queue。</div><div class="ocr-ai-candidates" style="max-height:46vh;overflow:auto;"></div>';
      mount.appendChild(candidateSection);
      const list=candidateSection.querySelector('.ocr-ai-candidates');
      if(!items.length)list.innerHTML='<div class="notice">目前沒有可覆核項目。</div>';
      for(let offset=0;offset<items.length;offset+=CANDIDATE_BATCH_SIZE){
        assertActive(id);
        const fragment=document.createDocumentFragment();
        items.slice(offset,offset+CANDIDATE_BATCH_SIZE).forEach(item=>fragment.appendChild(createCandidateRow(item)));
        list.appendChild(fragment);
        await yieldFrame(id);
      }
      trace('advanced_review_candidates_rendered','completed',{candidate_count:items.length,batch_size:CANDIDATE_BATCH_SIZE});

      const actions=document.createElement('section');
      actions.innerHTML=`<div class="ocr-ai-selection-actions"><button type="button" id="ocrAiSelectAll" class="secondary">全選一般待覆核</button><button type="button" id="ocrAiClear" class="secondary">清除選取</button></div><div class="notice" data-ai-queue-summary></div><div class="notice"><strong>目前此按鈕只建立待送 Queue，不會呼叫 AI。</strong> API Key 測試僅確認 Key 與模型可用；實際 AI 執行器將由下一階段串接。</div><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiConsent">我明確同意將勾選項目交由 AI 覆核。</label><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiUploadAck">我了解實際執行時圖片會上傳至 AI Provider，且 API Key 僅暫存於本瀏覽器工作階段。</label><button type="button" id="prepareAiReviewBtn" disabled>建立 AI 覆核 Queue（尚不送出）</button><div class="notice" data-ai-validation-hint>需先選取圖片並完成兩項同意。</div>`;
      mount.appendChild(actions);
      updateActionState();
      trace('advanced_review_buttons_rendered','completed',{button_count:4});
      await yieldFrame(id);

      root.querySelector('#ocrRegionPreset')?.addEventListener('change',event=>{
        preset=event.target.value;
        trace('ocr_region_preset_changed','completed',{preset,region_count:buildRegionConfig({preset}).regions.length});
        updatePreviewDom();
      });
      root.querySelector('.ocr-ai-candidates')?.addEventListener('change',event=>{
        const input=event.target.closest?.('[data-ai-item]');
        if(!input)return;
        input.checked?selected.add(input.dataset.aiItem):selected.delete(input.dataset.aiItem);
        const item=items.find(candidate=>itemId(candidate)===input.dataset.aiItem);
        if(item&&isDuplicateReviewCandidate(item)&&input.checked)trace('duplicate_ai_review_manually_selected','completed',{item_id:itemId(item),source_image_ref:itemName(item)});
        updateActionState();
      });
      root.querySelector('#ocrAiSelectAll')?.addEventListener('click',()=>{
        selected=new Set(items.filter(isDefaultReviewItem).map(itemId).filter(Boolean));
        root.querySelectorAll('[data-ai-item]').forEach(input=>{input.checked=selected.has(input.dataset.aiItem);});
        updateActionState();
      });
      root.querySelector('#ocrAiClear')?.addEventListener('click',()=>{
        selected.clear();
        root.querySelectorAll('[data-ai-item]').forEach(input=>{input.checked=false;});
        updateActionState();
      });
      root.querySelector('#ocrAiConsent')?.addEventListener('change',event=>{confirmed=event.target.checked;updateActionState();});
      root.querySelector('#ocrAiUploadAck')?.addEventListener('change',event=>{acknowledgedUpload=event.target.checked;updateActionState();});
      root.querySelector('#prepareAiReviewBtn')?.addEventListener('click',()=>{
        const latestQueue=buildQueue();
        const latestValidation=validateAiConsent({confirmed,acknowledgedUpload,queue:latestQueue});
        recordAiConsentTrace(latestQueue,{confirmed:latestValidation.ok});
        if(!latestValidation.ok)return;
        trace('ai_review_queue_ready','completed',{selected_count:latestQueue.selected_count,manual_duplicate_count:latestQueue.manual_duplicate_count||0,model:latestQueue.model,project_alias:latestQueue.project_alias,request_sent:false});
        onPrepared({queue:latestQueue,region_config:buildRegionConfig({preset}),consent:{confirmed,acknowledged_upload:acknowledgedUpload}});
      });
      trace('advanced_review_events_attached','completed',{delegated_candidate_listener:true});
      updateBootstrapStatus('<strong>單張進階覆核已完成載入。</strong><br>所有區塊已採分階段初始化。','success');
      root.querySelector('[data-ai-cancel-bootstrap]')?.remove();
      trace('advanced_review_core_completed','completed',{candidate_count:items.length,preset});
      return root;
    }catch(error){
      if(error?.name==='AbortError')return root;
      renderFailure(error,id);
      return root;
    }
  };
  const startInitialization=()=>{
    initializationId+=1;
    const id=initializationId;
    updateBootstrapStatus('<strong>正在初始化單張進階覆核…</strong><br>介面將分階段載入，期間可返回上一層。');
    initializationPromise=initializeCore(id);
    root.ready=initializationPromise;
    return initializationPromise;
  };
  const onPreview=event=>{
    const detail=event?.detail||{};
    if(disposed||!(detail.blob instanceof Blob))return;
    const nextItem=detail.item||null;
    const nextPreset=detail.preset||preset;
    if(previewBlob===detail.blob&&itemId(previewItem)===itemId(nextItem)&&preset===nextPreset)return;
    releasePreview();
    previewBlob=detail.blob;
    previewUrl=URL.createObjectURL(detail.blob);
    previewItem=nextItem;
    preset=nextPreset;
    updatePreviewDom();
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_region_preview_rendered',{status:'completed',details:{path:itemName(previewItem),blob_size:detail.blob.size,preset,list_position_preserved:true}});
  };
  const onPreviewClear=event=>{
    if(disposed)return;
    releasePreview();
    updatePreviewDom();
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_region_preview_released',{status:'completed',details:{reason:event?.detail?.reason||'clear'}});
  };

  globalThis.addEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreview);
  globalThis.addEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewClear);
  root.querySelector('[data-ai-cancel-bootstrap]')?.addEventListener('click',()=>{
    initializationId+=1;
    updateBootstrapStatus('<strong>已取消進階覆核初始化。</strong><br>可返回輕量清單後再次開啟。');
    trace('advanced_review_core_failed','cancelled',{phase:'progressive_initialization',reason:'user_cancelled'});
  });
  root.dispose=()=>{
    if(disposed)return;
    disposed=true;
    initializationId+=1;
    releasePreview();
    globalThis.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreview);
    globalThis.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewClear);
  };
  startInitialization();
  return root;
}

export {DEFAULT_MODEL,isDefaultReviewItem,isDuplicateReviewCandidate,reviewCandidates};
