import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// G479: real Chromium dynamic import with the ACTUAL production SW fetch logic.
// Only the precache asset inventory is reduced to inert localhost fixtures.
// This is not an Android incident trace, production SW modification, or player data test.
const productionSource=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
assert.match(productionSource,/async function querySafeCacheMatch\(request\)/);
assert.match(productionSource,/event\.respondWith\(fetch\(event\.request,\{cache:'no-store'\}\)/);
const assetList=/const ASSETS=\[[\s\S]*?\];/g;
assert.equal([...productionSource.matchAll(assetList)].length,1,'exact production precache declaration');
const serviceWorkerSource=productionSource.replace(
  assetList,
  "const ASSETS=['./','./index.html','./assets/js/app.js'];"
);
const versionFixture="self.PokemonSleepVersionAuthority=Object.freeze({app_version:'synthetic-g479',app_build:'synthetic-current-build',cache_name:'synthetic-g479-current-cache'});";
const scriptCached="export const evidence='CACHED_CURRENT';";
const scriptNetwork="export const evidence='NETWORK_CURRENT';";
const cases=[
  {name:'HTTP_503',success:false},
  {name:'HTTP_404',success:false},
  {name:'NETWORK_REJECT_CACHED',success:true,evidence:'CACHED_CURRENT'},
  {name:'HTTP_200',success:true,evidence:'NETWORK_CURRENT'},
  {name:'NETWORK_REJECT_UNCACHED',success:false,path:'/assets/js/not-cached.js'},
];
const hits=[];
let transitionAttempts=0;
let deferredTransitionAttempts=0;
let indexRequests=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  const send=(status,body,type='text/javascript')=>{
    res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
    res.end(body);
  };
  if(url.pathname==='/service-worker.js'){
    send(200,serviceWorkerSource);
    return;
  }
  if(url.pathname==='/assets/js/version-authority.js'){
    send(200,versionFixture);
    return;
  }
  if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/assets/js/fixture.html'){
    indexRequests++;
    send(200,'<!doctype html><title>G479 inert Chromium SW fixture</title>','text/html');
    return;
  }
  if(url.pathname==='/assets/js/app.js'||url.pathname==='/assets/js/not-cached.js'){
    const name=url.searchParams.get('case');
    if(name)hits.push(name);
    if(name==='NETWORK_REJECT_CACHED'||name==='NETWORK_REJECT_UNCACHED'){
      req.socket.destroy();
      return;
    }
    if(name==='HTTP_503_THEN_200_DEFERRED'){
      deferredTransitionAttempts++;
      send(deferredTransitionAttempts===1?503:200,scriptNetwork);
      return;
    }
    if(name==='HTTP_503_THEN_200_SAME_URL'){
      // A transport 503 is not an absent module. Switch to 200 without changing
      // the module URL so the browser's per-document module map is exercised.
      transitionAttempts++;
      send(transitionAttempts===1?503:200,scriptNetwork);
      return;
    }
    if(name==='HTTP_503'){send(503,scriptNetwork);return;}
    if(name==='HTTP_404'){send(404,scriptNetwork);return;}
    send(200,name==='HTTP_200'?scriptNetwork:scriptCached);
    return;
  }
  send(404,'not found','text/plain');
});
await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
});
const address=server.address();
assert.ok(address&&typeof address!=='string');
const origin='http://127.0.0.1:'+address.port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const c of cases){
    const context=await browser.newContext({serviceWorkers:'allow'});
    try{
      const page=await context.newPage();
      await page.goto(origin+'/index.html',{waitUntil:'load'});
      await page.evaluate(async()=>{
        await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});
        await navigator.serviceWorker.ready;
      });
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:15000});
      const outcome=await page.evaluate(async ({path,name})=>{
        const url=new URL(path+'?case='+name,location.origin).href;
        try{
          const module=await import(url);
          return {success:true,evidence:module.evidence};
        }catch(error){
          return {success:false,name:error?.name||null,message:String(error?.message||error)};
        }
      },{path:c.path||'/assets/js/app.js',name:c.name});
      assert.equal(outcome.success,c.success,c.name+' real Chromium import outcome');
      if(c.success)assert.equal(outcome.evidence,c.evidence,c.name+' response provenance');
      else assert.equal(outcome.name,'TypeError',c.name+' module rejection');
      assert.ok(hits.includes(c.name),c.name+' must actually reach synthetic network');
      console.log('PASS G479_CHROMIUM_PRODUCTION_SW_'+c.name);
    }finally{
      await context.close();
    }
  }
  // G479 independent regression: a failed ESM URL can remain rejected by the
  // document module map even after its transport recovers. Replaying each status
  // in a fresh context (above) cannot prove this real first-boot recovery gap.
  // Only an inert localhost fixture is used; no production SW or player writes.
  {
    const context=await browser.newContext({serviceWorkers:'allow'});
    try{
      const page=await context.newPage();
      await page.goto(origin+'/index.html',{waitUntil:'load'});
      await page.evaluate(async()=>{
        await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});
        await navigator.serviceWorker.ready;
      });
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:15000});
      const target=origin+'/assets/js/app.js?case=HTTP_503_THEN_200_SAME_URL';
      const attempt=()=>page.evaluate(async url=>{
        try{
          const module=await import(url);
          return {success:true,evidence:module.evidence};
        }catch(error){
          return {success:false,name:error?.name||null,message:String(error?.message||error)};
        }
      },target);
      const first=await attempt();
      assert.equal(first.success,false,'first real Chromium HTTP 503 import must fail');
      assert.equal(first.name,'TypeError');
      assert.equal(transitionAttempts,1,'first failure reached the production SW network-first path');
      const sameDocument=await attempt();
      assert.equal(sameDocument.success,false,'same document must not claim recovery from a cached failed module');
      assert.equal(sameDocument.name,'TypeError');
      assert.equal(transitionAttempts,1,'same-URL retry in failed module map must not issue a second network fetch');
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:15000});
      const nextDocument=await attempt();
      assert.equal(nextDocument.success,true,'new document must recover once the same URL returns HTTP 200');
      assert.equal(nextDocument.evidence,'NETWORK_CURRENT','recovery must be from the network, not an old cached module');
      assert.equal(transitionAttempts,2,'new document must fetch the same module URL exactly once');
      console.log('PASS G479_CHROMIUM_PRODUCTION_SW_503_SAME_DOCUMENT_FAILED_MODULE_MAP');
      console.log('PASS G479_CHROMIUM_PRODUCTION_SW_NEW_DOCUMENT_SAME_URL_NETWORK_RECOVERY');
    }finally{
      await context.close();
    }
  }
  // G479: execute the production bootstrap failure handler in real Chromium.
  // Inert localhost document only; no application import or player database.
  {
    const bootstrapSource=readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
    const start=bootstrapSource.indexOf('function showFailure(label,error){');
    assert.ok(start>=0,'production bootstrap failure handler must exist');
    const end=bootstrapSource.indexOf('\n}\n',start);
    assert.ok(end>start,'extract the complete production handler, not a test copy');
    const handler=bootstrapSource.slice(start,end+2);
    assert.match(handler,/g479ManualReload/);
    assert.match(handler,/location\.reload\(\)/);
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      await page.goto(origin+'/index.html',{waitUntil:'load'});
      await page.evaluate(()=>{
        document.body.innerHTML='<div id="dbStatus"></div><div id="storageWarning" class="hidden"></div>';
        localStorage.setItem('g479-inert-sentinel','preserved');
      });
      await page.addScriptTag({content:`
        const status=document.getElementById('dbStatus');
        const warning=document.getElementById('storageWarning');
        const trace=[];
        const debugTrace={record:(...args)=>trace.push(args)};
        ${handler}
        globalThis.g479Fixture={showFailure,trace};
      `});
      // G479 negative-first: the real bootstrap ESM failure must not erase
      // an independently owned storage-integrity HOLD or attach its retry
      // control to the foreign warning. Only an isolated synthetic document.
      await page.evaluate(()=>{
        const foreign=document.getElementById('storageWarning');
        foreign.textContent='EXTERNAL_STORAGE_INTEGRITY_HOLD';
        foreign.classList.remove('hidden');
        foreign.dataset.storageAuthority='foreign-integrity';
      });
      await page.evaluate(()=>g479Fixture.showFailure('entry_modules',new TypeError('synthetic ESM failure with foreign HOLD')));
      assert.equal(await page.locator('#storageWarning').textContent(),'EXTERNAL_STORAGE_INTEGRITY_HOLD',
        'G479 bootstrap must preserve the exact foreign storage warning');
      assert.equal(await page.locator('#storageWarning').getAttribute('data-storage-authority'),'foreign-integrity',
        'G479 must not steal storage-integrity ownership');
      assert.equal(await page.locator('#moduleBootstrapWarning [data-g479-manual-reload]').count(),1,
        'G479 module failure must offer its own manual reload control');
      assert.match(await page.locator('#moduleBootstrapWarning').textContent(),/前端模組載入失敗/,
        'module failure must remain visible independently of storage HOLD');
      await page.evaluate(()=>{
        const foreign=document.getElementById('storageWarning');
        foreign.textContent='';foreign.classList.add('hidden');
        delete foreign.dataset.storageAuthority;
        document.getElementById('moduleBootstrapWarning')?.remove();
      });
      console.log('PASS G479_CHROMIUM_BOOTSTRAP_FOREIGN_STORAGE_HOLD_NOT_OVERWRITTEN');
      await page.evaluate(()=>g479Fixture.showFailure('other_module',new Error('synthetic non-entry failure')));
      assert.equal(await page.locator('[data-g479-manual-reload]').count(),0,'non-entry failure cannot add retry');
      await page.evaluate(()=>g479Fixture.showFailure('entry_modules',new TypeError('synthetic ESM fetch failed')));
      assert.equal(await page.locator('#dbStatus').textContent(),'載入失敗');
      assert.equal(await page.locator('[data-g479-manual-reload]').count(),1);
      assert.match(await page.locator('#storageWarning').innerText(),/重新載入頁面（保留資料）/);
      const priorIndexRequests=indexRequests;
      await page.waitForTimeout(150);
      assert.equal(indexRequests,priorIndexRequests,'failure must not trigger automatic navigation');
      const events=await page.evaluate(()=>g479Fixture.trace.map(item=>item[1]));
      assert.ok(events.includes('module_probe_failed'));
      assert.ok(!events.includes('module_reload_requested'),'no implicit retry');
      await Promise.all([
        page.waitForNavigation({waitUntil:'load'}),
        page.locator('[data-g479-manual-reload]').click(),
      ]);
      assert.equal(indexRequests,priorIndexRequests+1,'exactly one user-initiated document reload');
      assert.equal(await page.evaluate(()=>localStorage.getItem('g479-inert-sentinel')),'preserved','manual retry cannot clear synthetic storage');
      await page.waitForTimeout(150);
      assert.equal(indexRequests,priorIndexRequests+1,'no automatic reload loop');
      console.log('PASS G479_CHROMIUM_BOOTSTRAP_MANUAL_FRESH_DOCUMENT_RETRY');
      console.log('PASS G479_CHROMIUM_BOOTSTRAP_NO_AUTO_RELOAD_NO_STORAGE_CLEAR');
    }finally{
      await context.close();
    }
  }

  // G479 independent deferred-page failure: a rejected feature ESM import
  // must settle the visible hydration badge, not leave a permanent "loading".
  // Retry is only through the next explicit navigation, with no player DB.
  {
    const source=readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
    const start=source.indexOf('async function loadPageModules(page){');
    const end=source.indexOf('\n}\nasync function hydrateBackupSnapshotPanel',start);
    assert.ok(start>=0&&end>start,'extract exact production deferred page loader');
    const actual=source.slice(start,end+2);
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      await page.goto(origin+'/index.html',{waitUntil:'load'});
      await page.addScriptTag({content:[
        'const pageLoads=new Map(),failedFeatureModuleUrls=new Set();',
        "const pageModuleGroups={updates:['synthetic-feature']};",
        'const events=[];',
        'let failImport=true,attempts=0;',
        "const debugTrace={record:(...args)=>events.push({kind:'trace',name:args[1],payload:args[2]})};",
        "const pageProgress=(page,state,message,details={})=>events.push({kind:'progress',page,state,message,details});",
        'const yieldToBrowser=()=>Promise.resolve();',
        "const importFeatureModule=async(file)=>{if(failedFeatureModuleUrls.has(file))throw new TypeError('cached deferred ESM failure');attempts++;if(failImport){failedFeatureModuleUrls.add(file);throw new TypeError('synthetic deferred ESM 503');}return {};};",
        'const hydrateUpdateCenterShells=async()=>{};',
        'const startOcrOverlayForUpdates=async()=>{};',
        'const hydrateBackupSnapshotPanel=async()=>{};',
        actual,
        'globalThis.g479DeferredFixture={loadPageModules,events,recover:()=>{failImport=false;},attempts:()=>attempts};',
      ].join('\n')});
      const observed=await page.evaluate(async()=>{
        const fixture=globalThis.g479DeferredFixture;
        let firstError='';
        try{await fixture.loadPageModules('updates');}catch(error){firstError=String(error.message||error);}
        const afterFailure=fixture.events.filter(e=>e.kind==='progress').map(e=>e.state);
        fixture.recover();
        let secondError='';
        try{await fixture.loadPageModules('updates');}catch(error){secondError=String(error.message||error);}
        return {
          firstError,secondError,afterFailure,
          states:fixture.events.filter(e=>e.kind==='progress').map(e=>e.state),
          failed:fixture.events.find(e=>e.kind==='progress'&&e.state==='failed'),
          traces:fixture.events.filter(e=>e.kind==='trace').map(e=>e.name),
          attempts:fixture.attempts(),
        };
      });
      assert.match(observed.firstError,/synthetic deferred ESM 503/);
      assert.deepEqual(observed.afterFailure,['loading','failed'],
        'first rejected ESM must settle the visible hydration badge');
      assert.match(observed.secondError,/cached deferred ESM failure/,'same-document navigation cannot clear failed module map');
      assert.deepEqual(observed.states,['loading','failed','loading','failed'],
        'same-document re-navigation must remain fail-closed');
      assert.equal(observed.failed.details.player_write,false);
      assert.equal(observed.failed.details.retryable_on_next_navigation,false);
      assert.equal(observed.failed.details.manual_reload_required,true);
      assert.match(observed.failed.message,/保留本機資料/);
      assert.ok(observed.traces.includes('page_feature_load_failed'));
      assert.equal(observed.attempts,1,'failed module URL cannot be blindly re-imported in this document');
      console.log('PASS G479_CHROMIUM_DEFERRED_PAGE_ESM_FAILURE_STICKY_MANUAL_RELOAD_REQUIRED');
    }finally{
      await context.close();
    }
  }


  // Negative-first G479: execute the ACTUAL production deferred import/page
  // loader and hydration badge renderer against a real Chromium HTTP 503.
  // A same-document re-navigation cannot refresh the failed ESM module map.
  // Only an explicit fresh-document action may recover; never clear player data.
  {
    const bootstrap=readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
    const watchdog=readFileSync(new URL('../assets/js/v0394-startup-watchdog.js',import.meta.url),'utf8');
    const extract=(raw,startMarker,endMarker)=>{
      const start=raw.indexOf(startMarker),end=raw.indexOf(endMarker,start);
      assert.ok(start>=0&&end>start,'production function extraction: '+startMarker);
      return raw.slice(start,end+2);
    };
    const render=extract(watchdog,'function renderPageHydrationProgress(detail={}){','\n}\n\nfunction recordStage');
    const importModule=extract(bootstrap,'function importFeatureModule(file){','\n}\nasync function loadPageModules');
    const loadPage=extract(bootstrap,'async function loadPageModules(page){','\n}\nasync function hydrateBackupSnapshotPanel');
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      await page.goto(origin+'/assets/js/fixture.html',{waitUntil:'load'});
      await page.evaluate(()=>{document.body.innerHTML='<div id="pageLoadStatus" class="hidden"></div>';localStorage.setItem('g479-deferred-sentinel','preserved');});
      await page.addScriptTag({content:[
        'const pageLoads=new Map(),moduleLoads=new Map(),failedFeatureModuleUrls=new Set();',
        "const pageModuleGroups={guide:['app.js?case=HTTP_503_THEN_200_DEFERRED']};",
        "const PAGE_LABELS={guide:'使用說明'},activeView=()=> 'guide';",
        'let pageHydrationHideTimer=null;',
        'const events=[];',
        "const debugTrace={record:(...args)=>events.push({kind:'trace',name:args[1],payload:args[2]})};",
        'const recordStage=()=>{};',
        'const yieldToBrowser=()=>Promise.resolve();',
        "globalThis.PokemonSleepPageHydrationAuthorityV042755331={hydrateView:async()=>({owned:true})};",
        'const hydrateUpdateCenterShells=async()=>{};',
        'const startOcrOverlayForUpdates=async()=>{};',
        'const hydrateBackupSnapshotPanel=async()=>{};',
        render,
        "const pageProgress=(page,state,message,details={})=>{events.push({kind:'progress',page,state,message,details});renderPageHydrationProgress({page,state,message,...details});};",
        importModule,loadPage,
        'globalThis.g479RealDeferred={loadPageModules,events};',
      ].join('\n')});
      const first=await page.evaluate(async()=>{
        let error=null;
        try{await g479RealDeferred.loadPageModules('guide');}catch(e){error=String(e?.message||e);}
        return {error,failed:g479RealDeferred.events.find(e=>e.kind==='progress'&&e.state==='failed')};
      });
      assert.match(first.error||'',/Failed to fetch dynamically imported module|HTTP|Importing a module script failed/i);
      assert.equal(deferredTransitionAttempts,1,'actual deferred import must hit HTTP 503 once');
      assert.equal(first.failed?.details?.player_write,false,'failed deferred module cannot write player data');
      assert.equal(first.failed?.details?.retryable_on_next_navigation,false,'cached failed module must not claim same-document recovery');
      assert.equal(first.failed?.details?.manual_reload_required,true,'failed module requires explicit fresh document');
      assert.equal(await page.locator('[data-g479-deferred-manual-reload]').count(),1,'visible manual reload action must be rendered');
      const beforeReload=indexRequests;
      await page.waitForTimeout(150);
      assert.equal(indexRequests,beforeReload,'no automatic navigation after deferred import failure');
      await Promise.all([
        page.waitForNavigation({waitUntil:'load'}),
        page.locator('[data-g479-deferred-manual-reload]').click(),
      ]);
      assert.equal(indexRequests,beforeReload+1,'only explicit user click reloads document');
      assert.equal(await page.evaluate(()=>localStorage.getItem('g479-deferred-sentinel')),'preserved','fresh-document retry preserves storage');
      const recovered=await page.evaluate(async()=>{const module=await import('./app.js?case=HTTP_503_THEN_200_DEFERRED');return module.evidence;});
      assert.equal(recovered,'NETWORK_CURRENT','fresh document must import recovered same URL');
      assert.equal(deferredTransitionAttempts,2,'fresh document performs second network request exactly once');
      console.log('PASS G479_CHROMIUM_REAL_DEFERRED_ESM_MODULE_MAP_MANUAL_FRESH_DOCUMENT');
    }finally{await context.close();}
  }


  // G479 independent negative-first real Chromium: a static history-export
  // feature module 503 leaves its URL failed in this document's ESM module map.
  // The existing user-facing error must explain that a manual fresh document
  // is required, not suggest repeated same-document clicks can recover.
  {
    const bootstrap=readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
    const extract=(startMarker,endMarker)=>{
      const start=bootstrap.indexOf(startMarker),end=bootstrap.indexOf(endMarker,start);
      assert.ok(start>=0&&end>start,'exact production history export extraction '+startMarker);
      return bootstrap.slice(start,end+2);
    };
    const importSource=extract('function importFeatureModule(file){','\n}\nasync function loadPageModules');
    const historySource=extract('function bindStaticHistoryExport(){','\n}\nfunction bindPageAwareFeatureLoading');
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      const messages=[];
      let networkRequests=0;
      page.on('dialog',dialog=>{messages.push(dialog.message());void dialog.accept();});
      await page.route('**/assets/js/review-reference-history-ux-v042745.js',route=>{
        networkRequests++;
        return route.fulfill({status:503,contentType:'text/javascript',body:'export const downloadImportHistoryJson=()=>{};'});
      });
      await page.goto(origin+'/assets/js/fixture.html',{waitUntil:'load'});
      await page.evaluate(()=>{
        document.body.innerHTML='<button id="exportImportHistoryJsonBtnV042745">匯出</button>';
        localStorage.setItem('g479-history-sentinel','preserved');
      });
      await page.addScriptTag({content:[
        'const moduleLoads=new Map(),failedFeatureModuleUrls=new Set(),g479HistoryTrace=[];',
        "const debugTrace={record:(...args)=>g479HistoryTrace.push(args)};",
        importSource,historySource,
        'bindStaticHistoryExport();',
        'globalThis.g479HistoryState={failed:()=>g479HistoryTrace.filter(e=>e[1]==="static_history_export_failed").length};',
      ].join('\n')});
      await page.locator('#exportImportHistoryJsonBtnV042745').click();
      await page.waitForFunction(()=>g479HistoryState.failed()===1);
      assert.equal(networkRequests,1,'first history-export ESM failure must be real HTTP 503');
      assert.match(messages[0]||'',/手動重新載入頁面/,'first static export error must give bounded fresh-document recovery guidance');
      const beforeSecond=indexRequests;
      await page.locator('#exportImportHistoryJsonBtnV042745').click();
      await page.waitForFunction(()=>g479HistoryState.failed()===2);
      assert.equal(networkRequests,1,'failed ESM module URL must not be blindly re-fetched in the same document');
      assert.match(messages[1]||'',/手動重新載入頁面/,'repeat click must explain sticky failed module map');
      assert.equal(indexRequests,beforeSecond,'history export failure must never auto-reload');
      assert.equal(await page.evaluate(()=>localStorage.getItem('g479-history-sentinel')),'preserved','no player or local storage deletion');
      console.log('PASS G479_CHROMIUM_STATIC_HISTORY_ESM_FAILURE_MANUAL_RELOAD_GUIDANCE');
    }finally{await context.close();}
  }


  // G479 independent backup-route negative: production backup hydration imports
  // storage.js/time-utils.js outside the deferred module-map failure tracker.
  // A real Chromium HTTP 503 must not be labelled safe for same-document retry.
  // Only an explicit fresh document may recover; never touch player SQLite.
  {
    const bootstrap=readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
    const watchdog=readFileSync(new URL('../assets/js/v0394-startup-watchdog.js',import.meta.url),'utf8');
    const extract=(raw,startMarker,endMarker)=>{
      const start=raw.indexOf(startMarker),end=raw.indexOf(endMarker,start);
      assert.ok(start>=0&&end>start,'exact production backup module extraction: '+startMarker);
      return raw.slice(start,end+2);
    };
    const importSource=extract(bootstrap,'function importFeatureModule(file){','\n}\nasync function loadPageModules');
    const loadSource=extract(bootstrap,'async function loadPageModules(page){','\n}\nasync function hydrateBackupSnapshotPanel');
    const backupSource=extract(bootstrap,'async function hydrateBackupSnapshotPanel(){','\n}\nasync function hydrateUpdateCenterShells');
    const render=extract(watchdog,'function renderPageHydrationProgress(detail={}){','\n}\n\nfunction recordStage');
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      let storageRequests=0;
      await page.route('**/assets/js/storage.js',route=>{
        storageRequests++;
        return route.fulfill({status:storageRequests===1?503:200,contentType:'text/javascript',body:'export const listSnapshots=async()=>[];'});
      });
      await page.route('**/assets/js/time-utils.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const formatLocal=value=>String(value);'}));
      await page.goto(origin+'/assets/js/fixture.html',{waitUntil:'load'});
      await page.evaluate(()=>{
        document.body.innerHTML='<div id="pageLoadStatus" class="hidden"></div><div id="snapshotList"></div>';
        localStorage.setItem('g479-backup-sentinel','preserved');
      });
      await page.addScriptTag({content:[
        'const pageLoads=new Map(),moduleLoads=new Map(),failedFeatureModuleUrls=new Set();',
        "const pageModuleGroups={backup:[]};",
        "const PAGE_LABELS={backup:'備份還原'},activeView=()=> 'backup';",
        'let pageHydrationHideTimer=null;',
        'const events=[];',
        "const debugTrace={record:(...args)=>events.push({kind:'trace',name:args[1],payload:args[2]})};",
        'const recordStage=()=>{};',
        'const yieldToBrowser=()=>Promise.resolve();',
        "globalThis.PokemonSleepPageHydrationAuthorityV042755331={hydrateView:async()=>({owned:true})};",
        'const hydrateUpdateCenterShells=async()=>{};',
        'const startOcrOverlayForUpdates=async()=>{};',
        render,
        "const pageProgress=(page,state,message,details={})=>{events.push({kind:'progress',page,state,message,details});renderPageHydrationProgress({page,state,message,...details});};",
        importSource,loadSource,backupSource,
        'globalThis.g479BackupFixture={loadPageModules,events};',
      ].join('\n')});
      const first=await page.evaluate(async()=>{
        let error=null;
        try{await g479BackupFixture.loadPageModules('backup');}catch(e){error=String(e?.message||e);}
        return {error,failed:g479BackupFixture.events.find(e=>e.kind==='progress'&&e.state==='failed')};
      });
      assert.match(first.error||'',/Failed to fetch dynamically imported module|HTTP|Importing a module script failed/i);
      assert.equal(storageRequests,1,'backup storage module must actually return HTTP 503');
      assert.equal(first.failed?.details?.player_write,false,'backup ESM failure cannot write player data');
      assert.equal(first.failed?.details?.manual_reload_required,true,'sticky backup ESM 503 requires manual fresh document');
      assert.equal(first.failed?.details?.retryable_on_next_navigation,false,'same-document backup navigation cannot recover failed module map');
      assert.equal(await page.locator('[data-g479-deferred-manual-reload]').count(),1,'visible backup manual reload control required');
      const second=await page.evaluate(async()=>{
        let error=null;
        try{await g479BackupFixture.loadPageModules('backup');}catch(e){error=String(e?.message||e);}
        return error;
      });
      assert.match(second||'',/G479_DEFERRED_ESM_FAILED_MODULE_MAP_RELOAD_REQUIRED/,'repeat backup navigation must fail closed');
      assert.equal(storageRequests,1,'same-document retry must not refetch failed backup module');
      const beforeReload=indexRequests;
      await page.waitForTimeout(150);
      assert.equal(indexRequests,beforeReload,'no automatic backup reload');
      await Promise.all([
        page.waitForNavigation({waitUntil:'load'}),
        page.locator('[data-g479-deferred-manual-reload]').first().click(),
      ]);
      assert.equal(indexRequests,beforeReload+1,'only explicit backup action reloads');
      assert.equal(await page.evaluate(()=>localStorage.getItem('g479-backup-sentinel')),'preserved','backup retry preserves storage');
      const snapshots=await page.evaluate(async()=>{const m=await import('./storage.js');return m.listSnapshots();});
      assert.deepEqual(snapshots,[],'fresh document can load recovered backup module');
      assert.equal(storageRequests,2,'fresh document retries failed backup URL exactly once');
      console.log('PASS G479_CHROMIUM_BACKUP_ESM_STICKY_FAILURE_MANUAL_FRESH_DOCUMENT');
    }finally{await context.close();}
  }


}finally{
  if(browser)await browser.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
console.log('NOTE G479_PRODUCTION_SW_FETCH_SOURCE_BOUND_PRECACHE_FIXTURE_ONLY_ANDROID_ROOT_CAUSE_UNVERIFIED');
