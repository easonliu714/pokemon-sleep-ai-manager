const STATUS_UI_SCHEMA='pokemon-sleep-ai-review-executor-status-ui/1.2-model-failover-progress';
const unifiedState={ocr:'pending',ai:'pending',cross:'pending',message:'尚未開始辨識。'};
const modelState={running:false,current_model:null,preferred_model:null,from_model:null,to_model:null,candidate_started_at:0,image_started_at:0,last_event:null,note:''};
const label={pending:'待執行',running:'執行中',completed:'完成',failed:'失敗',review:'待人工確認'};
const icon={pending:'○',running:'◉',completed:'✓',failed:'✕',review:'△'};

function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function elapsedSeconds(start){return start?Math.max(0,Math.floor((Date.now()-start)/1000)):0;}
function modelRuntimeText(){
  if(!modelState.current_model&&!modelState.note)return '';
  const elapsed=elapsedSeconds(modelState.image_started_at||modelState.candidate_started_at);
  if(modelState.last_event==='ai_model_failover'&&modelState.from_model&&modelState.to_model)return `模型切換：${modelState.from_model} → ${modelState.to_model}｜累計 ${elapsed} 秒`;
  if(modelState.last_event==='ai_model_candidate_failed')return `模型：${modelState.current_model||'未確認'}｜${modelState.note||'本候選失敗'}｜累計 ${elapsed} 秒`;
  if(modelState.running)return `模型：${modelState.current_model||'待確認'}｜等待 ${elapsed} 秒${modelState.note?`｜${modelState.note}`:''}`;
  return `模型：${modelState.current_model||'未確認'}${modelState.note?`｜${modelState.note}`:''}`;
}
function ensureExecutorStatus(panel){
  let node=panel.querySelector('[data-ai-executor-local-status]');
  if(node)return node;
  node=document.createElement('div');node.className='notice';node.dataset.aiExecutorLocalStatus='true';node.textContent='AI 覆核：尚未開始。';
  const buttons=panel.querySelector('.buttons');buttons?.insertAdjacentElement('afterend',node);
  return node;
}
function updatePanel(root=document,status=null){
  for(const panel of root.querySelectorAll('.ocr-region-ai-panel')){
    const button=panel.querySelector('#prepareAiReviewBtn');setText(button,'同意並執行 AI 覆核');
    for(const notice of panel.querySelectorAll('.notice'))if(notice.textContent.includes('目前此按鈕只建立待送 Queue'))notice.innerHTML='<strong>按下後將立即使用目前啟用的 Project Pool 與模型送出已勾選圖片。</strong> 若遇短期限流會暫停；只有明確 Project／每日配額耗盡才切換下一 Project。';
    const ack=panel.querySelector('#ocrAiUploadAck')?.closest('label');const desired='我了解勾選圖片會上傳至 AI Provider；Key 可選擇加密保存於此裝置，且不會進入診斷或匯出檔。';if(ack?.lastChild&&ack.lastChild.textContent!==desired)ack.lastChild.textContent=desired;
    const local=ensureExecutorStatus(panel);if(local&&status){const runtime=modelRuntimeText();setText(local,[status.message,runtime].filter(Boolean).join('｜'));}
  }
}
function ensureUnifiedProgress(root=document){
  const workbench=root.getElementById?.('unifiedImportAnalysisWorkbench')||root.querySelector?.('#unifiedImportAnalysisWorkbench');if(!workbench)return null;
  let node=workbench.querySelector('[data-unified-analysis-progress]');if(node)return node;
  node=document.createElement('div');node.className='notice';node.dataset.unifiedAnalysisProgress='true';
  const status=workbench.querySelector('#unifiedStatus');status?.insertAdjacentElement('afterend',node);
  return node;
}
function renderUnifiedProgress(root=document){
  const node=ensureUnifiedProgress(root);if(!node)return;
  const rows=[['OCR',unifiedState.ocr],['AI',unifiedState.ai],['Cross Check',unifiedState.cross]],runtime=modelRuntimeText();
  const html=`<strong>辨識進度</strong><div style="display:grid;gap:6px;margin-top:6px">${rows.map(([name,state],index)=>`<div><b>${index+1}. ${name}</b>：${icon[state]||'○'} ${label[state]||state}</div>`).join('')}</div><div style="margin-top:6px">${unifiedState.message}</div>${runtime?`<div data-ai-model-runtime-visible="true" style="margin-top:6px"><strong>${runtime}</strong></div>`:''}`;
  if(node.dataset.signature===html)return;node.dataset.signature=html;node.innerHTML=html;
}
function strategyMode(root=document){return root.querySelector?.('#unifiedStrategy')?.value||'ocr_ai';}
function syncUnifiedFromDom(root=document){
  const status=root.querySelector?.('#unifiedStatus');if(!status){renderUnifiedProgress(root);return;}
  const value=String(status.textContent||'').trim(),mode=strategyMode(root);
  if(/第一階段|第二階段|OCR 進度|OCR…|OCR\.\.\./.test(value)){unifiedState.ocr='running';if(mode==='ocr_ai')unifiedState.ai='pending';unifiedState.cross='pending';}
  if(/正在送出單張圖片|AI 分析進度/.test(value)){unifiedState.ocr=mode==='ai_only'?'pending':'completed';unifiedState.ai='running';unifiedState.cross='pending';}
  if(/AI 分析完成/.test(value)){unifiedState.ocr=mode==='ai_only'?'pending':'completed';unifiedState.ai='completed';unifiedState.cross='pending';}
  if(/一條龍辨識完成/.test(value)){
    unifiedState.ocr=mode==='ai_only'?'pending':'completed';unifiedState.ai=mode==='ocr_only'?'pending':'completed';unifiedState.cross=mode==='ocr_ai'||mode==='ai_only'?'review':'pending';
  }
  if(/辨識失敗|OCR 失敗|AI 分析失敗/.test(value)){if(/AI/.test(value))unifiedState.ai='failed';else unifiedState.ocr='failed';}
  if(/辨識已取消|OCR 已取消/.test(value)){if(unifiedState.ocr==='running')unifiedState.ocr='pending';if(unifiedState.ai==='running')unifiedState.ai='pending';}
  if(value)unifiedState.message=value;renderUnifiedProgress(root);
}
function resetModelState(){Object.assign(modelState,{running:false,current_model:null,preferred_model:null,from_model:null,to_model:null,candidate_started_at:0,image_started_at:0,last_event:null,note:''});}
function resetUnified(root=document){unifiedState.ocr='pending';unifiedState.ai='pending';unifiedState.cross='pending';unifiedState.message='圖片已載入；請選擇辨識策略後開始。';resetModelState();renderUnifiedProgress(root);}
function consumeModelRuntime(detail={},root=document){
  const event=detail.event||'';modelState.last_event=event;
  if(event==='ai_model_candidate_started'){
    modelState.running=true;modelState.current_model=detail.model||modelState.current_model;modelState.preferred_model=detail.preferred_model||modelState.preferred_model;modelState.from_model=null;modelState.to_model=null;modelState.candidate_started_at=Date.now();if(!modelState.image_started_at)modelState.image_started_at=Date.now();modelState.note=`候選 ${detail.candidate_number||'?'} / ${detail.candidate_count||'?'}`;
  }else if(event==='ai_model_candidate_failed'){
    modelState.running=false;modelState.current_model=detail.model||modelState.current_model;modelState.note=detail.error_class==='provider_timeout'||detail.error_class==='provider_total_timeout'?'逾時':'本候選失敗';
  }else if(event==='ai_model_failover'){
    modelState.running=true;modelState.from_model=detail.from_model||modelState.current_model;modelState.to_model=detail.to_model||null;modelState.current_model=modelState.to_model||modelState.current_model;modelState.candidate_started_at=Date.now();modelState.note='正在切換模型';
  }else if(event==='ai_model_timeout_project_state_released'){
    modelState.from_model=detail.from_model||modelState.from_model;modelState.to_model=detail.to_model||modelState.to_model;modelState.note='逾時後已釋放 Project，準備下一模型';
  }else if(event==='ai_model_fallback_promoted'){
    modelState.running=false;modelState.from_model=detail.from_model||modelState.from_model;modelState.to_model=detail.to_model||modelState.current_model;modelState.current_model=modelState.to_model;modelState.note='Fallback 完成，已設為下次首選';
  }
  renderUnifiedProgress(root);updatePanel(root,{message:unifiedState.message});
}

