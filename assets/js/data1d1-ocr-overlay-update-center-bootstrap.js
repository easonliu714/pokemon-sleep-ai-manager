import {createOcrOverlayUpdateCenterBridge} from './data1d1-ocr-overlay-update-center-bridge.js';

const BOOTSTRAP_SCHEMA='pokemon-sleep-ocr-overlay-update-center-bootstrap/1.0';

function waitForHost({root=document,selector='#ocrThumbnailOverlaySlot',timeoutMs=10000,pollMs=100}={}){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const probe=()=>{
      const host=root.querySelector(selector);
      if(host){resolve(host);return;}
      if(Date.now()-started>=timeoutMs){reject(new Error('ocr_overlay_update_center_host_timeout'));return;}
      setTimeout(probe,pollMs);
    };
    probe();
  });
}

export async function bootstrapOcrOverlayUpdateCenter({root=document,slot='#ocrThumbnailOverlaySlot',maxActive=8,target=globalThis,timeoutMs=10000}={}){
  const host=await waitForHost({root,selector:slot,timeoutMs});
  const bridge=createOcrOverlayUpdateCenterBridge({root,slot:host,maxActive,target});
  target.OcrOverlayUpdateCenterBridge=bridge;
  target.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bootstrapped',{status:'completed',details:{slot:typeof slot==='string'?slot:'element',active_count:bridge.activeCount}});

  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;
    bridge.dispose();
    if(target.OcrOverlayUpdateCenterBridge===bridge)delete target.OcrOverlayUpdateCenterBridge;
    target.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bootstrap_disposed',{status:'completed',details:{active_count:0}});
  }

  target.addEventListener?.('pagehide',dispose,{once:true});
  return {schema:BOOTSTRAP_SCHEMA,bridge,dispose,get activeCount(){return bridge.activeCount;}};
}

export {BOOTSTRAP_SCHEMA,waitForHost};
