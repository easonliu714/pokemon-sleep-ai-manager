export const ANALYSIS_EXECUTION_UX_VERSION='v0.4.27.20-analysis-execution-ux-2026-08-20-a';
export const PRIMARY_VISUAL_MODEL='gemini-3.1-flash-lite';
export const VISUAL_MODEL_RESCUE_ORDER=Object.freeze(['gemini-2.5-flash','gemini-2.5-flash-lite']);

const SESSION_KEY='pokemon-sleep:ai-project-pool/session';
const LEGACY_DEFAULT_MODELS=new Set(['','gemini-3.6-flash']);
const CURATED_VISUAL_MODELS=new Set([PRIMARY_VISUAL_MODEL,...VISUAL_MODEL_RESCUE_ORDER]);
const state={batchActive:false,aiCancelRequested:false,activeGeminiControllers:new Set(),modelPolicyUpdating:false};
const text=value=>String(value??'').trim();
const trace=(event,detail={})=>{
  const payload={version:ANALYSIS_EXECUTION_UX_VERSION,...detail};
  globalThis.UpdateCenterLiveDebug?.record?.(event,payload);
  globalThis.DebugTrace?.record?.('analysis_execution_ux',event,{status:'completed',details:payload});
};

export function rankVisualRescueModels(models=[],preferred=PRIMARY_VISUAL_MODEL){
  const unique=[...new Set((Array.isArray(models)?models:[]).map(text).filter(Boolean))];
  const priority=[text(preferred),...VISUAL_MODEL_RESCUE_ORDER].filter(Boolean);
  return unique.sort((a,b)=>{
    const ai=priority.indexOf(a),bi=priority.indexOf(b);
    const ar=ai<0?999:ai,br=bi<0?999:bi;
    if(ar!==br)return ar-br;
    const as=/gemini/i.test(a)&&/flash/i.test(a)&&!/(?:preview|experimental|exp\b)/i.test(a);
    const bs=/gemini/i.test(b)&&/flash/i.test(b)&&!/(?:preview|experimental|exp\b)/i.test(b);
    if(as!==bs)return as?-1:1;
    return a.localeCompare(b);
  });
}

function readPoolSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
function writePoolSession(value){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));return true;}catch{return false;}}
function modelNeedsDefaultMigration(model){return LEGACY_DEFAULT_MODELS.has(text(model));}
function publishMigratedPool(pool){
  if(!pool?.projects)return;
  const next={...pool,model:PRIMARY_VISUAL_MODEL};
  globalThis.PokemonSleepAiProjectPool=next;
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-project-pool-updated',{detail:{projects:next.projects,model:next.model,persistent:Boolean(next.persistent),source:'v042720_default_model_migration'}}));
}
function ensureDefaultModel(){
  if(state.modelPolicyUpdating)return;
  state.modelPolicyUpdating=true;
  try{
    const session=readPoolSession();
    if(session?.projects&&modelNeedsDefaultMigration(session.model)){
      const next={...session,model:PRIMARY_VISUAL_MODEL};writePoolSession(next);publishMigratedPool(next);
      trace('v042720_default_model_session_migrated',{from_model:text(session.model)||null,to_model:PRIMARY_VISUAL_MODEL});
    }else if(globalThis.PokemonSleepAiProjectPool?.projects&&modelNeedsDefaultMigration(globalThis.PokemonSleepAiProjectPool.model)){
      publishMigratedPool(globalThis.PokemonSleepAiProjectPool);
      trace('v042720_default_model_runtime_migrated',{to_model:PRIMARY_VISUAL_MODEL});
    }
    const select=document.getElementById('aiModelSelect');
    if(select&&modelNeedsDefaultMigration(select.value)){
      if(![...select.options].some(option=>option.value===PRIMARY_VISUAL_MODEL)){
        const option=document.createElement('option');option.value=PRIMARY_VISUAL_MODEL;option.textContent=`${PRIMARY_VISUAL_MODEL}（預設）`;select.prepend(option);
      }
      const previous=text(select.value)||null;select.value=PRIMARY_VISUAL_MODEL;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      trace('v042720_default_model_ui_migrated',{from_model:previous,to_model:PRIMARY_VISUAL_MODEL});
    }
  }finally{state.modelPolicyUpdating=false;}
}

