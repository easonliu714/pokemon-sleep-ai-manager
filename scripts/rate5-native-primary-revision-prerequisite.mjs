// RATE.5 prerequisite: exercise the unchanged production primary-revision lease in
// real Chromium tabs against disposable IndexedDB + SQL.js. No Player/Raw/Apply.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE synthetic_rating(id TEXT PRIMARY KEY, grade TEXT)');
seed.run("INSERT INTO synthetic_rating VALUES('fixture','S-')");
const bytes=Array.from(seed.export());seed.close();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
try{
  await context.route('**/rate5-primary-revision-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>RATE5 disposable authority</title>'
  }));
  async function tab(){
    const page=await context.newPage();pages.push(page);
    await page.goto(new URL('rate5-primary-revision-disposable',base).href);
    await page.evaluate(async()=>{
      const storage=await import('/assets/js/storage.js');
      window.__rate5={storage,sqlEntered:0};
      await storage.loadDatabaseBytes();
    });
    return page;
  }
  const a=await tab();
  // Seed through the real production CAS API; the origin is disposable.
  await a.evaluate(value=>window.__rate5.storage.saveDatabaseBytes(Uint8Array.from(value)),bytes);
  const b=await tab(); // B freezes the old durable revision.
  // Chromium page.evaluate serializes ArrayBuffer as an empty object; inspect the
  // real production bytes INSIDE the browser realm before crossing Playwright.
  const old=await b.evaluate(async()=>{
    const raw=await window.__rate5.storage.loadDatabaseBytes();
    return {byteLength:raw?.byteLength??null};
  });
  assert.equal(old.byteLength,bytes.length);
  const newer=await a.evaluate(async seedBytes=>{
    const s=window.__rate5.storage;
    return s.withPrimarySqliteMutationLock(async lease=>{
      const next=await s.saveDatabaseBytes(Uint8Array.from(seedBytes),{primaryMutationLease:lease});
      return next;
    });
  },bytes).catch(error=>({error:error.message}));
  // Rebinding inside a lease is not a supported writer contract; test a fresh
  // A admission and persistence separately if the above path rejected.
  assert.ok(!newer.error,'production primary lease and durable ACK: '+JSON.stringify(newer));
  const stale=await b.evaluate(async()=>{
    try{
      await window.__rate5.storage.withPrimarySqliteMutationLock(async()=>{
        window.__rate5.sqlEntered++;
      });
      return 'UNEXPECTED_ADMITTED';
    }catch(error){return error.code||error.message;}
  });
  assert.equal(stale,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__rate5.sqlEntered),0);
  const sticky=await b.evaluate(async()=>{
    try{await window.__rate5.storage.withPrimarySqliteMutationLock(()=>{});return 'UNEXPECTED';}
    catch(error){return error.code||error.message;}
  });
  assert.equal(sticky,'SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
  const c=await tab();
  const durable=await c.evaluate(async()=>{
    const raw=await window.__rate5.storage.loadDatabaseBytes();
    return {length:raw.byteLength,bytes:Array.from(new Uint8Array(raw))};
  });
  assert.deepEqual(durable.bytes,bytes);
  assert.equal(durable.length,bytes.length);
  // RATE.5 source-bound boundary: real durable Primary Revision is readable,
  // but it MUST NOT be promoted to a rating confirmation token while the
  // independent Import/Restore/Observation revisions remain untrusted.
  const authorityBoundary=await c.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon-sleep-ai-manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const stores=Array.from(db.objectStoreNames);
    db.close();
    return {stores};
  });
  assert.ok(authorityBoundary.stores.length>0,'disposable native IndexedDB must exist');
  const failClosed=await c.evaluate(async()=>{
    const rating=await import('/assets/js/pokemon-rating-refresh-authority.js');
    return rating.capturePokemonRatingRefreshAuthority({
      // A real SQLite revision alone cannot attest the other three authorities.
      rule_version:'UNTRUSTED_UI_RULE',sqlite_generation:0,
      sqlite_sha256:'0'.repeat(64),pokemon:[],ingredients:[],subskills:[]
    });
  });
  assert.equal(failClosed.status,'HOLD_SOURCE_UNVERIFIED');
  assert.equal(failClosed.production_apply,false);
  assert.equal(failClosed.player_data_write,false);
  console.log('PASS_RATE5_NATIVE_UI_TO_DURABLE_AUTHORITY_MISSING_REVISIONS_HOLD');
  console.log('PASS_RATE5_REAL_STORAGE_NATIVE_CHROMIUM_STALE_DENY_STICKY_DURABLE_READBACK');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await browser.close();
}
