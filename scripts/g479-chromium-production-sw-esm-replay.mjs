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
  if(url.pathname==='/'||url.pathname==='/index.html'){
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
}finally{
  if(browser)await browser.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
console.log('NOTE G479_PRODUCTION_SW_FETCH_SOURCE_BOUND_PRECACHE_FIXTURE_ONLY_ANDROID_ROOT_CAUSE_UNVERIFIED');