function unifiedRoot(){return document.getElementById('unifiedImportAnalysisWorkbench');}
function runButton(){return unifiedRoot()?.querySelector('#unifiedRun')||null;}
function strategyNeedsAi(){return ['ocr_ai','ai_only'].includes(unifiedRoot()?.querySelector('#unifiedStrategy')?.value||'');}
function cancelAiButton(){return unifiedRoot()?.querySelector('#unifiedCancelAi')||null;}
function enforceRunLock(){
  const run=runButton();if(!run)return;
  if(state.batchActive){run.disabled=true;run.dataset.v042720ExecutionLock='1';if(!/辨識進行中/.test(run.textContent||''))run.textContent='辨識進行中…';}
  else delete run.dataset.v042720ExecutionLock;
  const cancel=cancelAiButton();if(cancel){cancel.disabled=!state.batchActive||!strategyNeedsAi()||state.aiCancelRequested;cancel.textContent=state.aiCancelRequested?'AI 取消中…':'取消 AI';}
}
function finishBatch(reason='completed'){
  setTimeout(()=>{
    state.batchActive=false;state.aiCancelRequested=false;state.activeGeminiControllers.clear();enforceRunLock();trace('v042720_batch_lock_released',{reason});
  },0);
}
function beginBatch(){
  state.batchActive=true;state.aiCancelRequested=false;state.activeGeminiControllers.clear();ensureCancelAiButton();enforceRunLock();
  queueMicrotask(enforceRunLock);setTimeout(enforceRunLock,0);setTimeout(enforceRunLock,25);setTimeout(enforceRunLock,100);
  trace('v042720_batch_lock_acquired',{strategy:unifiedRoot()?.querySelector('#unifiedStrategy')?.value||null});
}
function requestAiCancel(){
  if(!state.batchActive||!strategyNeedsAi())return;
  state.aiCancelRequested=true;
  for(const controller of [...state.activeGeminiControllers]){try{controller.abort('user_cancelled_ai');}catch{}}
  const status=unifiedRoot()?.querySelector('#unifiedStatus');
  if(status){status.className='notice';status.textContent='已要求取消 AI：目前進行中的 Provider 請求會停止／結束，後續 AI 不再繼續；已完成的 OCR / AI revision 會保留。';}
  enforceRunLock();trace('v042720_ai_cancel_requested',{active_request_count:state.activeGeminiControllers.size});
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-cancel-requested',{detail:{source:'v042720_user'}}));
}
function ensureCancelAiButton(){
  const root=unifiedRoot();if(!root)return null;
  let button=root.querySelector('#unifiedCancelAi');if(button)return button;
  const anchor=root.querySelector('#unifiedCancel');if(!anchor)return null;
  button=document.createElement('button');button.id='unifiedCancelAi';button.type='button';button.className='secondary';button.textContent='取消 AI';button.disabled=true;
  anchor.insertAdjacentElement('afterend',button);button.addEventListener('click',event=>{event.preventDefault();requestAiCancel();});
  trace('v042720_cancel_ai_control_ready',{});return button;
}

function alignUpdateCenterLayout(){
  const updates=document.getElementById('updates');if(!updates)return false;
  const ocr=document.getElementById('ocrRuntimeStatusPanel'),heading=document.getElementById('importHistoryHeading'),wrap=document.getElementById('importHistoryWrap');
  if(ocr&&heading&&ocr.nextElementSibling!==heading)updates.insertBefore(ocr,heading);
  if(heading&&wrap){updates.appendChild(heading);updates.appendChild(wrap);}
  if(ocr&&heading)ocr.dataset.v042720BeforeImportHistory='1';
  return Boolean(ocr&&heading&&wrap);
}

