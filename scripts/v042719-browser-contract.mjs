import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.PokemonSleepVersionAuthority?.app_version==='v0.4.27.19',{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepManualDraftOverlayV042719),{timeout:30000});

  const manual=await page.evaluate(()=>{
    const real=document.getElementById('analysisConfirmationWorkbench');
    if(real)real.id='analysisConfirmationWorkbenchV042719Original';
    const root=document.createElement('section');root.id='analysisConfirmationWorkbench';document.body.append(root);
    const render=(groupId,value='')=>{root.innerHTML=`<section class="analysis-confirmation" data-v042718-group-id="${groupId}"><input data-field="nickname" value="${value}"><input data-field="species" value="SPECIES_${groupId}"><input data-check="sub_unlock_10" type="checkbox"></section>`;};
    const restore=groupId=>globalThis.PokemonSleepManualDraftOverlayV042719.restoreVisibleForm({groupId,reason:'v042719_browser_fixture'});

    render('B');restore('B');
    const bInput=root.querySelector('[data-field="nickname"]');
    const bCheck=root.querySelector('[data-check="sub_unlock_10"]');
    assertFixture(Boolean(bInput&&bCheck),'B fixture controls missing');
    bInput.value='USER_MANUAL_B';bInput.dispatchEvent(new Event('input',{bubbles:true}));
    bCheck.checked=true;bCheck.dispatchEvent(new Event('change',{bubbles:true}));

    render('A');const aRestoreCount=restore('A');
    const aNickname=root.querySelector('[data-field="nickname"]')?.value??null;
    const aChecked=root.querySelector('[data-check="sub_unlock_10"]')?.checked??null;

    render('C');const cRestoreCount=restore('C');
    const cNickname=root.querySelector('[data-field="nickname"]')?.value??null;

    render('B');const bRestoreCount=restore('B');
    const bRestored=root.querySelector('[data-field="nickname"]')?.value??null;
    const bCheckRestored=root.querySelector('[data-check="sub_unlock_10"]')?.checked??null;
    const state=globalThis.PokemonSleepManualDraftOverlayV042719.getState();

    root.remove();if(real)real.id='analysisConfirmationWorkbench';
    return {aNickname,aChecked,cNickname,bRestored,bCheckRestored,aRestoreCount,cRestoreCount,bRestoreCount,state};

    function assertFixture(condition,message){if(!condition)throw new Error(message);}
  });
  assert.equal(manual.bRestored,'USER_MANUAL_B','manual nickname must survive B -> A -> C -> B');
  assert.equal(manual.bCheckRestored,true,'manual checkbox must survive navigation');
  assert.equal(manual.aNickname,'','B marker must not leak into A');
  assert.equal(manual.cNickname,'','B marker must not leak into C');
  assert.equal(manual.aChecked,false,'B checkbox must not leak into A');
  assert.equal(manual.aRestoreCount,0,'A must not inherit B manual controls');
  assert.equal(manual.cRestoreCount,0,'C must not inherit B manual controls');
  assert.ok(manual.bRestoreCount>=2,'B manual controls must be restored from the group-local overlay');
  assert.ok(manual.state.group_ids.includes('B'));

  await page.waitForFunction(()=>navigator.serviceWorker?.controller!=null,{timeout:30000});
  const registration=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return {scope:reg.scope,controller:Boolean(navigator.serviceWorker.controller)};});
  assert.equal(registration.controller,true);

  await context.setOffline(true);
  const offlineModule=await page.evaluate(async()=>{
    const response=await fetch(new URL('./assets/js/runtime-version.js?v=V042719_OFFLINE_QUERY_PROBE',location.href));
    const body=await response.text();
    return {status:response.status,contentType:response.headers.get('content-type')||'',bodyStart:body.slice(0,160),hasRuntimeToken:body.includes('UNKNOWN_VERSION')};
  });
  assert.equal(offlineModule.status,200,'query-versioned cached module must resolve offline');
  assert.equal(offlineModule.hasRuntimeToken,true,'offline query fallback must return JavaScript module body');
  assert.ok(!offlineModule.bodyStart.toLowerCase().includes('<!doctype'),'JavaScript request must never receive HTML shell');

  const missingScript=await page.evaluate(async()=>{
    const response=await fetch(new URL('./assets/js/v042719-definitely-missing.js?v=probe',location.href));
    const body=await response.text();return {status:response.status,bodyStart:body.slice(0,80),contentType:response.headers.get('content-type')||''};
  });
  assert.ok(missingScript.status>=400,'missing script must fail closed as an asset');
  assert.ok(!missingScript.bodyStart.toLowerCase().includes('<!doctype'),'missing script must not receive app shell');
  assert.ok(!missingScript.contentType.toLowerCase().includes('text/html')||missingScript.status!==200,'missing script must never succeed with an HTML shell');

  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>globalThis.PokemonSleepVersionAuthority?.app_version==='v0.4.27.19',{timeout:30000});
  const offlineReload=await page.evaluate(()=>({version:globalThis.PokemonSleepVersionAuthority?.app_version,overlay:Boolean(globalThis.PokemonSleepManualDraftOverlayV042719),warning:document.getElementById('storageWarning')?.textContent||''}));
  assert.equal(offlineReload.version,'v0.4.27.19');
  assert.equal(offlineReload.overlay,true,'manual overlay module must load in offline PWA reload');
  assert.ok(!offlineReload.warning.includes('前端模組載入失敗'),'offline bootstrap must not report module load failure');
  await context.setOffline(false);

  console.log(JSON.stringify({status:'PASS',gate:'V042719_BROWSER_MANUAL_DRAFT_AND_QUERYSAFE_OFFLINE',manual,offlineModule:{...offlineModule,bodyStart:undefined},missingScript,offlineReload},null,2));
}finally{await browser.close();}
