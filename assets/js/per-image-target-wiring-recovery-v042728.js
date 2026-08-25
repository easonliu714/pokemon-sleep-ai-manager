export const PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION='v0.4.27.28-late-card-wiring-recovery-2026-08-23-b';
export const PER_IMAGE_TARGET_WIRING_RECOVERY_MAX_ATTEMPTS=300;
export const PER_IMAGE_TARGET_WIRING_RECOVERY_INTERVAL_MS=100;

const text=value=>String(value??'').trim();
const assignmentReady=row=>Boolean(row&&(row.mode==='existing'?text(row.pokemon_id):row.mode==='new'?text(row.new_group_key):false));
const setTextIfChanged=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
const setClassIfChanged=(node,value)=>{if(node&&node.className!==value)node.className=value;};
const trace=(scope,event,detail={})=>{
  const safe={version:PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION,...detail};
  scope.UpdateCenterLiveDebug?.record?.(event,safe);
  scope.DebugTrace?.record?.('unified_pipeline',event,{status:detail.status||'completed',details:safe});
};

export function evaluatePerImageTargetWiring({selected_ids=[],control_ids=[],ready_ids=[],needs_ai=false,consent=false}={}){
  const selected=[...new Set((selected_ids||[]).map(text).filter(Boolean))];
  const controls=new Set((control_ids||[]).map(text).filter(Boolean));
  const ready=new Set((ready_ids||[]).map(text).filter(Boolean));
  const unwired=selected.filter(id=>!controls.has(id));
  const unassigned=selected.filter(id=>controls.has(id)&&!ready.has(id));
  const allWired=selected.length>0&&unwired.length===0;
  const allAssigned=allWired&&unassigned.length===0;
  return {
    selected_count:selected.length,
    control_count:selected.filter(id=>controls.has(id)).length,
    ready_count:selected.filter(id=>ready.has(id)).length,
    unwired_ids:unwired,
    unassigned_ids:unassigned,
    all_wired:allWired,
    all_assigned:allAssigned,
    run_allowed:Boolean(selected.length&&allAssigned&&(!needs_ai||consent)),
  };
}

function cardId(card){return text(card?.querySelector?.('[data-unified-item]')?.value);}
function selectedIds(node){return [...node.querySelectorAll('[data-unified-item]:checked')].map(box=>text(box.value)).filter(Boolean);}
function controlIds(node){return [...node.querySelectorAll('[data-v042718-target-assignment]')].map(section=>text(section.dataset.v042718TargetAssignment)).filter(Boolean);}
function assignmentMap(core){return new Map((core?.getAssignments?.()||[]).map(row=>[text(row.item_id),row]));}
function filenameFor(node,id){
  for(const card of node.querySelectorAll('.light-review-item')){
    if(cardId(card)!==text(id))continue;
    return text(card.querySelector('strong')?.textContent)||text(id)||'未命名圖片';
  }
  return text(id)||'未命名圖片';
}
function stateFor(node,core){
  const selected=selectedIds(node),controls=controlIds(node),assignments=assignmentMap(core);
  const ready=selected.filter(id=>assignmentReady(assignments.get(id)));
  const strategy=node.querySelector('#unifiedStrategy')?.value||'';
  const needsAi=['ocr_ai','ai_only'].includes(strategy);
  const consent=Boolean(node.querySelector('#unifiedAiConsent')?.checked);
  return evaluatePerImageTargetWiring({selected_ids:selected,control_ids:controls,ready_ids:ready,needs_ai:needsAi,consent});
}
function cardControlParity(node){
  const cards=[...node.querySelectorAll('.light-review-item')];
  const ids=cards.map(cardId).filter(Boolean),controls=new Set(controlIds(node));
  const missing=ids.filter(id=>!controls.has(id));
  return {card_count:ids.length,control_count:ids.filter(id=>controls.has(id)).length,missing_control_ids:missing,complete:Boolean(ids.length&&missing.length===0)};
}

function ensureRecoveryUi(scope,node){
  const panel=node.querySelector('#v042718PerImageTargetNotice');if(!panel)return null;
  let row=node.querySelector('#v042728WiringRecoveryActions');
  if(!row){
    row=scope.document.createElement('div');row.id='v042728WiringRecoveryActions';row.className='buttons';
    row.innerHTML='<button type="button" id="v042728JumpFirstProblem" class="secondary" disabled>跳到第一張未指定圖片</button>';
    panel.append(row);
  }
  return row.querySelector('#v042728JumpFirstProblem');
}

