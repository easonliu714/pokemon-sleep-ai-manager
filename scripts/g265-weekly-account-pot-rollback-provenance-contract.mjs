// G265 account-pot/fallback SQL rollback provenance, source-bound negative-first.
// Disposable SQL.js only. Native Chromium lease/CAS is NOT claimed by this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
const start=source.indexOf('async function saveAccountPotCapacity(');
const end=source.indexOf('function emitEntityChanged(',start);
assert.ok(start>=0&&end>start,'exact current production account-pot writers required');
const functions=source.slice(start,end);
const SQL=await initSqlJs();
function fixture({fallback=false,rollbackFails=false,sqlFails=false}={}){
  const db=new SQL.Database();
  db.run('CREATE TABLE account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER,source TEXT)');
  db.run('CREATE TABLE weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT)');
  if(sqlFails)db.run("CREATE TRIGGER fail_pot BEFORE INSERT ON account_capacity BEGIN SELECT RAISE(ABORT,'POT_SQL_ABORT'); END");
  const signals={snapshots:0,persists:0,rollbacks:0,windows:[],commits:0};
  const current={week_start:'2026-11-16',authority_revision:'r1',authority_context_id:'c1',pot_size:20,field_sources:{pot_size:'IMPORTED'}};
  const ctx={
    currentWeeklyContext:()=>fallback?{week_start:'2026-11-16'}:current,
    hasImportedAuthority:c=>!fallback&&c===current,
    beginSqliteExclusiveWriteWindow:()=>opts=>signals.windows.push(opts),
    withPrimarySqliteMutationLock:async fn=>fn({lease:'disposable'}),
    withSqliteCoordinatedMutation:fn=>fn(),
    typedValue:(key,v)=>v,
    snapshot:async()=>{signals.snapshots++;},
    begin:()=>db.run('BEGIN IMMEDIATE'),
    commit:()=>{db.run('COMMIT');signals.commits++;},
    rollback:()=>{signals.rollbacks++;if(rollbackFails)throw new Error('ROLLBACK_IO_FAILURE');db.run('ROLLBACK');},
    writeAccountPotCapacity:(v,s)=>db.run('INSERT INTO account_capacity VALUES(?,?,?)',['pot',v,s]),
    persist:async()=>{signals.persists++;},
    validateManualForm:()=>{},
    q:()=>({value:'demo'}),
    formBerryObservation:()=>[],
    resolveCampFavoriteBerries:()=>({berries:[]}),
    localWeekStart:()=> '2026-11-16',
    localIso:()=> '2026-11-16T00:00:00Z',
    Error,String,Number,JSON,
  };
  const {saveAccountPotCapacity,saveFallback}=vm.runInNewContext(functions+';({saveAccountPotCapacity,saveFallback})',ctx);
  return {db,signals,current,saveAccountPotCapacity,saveFallback};
}
test('account pot: SQL abort with successful ROLLBACK preserves original SQL error',async()=>{
  const f=fixture({sqlFails:true});
  await assert.rejects(f.saveAccountPotCapacity({needsAccountWrite:true,changed:true,source:'MANUAL_WEEKLY_CONTEXT_UI',value:25},f.current),/POT_SQL_ABORT/);
  assert.equal(f.signals.rollbacks,1);assert.equal(f.signals.commits,0);
  assert.equal(f.signals.persists,0);assert.equal(f.signals.windows.at(-1).uncertainOutcome,true);
  f.db.close();
});
test('account pot: failed ROLLBACK must explicitly quarantine unverified SQL state',async()=>{
  const f=fixture({sqlFails:true,rollbackFails:true});
  await assert.rejects(f.saveAccountPotCapacity({needsAccountWrite:true,changed:true,source:'MANUAL_WEEKLY_CONTEXT_UI',value:25},f.current),e=>e?.code==='ACCOUNT_POT_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'&&e?.cause?.message==='ROLLBACK_IO_FAILURE','G265_ACCOUNT_POT_ROLLBACK_FAILURE_MUST_BE_EXPLICIT_STICKY_HOLD');
  assert.equal(f.signals.rollbacks,1);assert.equal(f.signals.persists,0);
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,true);
  f.db.close();
});
test('manual fallback: failed ROLLBACK must explicitly quarantine unverified SQL state',async()=>{
  const f=fixture({fallback:true,sqlFails:true,rollbackFails:true});
  await assert.rejects(f.saveFallback({}, {week_start:'2026-11-16'}, {needsAccountWrite:true,value:25,source:'MANUAL_WEEKLY_CONTEXT_UI'}),e=>e?.code==='WEEKLY_FALLBACK_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'&&e?.cause?.message==='ROLLBACK_IO_FAILURE','G265_WEEKLY_FALLBACK_ROLLBACK_FAILURE_MUST_BE_EXPLICIT_STICKY_HOLD');
  assert.equal(f.signals.rollbacks,1);assert.equal(f.signals.persists,0);
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,true);
  f.db.close();
});
