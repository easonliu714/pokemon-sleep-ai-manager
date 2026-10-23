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
const warning={textContent:'',dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
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
console.log('PASS G295_SOURCE_BOUND_LIFECYCLE_VM hidden/resume/pageshow/focus/native_dialog/recovery/real_stall; ANDROID_OWNER_NOT_VERIFIED');
