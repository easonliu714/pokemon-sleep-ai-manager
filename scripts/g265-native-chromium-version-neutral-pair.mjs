import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265 disposable native-browser compatibility gate; never opens the production origin.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','G265 must run only on loopback');
const SQL=await initSqlJs();
const db=new SQL.Database();
db.run('CREATE TABLE g265_native_pair (id TEXT PRIMARY KEY)');
db.run("INSERT INTO g265_native_pair VALUES ('seed')");
const first=Array.from(db.export());
db.run("INSERT INTO g265_native_pair VALUES ('A')");
const second=Array.from(db.export());
db.run("INSERT INTO g265_native_pair VALUES ('B')");
const third=Array.from(db.export());db.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g265-native-pair-blank',route=>route.fulfill({status:200,
    contentType:'text/html',body:'<!doctype html><title>G265 disposable pair</title>'}));
  const tabA=await context.newPage(),tabB=await context.newPage();
  for(const tab of [tabA,tabB]){
    await tab.goto(new URL('g265-native-pair-blank',base).href);
    await tab.evaluate(async()=>{
      const storage=await import('/assets/js/storage.js');
      const name='pokemon_sleep_ai_manager';
      const state={storage};
      state.open=()=>new Promise((resolve,reject)=>{
        const req=indexedDB.open(name);req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      state.read=(db,store,key)=>new Promise((resolve,reject)=>{
        const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(key);
        tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
      state.seedRevision=async (generation,sha256)=>{
        const db=await state.open();
        try{await new Promise((resolve,reject)=>{
          const tx=db.transaction('metadata','readwrite');
          tx.objectStore('metadata').put({generation,sha256},'revision:primary');
          tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });}finally{db.close();}
      };
      // Test-only atomic pair: no await inside a native IDB readwrite transaction.
      state.pair=async ({generation,expectedHash,expectedBytes,nextBytes,nextHash,abortAfterWrite=false})=>{
        const db=await state.open();
        try{return await new Promise((resolve,reject)=>{
          const tx=db.transaction(['database','metadata'],'readwrite');
          const data=tx.objectStore('database'),meta=tx.objectStore('metadata');
          const rawReq=data.get('primary'),revReq=meta.get('revision:primary');
          let rawReady=false,revReady=false,code=null,settled=false;
          const rejectOnce=error=>{if(!settled){settled=true;reject(error);}};
          const abort=reason=>{code=reason;try{tx.abort();}catch{}};
          const stage=()=>{
            if(!rawReady||!revReady||code)return;
            const raw=rawReq.result,rev=revReq.result;
            const expected=Uint8Array.from(expectedBytes);
            const current=raw instanceof ArrayBuffer?new Uint8Array(raw):null;
            if(!current||!rev||rev.generation!==generation||rev.sha256!==expectedHash||
              current.length!==expected.length||!current.every((v,i)=>v===expected[i])){
              abort('G265_NATIVE_PAIR_STALE_CAS');return;
            }
            if(!Number.isSafeInteger(generation)||generation>=Number.MAX_SAFE_INTEGER){
              abort('G265_NATIVE_PAIR_INVALID_GENERATION');return;
            }
            const bytes=Uint8Array.from(nextBytes);
            data.put(bytes.buffer,'primary');
            meta.put({generation:generation+1,sha256:nextHash},'revision:primary');
            meta.put({byte_length:bytes.byteLength,format:'sqlite-arraybuffer',safe_boot_version:2},'primary');
            if(abortAfterWrite)abort('G265_NATIVE_PAIR_INJECTED_ABORT');
          };
          rawReq.onsuccess=()=>{rawReady=true;stage();};
          revReq.onsuccess=()=>{revReady=true;stage();};
          rawReq.onerror=()=>abort('G265_NATIVE_PAIR_READ_FAILED');
          revReq.onerror=()=>abort('G265_NATIVE_PAIR_READ_FAILED');
          tx.oncomplete=()=>{if(!settled){settled=true;resolve({status:'PERSISTED'});}};
          tx.onerror=()=>rejectOnce({code:code||'G265_NATIVE_PAIR_TX_FAILED'});
          tx.onabort=()=>rejectOnce({code:code||'G265_NATIVE_PAIR_TX_ABORTED'});
        });}finally{db.close();}
      };
      state.get=async()=>{
        const db=await state.open();
        try{const raw=await storage.loadDatabaseBytes();return {rawIsBuffer:raw instanceof ArrayBuffer,rawBytes:Array.from(new Uint8Array(raw)),revision:await state.read(db,'metadata','revision:primary')};}
        finally{db.close();}
      };
      window.__g265=state;
    });
  }
  await tabA.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),first);
  await tabA.evaluate(h=>window.__g265.seedRevision(0,h),hash(first));
  const boot=await tabB.evaluate(async()=>{const raw=await window.__g265.storage.loadDatabaseBytes();return {isBuffer:raw instanceof ArrayBuffer,bytes:Array.from(new Uint8Array(raw))};});
  assert.ok(boot.isBuffer);
  assert.equal(hash(boot.bytes),hash(first));
  console.log('PASS G265_NATIVE_CHROMIUM_LEGACY_RAW_ARRAYBUFFER_BOOT_COMPATIBILITY');

  const args=(next,nextHash)=>({generation:0,expectedHash:hash(first),expectedBytes:first,nextBytes:next,nextHash});
  const results=await Promise.all([
    tabA.evaluate(async x=>{try{return await window.__g265.pair(x);}catch(e){return {code:e.code};}},args(second,hash(second))),
    tabB.evaluate(async x=>{try{return await window.__g265.pair(x);}catch(e){return {code:e.code};}},args(third,hash(third)))
  ]);
  assert.equal(results.filter(x=>x.status==='PERSISTED').length,1);
  assert.equal(results.filter(x=>x.code==='G265_NATIVE_PAIR_STALE_CAS').length,1);
  let record=await tabA.evaluate(()=>window.__g265.get());
  assert.equal(record.revision.generation,1);
  assert.equal(record.rawIsBuffer,true);
  assert.equal(record.revision.sha256,hash(record.rawBytes));
  const winner=record.revision.sha256===hash(second)?second:third;
  const loser=winner===second?third:second;
  assert.equal(hash(record.rawBytes),hash(winner));
  console.log('PASS G265_NATIVE_CHROMIUM_TWO_TAB_ATOMIC_PAIR_SINGLE_WINNER_STALE_REJECT');

  const abort=await tabA.evaluate(async x=>{
    try{await window.__g265.pair({...x,abortAfterWrite:true});return {code:'UNEXPECTED_PASS'};}
    catch(e){return {code:e.code};}
  },{generation:1,expectedHash:hash(winner),expectedBytes:winner,nextBytes:loser,nextHash:hash(loser)});
  assert.equal(abort.code,'G265_NATIVE_PAIR_INJECTED_ABORT');
  record=await tabB.evaluate(()=>window.__g265.get());
  assert.equal(record.revision.generation,1);
  assert.equal(record.rawIsBuffer,true);
  assert.equal(hash(record.rawBytes),hash(winner));
  console.log('PASS G265_NATIVE_CHROMIUM_ATOMIC_PAIR_ABORT_ROLLBACK_BOTH_STORES');

  // Existing production legacy writer does not update revision metadata.
  await tabB.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),loser);
  record=await tabA.evaluate(()=>window.__g265.get());
  assert.equal(hash(record.rawBytes),hash(loser));
  assert.equal(record.revision.generation,1);
  assert.equal(record.rawIsBuffer,true);
  assert.equal(record.revision.sha256,hash(winner));
  assert.notEqual(record.revision.sha256,hash(record.rawBytes));
  console.log('REPRODUCED_HOLD G265_NATIVE_CHROMIUM_LEGACY_SAVE_BYPASSES_REVISION_ATOMICITY');
  console.log('HOLD G265_PRODUCTION_WRITER_CONTAINMENT_CROSS_TAB_RELOAD_ANDROID_UAT');
  for(const tab of [tabA,tabB])await tab.evaluate(()=>window.__g265.storage.closeStorageConnection());
}finally{await context.close();await browser.close();}
