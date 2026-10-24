import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Source-bound real Chromium DOM/native-dialog lifecycle gate. The clock is synthetic.
// No application bootstrap, SQLite, IndexedDB, Service Worker, or personal data.
// This does NOT substitute for Android Owner UAT or prove a physical device stall.
const raw=readFileSync(new URL('../assets/js/v0394-startup-watchdog.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
assert.match(raw,/main_thread_block_detected/);
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({serviceWorkers:'block'});
  try{
    const page=await context.newPage();
    const dialogs=[];
    page.on('dialog',dialog=>{
      dialogs.push(dialog.type());
      if(dialog.type()==='confirm')void dialog.dismiss();
      else if(dialog.type()==='prompt')void dialog.accept('typed');
      else void dialog.accept();
    });
    await page.goto('about:blank');
    await page.evaluate(source=>{
      document.body.innerHTML='<div id="storageWarning" class="hidden"></div>';
      window.PokemonSleepVersionAuthority={app_version:'synthetic',app_build:'synthetic'};
      const trace=[];window.debugTrace={record:(group,event,detail)=>trace.push({group,event,detail})};
      let clock=0,visible=true,timer=null,timerCount=0,raf=[];
      Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visible?'visible':'hidden'});
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>!visible});
      window.setInterval=(fn,ms)=>{if(ms!==2000)throw Error('unexpected heartbeat period');if(timer)throw Error('duplicate watchdog interval');timer=fn;timerCount++;return timerCount;};
      window.clearInterval=()=>{timer=null;};
      window.requestAnimationFrame=fn=>{raf.push(fn);return raf.length;};
      (0,eval)(source);
      window.__g295={
        tick(ms=0){clock+=ms;if(!timer)throw Error('missing watchdog interval');timer();},
        advance(ms){clock+=ms;},
        visibility(hidden){visible=!hidden;document.dispatchEvent(new Event('visibilitychange'));},
        event(name){window.dispatchEvent(new Event(name));},
        frames(count){for(let i=0;i<count;i++){clock+=16;const fn=raf.shift();if(!fn)throw Error('missing RAF');fn(clock);}},
        state(){const warning=document.getElementById('storageWarning');return {detected:trace.filter(e=>e.event==='main_thread_block_detected').length,recovered:trace.filter(e=>e.event==='main_thread_block_recovered').length,resets:trace.filter(e=>e.event==='main_thread_watchdog_visibility_reset').map(e=>e.detail?.details?.reason),visibleWarning:!warning.classList.contains('hidden'),timerActive:Boolean(timer),traceCount:trace.length};}
      };
    },source);
    const act=fn=>page.evaluate(fn);
    const state=()=>act(()=>window.__g295.state());
    await act(()=>{window.__g295.visibility(true);window.__g295.tick(20000);});
    assert.equal((await state()).detected,0,'hidden timer gap must not be a foreground stall');
    await act(()=>{window.__g295.visibility(false);window.__g295.tick(100);});
    assert.equal((await state()).detected,0,'visible resume grace must suppress first gap');
    await act(()=>window.__g295.tick(6000));
    let s=await state();
    assert.equal(s.detected,1,'true foreground gap after grace must warn');
    assert.equal(s.visibleWarning,true,'actual DOM warning must be visible');
    await act(()=>window.__g295.frames(31));
    s=await state();
    assert.equal(s.recovered,1,'stable RAF must recover watchdog-owned warning');
    assert.equal(s.visibleWarning,false,'actual DOM warning must clear on recovery');
    await act(()=>{window.__g295.event('pagehide');window.__g295.advance(25000);});
    assert.equal((await state()).timerActive,false,'pagehide must clear timer');
    await act(()=>{window.__g295.event('pageshow');window.__g295.tick();});
    assert.equal((await state()).detected,1,'pageshow BFCache return must ignore old gap');
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,2,'post-pageshow foreground stall still detected');
    await act(()=>{window.__g295.event('focus');window.__g295.tick();});
    assert.equal((await state()).detected,2,'focus return must reset clock');
    const before=(await state()).detected;
    const confirmResult=await act(()=>{window.__g295.advance(12000);return window.confirm('g295 confirm');});
    assert.equal(confirmResult,false,'native confirm dismiss return preserved');
    await act(()=>window.__g295.tick());
    assert.equal((await state()).detected,before,'native confirm must not false-positive');
    const promptResult=await act(()=>{window.__g295.advance(12000);return window.prompt('g295 prompt');});
    assert.equal(promptResult,'typed','native prompt input preserved');
    await act(()=>window.__g295.tick());
    assert.equal((await state()).detected,before,'native prompt must not false-positive');
    await act(()=>{window.__g295.advance(12000);window.alert('g295 alert');});
    await act(()=>window.__g295.tick());
    assert.equal((await state()).detected,before,'native alert must not false-positive');
    assert.deepEqual(dialogs,['confirm','prompt','alert'],'real Chromium dialogs must have fired');
    await act(()=>window.__g295.tick(6000));
    s=await state();
    assert.equal(s.detected,before+1,'native-dialog grace must expire without disabling detector');
    for(const reason of ['background-pause','foreground-resume','pageshow-resume','focus-resume','native-dialog-return:confirm','native-dialog-return:prompt','native-dialog-return:alert']){
      assert.ok(s.resets.includes(reason),'missing reset provenance: '+reason);
    }
    console.log('PASS G295_CHROMIUM_SOURCE_BOUND_NATIVE_DIALOG_DOM_LIFECYCLE hidden/resume/pageshow/focus/alert/confirm/prompt/grace_expiry/real_stall');
    console.log('HOLD G295_ANDROID_OWNER_UAT_NOT_VERIFIED');
  }finally{await context.close();}
}finally{await browser.close();}
