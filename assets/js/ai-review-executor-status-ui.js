const STATUS_UI_SCHEMA='pokemon-sleep-ai-review-executor-status-ui/1.2-model-failover-visible';
const unifiedState={ocr:'pending',ai:'pending',cross:'pending',message:'尚未開始辨識。'};
const label={pending:'待執行',running:'執行中',completed:'完成',failed:'失敗',review:'待人工確認'};
const icon={pending:'○',running:'◉',completed:'✓',failed:'✕',review:'△'};

function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
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
    const local=ensureExecutorStatus(panel);if(local&&status)setText(local,status.message);
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
  const rows=[['OCR',unifiedState.ocr],['AI',unifiedState.ai],['Cross Check',unifiedState.cross]];
  const html=`<strong>辨識進度</strong><div style="display:grid;gap:6px;margin-top:6px">${rows.map(([name,state],index)=>`<div><b>${index+1}. ${name}</b>：${icon[state]||'○'} ${label[state]||state}</div>`).join('')}</div><div style="margin-top:6px">${unifiedState.message}</div>`;
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
function resetUnified(root=document){unifiedState.ocr='pending';unifiedState.ai='pending';unifiedState.cross='pending';unifiedState.message='圖片已載入；請選擇辨識策略後開始。';renderUnifiedProgress(root);}
function elapsedSeconds(startedAt){return startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;}
function modelStatusText(modelState,status){
  const d=status?.detail||{};
  const pos=d.current&&d.total?`AI ${d.current}/${d.total}`:'AI';
  const file=d.file_name||'目前圖片';
  const elapsed=elapsedSeconds(modelState.imageStartedAt);
  const transition=modelState.transition?`｜${modelState.transition}`:'';
  return `${pos}｜${modelState.model||d.model||'模型確認中'}｜${file}｜等待 ${elapsed} 秒${transition}`;
}

export function createAiReviewExecutorStatusUi({root=document,target=globalThis}={}){
  let status=null;
  const modelState={model:null,imageStartedAt:null,transition:null};
  const set=(state,message,detail={})=>{status={state,message,detail,updated_at:new Date().toISOString()};target.DebugTrace?.record?.('ai_executor_ui','ai_executor_status_changed',{status:state==='failed'?'failed':'completed',details:{state,...detail}});updatePanel(root,status);};
  const handlers={
    started:event=>{modelState.model=event.detail?.model||modelState.model;modelState.imageStartedAt=null;modelState.transition=null;set('running','AI 覆核：執行中。',event.detail);},
    progress:event=>{const d=event.detail||{};if(d.phase==='started'){modelState.model=d.model||modelState.model;modelState.imageStartedAt=Date.now();modelState.transition=null;}if(d.phase==='completed'){modelState.model=d.model||modelState.model;modelState.transition=null;}set('running',modelStatusText(modelState,{detail:d}),d);},
    completed:event=>{modelState.imageStartedAt=null;modelState.transition=null;set('completed',`AI 覆核：完成 ${event.detail?.completed||0} 張。`,event.detail);},
    paused:event=>{modelState.imageStartedAt=null;set('paused','AI 覆核：已暫停，可在 Project 恢復後重試。',event.detail);},
    blocked:event=>set('blocked','AI 覆核：請先在使用說明設定並測試 Project Pool。',event.detail),
    failed:event=>{modelState.imageStartedAt=null;set('failed',`AI 覆核失敗：${event.detail?.message||'未知錯誤'}`,event.detail);}
  };
  for(const [name,handler] of Object.entries(handlers))target.addEventListener?.(`pokemon-sleep:ai-review-executor-${name}`,handler);
  const onModelStatus=event=>{
    const d=event.detail||{};
    if(d.event==='ai_model_candidate_started')modelState.model=d.model||modelState.model;
    else if(d.event==='ai_model_failover'){modelState.model=d.to_model||modelState.model;modelState.transition=`${d.from_model||'前一模型'} ${d.error_class==='provider_timeout'||d.error_class==='provider_total_timeout'?'逾時':'失敗'}，已切換 → ${d.to_model||'下一模型'}`;}
    else if(d.event==='ai_model_fallback_promoted'){modelState.model=d.to_model||modelState.model;modelState.transition=`${d.to_model||modelState.model||'Fallback 模型'} 完成，已設為下次首選`;}
    set('running',modelStatusText(modelState,status),{...(status?.detail||{}),model_event:d.event,model:modelState.model});
  };
  target.addEventListener?.('pokemon-sleep:ai-review-model-status',onModelStatus);
  const ticker=setInterval(()=>{if(status?.state==='running'&&modelState.imageStartedAt){status.message=modelStatusText(modelState,status);updatePanel(root,status);}},1000);
  const onCross=event=>{unifiedState.cross=event.detail?.ai_revision_id?'completed':event.detail?.recommended_action==='run_ai'?'pending':'review';unifiedState.message=event.detail?.ai_revision_id?'Cross Check 已更新；請在下方逐欄人工確認。':'Cross Check 已更新，仍需補 AI 或人工確認。';renderUnifiedProgress(root);};
  const onSource=()=>resetUnified(root);
  target.addEventListener?.('pokemon-sleep:analysis-cross-check-ready',onCross);target.addEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);
  const observer=new MutationObserver(()=>{updatePanel(root,status);syncUnifiedFromDom(root);});observer.observe(root.documentElement||root,{subtree:true,childList:true});
  updatePanel(root,status);syncUnifiedFromDom(root);
  return {schema:STATUS_UI_SCHEMA,get status(){return status;},get unified_progress(){return {...unifiedState};},dispose(){observer.disconnect();for(const [name,handler] of Object.entries(handlers))target.removeEventListener?.(`pokemon-sleep:ai-review-executor-${name}`,handler);target.removeEventListener?.('pokemon-sleep:analysis-cross-check-ready',onCross);target.removeEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);target.removeEventListener?.('pokemon-sleep:ai-review-model-status',onModelStatus);clearInterval(ticker);}};
}
if(typeof document!=='undefined'&&!globalThis.PokemonSleepAiReviewExecutorStatusUi)globalThis.PokemonSleepAiReviewExecutorStatusUi=createAiReviewExecutorStatusUi();
export {STATUS_UI_SCHEMA};
