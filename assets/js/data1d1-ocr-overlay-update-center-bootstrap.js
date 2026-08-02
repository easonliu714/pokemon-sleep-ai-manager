import {createOcrOverlayUpdateCenterBridge} from './data1d1-ocr-overlay-update-center-bridge.js';

const BOOTSTRAP_SCHEMA='pokemon-sleep-ocr-overlay-update-center-bootstrap/1.1';
const INSTANCE_KEY='OcrOverlayUpdateCenterBootstrap';
const PROMISE_KEY='OcrOverlayUpdateCenterBootstrapPromise';

function waitForHost({root=document,selector='#ocrThumbnailOverlaySlot',timeoutMs=10000,pollMs=100}={}){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const probe=()=>{
      const host=typeof selector==='string'?root.querySelector(selector):selector;
      if(host){resolve(host);return;}
      if(Date.now()-started>=timeoutMs){reject(new Error('ocr_overlay_update_center_host_timeout'));return;}
      setTimeout(probe,pollMs);
    };
    probe();
  });
}

export function bootstrapOcrOverlayUpdateCenter({root=document,slot='#ocrThumbnailOverlaySlot',maxActive=8,target=globalThis,timeoutMs=10000}={}){
  if(target[INSTANCE_KEY])return Promise.resolve(target[INSTANCE_KEY]);
  if(target[PROMISE_KEY])return target[PROMISE_KEY];

  const pending=(async()=>{
    const host=await waitForHost({root,selector:slot,timeoutMs});
    const bridge=createOcrOverlayUpdateCenterBridge({root,slot:host,maxActive,target});
    target.OcrOverlayUpdateCenterBridge=bridge;
    target.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bootstrapped',{status:'completed',details:{slot:typeof slot==='string'?slot:'element',active_count:bridge.activeCount}});

    let disposed=false;
    const instance={schema:BOOTSTRAP_SCHEMA,bridge,dispose,get activeCount(){return bridge.activeCount;}};
    function dispose(){
      if(disposed)return;
      disposed=true;
      bridge.dispose();
      if(target.OcrOverlayUpdateCenterBridge===bridge)delete target.OcrOverlayUpdateCenterBridge;
      if(target[INSTANCE_KEY]===instance)delete target[INSTANCE_KEY];
      if(target[PROMISE_KEY])delete target[PROMISE_KEY];
      target.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bootstrap_disposed',{status:'completed',details:{active_count:0}});
    }

    target.addEventListener?.('pagehide',dispose,{once:true});
    target[INSTANCE_KEY]=instance;
    return instance;
  })();

  target[PROMISE_KEY]=pending;
  pending.catch(error=>{
    if(target[PROMISE_KEY]===pending)delete target[PROMISE_KEY];
    target.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_update_center_bootstrap_failed',{status:'failed',error,details:{timeout_ms:timeoutMs}});
  });
  return pending;
}

export {BOOTSTRAP_SCHEMA,INSTANCE_KEY,PROMISE_KEY,waitForHost};
