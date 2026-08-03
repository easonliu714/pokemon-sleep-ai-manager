import {OCR_REGION_PRESETS,buildRegionConfig} from './data1d1-ocr-region-ai-consent.js';
import {createSingleItemOcrRegionAiReviewPanel} from './data1d1-ocr-region-single-item-ui.js?v=20260803-g13-2m-live-debug-deferred-render';

const BUILD='20260803-g13-2m-live-debug-deferred-render';
let activeDispose=null;
let standalonePreviewUrl=null;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const trace=(event,detail={})=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,detail);
  globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});
};

function selectedItems(panel){
  return [...panel.querySelectorAll('.light-review-check:checked')].map(box=>{
    const article=box.closest('.light-review-item');
    const name=article?.querySelector('strong')?.textContent?.trim()||box.value||'未命名圖片';
    return {sha256:String(box.value||''),source_image_ref:name,path:name,file_name:name,status:'review',classification_status:'manual_ocr_review',requires_review:true};
  });
}

function controls({index,total,onPrevious,onNext,onBack}){
  const row=document.createElement('div');
  row.className='buttons';
  const previous=document.createElement('button');
  previous.type='button';previous.className='secondary';previous.textContent='上一張';previous.disabled=index===0;previous.onclick=onPrevious;
  const next=document.createElement('button');
  next.type='button';next.className='secondary';next.textContent=index===total-1?'已是最後一張':'下一張';next.disabled=index===total-1;next.onclick=onNext;
  const back=document.createElement('button');
  back.type='button';back.className='secondary';back.textContent='返回輕量清單';back.onclick=onBack;
  row.append(previous,next,back);
  return row;
}

function createOcrOnlyPanel(item){
  const root=document.createElement('section');
  root.className='ocr-only-review-panel';
  let preset='full_image';
  const renderRegions=()=>{
    const config=buildRegionConfig({preset});
    const list=root.querySelector('[data-ocr-only-regions]');
    if(list)list.innerHTML=config.regions.map((region,index)=>`<div><strong>${index+1}. ${escapeHtml(region.label)}</strong><br>x ${region.x.toFixed(2)} / y ${region.y.toFixed(2)} / w ${region.width.toFixed(2)} / h ${region.height.toFixed(2)}</div>`).join('');
    trace('ocr_only_regions_rendered',{preset,region_count:config.regions.length});
  };
  root.innerHTML=`<div class="notice success"><strong>OCR-only 單張覆核</strong><br>不建立 AI Consent、Queue 或 Provider 元件。</div><div class="notice"><strong>${escapeHtml(item.file_name)}</strong><br>${escapeHtml(item.sha256||item.source_image_ref)}</div><label>辨識區域 preset <select data-ocr-only-preset>${Object.entries(OCR_REGION_PRESETS).map(([key,value])=>`<option value="${escapeHtml(key)}">${escapeHtml(value.label)}</option>`).join('')}</select></label><div class="ocr-region-list" data-ocr-only-regions></div><label>人工 OCR 判定 <select data-ocr-only-decision><option value="pending">待判定</option><option value="accepted">OCR 結果可接受</option><option value="manual_fix">需要人工修正</option><option value="reocr">需要重新 OCR</option></select></label><textarea data-ocr-only-note placeholder="人工覆核註記"></textarea><div class="buttons"><button type="button" data-ocr-only-save>保存本次 OCR 覆核結果</button></div><div class="notice" data-ocr-only-result></div>`;
  root.querySelector('[data-ocr-only-preset]')?.addEventListener('change',event=>{preset=event.target.value;renderRegions();});
  root.querySelector('[data-ocr-only-save]')?.addEventListener('click',()=>{
    const decision=root.querySelector('[data-ocr-only-decision]')?.value||'pending';
    const note=root.querySelector('[data-ocr-only-note]')?.value||'';
    const result=root.querySelector('[data-ocr-only-result]');
    if(result)result.textContent=`已保存：${decision}${note?`；${note}`:''}`;
    trace('ocr_only_review_saved',{item_id:item.sha256||item.source_image_ref,preset,decision,note_length:note.length});
  });
  renderRegions();
  trace('ocr_only_review_completed',{item_id:item.sha256||item.source_image_ref});
  root.dispose=()=>{};
  return root;
}

