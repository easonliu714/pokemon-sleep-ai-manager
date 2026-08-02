const LIFECYCLE_SCHEMA='pokemon-sleep-ocr-overlay-lifecycle/1.0';

export function bindOcrOverlayLifecycle({controller,target=globalThis}={}){
  if(!controller||typeof controller.releaseAll!=='function')throw new Error('ocr_overlay_controller_required');
  const listeners=[];
  const bind=(name,handler)=>{target.addEventListener?.(name,handler);listeners.push([name,handler]);};
  const release=(reason)=>{
    controller.releaseAll();
    globalThis.DebugTrace?.record?.('ocr_thumbnail','ocr_thumbnail_overlay_released',{status:'completed',details:{reason,active_count:controller.activeCount||0}});
  };
  bind('pokemon-sleep:import-source-changed',()=>release('import_source_changed'));
  bind('pokemon-sleep:ocr-cancel-requested',()=>release('ocr_cancel_requested'));
  bind('pokemon-sleep:zip-selection-cleared',()=>release('zip_selection_cleared'));
  bind('pagehide',()=>release('pagehide'));
  return {
    schema:LIFECYCLE_SCHEMA,
    releaseAll:release,
    dispose(){for(const [name,handler] of listeners)target.removeEventListener?.(name,handler);listeners.length=0;release('dispose');}
  };
}

export {LIFECYCLE_SCHEMA};
