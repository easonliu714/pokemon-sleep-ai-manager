import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const url='https://synthetic.invalid/pokemon-sleep-ai-manager/assets/js/v0382-release-authority.js';
const actual=fs.readFileSync(new URL('../assets/js/v0382-release-authority.js',import.meta.url),'utf8');
const source=actual.replace(/^import '\.\/version-authority\.js';\s*/,'').replaceAll('import.meta.url',JSON.stringify(url)).replace(/export\{APP_VERSION,APP_BUILD,enforceRuntimeAuthority,registerServiceWorker,progress,enterReadonlyMode,downloadStartupTrace\};\s*$/,'');
assert.ok(source.includes('function scheduleRegistrationUpdate(registration)'));
function replay(){
 const elements=new Map(),listeners=new Map(),records=[],idle=[];
 let updateResolve,updateReject,tickMs=0;
 const el=(id='')=>({id,dataset:{},style:{},textContent:'',innerHTML:'',className:'',classList:{remove(){},toggle(){}},appendChild(){},insertAdjacentElement(_pos,child){elements.set(child.id,child);},addEventListener(){},onclick:null});
 const get=id=>elements.get(id)||(()=>{const x=el(id);elements.set(id,x);return x})();
 const header=get('header');
 const document={documentElement:{dataset:{databaseReady:'false'}},head:{appendChild(){}},body:el('body'),createElement:()=>el(),getElementById:id=>elements.has(id)?elements.get(id):id==='startupProgressTicker'?null:get(id),querySelector:selector=>selector==='header'?header:null,querySelectorAll:()=>[]};
 const globalThis={PokemonSleepVersionAuthority:{app_version:'synthetic',app_build:'synthetic-build'},UpdateCenterLiveDebug:{record(event,details){records.push({event,details})}},DebugTrace:{record(group,event,details){records.push({group,event,details})}},addEventListener(name,fn){listeners.set(name,fn)}};
 const registration={scope:'https://synthetic.invalid/pokemon-sleep-ai-manager/',update:()=>new Promise((resolve,reject)=>{updateResolve=resolve;updateReject=reject})};
 vm.runInNewContext(source,{document,globalThis,navigator:{serviceWorker:{register:async()=>registration}},Date,Math,URL,console,performance:{now:()=>++tickMs},setInterval:()=>({unref(){}}),setTimeout:()=>({unref(){}}),clearTimeout(){},clearInterval(){},requestIdleCallback:fn=>idle.push(fn)},{filename:'real-release-authority.js',timeout:3000});
 return {get,records,idle,emit:(name,detail)=>{assert.ok(listeners.has(name));listeners.get(name)({detail})},tick:async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()},settle:()=>updateResolve(),fail:()=>updateReject(new Error('synthetic update failure'))};
}
{
 const h=replay();await h.tick();h.emit('pokemon-sleep:startup-progress',{stage:'SQLITE_PERSIST_RUNNING',message:'正在儲存 SQLite',status:'running'});
 assert.match(h.get('startupProgressMessage').textContent,/正在儲存 SQLite/);
 assert.match(h.get('startupProgressElapsed').textContent,/啟動累計/);
 assert.equal(h.idle.length,1);h.idle.shift()();await h.tick();
 assert.match(h.get('startupProgressMessage').textContent,/正在儲存 SQLite/,'background start cannot overwrite SQLite');
 h.settle();await h.tick();
 assert.match(h.get('startupProgressMessage').textContent,/正在儲存 SQLite/,'background completion cannot overwrite SQLite');
 assert.ok(h.records.some(x=>x.event==='startup_progress'&&x.details?.stage==='SERVICE_WORKER_UPDATE_BACKGROUND_COMPLETED'));
 console.log('PASS G479_ACTUAL_SOURCE_BACKGROUND_SW_NEVER_OVERWRITES_SQLITE');
}
{
 const h=replay();await h.tick();h.idle.shift()();await h.tick();
 h.emit('pokemon-sleep:database-ready',{rescue:false,readonly:false});
 h.emit('pokemon-sleep:app-ready',{hydration_complete:true});
 assert.match(h.get('startupProgressMessage').textContent,/系統已切換一般模式/);
 h.settle();await h.tick();
 assert.match(h.get('startupProgressMessage').textContent,/系統已切換一般模式/);
 assert.equal(h.get('startupProgressTicker').dataset.status,'completed');
 console.log('PASS G479_ACTUAL_SOURCE_READY_NOT_REGRESSED_BY_LATE_BACKGROUND');
}
{
 const h=replay();await h.tick();h.idle.shift()();await h.tick();
 h.emit('pokemon-sleep:startup-progress',{stage:'SQLITE_PERSIST_RUNNING',message:'正在儲存 SQLite',status:'running'});
 h.fail();await h.tick();
 assert.match(h.get('startupProgressMessage').textContent,/正在儲存 SQLite/);
 assert.ok(h.records.some(x=>x.event==='startup_progress'&&x.details?.stage==='SERVICE_WORKER_UPDATE_BACKGROUND_FAILED'));
 h.emit('pokemon-sleep:startup-progress',{stage:'DATABASE_RESCUE_REQUIRED',message:'模擬資料庫失敗',status:'failed'});
 assert.match(h.get('startupProgressMessage').textContent,/模擬資料庫失敗/);
 assert.equal(h.get('startupProgressTicker').dataset.status,'failed');
 console.log('PASS G479_ACTUAL_SOURCE_BACKGROUND_WARNING_RETAINED_REAL_FAILURE_VISIBLE');
}
console.log('NOTE G479_SYNTHETIC_VM_ACTUAL_SOURCE_NO_ANDROID_ESM_NETWORK_PROOF');
