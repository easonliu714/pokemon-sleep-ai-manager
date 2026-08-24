import './version-authority.js';
import './analysis-manual-draft-overlay-v042719.js';
import './ai-json-collapse-v042722.js';
import './player-profile-consistency-v042723.js';

const UNKNOWN_VERSION='v0.0.0-unknown';
const UNKNOWN_BUILD='unknown-build';

function cleanToken(value,fallback){
  const normalized=String(value||'').trim();
  return (normalized||fallback).replace(/[^a-zA-Z0-9._-]+/g,'_');
}

function timestampToken(value=new Date()){
  return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

export function getVersionAuthority(){
  return globalThis.PokemonSleepVersionAuthority||Object.freeze({
    app_version:UNKNOWN_VERSION,
    app_build:UNKNOWN_BUILD,
    cache_name:'pokemon-sleep-ai-unknown',
    schema:'pokemon-sleep-version-authority/unknown',
  });
}

export function getRuntimeVersion(root=globalThis.document){
  const authority=getVersionAuthority();
  const element=root?.documentElement||null;
  return {
    app_version:String(element?.dataset?.appVersion||authority.app_version||UNKNOWN_VERSION),
    app_build:String(element?.dataset?.appBuild||authority.app_build||UNKNOWN_BUILD)
  };
}

export function buildVersionedExportFilename(kind,{extension='json',sourceName=null,root=globalThis.document,timestamp=new Date()}={}){
  const {app_version,app_build}=getRuntimeVersion(root);
  const version=cleanToken(app_version,UNKNOWN_VERSION);
  const build=cleanToken(app_build,UNKNOWN_BUILD);
  const source=sourceName?`_${cleanToken(String(sourceName).replace(/\.[^.]+$/,''),'source')}`:'';
  const time=timestamp?`_${cleanToken(timestampToken(timestamp),'')}`:'';
  return `pokemon_sleep_${cleanToken(kind,'export')}_${version}_${build}${source}${time}.${cleanToken(extension,'json')}`;
}

export function attachRuntimeVersion(payload,root=globalThis.document){
  const runtime=getRuntimeVersion(root);
  return {...payload,app_version:runtime.app_version,app_build:runtime.app_build};
}

export const V042730_CONFIRMATION_JSON_MOBILE_CLOSURE_VERSION='v0.4.27.30-confirmation-json-mobile-closure-2026-08-24-a';

export function v042730ShouldBlockConfirmationNext(state={}){
  return Boolean(Number(state?.total||0)>0&&state?.has_next===false);
}

export function v042730RemainingItemIds(selectedIds=[],terminalIds=[]){
  const terminal=new Set((terminalIds||[]).map(value=>String(value||'')).filter(Boolean));
  return [...new Set((selectedIds||[]).map(value=>String(value||'')).filter(Boolean))].filter(id=>!terminal.has(id));
}

function installV042730ConfirmationJsonMobileClosure(scope=globalThis){
  if(!scope?.document||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepV042730ConfirmationJsonMobileClosure?.version===V042730_CONFIRMATION_JSON_MOBILE_CLOSURE_VERSION)return true;
  const doc=scope.document;
  let lastNavigationState=null;
  const wrappedRunHandlers=new WeakMap();
  const text=value=>String(value??'').trim();
  const trace=(event,detail={})=>{
    const safe={version:V042730_CONFIRMATION_JSON_MOBILE_CLOSURE_VERSION,...detail};
    scope.UpdateCenterLiveDebug?.record?.(event,safe);
    scope.DebugTrace?.record?.('unified_pipeline',event,{status:detail.status||'completed',details:safe});
  };
  const navigationState=()=>scope.PokemonSleepMultiCaptureConsistency?.getNavigationState?.()||lastNavigationState||null;
  const enforceConfirmationBoundary=()=>{
    const next=doc.getElementById('nextAnalysisGroup'),state=navigationState();
    if(!next||!v042730ShouldBlockConfirmationNext(state))return false;
    next.disabled=true;
    next.textContent='已是最後一隻寶可夢';
    next.dataset.v042730Boundary='last_existing_group';
    return true;
  };
  const onNavigation=event=>{
    lastNavigationState=event?.detail||navigationState();
    queueMicrotask(enforceConfirmationBoundary);
    setTimeout(enforceConfirmationBoundary,0);
  };
  const onDocumentClick=event=>{
    const target=event?.target?.closest?.('#nextAnalysisGroup');
    if(target&&v042730ShouldBlockConfirmationNext(navigationState())){
      event.preventDefault();
      event.stopImmediatePropagation();
      const status=doc.getElementById('analysisConfirmationStatus');
      if(status){status.className='notice';status.textContent='目前已是最後一位待確認寶可夢；人工確認不會建立空白群組。';}
      enforceConfirmationBoundary();
      trace('v042730_confirmation_last_group_forward_blocked',{status:'completed',empty_group_created:false});
      return;
    }
    const button=event?.target?.closest?.('button');
    if(button&&text(button.textContent).includes('檢視 JSON'))queueMicrotask(()=>decorateJsonViewers());
  };
  function decorateJsonViewers(){
    let count=0;
    for(const pre of doc.querySelectorAll('#unifiedResults pre.prompt-box')){
      if(pre.dataset.v042730JsonViewer==='true')continue;
      pre.dataset.v042730JsonViewer='true';
      pre.tabIndex=0;
      pre.style.maxHeight='60vh';
      pre.style.overflowY='auto';
      pre.style.overflowX='auto';
      pre.style.webkitOverflowScrolling='touch';
      pre.style.overscrollBehavior='contain';
      pre.style.touchAction='pan-x pan-y';
      count++;
    }
    return count;
  }
  const selectedIds=node=>[...node.querySelectorAll('[data-unified-item]:checked')].map(box=>text(box.value)).filter(Boolean);
  const allBoxes=node=>[...node.querySelectorAll('[data-unified-item]')];
  const markTerminalCard=(node,detail)=>{
    const results=node.querySelector('#unifiedResults');if(!results)return;
    const panels=[...results.querySelectorAll(':scope > .panel')];
    const host=panels.at(-1);if(!host)return;
    host.dataset.v042730TerminalItemId=text(detail.item_id);
    host.dataset.v042730TerminalState=text(detail.state);
    if(detail.state==='failed'&&!host.querySelector('[data-v042730-failure-notice]')){
      const notice=doc.createElement('div');notice.className='notice error';notice.dataset.v042730FailureNotice='true';
      notice.innerHTML=`<strong>AI 分析失敗 · ${text(detail.file_name)||'未命名圖片'}</strong><br>${text(detail.error_class)||'ai_provider_failed'}；Failure JSON 已保留，可檢視／匯出。`;
      host.prepend(notice);
    }
    decorateJsonViewers();
  };
  const wireRun=()=>{
    const node=doc.getElementById('unifiedImportAnalysisWorkbench'),run=node?.querySelector('#unifiedRun');
    if(!node||!run||!scope.PokemonSleepPerImageTargetAssignmentV042718||!scope.PokemonSleepPerImageTargetWiringRecoveryV042728)return false;
    const known=wrappedRunHandlers.get(run);
    if(known?.wrapper===run.onclick)return true;
    const base=run.onclick;if(typeof base!=='function')return false;
    const wrapper=async function(event){
      const mode=node.querySelector('#unifiedStrategy')?.value||'';
      if(!['ocr_ai','ai_only'].includes(mode))return base.call(this,event);
      const initialSelected=selectedIds(node);
      if(!initialSelected.length)return base.call(this,event);
      const boxes=allBoxes(node),initialSet=new Set(initialSelected),terminal=new Map();
      let pending=[...initialSelected],segment=0,hardStop=false;
      const results=node.querySelector('#unifiedResults'),status=node.querySelector('#unifiedStatus');
      try{
        while(pending.length){
          segment++;
          const pendingSet=new Set(pending);
          for(const box of boxes)box.checked=pendingSet.has(text(box.value));
          const preserved=segment>1&&results?[...results.children]:[];
          const segmentTerminal=[];
          const onStage=stageEvent=>{
            const detail=stageEvent?.detail||{},id=text(detail.item_id);
            if(detail.stage!=='ai'||!pendingSet.has(id)||!['completed','failed'].includes(detail.state))return;
            terminal.set(id,{state:detail.state,error_class:detail.error_class||null,file_name:detail.file_name||null});
            segmentTerminal.push(id);
            markTerminalCard(node,detail);
          };
          scope.addEventListener('pokemon-sleep:unified-analysis-stage',onStage);
          try{await base.call(this,event);}finally{scope.removeEventListener('pokemon-sleep:unified-analysis-stage',onStage);}
          if(preserved.length&&results)results.prepend(...preserved);
          decorateJsonViewers();
          const remaining=v042730RemainingItemIds(initialSelected,[...terminal.keys()]);
          if(!remaining.length){pending=[];break;}
          const madeProgress=segmentTerminal.length>0,hadItemFailure=segmentTerminal.some(id=>terminal.get(id)?.state==='failed');
          if(!madeProgress||!hadItemFailure){pending=remaining;hardStop=true;break;}
          pending=remaining;
          trace('v042730_batch_continuation_started',{status:'completed',segment,terminal_count:terminal.size,remaining_count:pending.length,per_item_failure_isolated:true});
        }
      }finally{
        for(const box of boxes)box.checked=initialSet.has(text(box.value));
        const failed=[...terminal.values()].filter(row=>row.state==='failed').length;
        const succeeded=[...terminal.values()].filter(row=>row.state==='completed').length;
        if(status&&terminal.size===initialSelected.length){
          status.className=failed?'notice pending':'notice success';
          status.textContent=`辨識完成：${terminal.size}/${initialSelected.length} terminal；${succeeded} succeeded；${failed} failed。${failed?' 失敗項已保留 Failure JSON，其餘圖片已繼續處理。':''}`;
        }else if(status&&hardStop){
          status.className='notice error';
          status.textContent=`辨識中止：${terminal.size}/${initialSelected.length} terminal；尚有 ${pending.length} 張未完成。請檢查上方錯誤後重試。`;
        }
        trace('v042730_batch_terminal_summary',{status:hardStop?'blocked':'completed',selected_count:initialSelected.length,terminal_count:terminal.size,succeeded_count:succeeded,failed_count:failed,remaining_count:pending.length,all_inputs_reached_terminal:terminal.size===initialSelected.length});
      }
    };
    wrappedRunHandlers.set(run,{base,wrapper});
    run.onclick=wrapper;
    run.dataset.v042730BatchContinuation='true';
    return true;
  };
  const observer=new MutationObserver(()=>{
    enforceConfirmationBoundary();
    decorateJsonViewers();
    wireRun();
  });
  observer.observe(doc.documentElement,{subtree:true,childList:true});
  scope.addEventListener('pokemon-sleep:analysis-confirmation-navigation-changed',onNavigation);
  doc.addEventListener('click',onDocumentClick,true);
  scope.addEventListener('pokemon-sleep:identity-import-files-selected',()=>{setTimeout(wireRun,0);setTimeout(wireRun,100);setTimeout(wireRun,300);});
  let attempts=0;
  const timer=setInterval(()=>{attempts++;const wired=wireRun();enforceConfirmationBoundary();decorateJsonViewers();if((wired&&attempts>=20)||attempts>=300)clearInterval(timer);},100);
  scope.addEventListener('pagehide',()=>{observer.disconnect();clearInterval(timer);},{once:true});
  const api=Object.freeze({version:V042730_CONFIRMATION_JSON_MOBILE_CLOSURE_VERSION,enforceConfirmationBoundary,decorateJsonViewers,wireRun,getNavigationState:navigationState});
  scope.PokemonSleepV042730ConfirmationJsonMobileClosure=api;
  trace('v042730_confirmation_json_mobile_closure_ready',{status:'completed',confirmation_empty_group_creation_blocked:true,per_item_provider_failure_isolated:true,mobile_json_vertical_scroll:true});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installV042730ConfirmationJsonMobileClosure(globalThis);

export {UNKNOWN_VERSION,UNKNOWN_BUILD,timestampToken,installV042730ConfirmationJsonMobileClosure};
