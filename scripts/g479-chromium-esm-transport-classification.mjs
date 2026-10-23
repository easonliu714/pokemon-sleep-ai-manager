import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// G479 source-independent actual Chromium ESM transport classification.
// Synthetic localhost only, Service Workers blocked, no PWA/player data.
// Existing g479-sw-network-failure-replay.mjs separately exercises production SW source.
// This is NOT an Android ESM incident reproduction or root-cause claim.
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const cases=[
  {name:'HTTP_200',status:200,success:true},
  {name:'HTTP_503',status:503,success:false},
  {name:'HTTP_404',status:404,success:false},
  {name:'NETWORK_REJECT',status:null,success:false},
];
const browser=await chromium.launch({headless:true});
try{
  for(const c of cases){
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      const page=await context.newPage();
      const seen={statuses:[],failures:[]};
      const isProbe=url=>url.includes('/__g479_esm_probe__.mjs');
      page.on('response',response=>{if(isProbe(response.url()))seen.statuses.push(response.status());});
      page.on('requestfailed',request=>{if(isProbe(request.url()))seen.failures.push(request.failure()?.errorText||'UNKNOWN');});
      // Same-origin inert text document avoids executing application bootstrap.
      await page.goto(new URL('README.md',base).href,{waitUntil:'domcontentloaded'});
      await page.route(url=>url.pathname.endsWith('/__g479_esm_probe__.mjs'),route=>{
        if(c.status===null)return route.abort('failed');
        return route.fulfill({status:c.status,contentType:'text/javascript',body:"export const evidence='G479_OK';"});
      });
      const url=new URL('__g479_esm_probe__.mjs?case='+c.name,base).href;
      const outcome=await page.evaluate(async url=>{
        try{const mod=await import(url);return {success:true,value:mod.evidence};}
        catch(error){return {success:false,name:error?.name||null,message:String(error?.message||error)};}
      },url);
      assert.equal(outcome.success,c.success,c.name+' browser ESM result');
      if(c.success)assert.equal(outcome.value,'G479_OK');
      else assert.equal(outcome.name,'TypeError',c.name+' browser error class');
      if(c.status===null){
        assert.deepEqual(seen.statuses,[],'network rejection has no HTTP status');
        assert.ok(seen.failures.length>0,'network rejection must emit requestfailed');
      }else{
        assert.deepEqual(seen.statuses,[c.status],c.name+' HTTP status');
        assert.deepEqual(seen.failures,[],'HTTP status must not masquerade as transport rejection');
      }
      console.log('PASS G479_CHROMIUM_ESM_'+c.name+'_CLASSIFIED');
    }finally{await context.close();}
  }
}finally{await browser.close();}
console.log('NOTE G479_SYNTHETIC_CHROMIUM_SW_BLOCKED_ANDROID_ROOT_CAUSE_UNVERIFIED');
