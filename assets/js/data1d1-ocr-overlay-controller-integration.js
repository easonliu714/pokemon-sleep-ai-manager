import {createOcrThumbnailOverlayController} from './data1d1-ocr-thumbnail-overlay-wiring.js';
import {createOcrOverlayLifecycleCoordinator} from './data1d1-ocr-overlay-lifecycle-events.js';

const INTEGRATION_SCHEMA='pokemon-sleep-ocr-overlay-integration/1.0';

export function createOcrOverlayIntegration({root=document,maxActive=8}={}){
  const controller=createOcrThumbnailOverlayController({maxActive});
  const lifecycle=createOcrOverlayLifecycleCoordinator({controller,target:globalThis});
  let disposed=false;

  async function renderItem({slot,item,index=0,blob,preset='full_image',regions=[]}={}){
    if(disposed)throw new Error('ocr_overlay_integration_disposed');
    const host=typeof slot==='string'?root.querySelector(slot):slot;
    if(!host)throw new Error('ocr_overlay_slot_missing');
    const model=await controller.attach({item,index,blob,preset,regions});
    host.innerHTML=controller.render(model);
    host.dataset.ocrOverlayId=model.id;
    return model;
  }

  function rerender({slot,model}={}){
    if(disposed)throw new Error('ocr_overlay_integration_disposed');
    const host=typeof slot==='string'?root.querySelector(slot):slot;
    if(!host)throw new Error('ocr_overlay_slot_missing');
    host.innerHTML=controller.render(model);
    return model;
  }

  function clearSlot(slot){
    const host=typeof slot==='string'?root.querySelector(slot):slot;
    if(host){host.innerHTML='';delete host.dataset.ocrOverlayId;}
  }

  function dispose(){
    if(disposed)return;
    disposed=true;
    lifecycle.dispose();
    controller.releaseAll();
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_integration_disposed',{status:'completed',details:{active_count:0}});
  }

  return {schema:INTEGRATION_SCHEMA,controller,lifecycle,renderItem,rerender,clearSlot,dispose,get activeCount(){return controller.activeCount;}};
}

export {INTEGRATION_SCHEMA};
