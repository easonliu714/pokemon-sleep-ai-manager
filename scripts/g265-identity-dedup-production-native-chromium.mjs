// G265 #861 — CURRENT actual production dedup ESM with native Chromium
// Web Locks, SQL.js and IndexedDB, on a disposable localhost origin ONLY.
// The module's optional boot timer is isolated deterministically, not the
// writer, locks, persistence, SQL engine, or the database's initialisation.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
try{
  await context.route('**/g265-dedup-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>Disposable Dedup</title>'
  }));
  async function tab(){
    const page=await context.newPage();pages.push(page);
    await page.goto(new URL('g265-dedup-production-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      window.__db=await import('/assets/js/database.js');
      window.__boot=await window.__db.initializeDatabase();
    });
    return page;
  }
  async function loadWriter(page){
    await page.evaluate(async()=>{
      // Retire exactly the auto-dedup bootstrap interval at registration,
      // before it can race explicit calls. All other timers are unchanged.
      // No production edits or global scheduler replacement survive import.
      const nativeSet=window.setInterval,nativeClear=window.clearInterval;
      let retired=0;
      window.setInterval=function(callback,delay,...args){
        const id=nativeSet.call(window,callback,delay,...args);
        if(delay===500&&typeof callback==='function'
          &&String(callback).includes('repairPokemonDuplicates()')){
          nativeClear.call(window,id);retired++;
        }
        return id;
      };
      try{window.__dedup=await import('/assets/js/identity-dedup.js');}
      finally{window.setInterval=nativeSet;}
      if(retired!==1)throw Error('G265_DEDUP_BOOT_TIMER_NOT_ISOLATED:'+retired);
    });
  }
  async function inspect(page){
    return page.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('pokemon_sleep_ai_manager');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      try{
        const image=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const raw=tx.objectStore('database').get('primary');
          const revision=tx.objectStore('metadata').get('revision:primary');
          const snapshots=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:raw.result,revision:revision.result,snapshots:snapshots.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes)),
          b=>b.toString(16).padStart(2,'0')).join('');
        const queries={
          pokemon:"SELECT pokemon_id,pokemon_instance_id,status,identity_review_required FROM pokemon WHERE pokemon_id IN ('g265-dedup-A','pkm_private_g265-dedup-A') ORDER BY pokemon_id",
          ingredients:"SELECT pokemon_id,unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id IN ('g265-dedup-A','pkm_private_g265-dedup-A') ORDER BY pokemon_id,unlock_level",
          subskills:"SELECT pokemon_id,unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id IN ('g265-dedup-A','pkm_private_g265-dedup-A') ORDER BY pokemon_id,unlock_level",
          history:"SELECT pokemon_id,event_type,before_json,after_json FROM pokemon_history WHERE event_type='G265_DEDUP_SYNTHETIC'",
          evidence:"SELECT evidence_id,pokemon_instance_id,evidence_type,evidence_value FROM pokemon_identity_evidence WHERE evidence_id IN ('g265-dedup-original','auto-dedup-v4-pkm_private_g265-dedup-A') ORDER BY evidence_id",
          evolution:"SELECT evolution_id,pokemon_instance_id,from_species,to_species FROM pokemon_evolution_history WHERE evolution_id='g265-dedup-evolution'",
          publicMaster:"SELECT COUNT(*) AS n FROM public_event_master"
        };
        const SQL=await window.initSqlJs();
        const db=new SQL.Database(new Uint8Array(image.bytes));
        try{
          const rawRows=sql=>{
            const r=db.exec(sql)[0];
            return r?r.values.map(values=>Object.fromEntries(r.columns.map((k,i)=>[k,values[i]]))):[];
          };
          const durable=Object.fromEntries(Object.entries(queries).map(([k,q])=>[k,rawRows(q)]));
          const loaded=Object.fromEntries(Object.entries(queries).map(([k,q])=>[k,window.__db.rows(q)]));
          return {hash,revision:image.revision,snapshots:image.snapshots,durable,loaded};
        }finally{db.close();}
      }finally{idb.close();}
    });
  }

  let seed=null,stable=false;
  for(let i=0;i<3;i++){
    seed=await tab();
    if((await seed.evaluate(()=>window.__boot)).boot_persist_skipped){stable=true;break;}
    await seed.close();
  }
  assert.equal(stable,true,'G265_DEDUP_BOOT_CONVERGENCE');
  await seed.evaluate(async()=>{
    const db=window.__db,at='2026-11-22T11:12:00+08:00';
    for(const [id,instance,review,confidence,registered,fingerprint] of [
      ['g265-dedup-A','g265-instance-A',0,0.99,at,'g265-fingerprint-A'],
      ['pkm_private_g265-dedup-A','g265-private-A',1,0.2,null,null]
    ]){
      db.run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,species,original_label,level,specialty,type,status,identity_review_required,identity_confidence,registered_at,identity_fingerprint,last_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [id,instance,'G265_SYNTHETIC_A','G265_SYNTHETIC_A',30,'ingredients','grass','active',review,confidence,registered,fingerprint,at]);
    }
    db.run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',['g265-dedup-A',1,'G265_A',2]);
    db.run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',['pkm_private_g265-dedup-A',30,'G265_B',3]);
    db.run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',['pkm_private_g265-dedup-A',10,'G265_SKILL',1]);
    db.run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json) VALUES(?,?,?,?,?)',
      ['pkm_private_g265-dedup-A',at,'G265_DEDUP_SYNTHETIC','{"previous":1}','{"current":2}']);
    db.run('INSERT INTO pokemon_identity_evidence(evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id) VALUES(?,?,?,?,?,?,?)',
      ['g265-dedup-original','g265-private-A','G265_SYNTHETIC','original-observation',0.2,at,'G265_FIXTURE']);
    db.run('INSERT INTO pokemon_evolution_history(evolution_id,pokemon_instance_id,from_species,to_species,evolved_at,source_update_id) VALUES(?,?,?,?,?,?)',
      ['g265-dedup-evolution','g265-private-A','G265_FROM','G265_TO',at,'G265_FIXTURE']);
    await db.persist();
  });
  await seed.close();
  // Fail late in the real SQL transaction, after child/provenance moves.
  // Use a schema trigger in this disposable loaded DB: snapshot() exports/reopens SQL.js,
  // which drops connection-local TEMP triggers before the production transaction.
  // This trigger is never persisted to primary IDB; the forced rollback must
  // leave durable SHA/revision and all player rows unchanged.
  const rollbackTab=await tab();
  assert.equal((await rollbackTab.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  await loadWriter(rollbackTab);
  const rollbackBefore=await inspect(rollbackTab);
  await rollbackTab.evaluate(()=>{
    window.__db.run(`CREATE TRIGGER g265_dedup_force_rollback
      BEFORE UPDATE OF status ON pokemon
      WHEN OLD.pokemon_id='pkm_private_g265-dedup-A' AND NEW.status='archived'
      BEGIN SELECT RAISE(ABORT,'G265_DEDUP_FORCED_SQL_ROLLBACK'); END`);
  });
  assert.equal(await rollbackTab.evaluate(()=>window.__db.rows(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name='g265_dedup_force_rollback'")[0].n),1,
    'G265_DEDUP_ROLLBACK_TRIGGER_NOT_INSTALLED');
  const rollbackAttempt=()=>rollbackTab.evaluate(async()=>{
    try{return {ok:true,count:await window.__dedup.repairPokemonDuplicates()};}
    catch(e){return {ok:false,code:e.code||e.message};}
  });
  assert.deepEqual(await rollbackAttempt(),{ok:false,code:'G265_DEDUP_FORCED_SQL_ROLLBACK'});
  const rolledBack=await inspect(rollbackTab);
  assert.deepEqual(rolledBack.loaded,rollbackBefore.loaded);
  assert.deepEqual(rolledBack.durable,rollbackBefore.durable);
  assert.equal(rolledBack.hash,rollbackBefore.hash);
  assert.deepEqual(rolledBack.revision,rollbackBefore.revision);
  // A pre-transaction recovery snapshot is expected; no second snapshot on retry.
  assert.equal(rolledBack.snapshots,rollbackBefore.snapshots+1);
  assert.deepEqual(await rollbackAttempt(),{ok:false,code:'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'});
  assert.deepEqual(await inspect(rollbackTab),rolledBack);
  await rollbackTab.close();
  const rollbackFresh=await tab();
  assert.equal((await rollbackFresh.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  assert.deepEqual(await inspect(rollbackFresh),rolledBack);
  await rollbackFresh.close();
  console.log('PASS G265_CURRENT_DEDUP_NATIVE_SQL_TRIGGER_ROLLBACK_STICKY_FRESH_READBACK');

  const writer=await tab(),stale=await tab();
  for(const p of [writer,stale]){
    assert.equal((await p.evaluate(()=>window.__boot)).boot_persist_skipped,true);
    await loadWriter(p);
  }
  const before=await inspect(writer),staleBefore=await inspect(stale);
  assert.equal(before.hash,before.revision.sha256);
  assert.deepEqual(staleBefore.revision,before.revision);
  assert.deepEqual(staleBefore.loaded,before.durable);
  assert.deepEqual(before.durable.pokemon.map(x=>x.status),['active','active']);
  assert.equal(before.durable.ingredients.length,2);
  assert.equal(before.durable.subskills.length,1);
  assert.equal(before.durable.history.length,1);
  assert.equal(before.durable.evidence.length,1);
  assert.equal(before.durable.evolution.length,1);

  assert.equal(await writer.evaluate(()=>window.__dedup.repairPokemonDuplicates()),1,'G265_DEDUP_ONE_REAL_MERGE');
  const saved=await inspect(writer);
  assert.equal(saved.hash,saved.revision.sha256);
  assert.equal(saved.revision.generation,before.revision.generation+1);
  assert.equal(saved.snapshots,before.snapshots+1);
  assert.deepEqual(saved.loaded,saved.durable);
  assert.deepEqual(saved.durable.pokemon.map(x=>x.status),['active','archived']);
  assert.equal(saved.durable.pokemon.length,2,'loser row must remain archived, not deleted');
  assert.deepEqual(saved.durable.ingredients,[
    {pokemon_id:'g265-dedup-A',unlock_level:1,ingredient_name:'G265_A',quantity:2},
    {pokemon_id:'g265-dedup-A',unlock_level:30,ingredient_name:'G265_B',quantity:3}
  ]);
  assert.deepEqual(saved.durable.subskills,[{pokemon_id:'g265-dedup-A',unlock_level:10,subskill_name:'G265_SKILL',is_unlocked:1}]);
  assert.deepEqual(saved.durable.history,[{...before.durable.history[0],pokemon_id:'g265-dedup-A'}]);
  assert.deepEqual(saved.durable.evolution,[{...before.durable.evolution[0],pokemon_instance_id:'g265-instance-A'}]);
  assert.equal(saved.durable.evidence.length,2);
  assert.deepEqual(saved.durable.evidence.find(x=>x.evidence_id==='g265-dedup-original'),
    {...before.durable.evidence[0],pokemon_instance_id:'g265-instance-A'});
  assert.equal(saved.durable.evidence.find(x=>x.evidence_id.startsWith('auto-dedup-v4-')).pokemon_instance_id,'g265-instance-A');
  assert.deepEqual(saved.durable.publicMaster,before.durable.publicMaster);
  console.log('PASS G265_CURRENT_DEDUP_NATIVE_ATOMIC_ACK_ARCHIVE_AND_CHILD_PROVENANCE');

  const attempt=p=>p.evaluate(async()=>{
    try{return {ok:true,count:await window.__dedup.repairPokemonDuplicates()};}
    catch(e){return {ok:false,code:e.code||e.message};}
  });
  assert.deepEqual(await attempt(stale),{ok:false,code:'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED'});
  const denied=await inspect(stale);
  assert.deepEqual(denied.loaded,staleBefore.loaded,'stale tab cannot mutate any tested loaded player row');
  assert.deepEqual(denied.durable,saved.durable);
  assert.equal(denied.hash,saved.hash);
  assert.deepEqual(denied.revision,saved.revision);
  assert.equal(denied.snapshots,saved.snapshots);
  assert.deepEqual(await attempt(stale),{ok:false,code:'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'});
  const retry=await inspect(stale);
  assert.deepEqual(retry,denied,'sticky denial must not change memory or durable state');
  const fresh=await tab();
  assert.equal((await fresh.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  const readback=await inspect(fresh);
  assert.deepEqual(readback.loaded,saved.durable);
  assert.deepEqual(readback.durable,saved.durable);
  assert.equal(readback.hash,saved.hash);
  assert.deepEqual(readback.revision,saved.revision);
  assert.equal(readback.snapshots,saved.snapshots);
  console.log('PASS G265_CURRENT_DEDUP_NATIVE_STALE_ZERO_SQL_STICKY_AND_FRESH_RELOAD');

  // Post-COMMIT application ACK loss: inject ONLY the acknowledgment failure
  // on an actual successful native primary IDB transaction completion. Never
  // mock Web Locks, the native IDB write, SHA/revision CAS, or SQLite COMMIT.
  // This is a separate disposable pair and cannot be satisfied by A's ACK.
  await fresh.evaluate(async()=>{
    const db=window.__db,at='2026-11-22T20:31:00+08:00';
    for(const [id,instance,review,confidence,registered,fingerprint] of [
      ['g265-dedup-B','g265-instance-B',0,0.99,at,'g265-fingerprint-B'],
      ['pkm_private_g265-dedup-B','g265-private-B',1,0.2,null,null]
    ])db.run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,species,original_label,level,specialty,type,status,identity_review_required,identity_confidence,registered_at,identity_fingerprint,last_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id,instance,'G265_SYNTHETIC_B','G265_SYNTHETIC_B',35,'ingredients','grass','active',review,confidence,registered,fingerprint,at]);
    db.run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',
      ['pkm_private_g265-dedup-B',30,'G265_B_ORIGINAL',4]);
    db.run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',
      ['pkm_private_g265-dedup-B',10,'G265_B_SKILL',1]);
    db.run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json) VALUES(?,?,?,?,?)',
      ['pkm_private_g265-dedup-B',at,'G265_DEDUP_ACK_LOSS','{"before":"B"}','{"after":"B"}']);
    db.run('INSERT INTO pokemon_identity_evidence(evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id) VALUES(?,?,?,?,?,?,?)',
      ['g265-dedup-B-original','g265-private-B','G265_SYNTHETIC','B-original-observation',0.2,at,'G265_FIXTURE']);
    db.run('INSERT INTO pokemon_evolution_history(evolution_id,pokemon_instance_id,from_species,to_species,evolved_at,source_update_id) VALUES(?,?,?,?,?,?)',
      ['g265-dedup-B-evolution','g265-private-B','G265_FROM_B','G265_TO_B',at,'G265_FIXTURE']);
    await db.persist();
  });
  await fresh.close();
  const lose=await tab();
  assert.equal((await lose.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  await loadWriter(lose);
  async function inspectAckLoss(page){
    return page.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('pokemon_sleep_ai_manager');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      try{
        const image=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const b=tx.objectStore('database').get('primary');
          const r=tx.objectStore('metadata').get('revision:primary');
          const n=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:b.result,revision:r.result,snapshots:n.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes)),
          b=>b.toString(16).padStart(2,'0')).join('');
        const SQL=await window.initSqlJs();
        const durable=new SQL.Database(new Uint8Array(image.bytes));
        const query={
          pokemon:"SELECT pokemon_id,status FROM pokemon WHERE pokemon_id IN ('g265-dedup-B','pkm_private_g265-dedup-B') ORDER BY pokemon_id",
          ingredients:"SELECT pokemon_id,unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id IN ('g265-dedup-B','pkm_private_g265-dedup-B')",
          subskills:"SELECT pokemon_id,unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id IN ('g265-dedup-B','pkm_private_g265-dedup-B')",
          history:"SELECT pokemon_id,before_json,after_json FROM pokemon_history WHERE event_type='G265_DEDUP_ACK_LOSS'",
          evidence:"SELECT evidence_id,pokemon_instance_id,evidence_value FROM pokemon_identity_evidence WHERE evidence_id IN ('g265-dedup-B-original','auto-dedup-v4-pkm_private_g265-dedup-B') ORDER BY evidence_id",
          evolution:"SELECT evolution_id,pokemon_instance_id FROM pokemon_evolution_history WHERE evolution_id='g265-dedup-B-evolution'"
        };
        const fromRaw=sql=>{
          const result=durable.exec(sql)[0];
          return result?result.values.map(values=>Object.fromEntries(result.columns.map((k,i)=>[k,values[i]]))):[];
        };
        try{
          const saved=Object.fromEntries(Object.entries(query).map(([k,q])=>[k,fromRaw(q)]));
          const loaded=Object.fromEntries(Object.entries(query).map(([k,q])=>[k,window.__db.rows(q)]));
          return {hash,revision:image.revision,snapshots:saved&&image.snapshots,saved,loaded};
        }finally{durable.close();}
      }finally{idb.close();}
    });
  }
  const beforeLost=await inspectAckLoss(lose);
  assert.equal(beforeLost.hash,beforeLost.revision.sha256);
  assert.deepEqual(beforeLost.saved.pokemon.map(row=>row.status),['active','active']);
  assert.equal(beforeLost.saved.evidence.length,1);
  const lost=await lose.evaluate(async()=>{
    // Intercept just the next primary readwrite transaction's JS completion
    // callback, AFTER Chromium has genuinely committed it to IndexedDB.
    const original=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
    if(!original?.configurable||!original.get||!original.set)
      throw Error('G265_ACK_LOSS_NATIVE_TRANSACTION_DESCRIPTOR_UNAVAILABLE');
    let selected=false,committed=false;
    Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
      configurable:true,enumerable:original.enumerable,
      get(){return original.get.call(this);},
      set(handler){
        const stores=this.objectStoreNames;
        if(!selected&&this.mode==='readwrite'&&stores.contains('database')&&stores.contains('metadata')){
          selected=true;
          original.set.call(this,event=>{
            committed=true;
            // The original IDB complete event is genuine, but the application
            // receives a failure instead of a successful acknowledgment.
            if(typeof this.onerror!=='function')
              throw Error('G265_ACK_LOSS_NO_APP_ERROR_HANDLER');
            this.onerror.call(this,new Event('error'));
          });
        }else original.set.call(this,handler);
      }
    });
    let outcome;
    try{
      try{outcome={ok:true,count:await window.__dedup.repairPokemonDuplicates()};}
      catch(e){outcome={ok:false,code:e.code||e.message,cause:e.cause?.code||e.cause?.message||null};}
    }finally{
      Object.defineProperty(IDBTransaction.prototype,'oncomplete',original);
    }
    return {outcome,selected,committed};
  });
  assert.equal(lost.selected,true,'G265_ACK_LOSS_MUST_INTERCEPT_REAL_IDB_PRIMARY_SAVE');
  assert.equal(lost.committed,true,'G265_ACK_LOSS_ONLY_AFTER_ACTUAL_IDB_COMMIT');
  assert.equal(lost.outcome.ok,false,'G265_DEDUP_LOST_ACK_NOT_SUCCESS');
  assert.equal(lost.outcome.code,'IDENTITY_DEDUP_DURABILITY_UNVERIFIED_RELOAD_REQUIRED');
  const afterLost=await inspectAckLoss(lose);
  assert.equal(afterLost.hash,afterLost.revision.sha256,'IDB native write really became durable');
  assert.equal(afterLost.revision.generation,beforeLost.revision.generation+1);
  assert.equal(afterLost.snapshots,beforeLost.snapshots+1);
  assert.deepEqual(afterLost.saved,afterLost.loaded,'real SQL COMMIT and real IDB bytes agree');
  assert.deepEqual(afterLost.saved.pokemon.map(row=>row.status),['active','archived']);
  assert.deepEqual(afterLost.saved.ingredients,[{
    pokemon_id:'g265-dedup-B',unlock_level:30,ingredient_name:'G265_B_ORIGINAL',quantity:4
  }]);
  assert.deepEqual(afterLost.saved.subskills,[{
    pokemon_id:'g265-dedup-B',unlock_level:10,subskill_name:'G265_B_SKILL',is_unlocked:1
  }]);
  assert.equal(afterLost.saved.history.length,1);
  assert.equal(afterLost.saved.history[0].pokemon_id,'g265-dedup-B');
  assert.equal(afterLost.saved.evidence.length,2);
  assert.equal(afterLost.saved.evidence.find(x=>x.evidence_id==='g265-dedup-B-original').pokemon_instance_id,'g265-instance-B');
  assert.deepEqual(afterLost.saved.evolution,[{
    evolution_id:'g265-dedup-B-evolution',pokemon_instance_id:'g265-instance-B'
  }]);
  const lostRetry=await lose.evaluate(async()=>{
    try{return {ok:true,count:await window.__dedup.repairPokemonDuplicates()};}
    catch(e){return {ok:false,code:e.code||e.message};}
  });
  assert.deepEqual(lostRetry,{ok:false,code:'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'});
  assert.deepEqual(await inspectAckLoss(lose),afterLost,'unknown ACK must prohibit a second write');
  const freshAfterLoss=await tab();
  assert.equal((await freshAfterLoss.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  const durableAfterReload=await inspectAckLoss(freshAfterLoss);
  assert.deepEqual(durableAfterReload.saved,afterLost.saved);
  assert.deepEqual(durableAfterReload.loaded,afterLost.saved);
  assert.deepEqual(durableAfterReload.revision,afterLost.revision);
  assert.equal(durableAfterReload.hash,afterLost.hash);
  console.log('PASS G265_CURRENT_DEDUP_NATIVE_REAL_POSTCOMMIT_ACK_LOST_STICKY_ZERO_RETRY_FRESH_READBACK');

}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await context.close();await browser.close();
}
