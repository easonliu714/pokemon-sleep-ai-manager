// G265 #861: execute the exact production setupG3Pages handler in a disposable
// native Chromium page with real SQL.js; deny cross-tab admission before SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(source.split(marker).length,2,'exactly one production setupG3Pages');
const production=source.slice(source.indexOf(marker)).replace(/^export /,'');
assert.match(production,/collectionAddForm'\)\.onsubmit/);
assert.match(production,/INSERT OR REPLACE INTO collection_targets/);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  const holder=await context.newPage(),writer=await context.newPage();
  for(const page of [holder,writer]){
    await page.goto('http://127.0.0.1:4173/');
    await page.addScriptTag({path:'node_modules/sql.js/dist/sql-wasm.js'});
  }
  await holder.evaluate(()=>{window.__hold=new Promise(resolve=>{
    navigator.locks.request('pokemon-sleep-g265-collection-production-test',{mode:'exclusive'},async()=>{window.__release=resolve;await new Promise(r=>window.__unlock=r);});
  });return true;});
  await holder.waitForFunction(()=>typeof window.__unlock==='function');
  const observed=await writer.evaluate(async productionCode=>{
    const SQL=await window.initSqlJs({locateFile:()=>'/node_modules/sql.js/dist/sql-wasm.wasm'});
    const db=new SQL.Database();
    db.run('CREATE TABLE collection_targets(target_id TEXT PRIMARY KEY,species TEXT,target_type TEXT,priority TEXT,camp TEXT,desired_traits TEXT,capture_strategy TEXT,status TEXT,notes TEXT,updated_at TEXT)');
    const calls={snapshot:0,sql:0,persist:0,lease:0};
    const form={onsubmit:null};
    const documentStub={getElementById:id=>id==='collectionAddForm'?form:null};
    const snapshot=async()=>{calls.snapshot++};
    const run=(sql,params)=>{calls.sql++;db.run(sql,params)};
    const persist=async()=>{calls.persist++};
    const rows=()=>[];
    const now=()=>new Date().toISOString();
    const ensureUi=()=>{},weeklyForm=()=>{},warroomForm=()=>{},renderCollection=()=>{},installStrategyRefreshListeners=()=>{};
    const FormDataStub=class{constructor(){this.values={species:'SYNTHETIC_DENIED',target_type:'observe'};}get(k){return this.values[k]||'';}};
    const document=documentStub,FormData=FormDataStub;
    const alert=()=>{};
    // Native lock is intentionally held by another Chromium tab. The
    // production handler must request admission before snapshot/SQL.
    const nativeAdmission=async()=>{calls.lease++;return navigator.locks.request('pokemon-sleep-g265-collection-production-test',{ifAvailable:true},lock=>Boolean(lock));};
    new Function('document','FormData','snapshot','run','persist','rows','now','ensureUi','weeklyForm','warroomForm','renderCollection','installStrategyRefreshListeners','alert','nativeAdmission',productionCode+';return setupG3Pages;')(
      document,FormData,snapshot,run,persist,rows,now,ensureUi,weeklyForm,warroomForm,renderCollection,installStrategyRefreshListeners,alert,nativeAdmission
    )();
    try{await form.onsubmit({preventDefault(){},target:{reset(){}}});}
    catch(error){calls.error=String(error.message||error);}
    calls.durableRows=db.exec('SELECT COUNT(*) FROM collection_targets')[0].values[0][0];
    db.close();
    return calls;
  },production);
  console.log('G265_PRODUCTION_HANDLER_NATIVE_DENIAL_OBSERVED',JSON.stringify(observed));
  assert.equal(observed.lease,1,'G265_COLLECTION_PRODUCTION_MUST_REQUEST_NATIVE_PRE_SQL_ADMISSION');
  assert.equal(observed.snapshot,0,'G265_DENIED_MUST_NOT_SNAPSHOT');
  assert.equal(observed.sql,0,'G265_DENIED_MUST_NOT_RUN_SQL');
  assert.equal(observed.persist,0,'G265_DENIED_MUST_NOT_PERSIST');
  assert.equal(observed.durableRows,0,'G265_DENIED_MUST_NOT_MUTATE_DISPOSABLE_SQLITE');
  console.log('PASS G265_COLLECTION_PRODUCTION_NATIVE_DENIAL_ZERO_EFFECT');
}finally{await context.close();await browser.close();}
