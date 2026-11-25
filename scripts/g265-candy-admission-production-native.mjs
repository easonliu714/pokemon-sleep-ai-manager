// G265 #861: genuine production Candy UI event, native Web Locks + IDB,
// actual SQL.js/WASM; disposable local browser context only, no player data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const endpoint=new URL('g265-candy-admission-disposable',base).href;
const html='<!doctype html><html><body><textarea id="candyB5WorkingJson"></textarea><button id="candyB5Parse">Parse</button><section id="candyQuantityScreenshotB5"><article data-kind="identity" data-id="g265-obs"><button data-action="gap">Admit</button></article></section></body></html>';
try{
  await context.route('**/g265-candy-admission-disposable',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  async function tab(){
    const page=await context.newPage();
    await page.goto(endpoint);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      window.__db=await import('/assets/js/database.js');
      window.__boot=await window.__db.initializeDatabase();
      window.__authority=await import('/assets/js/public-candy-local-admission-authority.js');
      window.__recognition=await import('/assets/js/public-master-recognition.js');
      window.__guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
      await import('/assets/js/candy-public-master-admission-ui.js');
    });
    await page.waitForFunction(()=>typeof document.querySelector('[data-action="gap"]')?.onclick==='function');
    return page;
  }
  // Settle legitimate first-install migrations and public hydration before
  // creating either loaded contender. Do not normalize or overwrite revisions.
  let stable=false;
  for(let i=0;i<3;i++){
    const seed=await tab();
    const boot=await seed.evaluate(()=>window.__boot);
    const refresh=await seed.evaluate(async()=>(
      await import('/assets/js/public-event-master-bootstrap.js')
    ).refreshPublicEventMasterForCurrentWeek());
    assert.ok(['UPDATED','UNCHANGED'].includes(refresh.status),JSON.stringify(refresh));
    await seed.close();
    if(boot.boot_persist_skipped){stable=true;break;}
  }
  assert.equal(stable,true,'G265_CANDY_BOOT_NOT_STABLE');
  const writer=await tab(),stale=await tab();
  for(const page of [writer,stale]){
    await page.bringToFront();
    assert.equal(await page.evaluate(()=>window.__boot.boot_persist_skipped),true);
  }
  const probe=await context.newPage();await probe.goto(endpoint);
  async function durable(){
    await probe.bringToFront();
    return probe.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('pokemon_sleep_ai_manager');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
        req.onblocked=()=>reject(Error('G265_CANDY_ORACLE_OPEN_BLOCKED'));
      });
      try{
        const v=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const raw=tx.objectStore('database').get('primary');
          const rev=tx.objectStore('metadata').get('revision:primary');
          const count=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:raw.result,revision:rev.result,snapshots:count.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        if(!(v.bytes instanceof ArrayBuffer))throw Error('G265_CANDY_PRIMARY_BYTES_MISSING');
        const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',v.bytes));
        return {hash:Array.from(digest,b=>b.toString(16).padStart(2,'0')).join(''),
          revision:v.revision,snapshots:v.snapshots,
          overlay:localStorage.getItem('pokemon-sleep-public-candy-local-admission-v1')};
      }finally{idb.close();}
    });
  }
  async function loaded(page){
    await page.bringToFront();
    return page.evaluate(()=>{
      const db=window.__db;
      const rows=db.rows('SELECT candy_id,candy_name FROM candy_master ORDER BY candy_id');
      const quantityTables=db.rows("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%candy%' AND name!='candy_master' ORDER BY name");
      const quantities=quantityTables.map(({name})=>{
        if(!/^[a-zA-Z0-9_]+$/.test(name))throw Error('unexpected table name');
        return {name,rows:db.rows('SELECT * FROM "'+name+'"')};
      });
      return {rows,quantities,guard:window.__guard.getSqliteDirectWriteGuardStatus().status};
    });
  }
  async function admit(page,species){
    await page.bringToFront();
    return page.evaluate(async species=>{
      const catalog=window.__recognition.buildPublicMasterCatalogSnapshot('candies');
      const observation={observation_id:'g265-obs',status:'UNMATCHED',observed_text:species+'的糖果',observed_data:{quantity:7},source_image_ref:'synthetic-g265-image',confidence:1};
      const value={schema:window.__recognition.PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:window.__recognition.PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'candy_inventory_update',authority:'candy_master',data_version:catalog.data_version,catalog_snapshot_id:catalog.catalog_snapshot_id,generated_at:'2026-11-25T00:00:00.000Z',visible_target_count:1,observations:[observation]};
      const area=document.getElementById('candyB5WorkingJson');
      const before=JSON.stringify(value);area.value=before;
      window.confirm=()=>true;
      const message=await new Promise(resolve=>{
        window.alert=msg=>resolve(String(msg));
        document.querySelector('[data-action="gap"]').click();
      });
      return {message,before,working:area.value,id:window.__authority.localAdmissionCandyIdForSpecies(species)};
    },species);
  }
  const initial=await durable(),staleBefore=await loaded(stale),writerBefore=await loaded(writer);
  assert.equal(initial.hash,initial.revision.sha256);
  const accepted=await admit(writer,'G265測試甲');
  assert.match(accepted.message,/完成雙層儲存核對/);
  const working=JSON.parse(accepted.working).observations[0];
  assert.equal(working.status,'MATCHED');
  assert.equal(working.user_resolution.admission.quantity_in_public_master,false);
  assert.equal(working.user_resolution.admission.github_public_master_mutated,false);
  const committed=await durable(),writerAfter=await loaded(writer);
  assert.equal(committed.hash,committed.revision.sha256);
  assert.equal(committed.revision.generation,initial.revision.generation+1);
  assert.ok(writerAfter.rows.some(row=>row.candy_id===accepted.id));
  assert.deepEqual(writerAfter.quantities,writerBefore.quantities);
  const rejected=await admit(stale,'G265測試乙');
  assert.match(rejected.message,/SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED|SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(rejected.working,rejected.before,'G265_CANDY_STALE_WORKING_UNCHANGED');
  const staleAfter=await loaded(stale);
  assert.deepEqual(staleAfter.rows,staleBefore.rows,'G265_CANDY_STALE_PRE_SQL_ZERO_MUTATION');
  assert.deepEqual(staleAfter.quantities,staleBefore.quantities);
  assert.equal(staleAfter.guard,'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await durable(),committed,'G265_CANDY_STALE_DURABLE_AND_OVERLAY_UNCHANGED');
  const retry=await admit(stale,'G265測試丙');
  assert.match(retry.message,/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED|SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED/);
  assert.deepEqual(await durable(),committed);
  const fresh=await tab(),freshLoaded=await loaded(fresh);
  assert.ok(freshLoaded.rows.some(row=>row.candy_id===accepted.id));
  assert.ok(!freshLoaded.rows.some(row=>row.candy_id===rejected.id));
  assert.deepEqual(freshLoaded.quantities,writerBefore.quantities);
  assert.deepEqual(await durable(),committed);
  console.log('PASS G265_CANDY_PRODUCTION_NATIVE_STALE_PRE_SQL_OVERLAY_SHA_REVISION_STICKY_FRESH_RELOAD');
}finally{
  await browser.close();
}
