import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const watchdog=read('assets/js/v0394-startup-watchdog.js');
const version=read('assets/js/version-authority.js');

assert.match(version,/app_version:\s*'v0\.4\.13\.7'/);
assert.match(version,/app_build:\s*'20260812-v04137-startup-watchdog-false-positive-closure'/);
assert.match(watchdog,/function v04137ShouldSuppressBlock\(\)/);
assert.match(watchdog,/document\.hidden===true\|\|document\.visibilityState==='hidden'/);
assert.match(watchdog,/document\.addEventListener\('visibilitychange'/);
assert.match(watchdog,/globalThis\.addEventListener\('pageshow'/);
assert.match(watchdog,/globalThis\.addEventListener\('focus'/);
assert.match(watchdog,/for\(const name of \['alert','confirm','prompt'\]\)/);
assert.match(watchdog,/__pokemonSleepV04137Guarded/);
assert.match(watchdog,/!\s*v04137ShouldSuppressBlock\(\)/);
assert.match(watchdog,/main_thread_block_detected/);

const start=watchdog.indexOf('// v0.4.13.7 false-positive guard:');
const endToken='v04137InstallLifecycleGuards();';
const end=watchdog.indexOf(endToken,start);
assert.ok(start>=0&&end>start,'guard source range missing');
const guardSource=watchdog.slice(start,end+endToken.length);

let now=1000;
const listeners=new Map();
const globalListeners=new Map();
const nativeCalls=[];
const fakeDocument={
  hidden:false,
  visibilityState:'visible',
  addEventListener(type,fn){listeners.set(type,fn);},
};
const fakeGlobal={
  document:fakeDocument,
  performance:{now:()=>now},
  addEventListener(type,fn){globalListeners.set(type,fn);},
  alert(value){nativeCalls.push(['alert',value]);return undefined;},
  confirm(value){nativeCalls.push(['confirm',value]);return true;},
  prompt(value){nativeCalls.push(['prompt',value]);return 'typed';},
};
const factory=Function('globalThis','document','performance',`${guardSource}\nreturn {suppress:v04137ShouldSuppressBlock,mark:v04137MarkResumeGrace,hidden:v04137DocumentHidden};`);
const guard=factory(fakeGlobal,fakeDocument,fakeGlobal.performance);

assert.equal(guard.suppress(),false,'normal visible foreground must not be suppressed');
fakeDocument.hidden=true;fakeDocument.visibilityState='hidden';
assert.equal(guard.suppress(),true,'hidden PWA must suppress timer-gap false positives');
fakeDocument.hidden=false;fakeDocument.visibilityState='visible';
listeners.get('visibilitychange')();
assert.equal(guard.suppress(),true,'first foreground heartbeat after resume must be suppressed');
now+=5001;
assert.equal(guard.suppress(),false,'resume grace must expire so real detection returns');

assert.equal(fakeGlobal.confirm('x'),true,'confirm return value must be preserved');
assert.equal(guard.suppress(),true,'blocking dialog return must grant resume grace');
now+=5001;
assert.equal(fakeGlobal.prompt('y'),'typed','prompt return value must be preserved');
assert.equal(guard.suppress(),true);
now+=5001;
fakeGlobal.alert('z');
assert.equal(guard.suppress(),true,'alert return must grant resume grace');
assert.deepEqual(nativeCalls.map(x=>x[0]),['confirm','prompt','alert']);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.13.7_STARTUP_WATCHDOG_FALSE_POSITIVE_CLOSURE',
  app_version:'v0.4.13.7',
  visibility_guard:true,
  pageshow_focus_guard:true,
  native_dialog_guard:true,
  dialog_return_semantics_preserved:true,
  real_block_detector_retained:true,
  database_write_performed:false,
  schema_migration:false
},null,2));
