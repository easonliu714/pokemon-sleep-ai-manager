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
}finally{
  if(browser)await browser.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
console.log('NOTE G479_PRODUCTION_SW_FETCH_SOURCE_BOUND_PRECACHE_FIXTURE_ONLY_ANDROID_ROOT_CAUSE_UNVERIFIED');
