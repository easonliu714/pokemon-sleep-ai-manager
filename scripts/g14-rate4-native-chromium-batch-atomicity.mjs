// G14.RATE.4: real native Chromium two-tab Web Locks, SQL.js/WASM and
// disposable IndexedDB only. This test never visits or imports the PWA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
assert.doesNotMatch(fs.readFileSync('assets/js/app.js','utf8'),
  /sqlite-pokemon-rating-durable-optin/);
const SQL=await initSqlJs(),seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT NOT NULL,rating TEXT,level INTEGER,status TEXT NOT NULL)');
for(const [id,rating] of [['A','D-'],['B','C'],['C','B'],['D','D'],['E','C-'],['F','B-']])
  seedDb.run('INSERT INTO pokemon VALUES(?,?,?,?,?)',
    ['fixture-'+id,'instance-'+id,rating,20,'active']);
seedDb.run('CREATE TABLE g14_rate4_fixture_authority(marker TEXT PRIMARY KEY)');
seedDb.run("INSERT INTO g14_rate4_fixture_authority VALUES('G14_RATE4_DISPOSABLE_SQLITE_ONLY')");
seedDb.run('CREATE TABLE g14_rate4_rating_audit(batch_id TEXT,pokemon_id TEXT,pokemon_instance_id TEXT,previous_rating TEXT,proposed_rating TEXT,rule_version TEXT,before_sha256 TEXT,consent_digest TEXT,applied_at TEXT,level INTEGER,PRIMARY KEY(batch_id,pokemon_id))');
seedDb.run("CREATE TRIGGER g14_native_late_failure BEFORE INSERT ON g14_rate4_rating_audit WHEN NEW.batch_id='rate_native_failure001' AND NEW.pokemon_id='fixture-D' BEGIN SELECT RAISE(ABORT,'synthetic-late-record-denial'); END");
seedDb.run('CREATE TABLE public_event_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('master','UNCHANGED')");
const seed=Array.from(seedDb.export());seedDb.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=hash(seed),primary='g14-rate4-native-disposable-'+Date.now();
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g14-rate4-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><title>RATE4 disposable native batch</title>'
  }));
  await context.route('**/g14-rate4-native-sqljs.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g14-rate4-native-sqljs.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const pages=[await context.newPage(),await context.newPage()];
  for(const page of pages){
    await page.goto(new URL('g14-rate4-native-blank',base).href);
    await page.addScriptTag({url:new URL('g14-rate4-native-sqljs.js',base).href});
    await page.evaluate(async primary=>{
      const SQL=await window.initSqlJs({locateFile:()=>'/g14-rate4-native-sqljs.wasm'});
      const {createSqliteVersionNeutralAtomicPairGate}=await import(
        '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
      const {createDisposableEvaluationEscrowStore}=await import(
        '/assets/js/sqlite-evaluation-pretransaction-escrow-optin.js');
      const {createPokemonRatingDurableOptIn}=await import(
        '/assets/js/sqlite-pokemon-rating-durable-optin.js');
      const {POKEMON_PROVISIONAL_RATING_RULE_VERSION:rule}=await import(
        '/assets/js/pokemon-provisional-rating.js');
      const open=()=>new Promise((resolve,reject)=>{
        const request=indexedDB.open(primary,1);
        request.onupgradeneeded=()=>{
          request.result.createObjectStore('database');
          request.result.createObjectStore('metadata');
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      const db=await open();
      const pair=()=>createSqliteVersionNeutralAtomicPairGate({db});
      const grade={A:['D-','S+'],B:['C','A+'],C:['B','A'],D:['D','B+'],
        E:['C-','S-'],F:['B-','A-']};
      const row=id=>({
        pokemon_id:'fixture-'+id,pokemon_instance_id:'instance-'+id,
        previous_rating:grade[id][0],proposed_rating:grade[id][1],
        status:'PROVISIONAL_HEURISTIC',changed:true,rule_version:rule,
        level:20,species:'synthetic species',nickname:'fixture-'+id,
        current_evidence:[{source:'synthetic',name:'verified',scope:'CURRENT'}],
        future_evidence:[],score_breakdown:[],reason_codes:[],missing_inputs:[]
      });
      const preview={status:'PREVIEW_ONLY',plan:{rule_version:rule},
        rows:Object.keys(grade).map(row),player_data_write:false,overwrite_allowed:false};
      const input=(letters,revision,batchId,view=preview)=>{
        const selectedPokemonIds=letters.map(id=>'fixture-'+id);
        return {preview:view,freshView:view,selectedPokemonIds,
          confirmation:{explicit_user_action:true,intent:'APPLY_SELECTED_RATINGS',
            rule_version:rule,acknowledged_diff_count:letters.length,
            selectedPokemonIds:[...selectedPokemonIds]},
          expectedGeneration:revision.generation,
          expectedFingerprint:revision.sha256,batchId,
          appliedAt:'2026-11-07T00:00:00.000Z'};
      };
      const state={SQL,db,pair,preview,input,waiting:false,releaseWrite:null};
      state.make=(tag,options={})=>{
        const gate=pair();
        const store=createDisposableEvaluationEscrowStore({
          indexedDB,name:'g265-evaluation-escrow-disposable-rate4native-'+tag
        });
        const wrapped={
          readVerified:()=>gate.readVerified(),
          write:async request=>{
            if(options.barrier){
              state.waiting=true;
              await new Promise(resolve=>{state.releaseWrite=resolve;});
            }
            const outcome=await gate.write(request);
            if(options.ackLoss)
              throw Object.assign(new Error('synthetic ACK lost'),
                {code:'G14_RATE4_NATIVE_SYNTHETIC_ACK_LOSS'});
            return outcome;
          },
          status:()=>gate.status()
        };
        return {store,writer:createPokemonRatingDurableOptIn({
          pairGate:wrapped,openSqlite:bytes=>new SQL.Database(bytes),
          snapshotStore:store
        })};
      };
      state.read=async()=>{
        const verified=await pair().readVerified();
        const sql=new SQL.Database(verified.bytes);
        try{
          return {generation:verified.generation,sha256:verified.sha256,
            ratings:sql.exec('SELECT pokemon_id,rating FROM pokemon ORDER BY pokemon_id')[0].values,
            audits:sql.exec('SELECT batch_id,pokemon_id,previous_rating,proposed_rating,before_sha256,consent_digest FROM g14_rate4_rating_audit ORDER BY batch_id,pokemon_id')?.[0]?.values||[],
            master:sql.exec("SELECT value FROM public_event_master WHERE id='master'")[0].values[0][0]};
        }finally{sql.close();}
      };
      window.__rate4=state;
    },primary);
    assert.equal(await page.evaluate(()=>typeof navigator.locks?.request==='function'),true);
    assert.equal(await page.evaluate(()=>!!crypto.subtle?.digest),true);
  }
  await pages[0].evaluate(async ({seed,seedHash})=>{
    const db=window.__rate4.db;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['database','metadata'],'readwrite');
      tx.objectStore('database').put(Uint8Array.from(seed).buffer,'primary');
      tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  },{seed,seedHash});
  const before=await pages[0].evaluate(()=>window.__rate4.read());
  assert.equal(before.generation,0);assert.equal(before.sha256,seedHash);
  // A real two-record SQL.js transaction: the second audit insert fails.
  const failed=await pages[0].evaluate(async rev=>{
    const r=window.__rate4,session=r.make('latefailure');
    try{await session.writer.execute(r.input(['C','D'],rev,'rate_native_failure001'));
      return {code:'UNEXPECTED_PASS'};}
    catch(error){const snapshot=await session.store.read();
      return {code:error.code||error.message,
        status:session.writer.status().status,
        snapshot:{generation:snapshot.generation,sha256:snapshot.sha256,
          bytes:Array.from(new Uint8Array(snapshot.bytes))}};}
  },before);
  assert.notEqual(failed.code,'UNEXPECTED_PASS');
  assert.equal(failed.status,'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(failed.snapshot.sha256,seedHash);
  assert.equal(hash(new Uint8Array(failed.snapshot.bytes)),seedHash);
  const afterFailure=await pages[1].evaluate(()=>window.__rate4.read());
  assert.deepEqual(afterFailure,before,'late second-record failure must rollback entire batch');
  console.log('PASS G14_RATE4_NATIVE_BATCH_LATE_RECORD_ROLLBACK_NO_DURABLE_DELTA');

  const succeeded=await pages[0].evaluate(async rev=>{
    const r=window.__rate4,session=r.make('batchsuccess');
    const result=await session.writer.execute(r.input(['A','B'],rev,'rate_native_success001'));
    const snapshot=await session.store.read();
    return {result,snapshot:{generation:snapshot.generation,
      sha256:snapshot.sha256,bytes:Array.from(new Uint8Array(snapshot.bytes))}};
  },before);
  assert.equal(succeeded.result.status,'ISOLATED_PERSISTED');
  assert.equal(succeeded.result.recordCount,2);
  assert.equal(succeeded.result.productionApply,false);
  assert.equal(succeeded.snapshot.generation,0);
  assert.equal(succeeded.snapshot.sha256,seedHash);
  assert.equal(hash(new Uint8Array(succeeded.snapshot.bytes)),seedHash);
  const afterSuccess=await pages[1].evaluate(()=>window.__rate4.read());
  assert.equal(afterSuccess.generation,1);
  assert.deepEqual(afterSuccess.ratings.slice(0,2),
    [['fixture-A','S+'],['fixture-B','A+']]);
  assert.equal(afterSuccess.audits.length,2);
  assert.deepEqual(afterSuccess.audits.map(x=>x.slice(0,4)),
    [['rate_native_success001','fixture-A','D-','S+'],
     ['rate_native_success001','fixture-B','C','A+']]);
  assert.ok(afterSuccess.audits.every(x=>x[4]===seedHash&&/^[0-9a-f]{64}$/.test(x[5])));
  assert.equal(afterSuccess.master,'UNCHANGED');
  console.log('PASS G14_RATE4_NATIVE_TWO_RECORD_ATOMIC_SUCCESS_SNAPSHOT_AUDIT_RELOAD');

  // Evidence changed between the original preview and the independent fresh
  // projection: reject before taking any snapshot or acquiring a writer lock.
  const evidence=await pages[0].evaluate(async rev=>{
    const r=window.__rate4,session=r.make('evidencedrift');
    const request=r.input(['C'],rev,'rate_native_evidence001');
    request.freshView={...r.preview,rows:r.preview.rows.map(row=>
      row.pokemon_id==='fixture-C'?{...row,current_evidence:[
        ...row.current_evidence,{source:'synthetic',name:'changed',scope:'CURRENT'}
      ]}:row)};
    try{await session.writer.execute(request);return {code:'UNEXPECTED_PASS'};}
    catch(error){return {code:error.code||error.message,
      status:session.writer.status().status};}
  },afterSuccess);
  assert.deepEqual(evidence,{code:'G14_RATE4_PREAPPLY_REJECTED',status:'READY'});
  assert.deepEqual(await pages[1].evaluate(()=>window.__rate4.read()),afterSuccess);
  console.log('PASS G14_RATE4_NATIVE_STALE_EVIDENCE_PREFLIGHT_NO_WRITE');

  // Stale instance and level are rejected against the latest durable rows.
  for(const [tag,id,change] of [
    ['identity','C',{pokemon_instance_id:'instance-C-wrong'}],
    ['level','D',{level:21}]
  ]){
    const result=await pages[0].evaluate(async ({rev,tag,id,change})=>{
      const r=window.__rate4,session=r.make('stale'+tag);
      const view={...r.preview,rows:r.preview.rows.map(row=>
        row.pokemon_id==='fixture-'+id?{...row,...change}:row)};
      try{await session.writer.execute(r.input([id],rev,'rate_native_stale_'+tag+'001',view));
        return {code:'UNEXPECTED_PASS'};}
      catch(error){return {code:error.code||error.message,
        status:session.writer.status().status};}
    },{rev:afterSuccess,tag,id,change});
    assert.equal(result.code,'G14_RATE4_DURABLE_RECORD_STALE');
    assert.equal(result.status,'UNVERIFIED_RELOAD_REQUIRED');
    assert.deepEqual(await pages[1].evaluate(()=>window.__rate4.read()),afterSuccess);
  }
  console.log('PASS G14_RATE4_NATIVE_STALE_INSTANCE_LEVEL_NO_WRITE');

  // Both tabs independently finish immutable snapshots before either native
  // Web Lock is requested. Native lock + CAS must yield exactly one winner.
  const races=pages.map((page,index)=>page.evaluate(async ({rev,index})=>{
    const r=window.__rate4;
    const session=r.make('race'+index,{barrier:true});
    r.raceSession=session;
    try{
      const result=await session.writer.execute(r.input(['C','D'],rev,
        'rate_native_race_batch'+index));
      return {ok:true,result};
    }catch(error){return {ok:false,code:error.code||error.message,
      status:session.writer.status().status};}
  },{rev:afterSuccess,index:pages.indexOf(page)}));
  for(const page of pages)await page.waitForFunction(
    ()=>window.__rate4.waiting===true,null,{timeout:15000});
  for(const page of pages)await page.evaluate(()=>window.__rate4.releaseWrite());
  const raceResults=await Promise.all(races);
  assert.equal(raceResults.filter(x=>x.ok).length,1);
  assert.equal(raceResults.filter(x=>x.code==='G265_PAIR_STALE_RELOAD_REQUIRED').length,1);
  const snapshots=await Promise.all(pages.map(page=>page.evaluate(async()=>{
    const s=await window.__rate4.raceSession.store.read();
    return {generation:s.generation,sha256:s.sha256,bytes:Array.from(new Uint8Array(s.bytes))};
  })));
  for(const snapshot of snapshots){
    assert.equal(snapshot.generation,1);
    assert.equal(snapshot.sha256,afterSuccess.sha256);
    assert.equal(hash(snapshot.bytes),afterSuccess.sha256);
  }
  const afterRace=await pages[1].evaluate(()=>window.__rate4.read());
  assert.equal(afterRace.generation,2);
  assert.deepEqual(afterRace.ratings.slice(2,4),
    [['fixture-C','A'],['fixture-D','B+']]);
  assert.equal(afterRace.audits.length,4);
  assert.equal(afterRace.master,'UNCHANGED');
  console.log('PASS G14_RATE4_NATIVE_TWO_TAB_WEB_LOCK_CAS_ONE_WINNER_BATCH');

  // Deliberate ACK-loss AFTER a genuine atomic pair commit: sticky HOLD, no
  // retry/restore and a separately readable immutable pretransaction image.
  const lost=await pages[0].evaluate(async rev=>{
    const r=window.__rate4,session=r.make('ackloss',{ackLoss:true});
    const input=r.input(['E','F'],rev,'rate_native_ackloss001');
    let code;
    try{await session.writer.execute(input);code='UNEXPECTED_PASS';}
    catch(error){code=error.code||error.message;}
    const snapshot=await session.store.read();
    let retry;
    try{await session.writer.execute(input);retry='UNEXPECTED_PASS';}
    catch(error){retry=error.code||error.message;}
    let restore;
    try{await session.writer.restore();restore='UNEXPECTED_PASS';}
    catch(error){restore=error.code||error.message;}
    return {code,retry,restore,status:session.writer.status().status,
      snapshot:{generation:snapshot.generation,sha256:snapshot.sha256,
        bytes:Array.from(new Uint8Array(snapshot.bytes))}};
  },afterRace);
  assert.equal(lost.code,'G14_RATE4_NATIVE_SYNTHETIC_ACK_LOSS');
  assert.equal(lost.status,'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(lost.retry,'G14_RATE4_UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(lost.restore,'G14_RATE4_RESTORE_BLOCKED_PRODUCTION_WRITERS_UNADMITTED');
  assert.equal(lost.snapshot.generation,2);
  assert.equal(lost.snapshot.sha256,afterRace.sha256);
  assert.equal(hash(lost.snapshot.bytes),afterRace.sha256);
  const afterLoss=await pages[1].evaluate(()=>window.__rate4.read());
  assert.equal(afterLoss.generation,3);
  assert.deepEqual(afterLoss.ratings.slice(4,6),
    [['fixture-E','S-'],['fixture-F','A-']]);
  assert.equal(afterLoss.audits.length,6);
  assert.equal(afterLoss.master,'UNCHANGED');
  console.log('PASS G14_RATE4_NATIVE_BATCH_ACK_LOSS_STICKY_HOLD_SNAPSHOT_PRESERVED');
  console.log('HOLD G14_RATE4_PRODUCTION_23_LEGACY_WRITERS_UNADMITTED_ANDROID_OWNER_UAT');
  for(const page of pages)await page.evaluate(()=>window.__rate4.db.close());
}finally{
  await context.close();
  await browser.close();
}
