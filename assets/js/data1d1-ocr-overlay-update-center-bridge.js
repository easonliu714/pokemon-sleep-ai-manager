import {mountOcrOverlayUpdateCenter} from './data1d1-ocr-overlay-update-center-mount.js';

const BRIDGE_SCHEMA='pokemon-sleep-ocr-overlay-update-center-bridge/1.0';

function eventDetail(event){return event?.detail&&typeof event.detail==='object'?event.detail:{};}

export function createOcrOverlayUpdateCenterBridge({root=document,target=globalThis,slot='#ocrThumbnailOverlaySlot',maxActive=8}={}){
  const mount=mountOcrOverlayUpdateCenter({root,slot,maxActive});
  let disposed=false;

  async function onPreviewRequested(event){
    if(disposed)return;
    const detail=eventDetail(event);
    try{
      await mount.show({
        item:detail.item,
        index:detail.index||0,
        blob:detail.blob,
        preset:detail.preset||'full_image',
        regions:Array.isArray(detail.regions)?detail.regions:[]
      });
      target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-overlay-preview-ready',{detail:{schema:BRIDGE_SCHEMA,active_count:mount.activeCount}}));
    }catch(error){
      globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_preview_failed',{status:'failed',error,details:{has_blob:detail.blob instanceof Blob}});
      target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ocr-overlay-preview-failed',{detail:{schema:BRIDGE_SCHEMA,message:String(error?.message||error)}}));
    }
  }

  function onPresetChanged(event){
    if(disposed)return;
    const detail=eventDetail(event);
    mount.changePreset(detail.preset||'full_image');
  }

  function onPreviewCleared(){if(!disposed)mount.clear();}

  target.addEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreviewRequested);
  target.addEventListener?.('pokemon-sleep:ocr-region-preset-changed',onPresetChanged);
  target.addEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewCleared);

  function dispose(){
    if(disposed)return;
    disposed=true;
    target.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-requested',onPreviewRequested);
    target.removeEventListener?.('pokemon-sleep:ocr-region-preset-changed',onPresetChanged);
    target.removeEventListener?.('pokemon-sleep:ocr-overlay-preview-cleared',onPreviewCleared);
    mount.dispose();
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bridge_disposed',{status:'completed',details:{active_count:0}});
  }

  return {schema:BRIDGE_SCHEMA,mount,dispose,get activeCount(){return mount.activeCount;}};
}

export {BRIDGE_SCHEMA};
