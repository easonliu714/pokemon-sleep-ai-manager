// G265 #861: real production ability-evidence import and native IDB/WebLocks.
// Completely disposable localhost Chromium PWA origin, no Owner player SQLite.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
try{
  await context.route('**/g265-ability-evidence-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><head><title>Disposable G265 Identity</title></head><body></body></html>'
  }));
  async function tab(){
    const page=await context.newPage();pages.push(page);
    await page.goto(new URL('g265-ability-evidence-production-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      if(typeof boot!=='function')throw Error('G265_ABILITY_SQLJS_MISSING');
      window.initSqlJs=()=>boot({locateFile:f=>'/node_modules/sql.js/dist/'+f});
      window.__db=await import('/assets/js/database.js');
      window.__boot=await window.__db.initializeDatabase();
    });
    return page;
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
        if(!(image.bytes instanceof ArrayBuffer))throw Error('G265_ABILITY_PRIMARY_BYTES_MISSING');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes)),
          b=>b.toString(16).padStart(2,'0')).join('');
        const SQL=await window.initSqlJs();
        const durable=new SQL.Database(new Uint8Array(image.bytes));
        let committed;
        try{
          const result=durable.exec("SELECT identity_review_required FROM pokemon WHERE pokemon_id='g265-ability-A'");
          const evidence=durable.exec("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-g265-ability-A'");
          // Independent raw IDB SQLite readback of original child facts.
          const original=durable.exec("SELECT (SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='g265-ability-A') + (SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='g265-ability-A')");
          committed={identity:result?.[0]?.values[0]?.[0]??null,evidence:evidence?.[0]?.values[0]?.[0]??null,originalEvidence:original?.[0]?.values[0]?.[0]??null};
        }finally{durable.close();}
        const selected=window.__db.rows("SELECT identity_review_required FROM pokemon WHERE pokemon_id='g265-ability-A'");
        const identity=selected?.[0]?.identity_review_required??null;
        const evidence=window.__db.rows("SELECT COUNT(*) AS n FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-g265-ability-A'")[0]?.n??null;
        const originalEvidence=window.__db.rows("SELECT COUNT(*) AS n FROM pokemon_identity_evidence WHERE evidence_id IN ('g265-A-registration','g265-A-fingerprint')")[0]?.n??null;
        const publicMaster=window.__db.rows('SELECT COUNT(*) AS n FROM public_event_master')[0]?.n;
        return {hash,revision:image.revision,snapshots:image.snapshots,identity,evidence,originalEvidence,committed,publicMaster};
      }finally{idb.close();}
    });
  }
  // First-install migrations may need one separate seed pass. Contending
  // pages must load an already converged shared primary and never migrate it.
  let stable=false,seed=null;
  for(let i=0;i<3;i++){
    seed=await tab();
    const boot=await seed.evaluate(()=>window.__boot);
    if(boot.boot_persist_skipped){stable=true;break;}
    await seed.close();
  }
  assert.equal(stable,true,'G265_ABILITY_BOOTSTRAP_NOT_CONVERGED');
  // Disposable player fixture: retain all three ingredient and five subskill
  // original observations across native admission, stale rejection and reload.
  const seeded=await seed.evaluate(async()=>{
    const db=window.__db;
    const at='2026-11-21T21:06:00+08:00';
    db.run(`INSERT INTO pokemon(
      pokemon_id,pokemon_instance_id,species,current_species,status,
      identity_review_required,identity_confidence,level,specialty,type,sp,
      main_skill,main_skill_level,nature,helper_seconds,carry_limit,last_updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      'g265-ability-A','g265-ability-instance-A',
      'G265_SYNTHETIC_SPECIES','G265_SYNTHETIC_SPECIES','active',
      1,0.2,30,'ingredients','grass',100,'G265_SYNTHETIC_SKILL',1,
      'G265_SYNTHETIC_NATURE',2400,10,at,
    ]);
    for(const level of [1,30,60])db.run(
      'INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',
      ['g265-ability-A',level,'SYNTHETIC_INGREDIENT_'+level,2]
    );
    for(const level of [10,25,50,70,80])db.run(
      'INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',
      ['g265-ability-A',level,'SYNTHETIC_SUBSKILL_'+level,1]
    );
    await db.persist();
    return db.rows("SELECT identity_review_required FROM pokemon WHERE pokemon_id='g265-ability-A'")[0]?.identity_review_required;
  });
  assert.equal(seeded,1);
  const beforeSeed=await inspect(seed);
  assert.equal(beforeSeed.hash,beforeSeed.revision.sha256);
  assert.equal(beforeSeed.committed.identity,1);
  assert.equal(beforeSeed.committed.evidence,0);
  assert.equal(beforeSeed.committed.originalEvidence,8,'G265_SEED_ORIGINAL_PROVENANCE_EXACT_TWO');
  await seed.close();

  const writer=await tab(),stale=await tab();
  for(const page of [writer,stale])
    assert.equal((await page.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  const before=await inspect(writer),staleInitial=await inspect(stale);
  assert.equal(before.hash,staleInitial.hash);
  assert.deepEqual(before.revision,staleInitial.revision);
  assert.equal(before.identity,1);
  const accepted=await writer.evaluate(async()=>{
    const identity=await import('/assets/js/ability-evidence.js');
    return identity.completeIdentityEvidence();
  });
  assert.equal(accepted,1,'G265_PRODUCTION_CONVERGENCE_EXPECTS_EXACT_ONE_STRONG_CANDIDATE');
  const committed=await inspect(writer);
  assert.equal(committed.hash,committed.revision.sha256);
  assert.equal(committed.revision.generation,before.revision.generation+1);
  assert.equal(committed.snapshots,before.snapshots+1);
  assert.equal(committed.identity,0);
  assert.equal(committed.evidence,1);
  assert.equal(committed.committed.identity,0);
  assert.equal(committed.committed.evidence,1);
  assert.equal(committed.originalEvidence,8,'G265_ACK_MUST_PRESERVE_TWO_PLAYER_OBSERVATIONS');
  assert.equal(committed.committed.originalEvidence,8,'G265_DURABLE_MUST_PRESERVE_TWO_ORIGINAL_FACTS');
  assert.equal(committed.publicMaster,before.publicMaster);
  console.log('PASS G265_PRODUCTION_ABILITY_NATIVE_EXACT_LEASE_DURABLE_ACK_FLAG_AND_EVIDENCE');

  const denied=await stale.evaluate(async()=>{
    const identity=await import('/assets/js/ability-evidence.js');
    try{await identity.completeIdentityEvidence();return {ok:true};}
    catch(error){return {ok:false,code:error?.code||error?.message||String(error)};}
  });
  assert.equal(denied.ok,false,'G265_PRODUCTION_STALE_IDENTITY_MUST_DENY');
  assert.equal(denied.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  const staleAfter=await inspect(stale);
  assert.equal(staleAfter.identity,staleInitial.identity,'G265_STALE_TAB_ZERO_LOADED_SQL_MUTATION');
  assert.equal(staleAfter.evidence,staleInitial.evidence,'G265_STALE_TAB_ZERO_EVIDENCE_WRITE');
  assert.equal(staleAfter.originalEvidence,8,'G265_STALE_LOADED_ORIGINAL_EVIDENCE_UNTOUCHED');
  assert.deepEqual(staleAfter.revision,committed.revision);
  assert.equal(staleAfter.snapshots,committed.snapshots,'G265_STALE_TAB_ZERO_SNAPSHOT');
  const retry=await stale.evaluate(async()=>{
    const identity=await import('/assets/js/ability-evidence.js');
    try{await identity.completeIdentityEvidence();return {ok:true};}
    catch(error){return {ok:false,code:error?.code||error?.message||String(error)};}
  });
  assert.equal(retry.ok,false,'G265_STALE_IDENTITY_BLIND_RETRY_NOT_ALLOWED');
  assert.equal(retry.code,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  const afterRetry=await inspect(stale);
  assert.deepEqual(afterRetry.revision,committed.revision);
  assert.equal(afterRetry.snapshots,committed.snapshots);
  console.log('PASS G265_PRODUCTION_ABILITY_NATIVE_STALE_BEFORE_SQL_ZERO_SNAPSHOT_STICKY');

  const fresh=await tab(),reloaded=await inspect(fresh);
  assert.equal((await fresh.evaluate(()=>window.__boot)).boot_persist_skipped,true);
  assert.equal(reloaded.hash,committed.hash);
  assert.deepEqual(reloaded.revision,committed.revision);
  assert.equal(reloaded.identity,0);
  assert.equal(reloaded.evidence,1);
  assert.equal(reloaded.originalEvidence,8,'G265_FRESH_RELOAD_ORIGINAL_EVIDENCE_INTACT');
  assert.equal(reloaded.committed.originalEvidence,8,'G265_FRESH_DURABLE_ORIGINAL_FACTS');
  assert.equal(reloaded.publicMaster,committed.publicMaster);
  console.log('PASS G265_PRODUCTION_ABILITY_NATIVE_FRESH_RELOAD_PRESERVES_ONLY_ACK');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await context.close();
  await browser.close();
}
