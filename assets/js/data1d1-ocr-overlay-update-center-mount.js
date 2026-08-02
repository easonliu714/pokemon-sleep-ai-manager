import {createOcrOverlayIntegration} from './data1d1-ocr-overlay-controller-integration.js';

const MOUNT_SCHEMA='pokemon-sleep-ocr-overlay-update-center-mount/1.0';

function resolveHost(root,selector){
  const host=typeof selector==='string'?root.querySelector(selector):selector;
  if(!host)throw new Error('ocr_overlay_update_center_host_missing');
  return host;
}

export function mountOcrOverlayUpdateCenter({root=document,slot='#ocrThumbnailOverlaySlot',maxActive=8}={}){
  const host=resolveHost(root,slot);
  const integration=createOcrOverlayIntegration({root,maxActive});
  let currentModel=null;
  let currentPreset='full_image';
  let disposed=false;

  async function show({item,index=0,blob,preset=currentPreset,regions=[]}={}){
    if(disposed)throw new Error('ocr_overlay_update_center_disposed');
    currentPreset=preset||'full_image';
    currentModel=await integration.renderItem({slot:host,item,index,blob,preset:currentPreset,regions});
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_rendered',{status:'completed',details:{preset:currentPreset,active_count:integration.activeCount}});
    return currentModel;
  }

  function changePreset(preset){
    if(disposed)throw new Error('ocr_overlay_update_center_disposed');
    currentPreset=preset||'full_image';
    if(!currentModel)return null;
    currentModel={...currentModel,preset:currentPreset};
    integration.rerender({slot:host,model:currentModel});
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_preset_rerendered',{status:'completed',details:{preset:currentPreset,active_count:integration.activeCount}});
    return currentModel;
  }

  function clear(){
    integration.clearSlot(host);
    currentModel=null;
  }

  function dispose(){
    if(disposed)return;
    disposed=true;
    clear();
    integration.dispose();
  }

  return {schema:MOUNT_SCHEMA,show,changePreset,clear,dispose,get currentModel(){return currentModel;},get activeCount(){return integration.activeCount;}};
}

export {MOUNT_SCHEMA};
