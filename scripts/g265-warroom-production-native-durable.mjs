// G265 War Room: negative-first actual production UI handler, disposable real Chromium/SQL.js/IDB.
// This test MUST fail on the unguarded production writer; no opt-in adapter or player data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try {
  await context.route('**/g265-warroom-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><html><head><title>Disposable War Room</title></head><body><nav><button data-view="guide">Guide</button></nav><main></main></body></html>'
  }));
  async function tab(){
    const page=await context.newPage();
    // Fail on real Chromium page exceptions instead of silently waiting for a later ACK.
    page.on('pageerror',error=>console.error('G265_WARROOM_BROWSER_PAGEERROR',error?.stack||String(error)));
    console.log('G265_WARROOM_PHASE_PAGE_GOTO_BEGIN');
    await page.goto(new URL('g265-warroom-production-disposable',base).href);
    console.log('G265_WARROOM_PHASE_PAGE_GOTO_ACK');
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    console.log('G265_WARROOM_PHASE_PRODUCTION_BOOT_BEGIN');
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      window.__db=await import('/assets/js/database.js');
      window.__g265Boot=await window.__db.initializeDatabase();
      (await import('/assets/js/g3-planning.js')).setupG3Pages();
      assertWarroom();
      function assertWarroom(){
        if(typeof document.getElementById('warroomForm')?.onsubmit!=='function')
          throw Error('G265_REAL_WARROOM_FORM_NOT_REACHABLE');
        if(!document.querySelector('[data-view="warroom"]'))
          throw Error('G265_WARROOM_NAV_NOT_REACHABLE');
      }
    });
    console.log('G265_WARROOM_PHASE_PRODUCTION_BOOT_ACK');
    return page;
  }
  async function inspect(page){
    return page.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('pokemon_sleep_ai_manager');
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      try {
        const data=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const b=tx.objectStore('database').get('primary');
          const v=tx.objectStore('metadata').get('revision:primary');
          const n=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:b.result,revision:v.result,snapshots:n.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        const bytes=new Uint8Array(data.bytes);
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
        return {hash,revision:data.revision,snapshots:data.snapshots,raw:Array.from(bytes),
          rows:window.__db.rows('SELECT strategy_id,team_summary FROM weekly_strategy ORDER BY strategy_id')};
      } finally {idb.close();}
    });
  }
  async function submit(page,summary){
    return page.evaluate(async summary=>{
      const form=document.getElementById('warroomForm');
      form.elements.namedItem('week_start').value='2026-11-16';
      form.elements.namedItem('team_summary').value=summary;
      try{
        await form.onsubmit({preventDefault(){},target:form});
        return {ok:true,rows:window.__db.rows('SELECT strategy_id,team_summary FROM weekly_strategy ORDER BY strategy_id')};
      }catch(e){
        return {ok:false,code:e?.code||e?.message||String(e),
          rows:window.__db.rows('SELECT strategy_id,team_summary FROM weekly_strategy ORDER BY strategy_id')};
      }
    },summary);
  }
  // G265: first establish one disposable, durable SQL.js seed in isolation.
  // A first-install bootstrap/one-time migration is not a competing writer.
  // Subsequent tabs must still start on a common native revision and prove
  // their real stale pre-SQL rejection; no CAS assertion is relaxed.
  // A fresh schema may require a second, one-time public-master migration.
  // Settle only before creating competing tabs; a repeated migration on a
  // stable image is a real boot defect and must fail, not be normalized.
  let stableBoot=false;
  for(let bootIndex=0;bootIndex<3;bootIndex++){
    const seed=await tab();
    const boot=await seed.evaluate(()=>window.__g265Boot);
    // The real public-event bootstrap schedules a network refresh AFTER
    // initializeDatabase() returns. Complete that legitimate first-install
    // public-master write in the isolated seed, before any contender loads.
    // This does not suppress the production refresh or bypass native CAS.
    console.log('G265_WARROOM_PHASE_PUBLIC_MASTER_REFRESH_BEGIN',bootIndex);
    const refresh=await seed.evaluate(async()=>{
      const module=await import('/assets/js/public-event-master-bootstrap.js');
      return module.refreshPublicEventMasterForCurrentWeek();
    });
    console.log('G265_WARROOM_PHASE_PUBLIC_MASTER_REFRESH_ACK',bootIndex,refresh?.status);
    assert.ok(['UPDATED','UNCHANGED'].includes(refresh.status),
      'G265_SEED_PUBLIC_MASTER_REFRESH_NOT_ACKNOWLEDGED:'+JSON.stringify(refresh));
    const seeded=await inspect(seed);
    assert.equal(seeded.hash,seeded.revision?.sha256,'G265_SEED_DURABLE_SHA');
    await seed.close();
    if(boot.boot_persist_skipped){stableBoot=true;break;}
  }
  assert.equal(stableBoot,true,'G265_BOOT_MIGRATION_DID_NOT_CONVERGE');
  const writer=await tab();
  const stale=await tab();
  // Neither contender may silently migrate/persist before native CAS begins.
  const contenderBoots=await Promise.all([writer,stale].map(p=>p.evaluate(()=>window.__g265Boot)));
  assert.ok(contenderBoots.every(b=>b.boot_persist_skipped),
    'G265_COMPETING_BOOT_UNEXPECTED_PERSIST:'+JSON.stringify(contenderBoots));
  const before=await inspect(writer);
  const staleBefore=await inspect(stale);
  assert.equal(before.hash,before.revision.sha256,'G265_WARROOM_INITIAL_SHA_PARITY');
  // G265: preserve the native pre-SQL CAS assertion while exposing a single
  // IndexedDB-transaction revision/SHA snapshot from both browser roles.
  // Never normalize, rebase, or retry a mismatched durable revision here.
  const initialEvidence={
    writer:{generation:before.revision?.generation,revisionSha:before.revision?.sha256,bytesSha:before.hash,rows:before.rows.length,snapshots:before.snapshots},
    stale:{generation:staleBefore.revision?.generation,revisionSha:staleBefore.revision?.sha256,bytesSha:staleBefore.hash,rows:staleBefore.rows.length,snapshots:staleBefore.snapshots}
  };
  console.log('G265_WARROOM_INITIAL_ATOMIC_REVISION_EVIDENCE',JSON.stringify(initialEvidence));
  assert.equal(staleBefore.hash,staleBefore.revision?.sha256,'G265_WARROOM_STALE_INITIAL_SHA_PARITY');
  assert.equal(staleBefore.revision.generation,before.revision.generation,
    'G265_WARROOM_INITIAL_REVISION_MISMATCH:'+JSON.stringify(initialEvidence));
  console.log('G265_WARROOM_PHASE_FRESH_PRODUCTION_SUBMIT_BEGIN');
  const ack=await submit(writer,'SYNTHETIC_WARROOM_NEWER');
  console.log('G265_WARROOM_PHASE_FRESH_PRODUCTION_SUBMIT_ACK',ack?.ok,ack?.code||'');
  assert.equal(ack.ok,true,'G265_WARROOM_PRODUCTION_FRESH_ACK_REQUIRED:'+JSON.stringify(ack));
  const durable=await inspect(writer);
  assert.equal(durable.hash,durable.revision.sha256,'G265_WARROOM_POST_ACK_SHA');
  assert.equal(durable.revision.generation,before.revision.generation+1);
  assert.equal(durable.snapshots,before.snapshots+1);
  const independent=new SQL.Database(Uint8Array.from(durable.raw));
  const values=independent.exec('SELECT team_summary FROM weekly_strategy')?.[0]?.values||[];
  independent.close();
  assert.ok(values.some(r=>r[0]==='SYNTHETIC_WARROOM_NEWER'));
  console.log('PASS G265_WARROOM_REAL_PRODUCTION_ACK_IDB_SHA_DURABLE_READBACK');
  const denied=await submit(stale,'SYNTHETIC_WARROOM_STALE');
  assert.equal(denied.ok,false,'G265_WARROOM_STALE_MUST_BE_DENIED_BEFORE_SQL');
  assert.ok(['SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED','SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'].includes(denied.code),
    'G265_WARROOM_STALE_DENIAL_CODE:'+denied.code);
  assert.deepEqual(denied.rows,staleBefore.rows,'G265_WARROOM_STALE_SQL_MUST_BE_ZERO');
  const after=await inspect(stale);
  assert.equal(after.snapshots,durable.snapshots,'G265_WARROOM_STALE_SNAPSHOT_MUST_BE_ZERO');
  assert.equal(after.hash,durable.hash,'G265_WARROOM_STALE_NO_DURABLE_OVERWRITE');
  assert.deepEqual(after.raw,durable.raw);
  const retry=await submit(stale,'SYNTHETIC_WARROOM_BLIND_RETRY');
  assert.equal(retry.ok,false,'G265_WARROOM_STICKY_NO_BLIND_RETRY');
  const fresh=await tab();
  const readback=await inspect(fresh);
  assert.equal(readback.hash,durable.hash);
  assert.equal(readback.revision.generation,durable.revision.generation);
  assert.ok(readback.rows.some(r=>r.team_summary==='SYNTHETIC_WARROOM_NEWER'));
  console.log('PASS G265_WARROOM_PRODUCTION_STALE_PRE_SQL_ZERO_WRITE_AND_FRESH_RELOAD');
}finally{await context.close();await browser.close();}
