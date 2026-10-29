// G265 fifth legacy analysis revision: isolated native Chromium two-tab CAS/recovery.
// Real native Web Locks, IndexedDB and SQL.js/WASM on disposable loopback origin.
// The original legacy writer and all production player data remain untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/analysis-revision-store.js',import.meta.url),'utf8');
const exact=legacy.split('export async function saveAnalysisRevision(')[1]?.split('\nexport {TABLE_SQL}')[0];
assert.ok(exact&&/await snapshot\(/.test(exact)&&/await persist\(\)/.test(exact)
  &&/INSERT INTO image_analysis_revision/.test(exact));
assert.doesNotMatch(legacy,/sqlite-analysis-revision-optin/);
const tick=String.fromCharCode(96);
const schema=legacy.split('const TABLE_SQL='+tick)[1]?.split(tick+';')[0];
assert.ok(schema&&schema.includes('image_analysis_revision'));
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const imageSha256='a'.repeat(64),analysisType='synthetic-ocr';
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run(schema);
seedDb.run('CREATE INDEX idx_g265_native_revision_lookup ON image_analysis_revision(image_sha256,analysis_type,revision_no DESC)');
seedDb.run("INSERT INTO image_analysis_revision(analysis_id,image_sha256,analysis_type,revision_no,result_json,created_at) VALUES('unrelated','" + 'f'.repeat(64) + "','unrelated',1,'{}','2026-10-29T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_g265_native_analysis_insert BEFORE INSERT ON image_analysis_revision WHEN NEW.analysis_id='native-trigger' BEGIN SELECT RAISE(ABORT,'native-analysis-insert-rejection'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=digest(seed);
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-analysis-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-analysis-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createAnalysisRevisionOptIn}=await import('/assets/js/sqlite-analysis-revision-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-analysis-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createAnalysisRevisionOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createAnalysisRevisionOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(analysisId,expectedGeneration,expectedFingerprint,createdAt='2026-10-29T10:00:00.000Z')=>({
  analysisId,imageSha256,analysisType,sourceImageRef:'fixture://native-analysis/1',
  forced:false,provider:'fixture',model:'synthetic',promptVersion:'native-v1',
  regionPreset:null,result:{analysisId},createdAt,expectedGeneration,expectedFingerprint
});
const run=(page,payload)=>page.evaluate(async data=>{
  try{return {ok:true,result:await window.__g265.writer.execute(data)};}
  catch(error){return {ok:false,code:error.code||error.message};}
},payload);
const inspect=page=>page.evaluate(async()=>{
  const v=window.__g265;
  const current=await v.pair.readVerified();
  const sql=new v.SQL.Database(current.bytes);
  try{return {generation:current.generation,sha256:current.sha256,
    bytes:Array.from(current.bytes),
    records:sql.exec('SELECT analysis_id,image_sha256,analysis_type,revision_no,result_json,supersedes_analysis_id FROM image_analysis_revision ORDER BY analysis_id')?.[0]?.values||[]};
  }finally{sql.close();}
});
try{
  await context.route('**/g265-analysis-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable analysis</title>'
  }));
  await context.route('**/g265-analysis-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-analysis-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },seedHash);
  for(const page of [a,b])await page.evaluate(async()=>{
    window.__g265.db=await window.__g265.open();window.__g265.reset();
  });

  // Two native tabs race the same generation. One ACK; the stale contender
  // must fail before opening SQL.js, rather than duplicate revision_no=1.
  const race=await Promise.all([
    run(a,input('native-analysis-a',0,seedHash)),
    run(b,input('native-analysis-b',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const winner=race[0].ok?'native-analysis-a':'native-analysis-b';
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0,
    'stale tab must not open SQL.js');
  const first=await inspect(active);
  assert.equal(first.generation,1);
  assert.equal(first.sha256,digest(first.bytes));
  assert.deepEqual(first.records.filter(row=>row[1]===imageSha256).map(row=>[row[0],row[3],row[5]]),
    [[winner,1,null]]);
  assert.equal(first.records.find(row=>row[0]==='unrelated')[3],1);
  console.log('PASS G265_FIFTH_NATIVE_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS_UNIQUE_REVISION');

  // A fresh opt-in instance explicitly uses the new durable generation,
  // preserving both acknowledged revisions and the supersedes chain.
  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input('native-analysis-second',1,first.sha256,'2026-10-29T10:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  assert.equal(second.result.revisionNo,2);
  assert.equal(second.result.supersedesAnalysisId,winner);
  const after=await inspect(loser);
  assert.equal(after.generation,2);
  assert.equal(digest(after.bytes),after.sha256);
  assert.deepEqual(after.records.filter(row=>row[1]===imageSha256).map(row=>[row[0],row[3],row[5]]),
    [[winner,1,null],['native-analysis-second',2,winner]].sort((x,y)=>x[0].localeCompare(y[0])));
  assert.equal(after.records.find(row=>row[0]==='unrelated')[3],1);
  console.log('PASS G265_FIFTH_NATIVE_FRESH_RELOAD_UNIQUE_REVISION_CHAIN_BOTH_ACKS');

  // Close the committing document. A new real browser tab must independently
  // read generation 2 and reject blind replay from generation 1 with zero SQL.
  await loser.evaluate(()=>window.__g265.db.close());
  await loser.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const reloaded=await inspect(c);
  assert.deepEqual(reloaded,after);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('native-analysis-second',1,first.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_FIFTH_NATIVE_TAB_CLOSE_ACK_LOSS_RELOAD_STALE_REPLAY_ZERO_SQLJS');

  // Trigger-induced SQL INSERT failure must roll back synchronously and leave
  // all durable bytes, SHA, generation and logical rows unchanged after reload.
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('native-trigger',2,after.sha256,'2026-10-29T11:00:00.000Z'));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-analysis-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const recovered=await inspect(d);
  assert.deepEqual(recovered,after);
  console.log('PASS G265_FIFTH_NATIVE_SQL_ROLLBACK_RELOAD_ZERO_DURABLE_DELTA');
  console.log('HOLD G265_FIFTH_NATIVE_OPTIN_NOT_PRODUCTION_23_LEGACY_OWNER_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
