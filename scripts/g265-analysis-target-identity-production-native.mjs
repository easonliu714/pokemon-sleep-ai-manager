// Actual Production ESM, SQL.js, Web Locks and IndexedDB on disposable localhost.
// No test-only admission wrapper, production data or service worker.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const endpoint=new URL('g265-target-production-disposable',base).href;
try{
  await context.route('**/g265-target-production-disposable',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Disposable Target Identity</title>'}));
  async function tab(){
    const page=await context.newPage();await page.goto(endpoint);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      window.__db=await import('/assets/js/database.js');window.__boot=await window.__db.initializeDatabase();
      window.__target=await import('/assets/js/analysis-target-identity.js');
      window.__guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    });
    return page;
  }
  let seed,stable=false;
  for(let i=0;i<3;i++){
    seed=await tab();if((await seed.evaluate(()=>window.__boot)).boot_persist_skipped){stable=true;break;}await seed.close();
  }
  assert.equal(stable,true,'G265_TARGET_BOOT_CONVERGENCE');
  await seed.evaluate(async()=>{
    const db=window.__db,at='2026-11-27T08:00:00+08:00';
    for(const [id,instance] of [['g265-target-A',null],['g265-target-B',null],['g265-target-existing','g265-existing-id']]){
      db.run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,species,original_label,level,specialty,type,status,last_updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[id,instance,'G265_SYNTHETIC','G265_SYNTHETIC',30,'ingredients','grass','active',at]);
    }
    db.run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',['g265-target-A',1,'G265_SYNTHETIC',2]);
    await db.persist();
  });await seed.close();
  const writer=await tab(),stale=await tab();
  for(const page of [writer,stale])assert.equal(await page.evaluate(()=>window.__boot.boot_persist_skipped),true);
  const probe=await context.newPage();await probe.goto(endpoint);
  async function durable(){
    await probe.bringToFront();
    return probe.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{const r=indexedDB.open('pokemon_sleep_ai_manager');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      try{
        const v=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const raw=tx.objectStore('database').get('primary'),rev=tx.objectStore('metadata').get('revision:primary'),count=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:raw.result,revision:rev.result,snapshots:count.result});tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        if(!(v.bytes instanceof ArrayBuffer))throw Error('G265_TARGET_PRIMARY_MISSING');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v.bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        return {hash,revision:v.revision,snapshots:v.snapshots};
      }finally{idb.close();}
    });
  }
  async function loaded(page){
    await page.bringToFront();return page.evaluate(()=>{
      const db=window.__db;
      return {pokemon:db.rows("SELECT pokemon_id,pokemon_instance_id,source_update_id FROM pokemon WHERE pokemon_id LIKE 'g265-target-%' ORDER BY pokemon_id"),
        history:db.rows("SELECT pokemon_id,event_type,source_update_id FROM pokemon_history WHERE pokemon_id LIKE 'g265-target-%' ORDER BY pokemon_id"),
        ingredients:db.rows("SELECT * FROM pokemon_ingredients WHERE pokemon_id LIKE 'g265-target-%'"),
        publicMaster:db.rows("SELECT COUNT(*) AS n FROM public_event_master"),
        guard:window.__guard.getSqliteDirectWriteGuardStatus().status};
    });
  }
  async function assign(page,id){await page.bringToFront();return page.evaluate(async id=>{
    try{const value=await window.__target.createExistingPokemonAnalysisContext(id);return {ok:true,id:value.target_pokemon_instance_id};}
    catch(e){return {ok:false,code:e.code||e.message};}
  },id);}
  const before=await durable(),staleBefore=await loaded(stale),writerBefore=await loaded(writer);
  assert.equal(before.hash,before.revision.sha256);
  assert.equal(writerBefore.pokemon.find(x=>x.pokemon_id==='g265-target-A').pokemon_instance_id,null);
  assert.equal(writerBefore.pokemon.find(x=>x.pokemon_id==='g265-target-B').pokemon_instance_id,null);
  assert.deepEqual(await assign(writer,'g265-target-existing'),{ok:true,id:'g265-existing-id'});
  assert.deepEqual(await durable(),before,'existing ID is a durable no-op');
  const a=await assign(writer,'g265-target-A');assert.equal(a.ok,true);assert.match(a.id,/^pkm-/);
  const saved=await durable(),writerAfter=await loaded(writer);
  assert.equal(saved.hash,saved.revision.sha256);assert.equal(saved.revision.generation,before.revision.generation+1);assert.equal(saved.snapshots,before.snapshots+1);
  assert.equal(writerAfter.pokemon.find(x=>x.pokemon_id==='g265-target-A').pokemon_instance_id,a.id);
  assert.deepEqual(writerAfter.history,[{pokemon_id:'g265-target-A',event_type:'platform_identity_assigned',source_update_id:'platform-identity:'+a.id}]);
  assert.deepEqual(writerAfter.ingredients,writerBefore.ingredients);assert.deepEqual(writerAfter.publicMaster,writerBefore.publicMaster);
  assert.deepEqual(await assign(writer,'g265-target-A'),a);assert.deepEqual(await durable(),saved);
  const rejected=await assign(stale,'g265-target-B');assert.equal(rejected.ok,false);assert.match(rejected.code,/SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED/);
  const staleAfter=await loaded(stale);assert.deepEqual(staleAfter.pokemon,staleBefore.pokemon);assert.deepEqual(staleAfter.history,staleBefore.history);assert.deepEqual(staleAfter.ingredients,staleBefore.ingredients);assert.equal(staleAfter.guard,'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await durable(),saved,'stale must cause zero snapshot and durable mutation');
  const retry=await assign(stale,'g265-target-B');assert.equal(retry.ok,false);assert.match(retry.code,/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
  const fresh=await tab();assert.equal(await fresh.evaluate(()=>window.__boot.boot_persist_skipped),true);
  const freshBefore=await loaded(fresh);assert.deepEqual(freshBefore.pokemon,writerAfter.pokemon);assert.deepEqual(freshBefore.history,writerAfter.history);
  const b=await assign(fresh,'g265-target-B');assert.equal(b.ok,true);assert.notEqual(b.id,a.id);
  const final=await durable();assert.equal(final.hash,final.revision.sha256);assert.equal(final.revision.generation,saved.revision.generation+1);
  const reload=await tab(),reloaded=await loaded(reload);assert.equal(reloaded.pokemon.find(x=>x.pokemon_id==='g265-target-A').pokemon_instance_id,a.id);assert.equal(reloaded.pokemon.find(x=>x.pokemon_id==='g265-target-B').pokemon_instance_id,b.id);assert.equal(reloaded.history.length,2);assert.deepEqual(reloaded.ingredients,writerBefore.ingredients);assert.deepEqual(await durable(),final);
  console.log('PASS G265_TARGET_IDENTITY_PRODUCTION_NATIVE_PRE_SQL_STALE_ZERO_SNAPSHOT_SHA_REVISION_HISTORY_FRESH');
}finally{await browser.close();}
