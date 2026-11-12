import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G295: execute the ACTUAL current watchdog source under a deterministic clock.
// Synthetic VM evidence is not Android device UAT and never touches player SQLite.
const raw=fs.readFileSync('assets/js/v0394-startup-watchdog.js','utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
assert.match(raw,/main_thread_block_detected/);
const events=new Map(),docEvents=new Map(),intervals=new Map(),raf=[],trace=[],nativeCalls=[];
let now=0,visibilityState='visible',intervalId=0;
const classes=new Set(['hidden']);
const warning={textContent:'',dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
const document={
  get visibilityState(){return visibilityState;},
  get hidden(){return visibilityState!=='visible';},
  addEventListener:(name,fn)=>docEvents.set(name,fn),
  querySelector:()=>null,
  getElementById:id=>id==='storageWarning'?warning:null,
};
const ctx={
  document,
  performance:{now:()=>now},
  PokemonSleepVersionAuthority:{app_version:'synthetic',app_build:'synthetic'},
  debugTrace:{record:(group,event,detail)=>trace.push({group,event,detail})},
  sessionStorage:{setItem(){},getItem(){return null;}},
  addEventListener:(name,fn)=>events.set(name,fn),
  requestAnimationFrame:fn=>raf.push(fn),
  setInterval:(fn,ms)=>{assert.equal(ms,2000);const id=++intervalId;intervals.set(id,fn);return id;},
  clearInterval:id=>intervals.delete(id),
  setTimeout:()=>0,
  clearTimeout(){},
  alert(value){nativeCalls.push(['alert',value]);now+=12000;},
  confirm(value){nativeCalls.push(['confirm',value]);now+=12000;return false;},
  prompt(value){nativeCalls.push(['prompt',value]);now+=12000;if(value==='throw')throw new Error('native dialog error');return 'typed';},
};
ctx.globalThis=ctx;
vm.runInNewContext(source,ctx,{filename:'assets/js/v0394-startup-watchdog.js',timeout:3000});
const emit=(m,n)=>{assert.ok(m.has(n),'missing '+n+' lifecycle listener');m.get(n)();};
const interval=()=>{assert.equal(intervals.size,1,'exactly one active watchdog timer');[...intervals.values()][0]();};
const detected=()=>trace.filter(x=>x.event==='main_thread_block_detected').length;
const resetReason=reason=>trace.some(x=>x.event==='main_thread_watchdog_visibility_reset'&&x.detail?.details?.reason===reason);
assert.equal(intervals.size,1);
visibilityState='hidden';emit(docEvents,'visibilitychange');
now+=20000;interval();assert.equal(detected(),0,'hidden 20s timer gap must be ignored');
visibilityState='visible';emit(docEvents,'visibilitychange');
now+=100;interval();assert.equal(detected(),0,'first resumed heartbeat must not warn');
assert.ok(resetReason('foreground-resume'));
now+=6000;interval();assert.equal(detected(),1,'real visible stall must be detected after grace');
assert.equal(trace.find(x=>x.event==='main_thread_block_detected').detail.details.checkpoint_is_causal,false);
// G295 negative-first: a foreign ESM subsystem may claim a visible badge with
// unchanged text and its own explicit marker while an old watchdog marker lingers.
// Marker authority outranks same-text equality; a responsive timer must revoke
// stale watchdog ownership without suppressing stall diagnostics or erasing DOM.
assert.equal(warning.dataset.startupWatchdogWarning,'startup-heartbeat-watchdog','precondition: watchdog owns its visible warning');
const foreignMarkerText=warning.textContent;
const beforeForeignMarker=detected();
warning.dataset.g479ModuleFailure='true';
now+=2000;interval();
assert.equal(detected(),beforeForeignMarker,'responsive interval must not invent another stall');
assert.equal(warning.dataset.startupWatchdogWarning,undefined,'explicit ESM ownership must revoke stale watchdog marker even with identical text');
assert.equal(warning.dataset.g479ModuleFailure,'true','foreign marker must be preserved');
assert.equal(warning.textContent,foreignMarkerText,'foreign-owned same-text warning must not be overwritten');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(warning.textContent,foreignMarkerText,'RAF recovery must not erase same-text foreign-owned warning');
assert.equal(classes.has('hidden'),false,'RAF recovery must not hide foreign-owned warning');
delete warning.dataset.g479ModuleFailure;
warning.textContent='';classes.add('hidden');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.ok(trace.some(x=>x.event==='main_thread_block_recovered'),'stable frames must clear watchdog-owned warning');
emit(events,'pagehide');assert.equal(intervals.size,0,'pagehide must stop timer');
now+=25000;emit(events,'pageshow');assert.equal(intervals.size,1,'BFCache pageshow must restore exactly one timer');
assert.ok(resetReason('pageshow-resume'));
interval();assert.equal(detected(),1,'BFCache resume gap must be ignored');
now+=6000;interval();assert.equal(detected(),2,'post-pageshow real stall must be detected');
emit(events,'focus');assert.ok(resetReason('focus-resume'));
interval();assert.equal(detected(),2,'focus return must reset the gap');
const beforeDialogs=detected();
assert.equal(ctx.confirm('keep choice'),false,'native confirm false must be preserved');
interval();assert.equal(detected(),beforeDialogs,'confirm return cannot create false stall');
assert.equal(ctx.prompt('keep text'),'typed','native prompt return must be preserved');
interval();assert.equal(detected(),beforeDialogs,'prompt return cannot create false stall');
assert.equal(ctx.alert('keep alert'),undefined,'native alert undefined must be preserved');
interval();assert.equal(detected(),beforeDialogs,'alert return cannot create false stall');
assert.throws(()=>ctx.prompt('throw'),/native dialog error/,'native throw semantics preserved');
interval();assert.equal(detected(),beforeDialogs,'dialog exception finally must reset gap');
assert.deepEqual(nativeCalls.map(x=>x[0]),['confirm','prompt','alert','prompt']);
now+=6000;interval();assert.equal(detected(),beforeDialogs+1,'native-dialog grace must expire; real detector remains live');
emit(events,'pagehide');emit(events,'pageshow');assert.equal(intervals.size,1);
assert.equal(raf.length>=1,true,'requestAnimationFrame remains scheduled');
// Page Lifecycle resume may arrive without visibilitychange/pageshow/focus.
// A 20-second frozen clock gap must not masquerade as a foreground stall.
const preFreeze=detected();
emit(docEvents,'freeze');now+=20000;emit(docEvents,'resume');interval();
assert.equal(detected(),preFreeze,'freeze/resume gap without visibility event must be ignored');
assert.ok(resetReason('page-freeze'));
assert.ok(resetReason('page-resume'));
now+=6000;interval();
assert.equal(detected(),preFreeze+1,'real foreground stall after freeze grace must still warn');
// A pre-existing visible storage warning is foreign-owned. A new stall must
// remain in the trace without replacing or subsequently hiding that warning.
// Multiple pagehide/pageshow generations may leave inert RAF callbacks queued.
for(let i=0;i<40;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'prior watchdog stall must recover before foreign warning scenario');
warning.textContent='EXTERNAL_STORAGE_INTEGRITY_HOLD';
classes.delete('hidden');
const preForeign=detected();
now+=6000;interval();
assert.equal(detected(),preForeign+1,'foreign warning must not disable stall diagnostics');
assert.equal(warning.textContent,'EXTERNAL_STORAGE_INTEGRITY_HOLD','foreign warning must not be overwritten');
assert.equal(warning.dataset.startupWatchdogWarning,undefined,'watchdog must not claim foreign warning');
assert.ok(trace.some(x=>x.event==='main_thread_watchdog_external_warning_preserved'),'preservation must be traceable');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(warning.textContent,'EXTERNAL_STORAGE_INTEGRITY_HOLD','recovery must preserve foreign warning');
assert.equal(classes.has('hidden'),false,'foreign warning must remain visible');
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').at(-1).detail.details.warning_cleared,false,'recovery must report no foreign warning cleared');
// Independent #295 diagnostic regression: a visibility reset during a new stall
// must not report clearing an unrelated, still-visible storage integrity warning.
const preForeignVisibility=detected();
now+=6000;interval();
assert.equal(detected(),preForeignVisibility+1,'new visible stall still diagnosed with foreign warning');
visibilityState='hidden';emit(docEvents,'visibilitychange');
const lastReset=trace.filter(x=>x.event==='main_thread_watchdog_visibility_reset').at(-1);
assert.equal(lastReset.detail.details.warning_cleared,false,'visibility reset cannot claim foreign warning cleared');
assert.equal(warning.textContent,'EXTERNAL_STORAGE_INTEGRITY_HOLD','foreign warning text remains intact');
assert.equal(classes.has('hidden'),false,'foreign warning remains visible after reset');
visibilityState='visible';emit(docEvents,'visibilitychange');
interval();assert.equal(detected(),preForeignVisibility+1,'foreground resume grace remains intact');
// Independent G295 RAF-throttle regression: a visible page may stop painting
// while its main thread continues servicing the 2s interval. Do not diagnose
// a blocked main thread until BOTH the RAF and interval have a long gap.
visibilityState='hidden';emit(docEvents,'visibilitychange');
visibilityState='visible';emit(docEvents,'visibilitychange');
const beforeRafThrottle=detected();
for(let i=0;i<4;i++){now+=2000;interval();}
assert.equal(detected(),beforeRafThrottle,'regular interval proves responsiveness despite 8s RAF pause');
now+=6000;interval();
assert.equal(detected(),beforeRafThrottle+1,'a subsequent 6s interval gap remains a detectable real stall');
// Independent #295 regression: successive delayed timer callbacks with no RAF
// recovery are ONE continuous foreground stall. Preserve the worst gap, but
// never duplicate detection records until stable-frame recovery ends the episode.
for(let i=0;i<80;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'previous stall must recover before independent episode');
const beforeContinuous=detected();
now+=6000;interval();
assert.equal(detected(),beforeContinuous+1,'first long timer gap opens a stall episode');
const firstContinuousSnapshot=ctx.getStartupWatchdogState().stall_snapshot;
now+=6500;interval();
assert.equal(detected(),beforeContinuous+1,'repeated delayed callback without RAF recovery must not duplicate one episode');
const maxContinuousSnapshot=ctx.getStartupWatchdogState().stall_snapshot;
assert.ok(maxContinuousSnapshot.blocked_ms>firstContinuousSnapshot.blocked_ms,'same episode retains longest blocked gap');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'stable RAF closes the continuous episode');
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').at(-1).detail.details.max_blocked_ms,maxContinuousSnapshot.blocked_ms,'recovery reports episode maximum');
now+=6000;interval();
assert.equal(detected(),beforeContinuous+2,'a new stall after recovery must still be diagnosed');
// A background transition cancels an unresolved episode; it does not prove
// 30 stable RAF recovery frames. Do not inflate the recovered-incident metric.
const recoveredBeforeInterrupt=trace.filter(x=>x.event==='main_thread_block_recovered').length;
const interruptedBefore=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted').length;
visibilityState='hidden';emit(docEvents,'visibilitychange');
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').length,recoveredBeforeInterrupt,'backgrounding cannot claim verified RAF recovery');
const interrupts=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted');
assert.equal(interrupts.length,interruptedBefore+1,'lifecycle cancellation must have independent diagnostic');
assert.equal(interrupts.at(-1).detail.details.reason,'background-pause');
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'interrupted stall must release watchdog warning state');
visibilityState='visible';emit(docEvents,'visibilitychange');
now+=6000;interval();
assert.equal(detected(),beforeContinuous+3,'a fresh foreground stall must re-arm after lifecycle cancellation');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').length,recoveredBeforeInterrupt+1,'only stable RAF must record recovered');
// Missed visibilitychange on both transitions: the interval itself observes
// hidden then visible state. Its first visible callback must reset stale clocks,
// but the next independent foreground gap must still be detected.
const beforeSilentVisibility=detected();
visibilityState='hidden';now+=20000;interval();
assert.equal(detected(),beforeSilentVisibility,'hidden timer observation must not warn');
assert.ok(resetReason('timer-observed-background'),'hidden timer fallback must be traceable');
visibilityState='visible';now+=6000;interval();
assert.equal(detected(),beforeSilentVisibility,'missed foreground event must not create false stall');
assert.ok(resetReason('timer-observed-foreground'),'visible timer fallback must be traceable');
now+=6000;interval();
assert.equal(detected(),beforeSilentVisibility+1,'fresh foreground scheduling gap remains detectable');
for(let i=0;i<31;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'fallback must preserve stable-frame recovery');
// Independent #295 missed-event path: hidden RAF may still fire for 30+ frames.
// Those frames must interrupt a foreground stall, NOT certify stable recovery.
const beforeRafHidden=detected();
now+=6000;interval();
assert.equal(detected(),beforeRafHidden+1,'new foreground stall opens before missed hidden event');
assert.equal(ctx.getStartupWatchdogState().warning_active,true);
const recoveredBeforeRafHidden=trace.filter(x=>x.event==='main_thread_block_recovered').length;
const interruptedBeforeRafHidden=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted').length;
visibilityState='hidden'; // intentionally omit visibilitychange
for(let i=0;i<40;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'hidden RAF cancels unresolved foreground episode');
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').length,recoveredBeforeRafHidden,
  'hidden RAF must not inflate verified recovery');