function mountOcrOnly(button){
  const originalPanel=button.closest('.lightweight-ai-review');
  const slot=document.getElementById('ocrRegionAiReviewSlot');
  if(!originalPanel||!slot)return false;
  const items=selectedItems(originalPanel);
  if(!items.length)return false;
  trace('ocr_only_review_started',{selected_count:items.length});
  activeDispose?.();
  let index=0;
  const wrapper=document.createElement('section');
  wrapper.className='sequential-ocr-only-review';
  const render=()=>{
    wrapper.replaceChildren();
    const item=items[index];
    const header=document.createElement('div');
    header.className='notice success';
    header.innerHTML=`<strong>OCR-only 覆核：${index+1}/${items.length}</strong><br>${escapeHtml(item.file_name)}`;
    const panel=createOcrOnlyPanel(item);
    wrapper.append(header,controls({index,total:items.length,onPrevious:()=>{if(index>0){index-=1;render();}},onNext:()=>{if(index<items.length-1){index+=1;render();}},onBack:()=>{panel.dispose?.();slot.replaceChildren(originalPanel);trace('ocr_only_review_closed',{selected_count:items.length,index});}}),panel);
    activeDispose=()=>panel.dispose?.();
  };
  slot.replaceChildren(wrapper);
  render();
  return true;
}

function ensureComparisonButtons(panel){
  const buttonRow=panel.querySelector('.buttons');
  if(!buttonRow||panel.querySelector('#loadSelectedOcrOnlyReview'))return;
  const button=document.createElement('button');
  button.id='loadSelectedOcrOnlyReview';
  button.type='button';
  button.className='secondary';
  button.disabled=true;
  button.textContent='OCR-only 覆核選取圖片';
  buttonRow.append(button);
  const sync=()=>{const count=panel.querySelectorAll('.light-review-check:checked').length;button.disabled=count===0;button.textContent=count?`OCR-only 覆核選取圖片（${count}）`:'OCR-only 覆核選取圖片';};
  panel.addEventListener('change',sync);
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();mountOcrOnly(button);});
  sync();
  trace('ocr_only_review_entry_ready');
}

function ensureStandaloneHost(){
  const updates=document.getElementById('updates');
  if(!updates||document.getElementById('standaloneSingleImageAiDiagnostic'))return;
  const host=document.createElement('section');
  host.id='standaloneSingleImageAiDiagnostic';
  host.className='panel';
  host.innerHTML=`<h3>單張圖片 AI 分析（獨立診斷）</h3><p class="notice">直接選一張圖片；不經 ZIP、清單或多張序列。只在本機建立預覽與 AI Queue，絕不自動送出。</p><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" data-standalone-ai-file><div data-standalone-ai-status class="notice">尚未選擇圖片。</div><div data-standalone-ai-preview></div><div data-standalone-ai-mount></div>`;
  const dynamic=document.getElementById('updateCenterDynamicContent');
  if(dynamic?.parentElement)dynamic.parentElement.insertBefore(host,dynamic);
  else updates.append(host);
  const input=host.querySelector('[data-standalone-ai-file]');
  input?.addEventListener('change',async()=>{
    const file=input.files?.[0];
    if(!file)return;
    trace('standalone_single_image_ai_started',{name:file.name,size:file.size,type:file.type});
    activeDispose?.();
    if(standalonePreviewUrl)URL.revokeObjectURL(standalonePreviewUrl);
    standalonePreviewUrl=URL.createObjectURL(file);
    const preview=host.querySelector('[data-standalone-ai-preview]');
    preview.replaceChildren();
    const image=document.createElement('img');
    image.className='light-review-preview';
    image.alt=file.name;
    image.src=standalonePreviewUrl;
    preview.append(image);
    const status=host.querySelector('[data-standalone-ai-status]');
    status.textContent='圖片已載入；正在建立獨立單張 AI 分析介面。';
    const item={sha256:`standalone:${file.name}:${file.size}:${file.lastModified}`,source_image_ref:file.name,path:file.name,file_name:file.name,status:'review',classification_status:'standalone_single_image',requires_review:true};
    const panel=createSingleItemOcrRegionAiReviewPanel({item,onPrepared:payload=>trace('standalone_single_image_ai_queue_prepared',{selected_count:payload?.queue?.selected_count||0})});
    host.querySelector('[data-standalone-ai-mount]').replaceChildren(panel);
    activeDispose=()=>panel.dispose?.();
    await panel.ready;
    status.textContent='獨立單張 AI 分析介面已完成載入。';
    trace('standalone_single_image_ai_completed',{name:file.name,size:file.size});
  });
  trace('standalone_single_image_ai_entry_ready',{build:BUILD});
}

const observer=new MutationObserver(()=>{
  document.querySelectorAll('.lightweight-ai-review').forEach(ensureComparisonButtons);
  ensureStandaloneHost();
});
observer.observe(document.documentElement,{subtree:true,childList:true});
document.querySelectorAll('.lightweight-ai-review').forEach(ensureComparisonButtons);
ensureStandaloneHost();

addEventListener('pagehide',()=>{
  activeDispose?.();
  if(standalonePreviewUrl)URL.revokeObjectURL(standalonePreviewUrl);
},{once:true});

trace('ocr_ai_ab_diagnostic_ready',{build:BUILD});
