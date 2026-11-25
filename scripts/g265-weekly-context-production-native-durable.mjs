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
// Capture the real initializeDatabase() result in its original renderer ACK;
// a second evaluate on two live renderers is not needed for this boot fact.
const bootReceipts=new WeakMap();
try{
  await context.route('**/g265-weekly-context-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><head><title>Disposable G265 weekly context</title></head><body><nav><button data-view="guide">Guide</button></nav><main></main></body></html>'
  }));
  async function tab(){
    // G265: pinpoint real Chromium page/bootstrap await before any native writer.
    console.log('G265_WEEKLY_PHASE_TAB_NEW_PAGE_BEGIN');
    const page=await context.newPage();pages.push(page);
    page.on('dialog',dialog=>dialog.dismiss());
    // Forward browser-side IDB phases so a cancelled CI identifies the first unresolved await.
    page.on('console',message=>{if(message.text().startsWith('G265_WEEKLY_IDB_PHASE_'))console.log(message.text());});
    console.log('G265_WEEKLY_PHASE_TAB_GOTO_BEGIN');
    await page.goto(new URL('g265-weekly-context-production-disposable',base).href);
    console.log('G265_WEEKLY_PHASE_TAB_GOTO_ACK');
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    console.log('G265_WEEKLY_PHASE_TAB_PRODUCTION_BOOT_BEGIN');
    const receipt=await page.evaluate(async()=>{
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
      // Preserve the actual G3 production weeklyForm submit callback. The
      // Current Week Authority bridge may later replace the form onsumbit;
      // that independent writer is not this named G265 admission Gate.
      window.__g265G3WeeklySubmit=document.getElementById('weeklyContextForm')?.onsubmit;
      if(typeof window.__g265G3WeeklySubmit!=='function')
        throw Error('G265_PRODUCTION_WEEKLY_FORM_NOT_INSTALLED');
      return window.__boot;
    });
    assert.equal(typeof receipt?.boot_persist_skipped,'boolean','G265_WEEKLY_BOOT_RECEIPT_MISSING');
    bootReceipts.set(page,Object.freeze(receipt));
    console.log('G265_WEEKLY_PHASE_TAB_PRODUCTION_BOOT_ACK');
    return page;
  }
  // The durable oracle must not execute inside a production writer/seed
  // renderer: that page owns SQL.js state, lifecycle listeners and background
  // tasks. Keep the native IDB transaction atomic, but observe it from an
  // independent UI-free page in the same disposable BrowserContext/origin.
  // Never reload a contender, retry a transaction, or substitute a mock.
  let durableProbe=null;
  async function getDurableProbe(){
    if(durableProbe)return durableProbe;
    const probe=await context.newPage();pages.push(probe);
    probe.on('console',message=>{if(message.text().startsWith('G265_WEEKLY_IDB_PHASE_'))console.log(message.text());});
    await probe.goto(new URL('g265-weekly-context-production-disposable',base).href);
    const identity=await probe.evaluate(()=>({origin:location.origin,productionBooted:typeof window.__db!=='undefined',indexedDB:typeof indexedDB!=='undefined'}));
    assert.equal(identity.origin,base.origin,'G265_WEEKLY_ORACLE_MUST_SHARE_EXACT_ORIGIN');
    assert.equal(identity.productionBooted,false,'G265_WEEKLY_ORACLE_MUST_NOT_BOOT_WRITER');
    assert.equal(identity.indexedDB,true,'G265_WEEKLY_ORACLE_NATIVE_IDB_REQUIRED');
    durableProbe=probe;
    return probe;
  }
  async function inspect(page){
    console.log('G265_WEEKLY_PHASE_INSPECT_BEGIN');
    // Preserve the actual contender's loaded (possibly stale) SQL image.
    // Do not replace it with the fresh durable oracle's image.
    await page.bringToFront();
    console.log('G265_WEEKLY_PHASE_INSPECT_FOREGROUND_ACK');
    const loaded=await page.evaluate(()=>({
      loaded:window.__db.rows('SELECT context_id,week_start,base_notes FROM weekly_context ORDER BY context_id'),
      publicEvents:window.__db.rows('SELECT COUNT(*) AS n FROM public_event_master')[0]?.n
    }));
    const probe=await getDurableProbe();
    console.log('G265_WEEKLY_PHASE_STORAGE_ORACLE_BEGIN');
    const durable=await probe.evaluate(async()=>{
      console.log('G265_WEEKLY_IDB_PHASE_OPEN_BEGIN');
      const idb=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('pokemon_sleep_ai_manager');
        request.onsuccess=()=>{console.log('G265_WEEKLY_IDB_PHASE_OPEN_ACK');resolve(request.result);};
        request.onblocked=()=>console.log('G265_WEEKLY_IDB_PHASE_OPEN_BLOCKED');
        request.onerror=()=>reject(request.error);
      });
      try{
        console.log('G265_WEEKLY_IDB_PHASE_TX_BEGIN');
        const v=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const raw=tx.objectStore('database').get('primary');
          const revision=tx.objectStore('metadata').get('revision:primary');
          const snapshots=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>{console.log('G265_WEEKLY_IDB_PHASE_TX_ACK');resolve({bytes:raw.result,revision:revision.result,snapshots:snapshots.result});};
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        if(!(v.bytes instanceof ArrayBuffer))throw Error('G265_WEEKLY_PRIMARY_BYTES_MISSING');
        const bytes=new Uint8Array(v.bytes);
        console.log('G265_WEEKLY_IDB_PHASE_DIGEST_BEGIN');
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        console.log('G265_WEEKLY_IDB_PHASE_DIGEST_ACK');
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        console.log('G265_WEEKLY_IDB_PHASE_SERIALIZE_BEGIN',bytes.length);
        return {revision:v.revision,hash,snapshots:v.snapshots,
          // Preserve exact raw IDB bytes without expensive per-byte Playwright JSON transfer.
          rawChunks:Array.from({length:Math.ceil(bytes.length/32768)},(_,i)=>{
            const part=bytes.subarray(i*32768,(i+1)*32768);
            let binary='';for(const b of part)binary+=String.fromCharCode(b);
            return btoa(binary);
          })};
      }finally{idb.close();}
    });
    // Preserve the same observation contract. Every byte, revision and count
    // comes from one native readonly IDB transaction; loaded SQL comes only
    // from the original live contender/freshly booted page.
    assert.equal(durable.hash,durable.revision?.sha256,'G265_WEEKLY_ORACLE_ATOMIC_PRIMARY_SHA');
    console.log('G265_WEEKLY_PHASE_STORAGE_ORACLE_ACK');
    console.log('G265_WEEKLY_PHASE_INSPECT_ACK');
    return {...durable,...loaded};
  }
  async function submit(page,week,notes){
    return page.evaluate(async({week,notes})=>{
      const form=document.getElementById('weeklyContextForm');
      // The real weekly-context authority intentionally disables week_start.
      // A disabled control is absent from FormData; never re-enable it or
      // bypass CURRENT_WEEK_EPOCH just to satisfy this disposable CAS fixture.
      const weekField=form.elements.namedItem('week_start');
      if(weekField.disabled&&weekField.dataset.authoritySource!=='CURRENT_WEEK_EPOCH')
        throw Error('G265_WEEKLY_UNEXPECTED_DISABLED_EPOCH_AUTHORITY');
      if(!weekField.disabled)weekField.value=week;
      form.elements.namedItem('base_notes').value=notes;
      const current=new FormData(form);
      const submittedWeek=weekField.disabled?null:week;
      if(current.get('week_start')!==submittedWeek||current.get('base_notes')!==notes)
        throw Error('G265_WEEKLY_FORM_SUBMITTED_VALUES_UNEXPECTED:'+JSON.stringify({requested:{week,notes},submitted:{week:current.get('week_start'),notes:current.get('base_notes')},epochDisabled:weekField.disabled,epochAuthority:weekField.dataset.authoritySource,keys:[...current.keys()]}));
      const beforeAlerts=window.__g265WeeklyAlerts.length;
      try{
        await window.__g265G3WeeklySubmit({preventDefault(){},target:form});
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
    console.log('G265_WEEKLY_PHASE_SEED_BEGIN',i);
    const seed=await tab();
    const boot=bootReceipts.get(seed);
    console.log('G265_WEEKLY_PHASE_SEED_PUBLIC_REFRESH_BEGIN',i);
    const refreshed=await seed.evaluate(async()=>{
      const m=await import('/assets/js/public-event-master-bootstrap.js');
      return m.refreshPublicEventMasterForCurrentWeek();
    });
    assert.ok(['UPDATED','UNCHANGED'].includes(refreshed.status),
      'G265_WEEKLY_SEED_PUBLIC_REFRESH_MISSING:'+JSON.stringify(refreshed));
    console.log('G265_WEEKLY_PHASE_SEED_PUBLIC_REFRESH_ACK',i,refreshed.status);
    const seeded=await inspect(seed);
    assert.equal(seeded.hash,seeded.revision?.sha256,'G265_WEEKLY_SEED_IDB_SHA');
    console.log('G265_WEEKLY_PHASE_SEED_INSPECT_ACK',i);
    await seed.close();
    console.log('G265_WEEKLY_PHASE_SEED_CLOSE_ACK',i);
    if(boot.boot_persist_skipped){stable=true;break;}
  }
  assert.equal(stable,true,'G265_WEEKLY_BOOT_NEVER_CONVERGED');

  console.log('G265_WEEKLY_PHASE_CONTENDERS_BEGIN');
  const writer=await tab(),stale=await tab();
  console.log('G265_WEEKLY_PHASE_CONTENDERS_BOOT_ACK');
  const boots=[writer,stale].map(p=>bootReceipts.get(p));
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
  const independent=new SQL.Database(Uint8Array.from(persisted.rawChunks.flatMap(chunk=>Array.from(Buffer.from(chunk,'base64')))));
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
  assert.deepEqual(held.rawChunks,persisted.rawChunks);
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
  // G265: completed weekly contenders are no longer witnesses. Close their
  // independent SQL.js/IDB tabs before the separate activity-bonus scenario;
  // retained timers must not interfere with the following native ACK-loss probe.
  await Promise.all([writer,stale,fresh].map(p=>p.close()));

  // G265 #861: the ACTUAL production weekly-activity-bonus writer uses the
  // shared runtime session. Reuse this disposable, converged IDB+SQL.js origin
  // to prove cross-tab native pre-SQL denial, exact durable revision, and
  // independent fresh reload. No Owner/player SQLite is ever involved.
  console.log('G265_BONUS_PHASE_OPEN_TWO_TABS');
  const bonusWriter=await tab(),bonusStale=await tab();
  // Native two-tab inspection is a distinct awaited phase. Keep both reads
  // separate so a cancelled CI identifies which real IndexedDB read stalled.
  console.log('G265_BONUS_PHASE_WRITER_INSPECT_BEGIN');
  const bonusInitial=await inspect(bonusWriter);
  console.log('G265_BONUS_PHASE_WRITER_INSPECT_ACK');
  console.log('G265_BONUS_PHASE_STALE_INSPECT_BEGIN');
  const bonusStaleInitial=await inspect(bonusStale);
  console.log('G265_BONUS_PHASE_STALE_INSPECT_ACK');
  assert.equal(bonusInitial.hash,bonusInitial.revision?.sha256,'G265_BONUS_INITIAL_PRIMARY_SHA');
  assert.equal(bonusStaleInitial.hash,bonusStaleInitial.revision?.sha256,'G265_BONUS_STALE_INITIAL_SHA');
  assert.equal(bonusInitial.revision.generation,bonusStaleInitial.revision.generation,
    'G265_BONUS_TWO_TABS_MUST_BIND_SAME_DURABLE_REVISION');
  const bonusWeek='2026-11-09';
  async function savedBonus(page){
    return page.evaluate(week=>window.__db.rows(
      'SELECT value_json FROM settings WHERE key=?',['weekly_activity_bonus:'+week])[0]?.value_json??null,
      bonusWeek);
  }
  assert.equal(await savedBonus(bonusWriter),null,'G265_BONUS_BEFORE_WRITE_MUST_BE_ABSENT');
  assert.equal(await savedBonus(bonusStale),null,'G265_BONUS_STALE_BEFORE_WRITE_MUST_BE_ABSENT');
  console.log('G265_BONUS_PHASE_BEFORE_NATIVE_WRITER_ACK');
  const bonusAck=await bonusWriter.evaluate(async week=>{
    const api=await import('/assets/js/weekly-manual-activity-bonuses.js');
    return api.saveWeeklyManualActivityBonus({weekStart:week,values:{pot_multiplier:2}});
  },bonusWeek);
  assert.equal(bonusAck.source,'PLAYER_EXPLICIT_MANUAL_WEEKLY_OBSERVATION');
  const bonusDurable=await inspect(bonusWriter);
  assert.equal(bonusDurable.hash,bonusDurable.revision.sha256,'G265_BONUS_NATIVE_ACK_SHA');
  assert.equal(bonusDurable.revision.generation,bonusInitial.revision.generation+1,
    'G265_BONUS_ONE_NATIVE_ACK_ONE_GENERATION');
  assert.equal(bonusDurable.snapshots,bonusInitial.snapshots+1,'G265_BONUS_ONE_ACK_SNAPSHOT');
  const bonusStored=JSON.parse(await savedBonus(bonusWriter));
  assert.equal(bonusStored.values.pot_multiplier,2,'G265_BONUS_WRITER_SQL_DATA');
  assert.equal(bonusStored.source,'PLAYER_EXPLICIT_MANUAL_WEEKLY_OBSERVATION');
  const staleBonus=await bonusStale.evaluate(async week=>{
    const api=await import('/assets/js/weekly-manual-activity-bonuses.js');
    try{
      await api.saveWeeklyManualActivityBonus({weekStart:week,values:{pot_multiplier:3}});
      return {ok:true};
    }catch(error){return {ok:false,code:error?.code||error?.message||String(error)};}
  },bonusWeek);
  assert.equal(staleBonus.ok,false,'G265_BONUS_STALE_NATIVE_ADMISSION_MUST_DENY');
  assert.equal(staleBonus.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'G265_BONUS_STALE_PRE_SQL_NATIVE_CODE:'+JSON.stringify(staleBonus));
  assert.equal(await savedBonus(bonusStale),null,
    'G265_BONUS_STALE_LOADED_IMAGE_MUST_REMAIN_UNMUTATED_BEFORE_SQL');
  const deniedBonusDurable=await inspect(bonusStale);
  assert.deepEqual(deniedBonusDurable.revision,bonusDurable.revision,
    'G265_BONUS_STALE_MUST_NOT_ADVANCE_DURABLE_REVISION');
  assert.equal(deniedBonusDurable.hash,bonusDurable.hash,'G265_BONUS_STALE_NO_OVERWRITE_SHA');
  assert.equal(deniedBonusDurable.snapshots,bonusDurable.snapshots,
    'G265_BONUS_STALE_ZERO_SNAPSHOT');
  const blindRetry=await bonusStale.evaluate(async week=>{
    const api=await import('/assets/js/weekly-manual-activity-bonuses.js');
    try{await api.saveWeeklyManualActivityBonus({weekStart:week,values:{pot_multiplier:4}});
      return {ok:true};}
    catch(error){return {ok:false,code:error?.code||error?.message||String(error)};}
  },bonusWeek);
  assert.equal(blindRetry.ok,false,'G265_BONUS_STICKY_NO_BLIND_RETRY');
  assert.ok(['SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED',
    'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'].includes(blindRetry.code),
    'G265_BONUS_STICKY_RETRY_CODE:'+blindRetry.code);
  const afterRetryBonus=await inspect(bonusStale);
  assert.deepEqual(afterRetryBonus.revision,bonusDurable.revision,
    'G265_BONUS_BLIND_RETRY_MUST_NOT_ADVANCE_IDB');
  assert.equal(afterRetryBonus.snapshots,bonusDurable.snapshots);
  const bonusFresh=await tab();
  const freshBonusDurable=await inspect(bonusFresh);
  assert.equal(freshBonusDurable.hash,bonusDurable.hash,'G265_BONUS_FRESH_RELOAD_SHA');
  assert.deepEqual(freshBonusDurable.revision,bonusDurable.revision,
    'G265_BONUS_FRESH_RELOAD_EXACT_REVISION');
  assert.equal(freshBonusDurable.snapshots,bonusDurable.snapshots,
    'G265_BONUS_FRESH_RELOAD_NO_DUPLICATE_SNAPSHOT');
  assert.equal(JSON.parse(await savedBonus(bonusFresh)).values.pot_multiplier,2,
    'G265_BONUS_FRESH_RELOAD_PRESERVES_ACK_ONLY');
  // All positive/stale bonus assertions above already passed with two LIVE tabs.
  // Release these now-unused pages before an independent post-COMMIT ACK-loss
  // scenario. A closed tab cannot accidentally participate in a later check.
  await Promise.all([bonusWriter,bonusStale,bonusFresh].map(p=>p.close()));
  // G265 #861 successor: real native transaction COMMIT with the application's
  // IDB oncomplete ACK intentionally dropped for the actual shared-session
  // weekly activity bonus writer (NOT bootstrap Migration or Node VM).
  // Preserve the genuine IDB transaction/Web Lock; only its application ACK
  // callback is replaced after native completion on this disposable tab.
  console.log('G265_BONUS_PHASE_BEFORE_ACK_LOSS_TAB_BOOT');
  const bonusAckLostPage=await tab();
  const bonusBeforeLostAck=await inspect(bonusAckLostPage);
  assert.equal(bonusBeforeLostAck.hash,bonusDurable.hash,'G265_BONUS_ACK_DROP_SEED_SHA');
  assert.deepEqual(bonusBeforeLostAck.revision,bonusDurable.revision,
    'G265_BONUS_ACK_DROP_SEED_REVISION');
  console.log('G265_BONUS_PHASE_BEFORE_ACK_LOSS_INSTRUMENTATION');
  await bonusAckLostPage.evaluate(()=>{
    window.__g265BonusLostAckObserved=false;
    window.__g265BonusAckLossNativeCompleteCount=0;
    const nativeTransaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args){
      const tx=nativeTransaction.apply(this,args);
      const stores=typeof args[0]==='string'?[args[0]]:Array.from(args[0]);
      if(args[1]==='readwrite'&&stores.includes('database')&&!window.__g265BonusLostAckObserved){
        // Keep real IDB durable COMMIT. Do not deliver a synthetic success ACK.
        // Trigger the actual application's error callback only after complete.
        Object.defineProperty(tx,'oncomplete',{
          configurable:true,
          set(callback){
            if(typeof callback!=='function')throw Error('G265_BONUS_ACK_DROP_CALLBACK_MISSING');
            tx.addEventListener('complete',()=>{
              window.__g265BonusLostAckObserved=true;
              window.__g265BonusAckLossNativeCompleteCount++;
              // A completed native transaction has no failure state. Its
              // `error` getter may throw InvalidStateError after COMMIT; the
              // production error handler reads tx.error before rejecting the
              // pending application ACK Promise. Supply only a null error
              // value on this disposable completed transaction, then invoke
              // the actual production error handler (never a success ACK).
              Object.defineProperty(tx,'error',{configurable:true,value:null});
              if(typeof tx.onerror!=='function')
                throw Error('G265_BONUS_ACK_DROP_ERROR_HANDLER_MISSING');
              // Deliver the lost application ACK as a transaction error event
              // after the real native COMMIT, through EventTarget dispatch.
              // Calling the onerror property directly bypasses the browser's
              // event dispatch semantics and can leave the awaiting session
              // unresolved when the completed transaction is being dispatched.
              queueMicrotask(()=>{
                const delivered=tx.dispatchEvent(new Event('error'));
                if(!delivered)throw Error('G265_BONUS_ACK_DROP_ERROR_EVENT_CANCELLED');
              });
            },{once:true});
          },get(){return null;}
        });
      }
      return tx;
    };
  });
  console.log('G265_BONUS_PHASE_BEFORE_POSTCOMMIT_APPLICATION_ACK_LOSS');
  const unknownAck=await bonusAckLostPage.evaluate(async week=>{
    const api=await import('/assets/js/weekly-manual-activity-bonuses.js');
    try{
      await api.saveWeeklyManualActivityBonus({weekStart:week,values:{pot_multiplier:5}});
      return {ok:true,observed:window.__g265BonusLostAckObserved,
        nativeCompleteCount:window.__g265BonusAckLossNativeCompleteCount};
    }catch(error){
      return {ok:false,code:error?.code||error?.message||String(error),
        observed:window.__g265BonusLostAckObserved,
        nativeCompleteCount:window.__g265BonusAckLossNativeCompleteCount};
    }
  },bonusWeek);
  console.log('G265_BONUS_PHASE_AFTER_POSTCOMMIT_APPLICATION_ACK_LOSS');
  assert.equal(unknownAck.nativeCompleteCount,1,'G265_BONUS_ACK_DROP_EXACTLY_ONE_NATIVE_COMPLETE');
  assert.equal(unknownAck.observed,true,'G265_BONUS_ACK_DROP_REAL_IDB_COMMIT_NOT_REACHED');
  assert.equal(unknownAck.ok,false,'G265_BONUS_ACK_DROP_MUST_NOT_REPORT_SUCCESS');
  assert.equal(unknownAck.code,'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED',
    'G265_BONUS_ACK_DROP_MUST_QUARANTINE_PAGE:'+JSON.stringify(unknownAck));
  // An ACK-lost page cannot serve as the durable authority. A brand-new
  // Chromium tab must bootstrap from genuine primary IndexedDB and prove the
  // committed SHA/revision/snapshot independently of all pre-ACK pages.
  const ackDurabilityReader=await tab();
  const ackReaderBoot=bootReceipts.get(ackDurabilityReader);
  assert.equal(ackReaderBoot.boot_persist_skipped,true,
    'G265_BONUS_ACK_DROP_FRESH_READER_MUST_NOT_WRITE_ON_BOOT');
  const committedWithoutAck=await inspect(ackDurabilityReader);
  assert.equal(committedWithoutAck.hash,committedWithoutAck.revision.sha256,
    'G265_BONUS_ACK_DROP_ATOMIC_PRIMARY_SHA');
  assert.equal(committedWithoutAck.revision.generation,bonusBeforeLostAck.revision.generation+1,
    'G265_BONUS_ACK_DROP_EXACTLY_ONE_DURABLE_COMMIT');
  assert.equal(committedWithoutAck.snapshots,bonusBeforeLostAck.snapshots+1,
    'G265_BONUS_ACK_DROP_EXACTLY_ONE_SNAPSHOT');
  const independentlyCommitted=new SQL.Database(Uint8Array.from(committedWithoutAck.rawChunks.flatMap(chunk=>Array.from(Buffer.from(chunk,'base64')))));
  try{
    const durableJson=independentlyCommitted.exec(
      "SELECT value_json FROM settings WHERE key='weekly_activity_bonus:2026-11-09'"
    )[0]?.values[0][0];
    assert.equal(JSON.parse(durableJson).values.pot_multiplier,5,
      'G265_BONUS_ACK_DROP_COMMITTED_OBSERVATION_NOT_ROLLED_BACK');
  }finally{independentlyCommitted.close();}
  // A failed page still holds the already COMMITTED in-memory SQL image.
  // Rejecting the next save must not even mutate its loaded SQL.js state,
  // independently of the atomic IndexedDB no-overwrite assertion below.
  const loadedAfterUnknownAck=JSON.parse(await savedBonus(bonusAckLostPage));
  assert.equal(loadedAfterUnknownAck.values.pot_multiplier,5,
    'G265_BONUS_ACK_DROP_COMMITTED_IN_MEMORY_VALUE');
  const deniedAckRetry=await bonusAckLostPage.evaluate(async week=>{
    const api=await import('/assets/js/weekly-manual-activity-bonuses.js');
    try{
      await api.saveWeeklyManualActivityBonus({weekStart:week,values:{pot_multiplier:6}});
      return {ok:true};
    }catch(error){return {ok:false,code:error?.code||error?.message||String(error)};}
  },bonusWeek);
  assert.equal(deniedAckRetry.ok,false,'G265_BONUS_ACK_DROP_MUST_DENY_SAME_PAGE_RETRY');
  assert.deepEqual(JSON.parse(await savedBonus(bonusAckLostPage)),loadedAfterUnknownAck,
    'G265_BONUS_ACK_DROP_RETRY_MUST_NOT_MUTATE_LOADED_SQL_IMAGE');
  assert.ok(['SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED',
    'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'].includes(deniedAckRetry.code),
    'G265_BONUS_ACK_DROP_RETRY_HOLD_CODE:'+JSON.stringify(deniedAckRetry));
  const afterLostAckRetry=await inspect(ackDurabilityReader);
  assert.deepEqual(afterLostAckRetry.revision,committedWithoutAck.revision,
    'G265_BONUS_ACK_DROP_RETRY_MUST_NOT_ADVANCE_DURABLE_REVISION');
  assert.equal(afterLostAckRetry.hash,committedWithoutAck.hash,
    'G265_BONUS_ACK_DROP_RETRY_MUST_NOT_REWRITE_BYTES');
  assert.equal(afterLostAckRetry.snapshots,committedWithoutAck.snapshots,
    'G265_BONUS_ACK_DROP_RETRY_MUST_NOT_CREATE_SNAPSHOT');
  const recoveredBonus=await tab();
  const recoveredDurable=await inspect(recoveredBonus);
  assert.equal(recoveredDurable.hash,committedWithoutAck.hash,
    'G265_BONUS_ACK_DROP_FRESH_RELOAD_EXACT_COMMITTED_SHA');
  assert.deepEqual(recoveredDurable.revision,committedWithoutAck.revision,
    'G265_BONUS_ACK_DROP_FRESH_RELOAD_NO_DUPLICATE_COMMIT');
  assert.equal(recoveredDurable.snapshots,committedWithoutAck.snapshots);
  assert.equal(JSON.parse(await savedBonus(recoveredBonus)).values.pot_multiplier,5,
    'G265_BONUS_ACK_DROP_FRESH_RELOAD_PRESERVES_COMMITTED_PLAYER_OBSERVATION');
  console.log('PASS G265_PRODUCTION_WEEKLY_ACTIVITY_BONUS_NATIVE_POSTCOMMIT_LOST_ACK_STICKY_NO_RETRY_SHA_REVISION_FRESH_RELOAD');

  console.log('PASS G265_PRODUCTION_WEEKLY_ACTIVITY_BONUS_NATIVE_TWO_TAB_STALE_ZERO_SQL_SHA_REVISION_ACK_STICKY_FRESH_RELOAD');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await browser.close();
}