export function createAiReviewExecutorStatusUi({root=document,target=globalThis}={}){
  let status=null,timer=null;
  const ensureTimer=()=>{if(timer)return;timer=setInterval(()=>{if(modelState.running){renderUnifiedProgress(root);if(status)updatePanel(root,status);}},1000);};
  const stopTimer=()=>{if(timer){clearInterval(timer);timer=null;}};
  const set=(state,message,detail={})=>{status={state,message,detail,updated_at:new Date().toISOString()};target.DebugTrace?.record?.('ai_executor_ui','ai_executor_status_changed',{status:state==='failed'?'failed':'completed',details:{state,...detail}});updatePanel(root,status);};
  const handlers={
    started:event=>{resetModelState();modelState.running=true;modelState.current_model=event.detail?.model||null;modelState.preferred_model=event.detail?.model||null;modelState.image_started_at=Date.now();modelState.candidate_started_at=Date.now();modelState.note='準備送出';ensureTimer();set('running','AI 覆核：執行中。',event.detail);renderUnifiedProgress(root);},
    progress:event=>{const d=event.detail||{};if(d.phase==='started'){modelState.running=true;modelState.current_model=d.model||modelState.current_model;modelState.preferred_model=d.model||modelState.preferred_model;if(!modelState.image_started_at)modelState.image_started_at=Date.now();ensureTimer();}if(d.phase==='completed'){modelState.running=false;modelState.current_model=d.model||modelState.current_model;modelState.note=d.model_fallback_used?'完成（已使用 Fallback 模型）':'完成';}if(d.phase==='failed'){modelState.running=false;modelState.note=d.error_class||'失敗';}set('running',`AI 覆核：${d.current||0}/${d.total||0}。`,d);renderUnifiedProgress(root);},
    completed:event=>{modelState.running=false;modelState.note=modelState.note||'完成';stopTimer();set('completed',`AI 覆核：完成 ${event.detail?.completed||0} 張。`,event.detail);renderUnifiedProgress(root);},
    paused:event=>{modelState.running=false;stopTimer();set('paused','AI 覆核：已暫停，可在 Project 恢復後重試。',event.detail);renderUnifiedProgress(root);},
    blocked:event=>{modelState.running=false;stopTimer();set('blocked','AI 覆核：請先在使用說明設定並測試 Project Pool。',event.detail);renderUnifiedProgress(root);},
    failed:event=>{modelState.running=false;stopTimer();set('failed',`AI 覆核失敗：${event.detail?.message||'未知錯誤'}`,event.detail);renderUnifiedProgress(root);}
  };
  for(const [name,handler] of Object.entries(handlers))target.addEventListener?.(`pokemon-sleep:ai-review-executor-${name}`,handler);
  const onModelRuntime=event=>{consumeModelRuntime(event.detail,root);if(modelState.running)ensureTimer();};
  const onCross=event=>{unifiedState.cross=event.detail?.ai_revision_id?'completed':event.detail?.recommended_action==='run_ai'?'pending':'review';unifiedState.message=event.detail?.ai_revision_id?'Cross Check 已更新；請在下方逐欄人工確認。':'Cross Check 已更新，仍需補 AI 或人工確認。';renderUnifiedProgress(root);};
  const onSource=()=>resetUnified(root);
  target.addEventListener?.('pokemon-sleep:ai-model-runtime-status',onModelRuntime);target.addEventListener?.('pokemon-sleep:analysis-cross-check-ready',onCross);target.addEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);
  const observer=new MutationObserver(()=>{updatePanel(root,status);syncUnifiedFromDom(root);});observer.observe(root.documentElement||root,{subtree:true,childList:true});
  updatePanel(root,status);syncUnifiedFromDom(root);
  return {schema:STATUS_UI_SCHEMA,get status(){return status;},get unified_progress(){return {...unifiedState};},get model_runtime(){return {...modelState};},dispose(){observer.disconnect();stopTimer();for(const [name,handler] of Object.entries(handlers))target.removeEventListener?.(`pokemon-sleep:ai-review-executor-${name}`,handler);target.removeEventListener?.('pokemon-sleep:ai-model-runtime-status',onModelRuntime);target.removeEventListener?.('pokemon-sleep:analysis-cross-check-ready',onCross);target.removeEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);}};
}
if(typeof document!=='undefined'&&!globalThis.PokemonSleepAiReviewExecutorStatusUi)globalThis.PokemonSleepAiReviewExecutorStatusUi=createAiReviewExecutorStatusUi();
export {STATUS_UI_SCHEMA};
