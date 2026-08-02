import {buildRegionConfig} from './data1d1-ocr-region-ai-consent.js';

const WIRING_SCHEMA='pokemon-sleep-ocr-overlay-preview-event-wiring/1.0';

function eventDetail(event){return event?.detail&&typeof event.detail==='object'?event.detail:{};}
function currentPreset(root=document){return root.querySelector('#ocrRegionPreset')?.value||'full_image';}
function itemPathFromRow(row){return row?.querySelector('strong')?.textContent?.trim()||'';}
function reviewItemForPath(result,path){return (result?.inventory?.items||[]).find(item=>String(item?.path||item?.source_image_ref||'')===path)||null;}
function decorateRows(root=document){for(const row of root.querySelectorAll('.ocr-review-item')){if(row.dataset.ocrOverlayPreviewReady==='true')continue;row.dataset.ocrOverlayPreviewReady='true';row.setAttribute('role','button');row.setAttribute('tabindex','0');row.setAttribute('aria-label',`預覽 ${itemPathFromRow(row)||'OCR 圖片'}`);}}

export function createOcrOverlayPreviewEventWiring({root=document,target=globalThis}={}){
  let result=null;
  let disposed=false;
  let requestId=0;
  const observer=new MutationObserver(()=>decorateRows(root));

  const clear=(reason)=>{
    if(disposed)return;
    requestId+=1;
    target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-overlay-preview-cleared',{detail:{schema:WIRING_SCHEMA,reason}}));
    target.DebugTrace?.record?.('ocr_thumbnail','ocr_overlay_preview_cleared',{status:'completed',details:{reason}});
  };

  const requestPreview=async row=>{
    if(disposed||!result)return;
    const path=itemPathFromRow(row);
    const item=reviewItemForPath(result,path);
    const archive=result.archives?.[0];
    if(!path||!item||typeof archive?.readImage!=='function')return;
    const localRequestId=++requestId;
    row.setAttribute('aria-busy','true');
    try{
      const blob=await archive.readImage(path,{type:'blob'});
      if(disposed||localRequestId!==requestId)return;
      const preset=currentPreset(root);
      const config=buildRegionConfig({preset});
      target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-overlay-preview-requested',{detail:{schema:WIRING_SCHEMA,item,index:0,blob,preset,regions:config.regions}}));
      target.DebugTrace?.record?.('ocr_thumbnail','ocr_overlay_preview_requested',{status:'completed',details:{path,preset,region_count:config.regions.length,blob_size:blob.size}});
    }catch(error){
      target.DebugTrace?.record?.('ocr_thumbnail','ocr_overlay_preview_source_failed',{status:'failed',error,details:{path}});
      target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-overlay-preview-source-failed',{detail:{schema:WIRING_SCHEMA,path,message:String(error?.message||error)}}));
    }finally{row.removeAttribute('aria-busy');}
  };

  const onFilesSelected=event=>{clear('import_source_changed');result=eventDetail(event);decorateRows(root);};
  const onClick=event=>{const row=event.target?.closest?.('.ocr-review-item');if(row)requestPreview(row);if(event.target?.closest?.('#cancelOcrBtn'))clear('ocr_cancel_requested');};
  const onKeydown=event=>{if(!['Enter',' '].includes(event.key))return;const row=event.target?.closest?.('.ocr-review-item');if(!row)return;event.preventDefault();requestPreview(row);};
  const onChange=event=>{if(event.target?.id!=='ocrRegionPreset')return;const preset=event.target.value||'full_image';const config=buildRegionConfig({preset});target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-region-preset-changed',{detail:{schema:WIRING_SCHEMA,preset,regions:config.regions}}));target.DebugTrace?.record?.('ocr_region','ocr_region_preset_event_dispatched',{status:'completed',details:{preset,region_count:config.regions.length}});};
  const onPageHide=()=>clear('pagehide');

  target.addEventListener?.('pokemon-sleep:identity-import-files-selected',onFilesSelected);
  root.addEventListener?.('click',onClick);
  root.addEventListener?.('keydown',onKeydown);
  root.addEventListener?.('change',onChange);
  target.addEventListener?.('pagehide',onPageHide);
  observer.observe(root.documentElement||root,{subtree:true,childList:true});
  decorateRows(root);

  function dispose(){
    if(disposed)return;
    clear('dispose');
    disposed=true;
    observer.disconnect();
    target.removeEventListener?.('pokemon-sleep:identity-import-files-selected',onFilesSelected);
    root.removeEventListener?.('click',onClick);
    root.removeEventListener?.('keydown',onKeydown);
    root.removeEventListener?.('change',onChange);
    target.removeEventListener?.('pagehide',onPageHide);
    result=null;
  }

  return {schema:WIRING_SCHEMA,dispose,clear,get hasSource(){return Boolean(result);}};
}

if(typeof document!=='undefined'&&!globalThis.OcrOverlayPreviewEventWiring){
  globalThis.OcrOverlayPreviewEventWiring=createOcrOverlayPreviewEventWiring();
}

export {WIRING_SCHEMA,decorateRows,itemPathFromRow,reviewItemForPath};
