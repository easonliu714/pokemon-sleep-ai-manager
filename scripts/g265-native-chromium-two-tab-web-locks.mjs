import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265 isolated browser evidence: two genuine same-origin Chromium tabs,
// native Web Locks, and an ephemeral test-only IndexedDB record.
// Never load the production app or any personal SQLite / IndexedDB database.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','browser fixture must stay loopback-only');
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_browser_rows (id TEXT PRIMARY KEY, writer TEXT NOT NULL)');
seed.run("INSERT INTO g265_browser_rows VALUES ('seed','initial')");
const seedBytes=Array.from(new Uint8Array(seed.export()));
seed.close();

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const dbName='g265-native-two-tab-fixture-'+Date.now()+'-'+Math.random().toString(36).slice(2);
try{
  await context.route('**/g265-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><head><meta charset="utf-8"></head><body>G265 isolated fixture</body></html>'
  }));
  const tabA=await context.newPage(),tabB=await context.newPage();
  for(const [page,name] of [[tabA,'A'],[tabB,'B']]){
    await page.goto(new URL('g265-native-blank',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async ({dbName,name})=>{
      const module=await import('/assets/js/sqlite-cross-tab-write-admission.js');
      const SQL=await window.initSqlJs({locateFile:file=>'/node_modules/sql.js/dist/'+file});
      const open=()=>new Promise((resolve,reject)=>{
        const req=indexedDB.open(dbName,1);
        req.onupgradeneeded=()=>req.result.createObjectStore('kv');
        req.onerror=()=>reject(req.error);
        req.onsuccess=()=>resolve(req.result);
      });
      const read=async()=>{
        const db=await open();
        return new Promise((resolve,reject)=>{
          const tx=db.transaction('kv','readonly');
          const req=tx.objectStore('kv').get('image');
          req.onsuccess=()=>resolve(req.result?new Uint8Array(req.result):null);
          req.onerror=()=>reject(req.error);
          tx.oncomplete=()=>db.close();
          tx.onerror=()=>{db.close();reject(tx.error);};
        });
      };
      const write=async bytes=>{
        const db=await open();
        return new Promise((resolve,reject)=>{
          const tx=db.transaction('kv','readwrite');
          tx.objectStore('kv').put(new Uint8Array(bytes),'image');
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onerror=()=>{db.close();reject(tx.error);};
          tx.onabort=()=>{db.close();reject(tx.error||Error('idb_abort'));};
        });
      };
      const gate=()=>module.createSqliteCrossTabWriteAdmission({
        readDurable:read,timeoutMs:12000
      });
      const fingerprint=bytes=>module.sha256SqliteBytes(bytes);
      const fixture={name,SQL,read,write,gate,fingerprint,writeCount:0,holding:false};
      fixture.mutate=async({latestBytes})=>{
        fixture.writeCount++;
        if(name==='A'&&fixture.holdFirst){
          fixture.holding=true;
          await fixture.holdFirst;
        }
        const sql=new SQL.Database(new Uint8Array(latestBytes));
        try{
          sql.run('INSERT INTO g265_browser_rows VALUES (?,?)',[name,name]);
          const next=new Uint8Array(sql.export());
          await write(next);
          return {persistedBytes:next};
        }finally{sql.close();}
      };
      window.__g265=fixture;
    },{dbName,name});
    const supported=await page.evaluate(()=>({
      secure:isSecureContext,
      locks:typeof navigator.locks?.request==='function',
      crypto:typeof crypto.subtle?.digest==='function'
    }));
    assert.deepEqual(supported,{secure:true,locks:true,crypto:true},name+' native browser primitives');
  }
  await tabA.evaluate(async bytes=>window.__g265.write(new Uint8Array(bytes)),seedBytes);
  const baselineA=await tabA.evaluate(async()=>window.__g265.fingerprint(await window.__g265.read()));
  const baselineB=await tabB.evaluate(async()=>window.__g265.fingerprint(await window.__g265.read()));
  assert.equal(baselineA,baselineB,'both tabs must load the identical original durable image');
  await tabA.evaluate(()=>{
    window.__g265.holdFirst=new Promise(resolve=>{window.__g265.releaseFirst=resolve;});
    window.__g265.session=window.__g265.gate();
  });
  await tabB.evaluate(()=>{window.__g265.session=window.__g265.gate();});
  const first=tabA.evaluate(async baseline=>{
    try{return {ok:true,...await window.__g265.session.execute({
      reason:'tab-A',expectedFingerprint:baseline,writeUnderLock:window.__g265.mutate
    })};}catch(e){return {ok:false,code:e.code||e.message};}
  },baselineA);
  await tabA.waitForFunction(()=>window.__g265.holding===true,null,{timeout:8000});
  const second=tabB.evaluate(async baseline=>{
    try{return {ok:true,...await window.__g265.session.execute({
      reason:'tab-B-stale',expectedFingerprint:baseline,writeUnderLock:window.__g265.mutate
    })};}catch(e){return {ok:false,code:e.code||e.message};}
  },baselineB);
  await tabB.waitForFunction(async()=>{
    const q=await navigator.locks.query();
    return q.pending.some(lock=>lock.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  },null,{timeout:8000});
  assert.equal(await tabB.evaluate(()=>window.__g265.writeCount),0,'B cannot enter while A holds native lock');
  await tabA.evaluate(()=>window.__g265.releaseFirst());
  const resultA=await first,resultB=await second;
  assert.equal(resultA.status,'PERSISTED');
  assert.deepEqual(resultB,{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(await tabB.evaluate(()=>window.__g265.session.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await tabB.evaluate(()=>window.__g265.writeCount),0,'stale B must never persist');
  const noLocks=await tabB.evaluate(async()=>{
    const m=await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const gate=m.createSqliteCrossTabWriteAdmission({
      locks:null,readDurable:window.__g265.read
    });
    try{
      await gate.execute({reason:'no-lock',expectedFingerprint:await window.__g265.fingerprint(await window.__g265.read()),
        writeUnderLock:window.__g265.mutate});
      return {code:'UNEXPECTED_PASS',status:gate.status().status};
    }catch(e){return {code:e.code,status:gate.status().status};}
  });
  assert.deepEqual(noLocks,{code:'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE',status:'UNVERIFIED_RELOAD_REQUIRED'});
  const fresh=await tabB.evaluate(async()=>{
    const gate=window.__g265.gate();
    return gate.execute({reason:'tab-B-fresh',expectedFingerprint:await window.__g265.fingerprint(await window.__g265.read()),
      writeUnderLock:window.__g265.mutate});
  });
  assert.equal(fresh.status,'PERSISTED');
  const finalBytes=await tabA.evaluate(async()=>Array.from(await window.__g265.read()));
  const finalSql=new SQL.Database(new Uint8Array(finalBytes));
  try{
    assert.deepEqual(finalSql.exec('SELECT id FROM g265_browser_rows ORDER BY id')[0].values.flat(),['A','B','seed']);
  }finally{finalSql.close();}
  assert.equal(await tabA.evaluate(()=>window.__g265.writeCount),1);
  assert.equal(await tabB.evaluate(()=>window.__g265.writeCount),1);
  console.log('PASS G265_NATIVE_CHROMIUM_TWO_TABS_EXCLUSIVE_WEB_LOCKS');
  console.log('PASS G265_NATIVE_INDEXEDDB_IN_LOCK_SHA256_STALE_REJECTION_AND_FRESH_RELOAD');
  console.log('PASS G265_NATIVE_WEB_LOCKS_UNAVAILABLE_STICKY_HOLD');
  console.log('HOLD G265_PRODUCTION_RUNTIME_WIRING_LEGACY_23_WRITERS_ANDROID_OWNER_UAT');
}finally{
  await context.close();
  await browser.close();
}
