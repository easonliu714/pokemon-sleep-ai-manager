// G265 B-lane: native Chromium Web Locks + IndexedDB + SQL.js execute the
// unchanged Named Draft local writer. Disposable origin/rows only, no player
// database, game Apply, production admission, SW, or PWA version changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const storeSource=fs.readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
const contractSource=fs.readFileSync('assets/js/war-room-named-team-draft-contract.js','utf8');
const admissionSource=fs.readFileSync('assets/js/sqlite-cross-tab-write-admission.js','utf8');
for(const marker of [/export async function saveNamedTeamDraftLocal\(/,
  /await snapshot\(/,/begin\(\)/,/INSERT INTO settings\(/,
  /commit\(\)/,/await persist\(\)/,/PERSISTENCE_UNCERTAIN/])
  assert.match(storeSource,marker,'exact unchanged Named Draft source is required');
assert.match(admissionSource,/SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED/);
assert.doesNotMatch(storeSource,/sqlite-cross-tab-write-admission/,
  'native admission must remain test-only');
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','never open production origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
seedDb.run('CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT)');
seedDb.run("INSERT INTO strategy_goal_profile VALUES('synthetic-goal',1,'2026-11-02T00:00:00Z')");
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seedDb.run("INSERT INTO synthetic_public_master VALUES('master','IMMUTABLE')");
seedDb.run("INSERT INTO settings VALUES('unrelated','guard','2026-11-02T00:00:00Z')");
seedDb.run("CREATE TRIGGER reject_synthetic_named_draft BEFORE INSERT ON settings WHEN NEW.key='war-room:named-team-draft:v1:draft_TTTTTTTTTTTTTTTT' BEGIN SELECT RAISE(ABORT,'NATIVE_NAMED_DRAFT_TRIGGER_ROLLBACK'); END");
const seedBytes=Array.from(seedDb.export());
seedDb.close();
const sha=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
const args=id=>({
  draftId:id,name:'Synthetic Native Team',goalDraftState:'clean',
  capturedAt:'2026-11-02T00:00:00.000Z',
  team:{team_status:'READY',team_id:'synthetic-team',
    input_fingerprint:'team-fingerprint',optimizer_version:'synthetic',
    slots:Array.from({length:5},(_,i)=>({slot_index:i,is_leader:i===0,
      pokemon_id:'synthetic-'+i,pokemon_instance_id:'synthetic-instance-'+i,
      hard_constraint_status:'PASS'})),
    missing_constraints:[],satisfied_constraints:[]},
});
function payload(id){
  const value=args(id);
  value.projection={projection_status:'READY',goal_profile_id:'synthetic-goal',
    input_fingerprint:'projection-fingerprint',primary:value.team,alternatives:[],
    mandatory_member_count:0,mandatory_satisfied_count:0};
  return value;
}
async function tab(){
  const page=await context.newPage();
  pages.push(page);
  await page.goto(new URL('g265-native-draft-source-blank',base).href);
  await page.addScriptTag({url:new URL('g265-native-draft-source.js',base).href});
  await page.evaluate(async sources=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-native-draft-source.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('g265_disposable_named_draft_native_source',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('durable');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const read=async()=>{
      const db=await open();
      try{return await new Promise((resolve,reject)=>{
        const tx=db.transaction('durable','readonly');
        const req=tx.objectStore('durable').get('primary');
        req.onsuccess=()=>resolve(req.result?new Uint8Array(req.result):null);
        req.onerror=()=>reject(req.error);
      });}finally{db.close();}
    };
    const write=async bytes=>{
      const db=await open();
      try{await new Promise((resolve,reject)=>{
        const tx=db.transaction('durable','readwrite');
        tx.objectStore('durable').put(new Uint8Array(bytes),'primary');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });}finally{db.close();}
    };
    const fingerprint=bytes=>sha256SqliteBytes(bytes,crypto);
    const factory=new Function('rows','run','begin','commit','rollback',
      'snapshot','persist','isDatabaseReady','isRescueReadonly',
      sources.contract.replace(/^export /gm,'')+'\n'+
      sources.store.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')+
      '\nreturn {saveNamedTeamDraftLocal,readNamedTeamDraft,getNamedTeamDraftPersistenceStatus};');
    const v=window.__g265={SQL,read,write,opened:0,sqlWrites:0,rollbacks:0,
      durableWrites:0,acks:0,entered:false,release:null,gate:null};
    v.makeGate=(denyLocks=false)=>{
      v.gate=createSqliteCrossTabWriteAdmission({
        locks:denyLocks?null:navigator.locks,readDurable:read,
        fingerprint,timeoutMs:10000
      });
    };
    v.inspect=async()=>{
      const bytes=await read();
      const db=new SQL.Database(bytes);
      try{
        const q=sql=>db.exec(sql)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),
          records:q('SELECT key,value_json FROM settings ORDER BY key'),
          master:q('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(data,expected,options={})=>{
      try{
        const result=await v.gate.execute({
          reason:'synthetic-native-named-draft-'+data.draftId,
          expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(await fingerprint(latestBytes)!==observedFingerprint)
              throw Error('NATIVE_PREIMAGE_MISMATCH');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            let inTransaction=false;
            const rows=(sql,params=[])=>{
              const stmt=db.prepare(sql);
              try{
                stmt.bind(params);
                const out=[];
                while(stmt.step())out.push(stmt.getAsObject());
                return out;
              }finally{stmt.free();}
            };
            const env={
              rows,
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_SQL_OUTSIDE_TRANSACTION');
                v.sqlWrites++;
                db.run(sql,params);
              },
              begin(){
                if(inTransaction)throw Error('NATIVE_DOUBLE_BEGIN');
                db.run('BEGIN IMMEDIATE');
                inTransaction=true;
              },
              commit(){
                if(!inTransaction)throw Error('NATIVE_DOUBLE_COMMIT');
                db.run('COMMIT');inTransaction=false;
              },
              rollback(){
                if(inTransaction){db.run('ROLLBACK');inTransaction=false;v.rollbacks++;}
              },
              async snapshot(reason){
                if(reason!=='war-room:named-team-draft:'+data.draftId)
                  throw Error('NATIVE_BAD_SNAPSHOT_REASON');
                return {synthetic:true};
              },
              async persist(){
                if(inTransaction)throw Error('NATIVE_PREMATURE_PERSIST');
                if(options.failBeforeDurable)throw Error('NATIVE_PRE_DURABLE_FAILURE');
                if(options.holdPersist){
                  v.entered=true;
                  await new Promise(resolve=>{v.release=resolve;});
                }
                await write(new Uint8Array(db.export()));
                v.durableWrites++;
                if(options.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE');
              },
              isDatabaseReady:()=>true,isRescueReadonly:()=>false
            };
            try{
              const writer=factory(...Object.keys(env).map(k=>env[k]));
              const saved=await writer.saveNamedTeamDraftLocal(data);
              if(saved.status!=='PERSISTED'||saved.game_applied!==false)
                throw Error('NATIVE_UNEXPECTED_NAMED_DRAFT_ACK');
              const record=writer.readNamedTeamDraft(data.draftId);
              if(record?.payload?.members?.length!==5||record?.game_applied!==false)
                throw Error('NATIVE_BAD_NAMED_DRAFT_READBACK');
              v.acks++;
              return {persistedBytes:await read()};
            }finally{
              if(inTransaction){db.run('ROLLBACK');v.rollbacks++;}
              db.close();
            }
          }
        });
        return {ok:true,result};
      }catch(error){return {ok:false,code:error.code||error.message};}
    };
  },{store:storeSource,contract:contractSource});
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    idb:typeof indexedDB.open==='function',crypto:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,idb:true,crypto:true});
  await page.evaluate(()=>window.__g265.makeGate());
  return page;
}
const run=(page,id,expected,options={})=>
  page.evaluate(a=>window.__g265.run(a.data,a.expected,a.options),
    {data:payload(id),expected,options});
const inspect=page=>page.evaluate(()=>window.__g265.inspect());
const drafts=state=>state.records.filter(row=>row[0].startsWith('war-room:named-team-draft:v1:'))
  .map(row=>JSON.parse(row[1]));
const assertDrafts=(state,count)=>{
  const records=drafts(state);
  assert.equal(records.length,count);
  for(const record of records){
    assert.equal(record.game_applied,false);
    assert.equal(record.local_only,true);
    assert.equal(record.payload.game_applied,false);
    assert.equal(record.payload.local_only,true);
    assert.equal(record.payload.members.length,5);
  }
  assert.deepEqual(state.master,[['master','IMMUTABLE']]);
  assert.deepEqual(state.records.find(row=>row[0]==='unrelated'),['unrelated','guard']);
};
try{
  await context.route('**/g265-native-draft-source-blank',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><title>G265 disposable native Named Draft</title>'
  }));
  await context.route('**/g265-native-draft-source.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-native-draft-source.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seedBytes);
  const baseline=await inspect(a);
  assert.equal(baseline.sha256,sha(seedBytes));
  assertDrafts(baseline,0);
  const first=run(a,'draft_AAAAAAAAAAAAAAAA',baseline.sha256,{holdPersist:true});
  await a.waitForFunction(()=>window.__g265.entered);
  const second=run(b,'draft_BBBBBBBBBBBBBBBB',baseline.sha256);
  await a.evaluate(()=>window.__g265.release());
  const race=await Promise.all([first,second]);
  assert.equal(race[0].ok,true,JSON.stringify(race));
  assert.deepEqual(race[1],{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(await b.evaluate(()=>window.__g265.opened),0);
  assert.equal(await b.evaluate(()=>window.__g265.sqlWrites),0);
  assert.equal(await b.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterA=await inspect(a);
  assertDrafts(afterA,1);
  assert.notEqual(afterA.sha256,baseline.sha256);
  console.log('PASS G265_NAMED_DRAFT_NATIVE_UNCHANGED_WRITER_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'draft_BBBBBBBBBBBBBBBB',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assertDrafts(afterB,2);
  const c=await tab();
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_NAMED_DRAFT_NATIVE_FRESH_DURABLE_RELOAD_BOTH_LOCAL_ONLY');

  const rollback=await run(c,'draft_TTTTTTTTTTTTTTTT',afterB.sha256);
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_NAMED_DRAFT_TRIGGER_ROLLBACK/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();
  assert.deepEqual(await inspect(d),afterB);
  console.log('PASS G265_NAMED_DRAFT_NATIVE_SQL_TRIGGER_ROLLBACK_ZERO_DURABLE_DELTA');

  const lost=await run(d,'draft_LLLLLLLLLLLLLLLL',afterB.sha256,{loseAck:true});
  assert.deepEqual(lost,{ok:false,code:'PERSISTENCE_UNCERTAIN'});
  assert.equal(await d.evaluate(()=>window.__g265.acks),0);
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterLost=await inspect(a);
  assertDrafts(afterLost,3);
  const retry=await run(d,'draft_LLLLLLLLLLLLLLLL',afterLost.sha256);
  assert.deepEqual(retry,{ok:false,code:'SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED'});
  const e=await tab();
  assert.deepEqual(await inspect(e),afterLost);
  console.log('PASS G265_NAMED_DRAFT_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_READBACK');

  await e.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(e,'draft_NNNNNNNNNNNNNNNN',afterLost.sha256);
  assert.deepEqual(denied,{ok:false,code:'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE'});
  assert.equal(await e.evaluate(()=>window.__g265.opened),0);
  assert.deepEqual(await inspect(e),afterLost);
  console.log('PASS G265_NAMED_DRAFT_NATIVE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_SQLJS');
  console.log('HOLD G265_TEST_ONLY_ADMISSION_NOT_PRODUCTION_23_WRITERS_CRASH_RESTORE_GAME_APPLY_ANDROID');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await context.close();
  await browser.close();
}