function renderRecoveryState(scope,node,core){
  const state=stateFor(node,core),notice=node.querySelector('#v042718AssignmentGateNotice'),jump=ensureRecoveryUi(scope,node);
  const assignments=assignmentMap(core),problemIds=[...state.unwired_ids,...state.unassigned_ids];
  const names=problemIds.map(id=>filenameFor(node,id));
  if(jump){jump.disabled=!problemIds.length;jump.dataset.targetItemId=problemIds[0]||'';}
  for(const card of node.querySelectorAll('.light-review-item')){
    const id=cardId(card);if(!id)continue;
    const selected=Boolean(card.querySelector('[data-unified-item]')?.checked);
    const wired=Boolean(card.querySelector('[data-v042718-target-assignment]'));
    const ready=assignmentReady(assignments.get(id));
    card.dataset.v042728AssignmentState=!selected?'not-selected':!wired?'unwired':ready?'ready':'unassigned';
  }
  if(notice&&state.selected_count){
    let message='',className='notice pending';
    if(state.unwired_ids.length)message=`已選 ${state.selected_count} 張；目標欄位載入 ${state.control_count}/${state.selected_count}。正在自動補掛：${names.join('、')}`;
    else if(state.unassigned_ids.length)message=`已選 ${state.selected_count} 張；完成目標指定 ${state.ready_count}/${state.selected_count}。未指定：${names.join('、')}`;
    else if(!state.run_allowed)message=`已選 ${state.selected_count} 張；完成目標指定 ${state.ready_count}/${state.selected_count}。若策略包含 AI，請確認已勾選 AI 上傳同意。`;
    else {message=`已選 ${state.selected_count} 張；完成目標指定 ${state.ready_count}/${state.selected_count}。可開始辨識。`;className='notice success';}
    setClassIfChanged(notice,className);setTextIfChanged(notice,message);
  }
  return state;
}

export function installPerImageTargetWiringRecovery(scope=globalThis){
  if(!scope?.document||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepPerImageTargetWiringRecoveryV042728?.version===PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION)return true;
  let generation=0,observer=null,observedNode=null,refreshQueued=false;

  const core=()=>scope.PokemonSleepPerImageTargetAssignmentV042718||null;
  const node=()=>scope.document.getElementById('unifiedImportAnalysisWorkbench');
  const queueRefresh=()=>{
    if(refreshQueued)return;refreshQueued=true;
    setTimeout(()=>{refreshQueued=false;refresh('mutation_or_input');},0);
  };
  const attachObserver=current=>{
    if(typeof scope.MutationObserver!=='function'||!current||observedNode===current)return;
    observer?.disconnect?.();observedNode=current;
    observer=new scope.MutationObserver(records=>{if(records.some(record=>record.type==='childList'))queueRefresh();});
    observer.observe(current,{childList:true,subtree:true});
  };
  const refresh=reason=>{
    const current=node(),assignmentCore=core();if(!current||!assignmentCore)return {ready:false,reason:'runtime_not_ready'};
    attachObserver(current);
    assignmentCore.sync?.();
    const parity=cardControlParity(current),state=renderRecoveryState(scope,current,assignmentCore);
    const signature=`${parity.card_count}:${parity.control_count}:${state.selected_count}:${state.ready_count}:${state.unwired_ids.join(',')}:${state.unassigned_ids.join(',')}`;
    if(current.dataset.v042728WiringSignature!==signature){
      current.dataset.v042728WiringSignature=signature;
      trace(scope,'v042728_per_image_target_wiring_sync',{reason,card_count:parity.card_count,control_count:parity.control_count,missing_control_count:parity.missing_control_ids.length,selected_count:state.selected_count,ready_count:state.ready_count,wiring_parity:parity.complete,status:parity.complete?'completed':'blocked'});
    }
    return {ready:parity.complete,parity,state};
  };
  const recover=(token,attempt=0)=>{
    if(token!==generation)return;
    const result=refresh('bounded_recovery');
    if(result.ready||attempt>=PER_IMAGE_TARGET_WIRING_RECOVERY_MAX_ATTEMPTS)return;
    setTimeout(()=>recover(token,attempt+1),PER_IMAGE_TARGET_WIRING_RECOVERY_INTERVAL_MS);
  };
  const startRecovery=reason=>{
    const token=++generation;
    trace(scope,'v042728_per_image_target_wiring_recovery_started',{reason,max_attempts:PER_IMAGE_TARGET_WIRING_RECOVERY_MAX_ATTEMPTS,interval_ms:PER_IMAGE_TARGET_WIRING_RECOVERY_INTERVAL_MS});
    recover(token,0);
  };
  const onInteraction=event=>{
    if(event?.target?.id==='v042728JumpFirstProblem'){
      const current=node(),id=event.target.dataset.targetItemId;if(current&&id){
        core()?.sync?.();
        for(const card of current.querySelectorAll('.light-review-item')){
          if(cardId(card)!==text(id))continue;
          card.scrollIntoView?.({behavior:'smooth',block:'center'});
          setTimeout(()=>card.querySelector('[data-v042718-target-mode]')?.focus?.(),250);
          break;
        }
      }
    }
    setTimeout(()=>refresh('user_interaction'),10);
  };

  scope.addEventListener('pokemon-sleep:identity-import-files-selected',()=>startRecovery('files_selected'));
  scope.document.addEventListener('change',onInteraction,true);
  scope.document.addEventListener('click',onInteraction,true);
  scope.addEventListener('pagehide',()=>observer?.disconnect?.(),{once:true});
  startRecovery('initial_install');

  const api=Object.freeze({
    version:PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION,
    sync:()=>refresh('manual_sync'),
    getState:()=>{const current=node(),assignmentCore=core();return current&&assignmentCore?{parity:cardControlParity(current),gate:stateFor(current,assignmentCore)}:null;},
    startRecovery,
  });
  scope.PokemonSleepPerImageTargetWiringRecoveryV042728=api;
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installPerImageTargetWiringRecovery(globalThis);