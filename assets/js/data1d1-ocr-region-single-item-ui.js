import {OCR_REGION_PRESETS,buildRegionConfig,buildAiConsentQueue,validateAiConsent,recordAiConsentTrace} from './data1d1-ocr-region-ai-consent.js';

const DEFAULT_MODEL='gemini-3.6-flash';
const FRAME_FALLBACK_MS=48;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const itemId=item=>String(item?.sha256||item?.source_image_ref||item?.path||'');
const itemName=item=>String(item?.file_name||item?.path||item?.source_image_ref||'未命名圖片');
const trace=(event,status='completed',details={},error)=>globalThis.DebugTrace?.record?.('ai_review',event,{status,details,error});

function nextFrame(){return new Promise(resolve=>{let settled=false;const finish=source=>{if(settled)return;settled=true;clearTimeout(timer);resolve(source);};const timer=setTimeout(()=>finish('timeout'),FRAME_FALLBACK_MS);if(typeof globalThis.requestAnimationFrame==='function')globalThis.requestAnimationFrame(()=>finish('raf'));else queueMicrotask(()=>finish('microtask'));});}
function presetOptions(selected){return Object.entries(OCR_REGION_PRESETS).map(([key,value])=>`<option value="${escapeHtml(key)}" ${key===selected?'selected':''}>${escapeHtml(value.label)}</option>`).join('');}
function regionList(config){return config.regions.map((region,index)=>`<div><strong>${index+1}. ${escapeHtml(region.label)}</strong><br>x ${region.x.toFixed(2)} / y ${region.y.toFixed(2)} / w ${region.width.toFixed(2)} / h ${region.height.toFixed(2)}</div>`).join('');}

export function createSingleItemOcrRegionAiReviewPanel({item,model=DEFAULT_MODEL,projectAlias='主要 Project',onPrepared=()=>{}}={}){
  const root=document.createElement('section');
  root.className='ocr-region-ai-panel single-item-advanced-review';
  root.innerHTML='<div class="ocr-region-ai-shell"><h4>OCR 分區與 AI 覆核準備</h4><div class="notice" data-ai-bootstrap-status><strong>正在初始化單張進階覆核…</strong><br>此模式只建立目前一張圖片所需的最小介面。</div><div data-ai-core-mount></div></div>';
  let disposed=false,preset='full_image',confirmed=false,acknowledgedUpload=false;
  let initializationId=1;
  trace('advanced_review_shell_mounted','completed',{candidate_count:1,single_item_minimal_core:true,model,project_alias:projectAlias});

  const assertActive=id=>{if(disposed||id!==initializationId)throw new DOMException('Advanced review initialization cancelled','AbortError');};
  const yieldFrame=async id=>{const source=await nextFrame();assertActive(id);if(source!=='raf')trace('advanced_review_frame_fallback','completed',{source,fallback_ms:FRAME_FALLBACK_MS,single_item_minimal_core:true});};
  const updateStatus=(html,kind='')=>{const node=root.querySelector('[data-ai-bootstrap-status]');if(node){node.className=`notice ${kind}`.trim();node.innerHTML=html;}};
  const buildQueue=()=>buildAiConsentQueue([item],{selectedIds:[itemId(item)],model,projectAlias});
  const updateActionState=()=>{if(disposed)return;const queue=buildQueue();const validation=validateAiConsent({confirmed,acknowledgedUpload,queue});const summary=root.querySelector('[data-ai-queue-summary]');if(summary)summary.textContent=`已選取 1 張；模型 ${model}；Project ${projectAlias}。`;const prepare=root.querySelector('#prepareAiReviewBtn');if(prepare)prepare.disabled=!validation.ok;const hint=root.querySelector('[data-ai-validation-hint]');if(hint)hint.hidden=validation.ok;};

  const initialize=async id=>{
    try{
      await yieldFrame(id);
      trace('advanced_review_frame_yielded','completed',{frames:1,single_item_minimal_core:true});
      trace('advanced_review_core_started','started',{candidate_count:1,single_item_minimal_core:true});
      const mount=root.querySelector('[data-ai-core-mount]');
      if(!mount)throw new Error('Advanced review mount point unavailable');
      const config=buildRegionConfig({preset});
      mount.innerHTML=`<section><label>辨識區域 preset <select id="ocrRegionPreset">${presetOptions(preset)}</select></label><div id="ocrRegionList" class="ocr-region-list">${regionList(config)}</div></section><section class="ocr-ai-candidates"><h5>目前覆核圖片</h5><div class="ocr-ai-candidate"><strong>${escapeHtml(itemName(item))}</strong><br>狀態：${escapeHtml(item?.status||'待覆核')}；分類：${escapeHtml(item?.suggested_category||item?.category||'未分類')}<br><small>${escapeHtml(itemId(item))}</small></div></section><section><div class="notice" data-ai-queue-summary></div><div class="notice"><strong>目前只建立待送 Queue，不會自動呼叫 AI。</strong></div><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiConsent">我明確同意將此圖片交由 AI 覆核。</label><label class="ocr-ai-consent"><input type="checkbox" id="ocrAiUploadAck">我了解實際執行時圖片會上傳至 AI Provider。</label><button type="button" id="prepareAiReviewBtn" disabled>建立 AI 覆核 Queue（尚不送出）</button><div class="notice" data-ai-validation-hint>需完成兩項同意。</div></section>`;
      trace('advanced_review_regions_rendered','completed',{region_count:config.regions.length,preset,single_item_minimal_core:true});
      trace('advanced_review_candidates_rendered','completed',{candidate_count:1,batch_size:1,single_item_minimal_core:true});
      trace('advanced_review_buttons_rendered','completed',{button_count:1,single_item_minimal_core:true});
      root.querySelector('#ocrRegionPreset')?.addEventListener('change',event=>{preset=event.target.value;const next=buildRegionConfig({preset});const list=root.querySelector('#ocrRegionList');if(list)list.innerHTML=regionList(next);trace('ocr_region_preset_changed','completed',{preset,region_count:next.regions.length});});
      root.querySelector('#ocrAiConsent')?.addEventListener('change',event=>{confirmed=event.target.checked;updateActionState();});
      root.querySelector('#ocrAiUploadAck')?.addEventListener('change',event=>{acknowledgedUpload=event.target.checked;updateActionState();});
      root.querySelector('#prepareAiReviewBtn')?.addEventListener('click',()=>{const queue=buildQueue();const validation=validateAiConsent({confirmed,acknowledgedUpload,queue});recordAiConsentTrace(queue,{confirmed:validation.ok});if(!validation.ok)return;onPrepared({queue,region_config:buildRegionConfig({preset}),consent:{confirmed,acknowledged_upload:acknowledgedUpload}});});
      updateActionState();
      trace('advanced_review_events_attached','completed',{single_item_minimal_core:true});
      updateStatus('<strong>單張進階覆核已完成載入。</strong><br>已使用單張最小化核心。','success');
      trace('advanced_review_core_completed','completed',{candidate_count:1,preset,single_item_minimal_core:true});
      return root;
    }catch(error){if(error?.name==='AbortError')return root;updateStatus(`<strong>進階 AI 覆核初始化失敗。</strong><br>${escapeHtml(error?.message||String(error))}`,'error');trace('advanced_review_core_failed','failed',{phase:'single_item_minimal_core'},error);return root;}
  };
  root.ready=initialize(initializationId);
  root.dispose=()=>{if(disposed)return;disposed=true;initializationId+=1;};
  return root;
}

export {DEFAULT_MODEL,FRAME_FALLBACK_MS};
