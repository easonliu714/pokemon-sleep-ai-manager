import {createSingleItemOcrRegionAiReviewPanel} from './data1d1-ocr-region-single-item-ui.js?v=20260803-g13-2m-live-debug-deferred-render';
import './data1d1-ocr-ai-ab-diagnostic.js?v=20260803-g13-2m-live-debug-deferred-render';

const HOTFIX_VERSION='v0.3.70';
const HOTFIX_BUILD='20260803-g13-2m-live-debug-deferred-render';
let activePanel=null;

function trace(event,detail={}){
  globalThis.UpdateCenterLiveDebug?.record?.(event,detail);
  globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});
}

function updateVisibleVersion(){
  document.documentElement.dataset.appVersion=HOTFIX_VERSION;
  document.documentElement.dataset.appBuild=HOTFIX_BUILD;
  const badge=document.getElementById('appVersion');
  if(badge){
    badge.textContent=`版本 ${HOTFIX_VERSION}`;
    badge.title=`Pokémon Sleep AI Manager ${HOTFIX_VERSION} / ${HOTFIX_BUILD}`;
  }
}

function selectedItemsFromPanel(panel){
  return [...panel.querySelectorAll('.light-review-check:checked')].map(box=>{
    const article=box.closest('.light-review-item');
    const name=article?.querySelector('strong')?.textContent?.trim()||box.value||'未命名圖片';
    const text=article?.textContent||'';
    const duplicate=text.includes('重複');
    return {
      sha256:String(box.value||''),
      source_image_ref:name,
      path:name,
      file_name:name,
      status:duplicate?'duplicate':'review',
      classification_status:duplicate?'skipped':'low_confidence',
      requires_review:!duplicate
    };
  });
}

function mountDirectMinimalReview(button){
  const originalPanel=button.closest('.lightweight-ai-review');
  const slot=document.getElementById('ocrRegionAiReviewSlot');
  if(!originalPanel||!slot)return false;
  const items=selectedItemsFromPanel(originalPanel);
  if(!items.length)return false;

  trace('direct_minimal_review_intercepted',{selected_count:items.length});
  activePanel?.dispose?.();

  const wrapper=document.createElement('section');
  wrapper.className='sequential-advanced-review direct-minimal-review';
  let index=0;

  const render=()=>{
    activePanel?.dispose?.();
    wrapper.replaceChildren();
    const item=items[index];

    const header=document.createElement('div');
    header.className='notice success';
    header.innerHTML=`<strong>進階 AI 覆核：${index+1}/${items.length}</strong><br>${item.file_name}<br>已啟用 Android 單張最小化核心。`;

    const controls=document.createElement('div');
    controls.className='buttons';
    const previous=document.createElement('button');
    previous.type='button';
    previous.className='secondary';
    previous.textContent='上一張';
    previous.disabled=index===0;
    const next=document.createElement('button');
    next.type='button';
    next.className='secondary';
    next.textContent=index===items.length-1?'已是最後一張':'下一張';
    next.disabled=index===items.length-1;
    const back=document.createElement('button');
    back.type='button';
    back.className='secondary';
    back.textContent='返回輕量清單';
    controls.append(previous,next,back);

    const mount=document.createElement('div');
    wrapper.append(header,controls,mount);
    activePanel=createSingleItemOcrRegionAiReviewPanel({
      item,
      onPrepared:payload=>trace('direct_minimal_review_queue_prepared',{index,selected_count:payload?.queue?.selected_count||0})
    });
    mount.append(activePanel);
    activePanel.ready?.then(()=>trace('direct_minimal_review_completed',{index,selected_count:items.length})).catch(error=>trace('direct_minimal_review_failed',{index,message:error?.message||String(error)}));

    previous.onclick=()=>{if(index>0){index-=1;render();}};
    next.onclick=()=>{if(index<items.length-1){index+=1;render();}};
    back.onclick=()=>{
      activePanel?.dispose?.();
      activePanel=null;
      slot.replaceChildren(originalPanel);
      trace('direct_minimal_review_closed',{selected_count:items.length,index});
    };
  };

  slot.replaceChildren(wrapper);
  render();
  return true;
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#loadSelectedAdvancedReview');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const mounted=mountDirectMinimalReview(button);
  if(!mounted)trace('direct_minimal_review_intercept_failed',{reason:'missing_selection_or_panel'});
},true);

updateVisibleVersion();
setTimeout(updateVisibleVersion,0);
setTimeout(updateVisibleVersion,500);
trace('direct_minimal_review_hotfix_ready',{version:HOTFIX_VERSION,build:HOTFIX_BUILD,diagnostics_mode:'deferred_bounded_render',ab_paths:['ocr_only','standalone_single_image_ai','zip_lightweight_ai']});
