import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const supported=['v0.4.27.22','v0.4.27.23','v0.4.27.24'];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction((versions)=>versions.includes(globalThis.PokemonSleepVersionAuthority?.app_version),supported,{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepAiJsonCollapseV042722),{timeout:30000});
  const result=await page.evaluate(async()=>{
    const updates=document.getElementById('updates');
    const host=document.createElement('section');host.id='v042722BrowserFixture';
    const summary=document.createElement('div');summary.className='notice success';summary.textContent='AI 分析完成 · revision fixture';
    const pre=document.createElement('pre');pre.className='prompt-box';pre.textContent=JSON.stringify({species:'皮卡丘',level:16},null,2);
    const hidden=document.createElement('pre');hidden.className='prompt-box hidden';hidden.textContent=JSON.stringify({already:'collapsed'},null,2);
    host.append(summary,pre,hidden);updates.append(host);
    await new Promise(resolve=>setTimeout(resolve,100));
    const details=host.querySelector('details[data-v042722-ai-json-collapsed]');
    const before={details:Boolean(details),open:details?.open??null,summary:details?.querySelector('summary')?.textContent||null,jsonText:details?.querySelector('pre.prompt-box')?.textContent||null,statusVisible:summary.isConnected,hiddenWrapped:Boolean(hidden.closest('details'))};
    if(details)details.open=true;
    const after={open:details?.open??null};
    return {before,after,version:globalThis.PokemonSleepVersionAuthority?.app_version,apiVersion:globalThis.PokemonSleepAiJsonCollapseV042722?.version};
  });
  assert.ok(supported.includes(result.version));
  assert.equal(result.apiVersion,'v0.4.27.22-ai-json-collapse-2026-08-20-a');
  assert.equal(result.before.details,true);
  assert.equal(result.before.open,false);
  assert.equal(result.before.summary,'AI 分析結果 JSON（點擊展開）');
  assert.match(result.before.jsonText,/皮卡丘/);
  assert.equal(result.before.statusVisible,true);
  assert.equal(result.before.hiddenWrapped,false);
  assert.equal(result.after.open,true);
  console.log(JSON.stringify({status:'PASS',gate:'V042722_BROWSER_COLLAPSED_AI_JSON_SUCCESSOR_AWARE',result},null,2));
}finally{await browser.close();}