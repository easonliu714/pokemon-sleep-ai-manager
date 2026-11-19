// G265 #861: actual production G3 weeklyForm handler, not an opt-in adapter.
// Real Chromium two tabs, SQL.js/WASM, native Web Locks and IndexedDB CAS.
// localhost disposable origin only; NEVER use or read an Owner player database.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
try{
  await context.route('**/g265-weekly-context-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><head><title>Disposable G265 weekly context</title></head><body><nav><button data-view="guide">Guide</button></nav><main></main></body></html>'
  }));
  async function tab(){
    const page=await context.newPage();pages.push(page);
    page.on('dialog',dialog=>dialog.dismiss());
    await page.goto(new URL('g265-weekly-context-production-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      if(typeof boot!=='function')throw Error('G265_WEEKLY_SQLJS_MISSING');
      window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      // Capture the actual production alert branch: invalid form no-op must
      // never be counted as an acknowledged native durable write.
      window.__g265WeeklyAlerts=[];
      window.alert=message=>window.__g265WeeklyAlerts.push(String(message));
      window.__db=await import('/assets/js/database.js');
      window.__boot=await window.__db.initializeDatabase();
      (await import('/assets/js/g3-planning.js')).setupG3Pages();
      if(typeof document.getElementById('weeklyContextForm')?.onsubmit!=='function')
        throw Error('G265_PRODUCTION_WEEKLY_FORM_NOT_INSTALLED');
    });
    return page;
  }
  async function inspect(page){
    return page.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('pokemon_sleep_ai_manager');
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      try{
        const v=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const raw=tx.objectStore('database').get('primary');
          const revision=tx.objectStore('metadata').get('revision:primary');
          const snapshots=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:raw.result,revision:revision.result,snapshots:snapshots.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        if(!(v.bytes instanceof ArrayBuffer))throw Error('G265_WEEKLY_PRIMARY_BYTES_MISSING');
        const bytes=new Uint8Array(v.bytes);
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        return {revision:v.revision,hash,snapshots:v.snapshots,
          raw:Array.from(bytes),
          loaded:window.__db.rows('SELECT context_id,week_start,base_notes FROM weekly_context ORDER BY context_id'),
          publicEvents:window.__db.rows('SELECT COUNT(*) AS n FROM public_event_master')[0]?.n};
      }finally{idb.close();}
    });
  }
  async function submit(page,week,notes){
    return page.evaluate(async({week,notes})=>{
      const form=document.getElementById('weeklyContextForm');
      form.elements.namedItem('week_start').value=week;
      form.elements.namedItem('base_notes').value=notes;
      const current=new FormData(form);
      if(current.get('week_start')!==week||current.get('base_notes')!==notes)
        throw Error('G265_WEEKLY_FORM_INPUT_NOT_APPLIED:'+JSON.stringify({requested:{week,notes},actual:{week:current.get('week_start'),notes:current.get('base_notes')},elementWeek:form.elements.namedItem('week_start').value,elementNotes:form.elements.namedItem('base_notes').value,weekOuterHTML:form.elements.namedItem('week_start').outerHTML,weekDisabled:form.elements.namedItem('week_start').disabled,weekFormId:form.elements.namedItem('week_start').form?.id,formTag:form.tagName,formKeys:[...current.keys()]}));
      const beforeAlerts=window.__g265WeeklyAlerts.length;
      try{
        await form.onsubmit({preventDefault(){},target:form});
        const alerts=window.__g265WeeklyAlerts.slice(beforeAlerts);
        return {ok:alerts.includes('本週環境已儲存'),alerts,
          rows:window.__db.rows('SELECT context_id,week_start,base_notes FROM weekly_context ORDER BY context_id')};
      }catch(error){
        return {ok:false,code:error?.code||error?.message||String(error),
          rows:window.__db.rows('SELECT context_id,week_start,base_notes FROM weekly_context ORDER BY context_id')};
      }
    },{week,notes});
  }
  // First-install migrations and async public-master refresh may create
  // legitimate early generations. Settle ONLY in an isolated seed tab.
  // Contending tabs must not migrate or persist their loaded images.
  let stable=false;
  for(let i=0;i<3;i++){
    const seed=await tab();
    const boot=await seed.evaluate(()=>window.__boot);
    const refreshed=await seed.evaluate(async()=>{
      const m=await import('/assets/js/public-event-master-bootstrap.js');
      return m.refreshPublicEventMasterForCurrentWeek();
    });
    assert.ok(['UPDATED','UNCHANGED'].includes(refreshed.status),
      'G265_WEEKLY_SEED_PUBLIC_REFRESH_MISSING:'+JSON.stringify(refreshed));
    const seeded=await inspect(seed);
    assert.equal(seeded.hash,seeded.revision?.sha256,'G265_WEEKLY_SEED_IDB_SHA');
    await seed.close();
    if(boot.boot_persist_skipped){stable=true;break;}
  }
  assert.equal(stable,true,'G265_WEEKLY_BOOT_NEVER_CONVERGED');

  const writer=await tab(),stale=await tab();
  const boots=await Promise.all([writer,stale].map(p=>p.evaluate(()=>window.__boot)));
  assert.ok(boots.every(b=>b.boot_persist_skipped),
    'G265_WEEKLY_CONTENDER_BOOT_WRITTEN:'+JSON.stringify(boots));
  const before=await inspect(writer),staleBefore=await inspect(stale);
  assert.equal(before.hash,before.revision.sha256);
  assert.equal(staleBefore.hash,staleBefore.revision.sha256);
  assert.equal(staleBefore.revision.generation,before.revision.generation,
    'G265_WEEKLY_WRITER_STALE_BASELINE_MISMATCH');
  assert.equal(staleBefore.hash,before.hash);
  const acknowledged=await submit(writer,'2026-11-16','SYNTHETIC_G265_WEEKLY_ACK');
  assert.equal(acknowledged.ok,true,JSON.stringify(acknowledged));
  const persisted=await inspect(writer);
  assert.equal(persisted.hash,persisted.revision.sha256,'G265_WEEKLY_ACK_IDB_SHA');
  assert.equal(persisted.revision.generation,before.revision.generation+1);
  assert.equal(persisted.snapshots,before.snapshots+1,'G265_WEEKLY_ONE_ACK_SNAPSHOT');
  assert.equal(persisted.loaded.length,before.loaded.length+1);
  const independent=new SQL.Database(Uint8Array.from(persisted.raw));
  const durableRows=independent.exec('SELECT base_notes FROM weekly_context')?.[0]?.values||[];
  independent.close();
  assert.ok(durableRows.some(r=>r[0]==='SYNTHETIC_G265_WEEKLY_ACK'));
  console.log('PASS G265_PRODUCTION_WEEKLY_CONTEXT_NATIVE_ACK_IDB_SHA_DURABLE_READBACK');

  const denied=await submit(stale,'2026-11-23','SYNTHETIC_G265_WEEKLY_STALE');
  assert.equal(denied.ok,false,'G265_WEEKLY_STALE_MUST_DENY:'+JSON.stringify(denied));
  assert.ok(['SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'].includes(denied.code),
    'G265_WEEKLY_STALE_PRE_SQL_CODE:'+denied.code);
  assert.deepEqual(denied.rows,staleBefore.loaded,'G265_WEEKLY_STALE_LOADED_SQL_UNTOUCHED');
  const held=await inspect(stale);
  assert.equal(held.hash,persisted.hash,'G265_WEEKLY_STALE_NO_DURABLE_OVERWRITE');
  assert.equal(held.snapshots,persisted.snapshots,'G265_WEEKLY_STALE_ZERO_NEW_SNAPSHOT');
  assert.deepEqual(held.raw,persisted.raw);
  const retry=await submit(stale,'2026-11-30','SYNTHETIC_G265_WEEKLY_BLIND_RETRY');
  assert.equal(retry.ok,false,'G265_WEEKLY_BLIND_RETRY_MUST_HOLD');
  const afterRetry=await inspect(stale);
  assert.equal(afterRetry.hash,persisted.hash);
  assert.equal(afterRetry.snapshots,persisted.snapshots);
  console.log('PASS G265_PRODUCTION_WEEKLY_CONTEXT_NATIVE_STALE_PRE_SQL_ZERO_SQL_SNAPSHOT_AND_STICKY');

  const fresh=await tab();
  const readback=await inspect(fresh);
  assert.equal(readback.hash,persisted.hash);
  assert.equal(readback.revision.generation,persisted.revision.generation);
  assert.equal(readback.publicEvents,persisted.publicEvents);
  assert.ok(readback.loaded.some(r=>r.base_notes==='SYNTHETIC_G265_WEEKLY_ACK'));
  assert.ok(!readback.loaded.some(r=>r.base_notes==='SYNTHETIC_G265_WEEKLY_STALE'));
  console.log('PASS G265_PRODUCTION_WEEKLY_CONTEXT_NATIVE_FRESH_RELOAD_PRESERVES_ACK_AND_PUBLIC_MASTER');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await browser.close();
}