function requestUrl(input){try{return new URL(typeof input==='string'?input:input?.url||String(input),location.href);}catch{return null;}}
function isGeminiRequest(input){return requestUrl(input)?.hostname==='generativelanguage.googleapis.com';}
function shouldCurateVisualCatalog(url){
  return Boolean(state.batchActive&&url?.hostname==='generativelanguage.googleapis.com'&&/\/v1beta\/models\/?$/.test(url.pathname)&&text(globalThis.PokemonSleepAiProjectPool?.model)===PRIMARY_VISUAL_MODEL);
}
async function curateCapabilityResponse(response){
  if(!response?.ok)return response;
  let payload;try{payload=await response.clone().json();}catch{return response;}
  if(!Array.isArray(payload?.models))return response;
  const before=payload.models.length;
  const selected=payload.models.filter(model=>CURATED_VISUAL_MODELS.has(text(model?.name).replace(/^models\//,'')));
  if(!selected.length)return response;
  payload={...payload,models:selected};
  const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');
  trace('v042720_visual_capability_catalog_curated',{before_count:before,after_count:selected.length,models:selected.map(model=>text(model?.name).replace(/^models\//,''))});
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
function installGeminiCancelFetchBoundary(){
  if(globalThis.fetch?.v042720AiCancelWrapped)return;
  const originalFetch=globalThis.fetch.bind(globalThis);
  const wrapped=async(input,init={})=>{
    if(!isGeminiRequest(input))return originalFetch(input,init);
    if(state.aiCancelRequested)throw new DOMException('AI analysis cancelled by user','AbortError');
    if(!state.batchActive)return originalFetch(input,init);
    const controller=new AbortController();state.activeGeminiControllers.add(controller);
    const outer=init?.signal;
    const abortFromOuter=()=>{try{controller.abort(outer?.reason);}catch{}};
    if(outer){if(outer.aborted)abortFromOuter();else outer.addEventListener?.('abort',abortFromOuter,{once:true});}
    try{
      const response=await originalFetch(input,{...init,signal:controller.signal});
      return shouldCurateVisualCatalog(requestUrl(input))?await curateCapabilityResponse(response):response;
    }finally{state.activeGeminiControllers.delete(controller);outer?.removeEventListener?.('abort',abortFromOuter);}
  };
  Object.defineProperty(wrapped,'v042720AiCancelWrapped',{value:true});
  globalThis.fetch=wrapped;trace('v042720_gemini_cancel_fetch_boundary_ready',{curated_capability_rescue:true});
}

function onUnifiedStage(event){
  const detail=event?.detail||{};
  if(detail.state==='running'){state.batchActive=true;ensureCancelAiButton();enforceRunLock();}
  if(detail.stage==='cross'&&['review','completed','cancelled'].includes(detail.state))finishBatch(`cross_${detail.state}`);
  if(detail.stage==='ai'&&['failed','cancelled'].includes(detail.state)){
    if(state.aiCancelRequested){const status=unifiedRoot()?.querySelector('#unifiedStatus');setTimeout(()=>{if(status){status.className='notice';status.textContent='AI 已取消；已完成的 OCR / AI revision 已保留，後續圖片未再送往 AI Provider。';}},0);}
    finishBatch(`ai_${detail.state}`);
  }
  if(detail.stage==='ocr'&&detail.state==='completed'&&detail.mode==='ocr_only'&&Number(detail.current)>=Number(detail.total||0))finishBatch('ocr_only_completed');
}

function install(){
  if(globalThis.PokemonSleepAnalysisExecutionUXV042720)return globalThis.PokemonSleepAnalysisExecutionUXV042720;
  installGeminiCancelFetchBoundary();ensureDefaultModel();alignUpdateCenterLayout();ensureCancelAiButton();
  document.addEventListener('click',event=>{if(event.target?.closest?.('#unifiedRun'))beginBatch();},true);
  document.addEventListener('change',event=>{if(event.target?.closest?.('#unifiedImportAnalysisWorkbench')){ensureCancelAiButton();if(state.batchActive)setTimeout(enforceRunLock,0);}},true);
  globalThis.addEventListener('pokemon-sleep:unified-analysis-stage',onUnifiedStage);
  globalThis.addEventListener('pokemon-sleep:identity-import-files-selected',()=>{setTimeout(()=>{ensureCancelAiButton();alignUpdateCenterLayout();ensureDefaultModel();enforceRunLock();},0);setTimeout(()=>{alignUpdateCenterLayout();enforceRunLock();},100);});
  globalThis.addEventListener('pokemon-sleep:ai-project-pool-updated',()=>setTimeout(ensureDefaultModel,0));
  const observer=new MutationObserver(()=>{ensureCancelAiButton();alignUpdateCenterLayout();ensureDefaultModel();if(state.batchActive)enforceRunLock();});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
  const api=Object.freeze({version:ANALYSIS_EXECUTION_UX_VERSION,primary_model:PRIMARY_VISUAL_MODEL,rescue_order:[...VISUAL_MODEL_RESCUE_ORDER],rankVisualRescueModels,requestAiCancel,getState:()=>({batch_active:state.batchActive,ai_cancel_requested:state.aiCancelRequested,active_gemini_requests:state.activeGeminiControllers.size}),alignUpdateCenterLayout,enforceRunLock});
  globalThis.PokemonSleepAnalysisExecutionUXV042720=api;
  globalThis.PokemonSleepVisualModelPolicyV042720=Object.freeze({primary:PRIMARY_VISUAL_MODEL,rescue_order:[...VISUAL_MODEL_RESCUE_ORDER],capability_catalog_curated_when_primary_active:true,reason:'PHYSICAL_V042719_8_OF_8_SUCCESS_LOW_LATENCY_STRUCTURED_EXTRACTION'});
  trace('v042720_analysis_execution_ux_ready',{run_lock:true,cancel_ai:true,ocr_before_history:true,history_last:true,primary_model:PRIMARY_VISUAL_MODEL,rescue_order:[...VISUAL_MODEL_RESCUE_ORDER],capability_catalog_curated:true});
  return api;
}

if(typeof document!=='undefined'&&typeof globalThis.addEventListener==='function')install();

export {install,requestAiCancel,alignUpdateCenterLayout,enforceRunLock};