const rafInterrupts=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted');
assert.equal(rafInterrupts.length,interruptedBeforeRafHidden+1);
assert.equal(rafInterrupts.at(-1).detail.details.reason,'raf-observed-background');
visibilityState='visible'; // again intentionally omit visibilitychange
for(let i=0;i<40;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.ok(resetReason('raf-observed-foreground'),'RAF must re-arm after missed foreground event');
interval();assert.equal(detected(),beforeRafHidden+1,'RAF foreground grace must not create false stall');
now+=6000;interval();
assert.equal(detected(),beforeRafHidden+2,'new real stall after RAF-observed foreground must remain detectable');
// Independent G295: pagehide without visibilitychange/pageshow must cancel an
// active foreground warning before BFCache suspension, not claim RAF recovery.
const pagehideBefore=detected();
const pagehideRecovered=trace.filter(x=>x.event==='main_thread_block_recovered').length;
const pagehideInterrupted=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted').length;
assert.equal(ctx.getStartupWatchdogState().warning_active,true,'precondition: active stall before pagehide');
emit(events,'pagehide');
assert.equal(intervals.size,0,'pagehide suspends heartbeat timer');
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'pagehide must cancel stale foreground stall immediately');
assert.equal(trace.filter(x=>x.event==='main_thread_block_recovered').length,pagehideRecovered,'pagehide is not verified RAF recovery');
const pagehideInterrupts=trace.filter(x=>x.event==='main_thread_watchdog_lifecycle_interrupted');
assert.equal(pagehideInterrupts.length,pagehideInterrupted+1,'pagehide must record distinct lifecycle interruption');
assert.equal(pagehideInterrupts.at(-1).detail.details.reason,'pagehide-suspend');
emit(events,'pageshow');assert.equal(intervals.size,1,'pageshow restores one timer');
now+=100;interval();assert.equal(detected(),pagehideBefore,'first BFCache return tick must not warn');
now+=6000;interval();assert.equal(detected(),pagehideBefore+1,'post-BFCache true foreground stall still detected');
// Independent G295: after a real visible 6s JS scheduling gap, Chromium may
// dispatch the pending RAF before the overdue interval. Both were delayed.
// RAF-first must not erase evidence before the timer's independent check.
for(let i=0;i<40;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'precondition: RAF recovered previous episode');
const beforeRafFirst=detected();
now+=6000;assert.ok(raf.length);raf.shift()();interval();
assert.equal(detected(),beforeRafFirst+1,'RAF-first overdue callback must still detect verified timer+RAF gap');
assert.equal(ctx.getStartupWatchdogState().warning_active,true,'RAF-first gap opens a diagnostic episode');
assert.ok(trace.filter(x=>x.event==='main_thread_block_detected').at(-1).detail.details.blocked_ms>=6000);
for(let i=0;i<40;i++){now+=16;assert.ok(raf.length);raf.shift()();}
assert.equal(ctx.getStartupWatchdogState().warning_active,false,'stable visible RAF recovers after RAF-first stall');
const beforeResponsive=detected();
for(let i=0;i<4;i++){now+=2000;interval();}
now+=16;assert.ok(raf.length);raf.shift()();
now+=2000;interval();
assert.equal(detected(),beforeResponsive,'regular timer + delayed RAF alone must not trigger false stall');
// B/G479 independent startup guard: a privacy-restricted browser may allow SW
// registration but deny sessionStorage. This must not reject the bootstrap's
// await enforceLiveVersionHandoff() as a misleading entry-module failure.
let syntheticReloads=0,syntheticGuardWrites=0;
ctx.location={reload(){syntheticReloads++;}};
ctx.navigator={serviceWorker:{controller:null,register:async()=>({active:{},update:async()=>{}})}};
ctx.sessionStorage={getItem(){throw new Error('synthetic sessionStorage denied');},setItem(){throw new Error('synthetic sessionStorage denied');}};
const deniedHandoff=await ctx.enforceLiveVersionHandoff();
assert.equal(deniedHandoff.supported,true);
assert.equal(deniedHandoff.registered,true);
assert.equal(deniedHandoff.controlled,false);
assert.equal(deniedHandoff.reload_guard_available,false);
assert.equal(deniedHandoff.update_on_critical_path,false);
assert.equal(syntheticReloads,0,'denied durable reload guard must not reload indefinitely');
assert.ok(trace.some(x=>x.event==='version_handoff_reload_guard_unavailable'&&x.detail.status==='blocked'&&x.detail.details.reload_suppressed===true),'denied storage guard must be traced as SW handoff HOLD, not ESM failure');
const syntheticGuardStore=new Map();
ctx.sessionStorage={getItem(key){return syntheticGuardStore.get(key)||null;},setItem(key,value){syntheticGuardWrites++;syntheticGuardStore.set(key,value);}};
const allowedHandoff=await ctx.enforceLiveVersionHandoff();
assert.equal(allowedHandoff.reloading,true,'available reload guard preserves first-controller handoff');
assert.equal(syntheticGuardWrites,1);
assert.equal(syntheticReloads,1);
ctx.navigator.serviceWorker.controller={};
const controlledHandoff=await ctx.enforceLiveVersionHandoff();
assert.equal(controlledHandoff.controlled,true,'controlled SW must not need sessionStorage reload guard');
assert.equal(syntheticReloads,1);
// Independent G479 failure mode: storage writes may silently disappear without
// throwing. A missing reload-loop token must never authorize location.reload().
ctx.navigator.serviceWorker.controller=null;
ctx.sessionStorage={getItem(){return null;},setItem(){}};
const silentDropHandoff=await ctx.enforceLiveVersionHandoff();
assert.equal(silentDropHandoff.reload_guard_available,false,'silently dropped reload token is not durable');
assert.equal(silentDropHandoff.update_on_critical_path,false);
assert.equal(syntheticReloads,1,'silently dropped reload token must not trigger an infinite reload loop');
assert.ok(trace.some(x=>x.event==='version_handoff_reload_guard_unavailable'&&x.detail.details.reload_suppressed===true),'silent-drop reload guard must have explicit blocked provenance');
console.log('PASS G479_SW_RELOAD_SILENT_DROP_WRITE_READBACK_FAIL_CLOSED');
console.log('PASS G479_SW_RELOAD_SESSIONSTORAGE_DENIAL_FAIL_CLOSED_AND_NORMAL_CONTROL');

