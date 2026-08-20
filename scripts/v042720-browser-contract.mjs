import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.PokemonSleepVersionAuthority?.app_version==='v0.4.27.20',{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepAnalysisExecutionUXV042720),{timeout:30000});

  const ux=await page.evaluate(async()=>{
    const api=globalThis.PokemonSleepAnalysisExecutionUXV042720;
    const real=document.getElementById('unifiedImportAnalysisWorkbench');
    if(real)real.id='unifiedImportAnalysisWorkbenchV042720Original';
    const fixture=document.createElement('section');fixture.id='unifiedImportAnalysisWorkbench';fixture.innerHTML=`
      <select id="unifiedStrategy"><option value="ai_only" selected>AI</option></select>
      <button id="unifiedRun">開始一條龍辨識</button>
      <button id="unifiedCancel" disabled>取消目前 OCR</button>
      <div id="unifiedStatus" class="notice"></div>`;
    document.body.appendChild(fixture);
    await new Promise(resolve=>setTimeout(resolve,40));
    const run=fixture.querySelector('#unifiedRun');
    run.click();
    await new Promise(resolve=>setTimeout(resolve,20));
    const lockedAfterClick=run.disabled&&run.dataset.v042720ExecutionLock==='1'&&api.getState().batch_active===true;
    run.disabled=false;
    await new Promise(resolve=>setTimeout(resolve,40));
    const relockAfterExternalEnable=run.disabled;
    const cancel=fixture.querySelector('#unifiedCancelAi');
    const cancelReady=Boolean(cancel&&!cancel.disabled&&cancel.textContent.includes('取消 AI'));
    cancel.click();
    await new Promise(resolve=>setTimeout(resolve,10));
    const cancelState=api.getState();
    let cancelledFetchName=null;
    try{await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=v042720-browser-fixture');}
    catch(error){cancelledFetchName=error?.name||null;}
    globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:unified-analysis-stage',{detail:{stage:'ai',state:'failed',mode:'ai_only',item_id:'fixture'}}));
    await new Promise(resolve=>setTimeout(resolve,30));
    const released=!api.getState().batch_active&&run.dataset.v042720ExecutionLock!=='1';
    run.disabled=false;
    await new Promise(resolve=>setTimeout(resolve,30));
    const staysUnlockedAfterFinish=!run.disabled;

    let select=document.getElementById('aiModelSelect');
    const realSelect=select;
    if(realSelect)realSelect.id='aiModelSelectV042720Original';
    select=document.createElement('select');select.id='aiModelSelect';select.innerHTML='<option value="gemini-3.6-flash" selected>legacy default</option><option value="gemini-2.5-flash">2.5</option>';document.body.appendChild(select);
    await new Promise(resolve=>setTimeout(resolve,40));
    const migratedModel=select.value;
    const ranked=api.rankVisualRescueModels(['gemini-2.0-flash','gemini-2.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash']);

    const updates=document.getElementById('updates');
    let ocr=document.getElementById('ocrRuntimeStatusPanel');
    if(!ocr){ocr=document.createElement('section');ocr.id='ocrRuntimeStatusPanel';updates.appendChild(ocr);}
    const heading=document.getElementById('importHistoryHeading'),wrap=document.getElementById('importHistoryWrap');
    const aligned=api.alignUpdateCenterLayout();
    const ocrBeforeHistory=Boolean(aligned&&ocr.compareDocumentPosition(heading)&Node.DOCUMENT_POSITION_FOLLOWING);
    const historyLast=Boolean(wrap&&updates.lastElementChild===wrap&&heading?.nextElementSibling===wrap);

    select.remove();if(realSelect)realSelect.id='aiModelSelect';fixture.remove();if(real)real.id='unifiedImportAnalysisWorkbench';
    return {lockedAfterClick,relockAfterExternalEnable,cancelReady,cancelState,cancelledFetchName,released,staysUnlockedAfterFinish,migratedModel,ranked,ocrBeforeHistory,historyLast};
  });

  assert.equal(ux.lockedAfterClick,true,'Run must lock immediately for active batch');
  assert.equal(ux.relockAfterExternalEnable,true,'successor must defeat legacy re-enable races');
  assert.equal(ux.cancelReady,true,'Cancel AI must be available during AI batch');
  assert.equal(ux.cancelState.ai_cancel_requested,true);
  assert.equal(ux.cancelledFetchName,'AbortError','future Gemini request must be cancelled after user cancel');
  assert.equal(ux.released,true,'batch lock must release after terminal AI failure/cancel');
  assert.equal(ux.staysUnlockedAfterFinish,true,'Run may be re-enabled after batch finishes');
  assert.equal(ux.migratedModel,'gemini-3.1-flash-lite','legacy default must migrate to 3.1 Flash-Lite');
  assert.deepEqual(ux.ranked.slice(0,3),['gemini-3.1-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite']);
  assert.equal(ux.ocrBeforeHistory,true,'OCR status must precede Import History');
  assert.equal(ux.historyLast,true,'Import History must remain final Update Center section');

  await page.waitForFunction(()=>navigator.serviceWorker?.controller!=null,{timeout:30000});
  await context.setOffline(true);
  const offlineAsset=await page.evaluate(async()=>{
    const response=await fetch(new URL('./assets/js/analysis-execution-ux-v042720.js?v=V042720_OFFLINE_PROBE',location.href));
    const body=await response.text();
    return {status:response.status,contentType:response.headers.get('content-type')||'',hasVersion:body.includes('v0.4.27.20-analysis-execution-ux'),bodyStart:body.slice(0,100)};
  });
  assert.equal(offlineAsset.status,200);
  assert.equal(offlineAsset.hasVersion,true,'v0.4.27.20 UX module must be available offline from current cache');
  assert.ok(!offlineAsset.bodyStart.toLowerCase().includes('<!doctype'));

  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>globalThis.PokemonSleepVersionAuthority?.app_version==='v0.4.27.20',{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepAnalysisExecutionUXV042720),{timeout:30000});
  const offlineReload=await page.evaluate(()=>({version:globalThis.PokemonSleepVersionAuthority?.app_version,ux:Boolean(globalThis.PokemonSleepAnalysisExecutionUXV042720),manual:Boolean(globalThis.PokemonSleepManualDraftOverlayV042719),warning:document.getElementById('storageWarning')?.textContent||''}));
  assert.equal(offlineReload.version,'v0.4.27.20');
  assert.equal(offlineReload.ux,true);
  assert.equal(offlineReload.manual,true);
  assert.ok(!offlineReload.warning.includes('前端模組載入失敗'));
  await context.setOffline(false);

  console.log(JSON.stringify({status:'PASS',gate:'V042720_BROWSER_ANALYSIS_UX_OFFLINE',ux,offlineAsset:{...offlineAsset,bodyStart:undefined},offlineReload},null,2));
}finally{await browser.close();}
