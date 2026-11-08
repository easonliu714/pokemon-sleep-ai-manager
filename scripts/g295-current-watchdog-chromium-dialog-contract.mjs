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
        visibilitySilent(hidden){visible=!hidden;},
        event(name){window.dispatchEvent(new Event(name));},
        documentEvent(name){document.dispatchEvent(new Event(name));},
        frames(count){for(let i=0;i<count;i++){clock+=16;const fn=raf.shift();if(!fn)throw Error('missing RAF');fn(clock);}},
        state(){const warning=document.getElementById('storageWarning');return {detected:trace.filter(e=>e.event==='main_thread_block_detected').length,recovered:trace.filter(e=>e.event==='main_thread_block_recovered').length,interrupts:trace.filter(e=>e.event==='main_thread_watchdog_lifecycle_interrupted').map(e=>e.detail?.details),resets:trace.filter(e=>e.event==='main_thread_watchdog_visibility_reset').map(e=>e.detail?.details?.reason),resetDetails:trace.filter(e=>e.event==='main_thread_watchdog_visibility_reset').map(e=>e.detail?.details),visibleWarning:!warning.classList.contains('hidden'),warningText:warning.textContent,watchdogMarker:warning.dataset.startupWatchdogWarning||null,preserved:trace.filter(e=>e.event==='main_thread_watchdog_external_warning_preserved').length,timerActive:Boolean(timer),traceCount:trace.length};}
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
    // Real Chromium document dispatch exercises the actual Page Lifecycle listener.
    // The test does not simulate a player DB, Service Worker or Android device.
    const beforeFreeze=s.detected;
    await act(()=>{window.__g295.documentEvent('freeze');window.__g295.advance(20000);window.__g295.documentEvent('resume');window.__g295.tick();});
    s=await state();
    assert.equal(s.detected,beforeFreeze,'frozen timer gap must not be a foreground false positive');
    assert.ok(s.resets.includes('page-freeze')&&s.resets.includes('page-resume'),'freeze/resume provenance required');
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforeFreeze+1,'real foreground stall after resume grace remains detectable');
    // A visible warning owned by storage integrity must survive both watchdog
    // detection and stable-frame recovery in the actual Chromium DOM.
    await act(()=>window.__g295.frames(40));
    assert.equal((await state()).watchdogMarker,null,'previous watchdog-owned warning must recover first');
    await act(()=>{const warning=document.getElementById('storageWarning');warning.textContent='EXTERNAL_STORAGE_INTEGRITY_HOLD';warning.classList.remove('hidden');});
    const preForeign=(await state()).detected;
    await act(()=>window.__g295.tick(6000));
    s=await state();
    assert.equal(s.detected,preForeign+1,'external warning cannot disable detector');
    assert.equal(s.warningText,'EXTERNAL_STORAGE_INTEGRITY_HOLD','external warning must not be overwritten');
    assert.equal(s.watchdogMarker,null,'watchdog must not claim an external warning');
    assert.ok(s.preserved>=1,'external-warning preservation must be traceable');
    await act(()=>window.__g295.frames(31));
    s=await state();
    assert.equal(s.warningText,'EXTERNAL_STORAGE_INTEGRITY_HOLD','external warning survives recovery');
    assert.equal(s.visibleWarning,true,'external warning remains visible after recovery');
    // A second real-Chromium stall followed by visibilitychange must preserve
    // foreign-owned warning AND report the actual warning_cleared=false outcome.
    const preForeignVisibility=s.detected,preResetCount=s.resetDetails.length;
    await act(()=>{window.__g295.tick(6000);window.__g295.visibility(true);});
    s=await state();
    assert.equal(s.detected,preForeignVisibility+1,'new stall must remain observable');
    assert.equal(s.resetDetails.length,preResetCount+1,'visibility reset must be recorded');
    assert.equal(s.resetDetails.at(-1).warning_cleared,false,'foreign warning was not cleared');
    assert.equal(s.warningText,'EXTERNAL_STORAGE_INTEGRITY_HOLD','foreign storage warning text remains');
    assert.equal(s.visibleWarning,true,'foreign storage warning remains visible');
    // Real Chromium DOM + deterministic clock: visible RAF may be throttled
    // while the JS timer is responsive. Preserve subsequent true-gap detection.
    await act(()=>{window.__g295.visibility(true);window.__g295.visibility(false);});
    const beforeRafThrottle=(await state()).detected;
    await act(()=>{for(let i=0;i<4;i++)window.__g295.tick(2000);});
    assert.equal((await state()).detected,beforeRafThrottle,'visible RAF pause with regular JS timer is not a blocked main thread');
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforeRafThrottle+1,'subsequent true timer gap still detected');
    // Real Chromium DOM, deterministic clock: repeated delayed callbacks
    // without stable RAF recovery are one episode, not duplicate alerts.
    await act(()=>window.__g295.frames(80));
    const beforeContinuous=(await state()).detected;
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforeContinuous+1,'first long timer gap must warn');
    await act(()=>window.__g295.tick(6500));
    assert.equal((await state()).detected,beforeContinuous+1,'second delayed callback in same stall must not duplicate warning');
    await act(()=>window.__g295.frames(31));
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforeContinuous+2,'new stall after RAF recovery must warn');
    // Lifecycle interruption is not a proven stable-frame recovery, even when
    // it safely removes a watchdog-owned warning. Preserve incident provenance.
    const beforeInterrupt=await state();
    await act(()=>window.__g295.visibility(true));
    s=await state();
    assert.equal(s.recovered,beforeInterrupt.recovered,'background transition must not claim RAF recovery');
    assert.equal(s.interrupts.length,beforeInterrupt.interrupts.length+1,'lifecycle interruption must be recorded separately');
    assert.equal(s.interrupts.at(-1).reason,'background-pause');
    await act(()=>{window.__g295.visibility(false);window.__g295.tick(6000);});
    s=await state();
    assert.equal(s.detected,beforeContinuous+3,'new foreground stall must still re-arm');
    await act(()=>window.__g295.frames(31));
    assert.equal((await state()).recovered,beforeInterrupt.recovered+1,'stable RAF alone proves recovery');
    // Real Chromium DOM with synthetic clock: no visibilitychange dispatch.
    // The watchdog timer must infer the observed hidden/visible transition.
    const beforeSilentVisibility=(await state()).detected;
    await act(()=>{window.__g295.visibilitySilent(true);window.__g295.tick(20000);});
    s=await state();
    assert.equal(s.detected,beforeSilentVisibility,'hidden timer must not warn without visibility event');
    assert.ok(s.resets.includes('timer-observed-background'),'hidden fallback provenance missing');
    await act(()=>{window.__g295.visibilitySilent(false);window.__g295.tick(6000);});
    s=await state();
    assert.equal(s.detected,beforeSilentVisibility,'missed foreground event must not false-positive');
    assert.ok(s.resets.includes('timer-observed-foreground'),'foreground fallback provenance missing');
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforeSilentVisibility+1,'true foreground gap still detected');
    await act(()=>window.__g295.frames(31));
    assert.equal((await state()).watchdogMarker,null,'stable-frame recovery remains effective');
    // G295: BFCache pagehide can arrive without visibilitychange. The real
    // Chromium DOM must drop a stale foreground warning before suspension.
    await act(()=>{const w=document.getElementById('storageWarning');w.classList.add('hidden');w.textContent='';});
    await act(()=>window.__g295.tick(6000));
    const beforePagehide=await state();
    assert.equal(beforePagehide.visibleWarning,true,'precondition: watchdog-owned foreground warning');
    assert.equal(beforePagehide.watchdogMarker,'startup-heartbeat-watchdog');
    await act(()=>window.__g295.event('pagehide'));
    s=await state();
    assert.equal(s.timerActive,false,'pagehide must stop the interval');
    assert.equal(s.watchdogMarker,null,'pagehide must release watchdog warning ownership');
    assert.equal(s.visibleWarning,false,'pagehide must hide stale watchdog-owned warning');
    assert.equal(s.recovered,beforePagehide.recovered,'pagehide must not claim stable-RAF recovery');
    assert.equal(s.interrupts.length,beforePagehide.interrupts.length+1,'pagehide interruption trace required');
    assert.equal(s.interrupts.at(-1).reason,'pagehide-suspend');
    await act(()=>{window.__g295.event('pageshow');window.__g295.tick(100);});
    assert.equal((await state()).detected,beforePagehide.detected,'BFCache first resumed timer tick is grace-protected');
    await act(()=>window.__g295.tick(6000));
    assert.equal((await state()).detected,beforePagehide.detected+1,'post-BFCache real foreground stall remains detectable');
    // Actual Chromium DOM and source, synthetic clock and explicit callback
    // order: overdue RAF first, overdue interval second. No player data.
    await act(()=>window.__g295.frames(40));
    assert.equal((await state()).watchdogMarker,null,'previous watchdog incident recovered');
    const beforeRafFirst=(await state()).detected;
    await act(()=>{window.__g295.advance(6000);window.__g295.frames(1);window.__g295.tick();});
    s=await state();
    assert.equal(s.detected,beforeRafFirst+1,'RAF-first after 6s visible scheduling gap must detect');
    assert.equal(s.watchdogMarker,'startup-heartbeat-watchdog','RAF-first warning must own DOM marker');
    await act(()=>window.__g295.frames(40));
    const beforeResponsive=(await state()).detected;
    await act(()=>{for(let i=0;i<4;i++)window.__g295.tick(2000);window.__g295.frames(1);window.__g295.tick(2000);});
    assert.equal((await state()).detected,beforeResponsive,'responsive timers with delayed RAF must not false-positive');
    // Negative-first: a storage-integrity warning can take over an active
    // watchdog-owned DOM badge before RAF recovery. Ownership must be revoked
    // immediately on the next watchdog observation, not left stale until RAF.
    await act(()=>{const w=document.getElementById('storageWarning');w.classList.add('hidden');w.textContent='';delete w.dataset.startupWatchdogWarning;});
    await act(()=>window.__g295.frames(40));
    const beforeLateForeign=await state();
    await act(()=>window.__g295.tick(6000));
    let lateForeign=await state();
    assert.equal(lateForeign.detected,beforeLateForeign.detected+1,'new watchdog stall must be independently detected');
    assert.equal(lateForeign.watchdogMarker,'startup-heartbeat-watchdog','precondition: watchdog owns active warning');
    const preservedBeforeTakeover=lateForeign.preserved;
    await act(()=>{const w=document.getElementById('storageWarning');w.textContent='EXTERNAL_LATE_STORAGE_INTEGRITY_HOLD';window.__g295.tick(6000);});
    lateForeign=await state();
    assert.equal(lateForeign.warningText,'EXTERNAL_LATE_STORAGE_INTEGRITY_HOLD','foreign warning must retain exact text');
    assert.equal(lateForeign.visibleWarning,true,'foreign warning must remain visible');
    assert.equal(lateForeign.watchdogMarker,null,'stale watchdog marker must be revoked when a foreign writer takes over');
    assert.equal(lateForeign.preserved,preservedBeforeTakeover+1,'late foreign takeover must be independently traced exactly once');
    await act(()=>window.__g295.frames(31));
    lateForeign=await state();
    assert.equal(lateForeign.warningText,'EXTERNAL_LATE_STORAGE_INTEGRITY_HOLD','late foreign warning must survive stable RAF recovery');
    assert.equal(lateForeign.visibleWarning,true);
    console.log('PASS G295_CHROMIUM_LATE_FOREIGN_WARNING_OWNERSHIP_REVOKED');

    console.log('PASS G295_CHROMIUM_RAF_FIRST_DELAYED_TIMER_AND_RESPONSIVE_CONTROL');
    console.log('PASS G295_CHROMIUM_PAGEHIDE_ACTIVE_STALL_INTERRUPTED_AND_REARM');
    console.log('PASS G295_CHROMIUM_TIMER_OBSERVED_MISSED_VISIBILITY_EVENTS');
    console.log('PASS G295_CHROMIUM_LIFECYCLE_INTERRUPTED_NOT_RAF_RECOVERED');
    console.log('PASS G295_CHROMIUM_CONTINUOUS_STALL_SINGLE_DETECTION_AND_REARM');
    console.log('PASS G295_CHROMIUM_RAF_THROTTLED_RESPONSIVE_TIMER_AND_TRUE_GAP');
    console.log('PASS G295_CHROMIUM_SOURCE_BOUND_NATIVE_DIALOG_DOM_LIFECYCLE hidden/resume/pageshow/focus/alert/confirm/prompt/freeze/resume/grace_expiry/real_stall/foreign_warning_reset_trace');
    console.log('HOLD G295_ANDROID_OWNER_UAT_NOT_VERIFIED');
  }finally{await context.close();}
}finally{await browser.close();}
