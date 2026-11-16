// G265 #861 real production restore admission — Native Chromium, two isolated tabs.
// Disposable fresh origin/SQLite/IndexedDB only. No player or Public Master edits.
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
  await context.route('**/g265-replace-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable replace</title>'
  }));
  async function tab(){
    const page=await context.newPage();pages.push(page);
    await page.goto(new URL('g265-replace-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const bootstrap=window.initSqlJs;
      if(typeof bootstrap!=='function')throw Error('G265_SQLJS_BROWSER_RUNTIME_MISSING');
      // Production database.js accepts a locateFile option; redirect WASM to the
      // fixture origin rather than external CDN, without changing production.
      window.initSqlJs=()=>bootstrap({locateFile:file=>'/node_modules/sql.js/dist/'+file});
      window.__g265Database=await import('/assets/js/database.js');
      await window.__g265Database.initializeDatabase();
    });
    return page;
  }
  const first=await tab();
  const raw=await first.evaluate(()=>Array.from(window.__g265Database.exportBytes()));
  assert.ok(raw.length>0,'G265_INIT_MUST_CREATE_DISPOSABLE_PRIMARY');
  const stale=await tab(); // Bound to first's old primary generation.
  const staleStart=await stale.evaluate(()=>window.__g265Database.rows(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='g265_replace_fixture'").length);
  assert.equal(staleStart,0);
  const candidate=new SQL.Database(Uint8Array.from(raw));
  candidate.run('CREATE TABLE g265_replace_fixture(id TEXT PRIMARY KEY, value TEXT)');
  candidate.run("INSERT INTO g265_replace_fixture VALUES('stable','new-primary')");
  const candidateBytes=Array.from(candidate.export());candidate.close();

  // Actual production replaceDatabase invokes native pre-SQL admission,
  // migrates isolated candidate, and writes exact-lease raw+revision atomically.
  const accepted=await first.evaluate(async bytes=>{
    await window.__g265Database.replaceDatabase(Uint8Array.from(bytes));
    return window.__g265Database.rows("SELECT value FROM g265_replace_fixture WHERE id='stable'")[0]?.value;
  },candidateBytes);
  assert.equal(accepted,'new-primary','G265_REPLACE_PRIMARY_ACK_AND_NEW_MEMORY');
  const b=await stale.evaluate(async bytes=>{
    try{await window.__g265Database.replaceDatabase(Uint8Array.from(bytes));
      return {code:'UNEXPECTED_ALLOWED'};}
    catch(error){
      return {code:error.code||error.message,
        liveTableCount:window.__g265Database.rows(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='g265_replace_fixture'").length};
    }
  },candidateBytes);
  assert.equal(b.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(b.liveTableCount,0,'G265_STALE_DENIAL_PRESERVES_LIVE_MEMORY');
  const deniedDirect=await stale.evaluate(()=>{
    try{window.__g265Database.run('CREATE TABLE g265_unsafe_after_stale(id TEXT)');return 'UNEXPECTED_ALLOWED';}
    catch(error){return error.code||error.message;}
  });
  assert.equal(deniedDirect,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');

  // Fresh independent tab must read the newer durable revision and schema.
  const fresh=await tab();
  const readback=await fresh.evaluate(()=>window.__g265Database.rows(
    "SELECT value FROM g265_replace_fixture WHERE id='stable'")[0]?.value);
  assert.equal(readback,'new-primary','G265_NEW_TAB_DURABLE_RESTORE_READBACK');

  // A corrupt candidate must NOT close the already-open loaded image or alter
  // the persisted primary. A failed native session is a sticky page HOLD.
  const corrupt=await fresh.evaluate(async()=>{
    let rejected=false;
    try{await window.__g265Database.replaceDatabase(Uint8Array.from([1,255,3,4,5,6,7]));}
    catch{rejected=true;}
    const value=window.__g265Database.rows(
      "SELECT value FROM g265_replace_fixture WHERE id='stable'")[0]?.value;
    return {rejected,value};
  });
  assert.equal(corrupt.rejected,true,'G265_CORRUPT_CANDIDATE_MUST_REJECT');
  assert.equal(corrupt.value,'new-primary','G265_CORRUPT_RESTORE_MUST_KEEP_OLD_IN_MEMORY');
  const final=await tab();
  assert.equal(await final.evaluate(()=>window.__g265Database.rows(
    "SELECT value FROM g265_replace_fixture WHERE id='stable'")[0]?.value),'new-primary');
  console.log('PASS_G265_ACTUAL_REPLACE_DATABASE_NATIVE_CHROMIUM_STALE_INVALID_AND_DURABLE_READBACK');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await browser.close();
}