console.log('PASS G295_RAF_FIRST_DELAYED_TIMER_INDEPENDENT_GAP_AND_RESPONSIVE_CONTROL');
console.log('PASS G295_PAGEHIDE_ACTIVE_STALL_INTERRUPTED_NOT_RECOVERED_AND_REARM');
console.log('PASS G295_RAF_OBSERVED_MISSED_VISIBILITY_HIDDEN_NOT_RECOVERED_AND_REARM');
console.log('PASS G295_TIMER_OBSERVED_VISIBILITY_MISSED_EVENTS_FAIL_CLOSED_AND_REARM');
console.log('PASS G295_LIFECYCLE_INTERRUPTED_NOT_VERIFIED_RAF_RECOVERY_AND_REARM');
console.log('PASS G295_CONTINUOUS_STALL_SINGLE_DETECTION_MAX_GAP_AND_NEW_EPISODE');
console.log('PASS G295_VISIBLE_RAF_THROTTLED_TIMER_RESPONSIVE_NO_FALSE_STALL_AND_REAL_GAP_DETECTED');
console.log('PASS G295_SOURCE_BOUND_LIFECYCLE_VM hidden/resume/pageshow/focus/native_dialog/freeze/resume/recovery/real_stall/foreign_warning_reset_trace; ANDROID_OWNER_NOT_VERIFIED');
