// G265 #861 negative-first: after an actual SQL.js COMMIT, a failed durable
// persist must preserve the original ACK error. ROLLBACK after COMMIT is invalid.
// Source-bound exact production functions; disposable in-memory SQLite only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const full=readFileSync('assets/js/weekly-context-manual-override.js','utf8');
const begin=full.indexOf('export async function saveWeeklyManualOverride(');
const clear=full.indexOf('export async function clearWeeklyManualOverride(');
assert.ok(begin>=0&&clear>begin,'G265 exact production function source required');
const bodies=full.slice(begin).replace(/^export /gm,'');
const SQL=await initSqlJs();

function fixture({failAck=false,failSql=false}={}){
  const db=new SQL.Database();
  db.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
  if(failSql){
    db.run("CREATE TRIGGER no_override BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT,'SYNTHETIC_SQL_ABORT'); END");
  }
  const signals={begins:0,commits:0,rollbacks:0,snapshots:0,persists:0,windows:[]};
  const expected=Object.assign(new Error('synthetic postcommit durable ACK lost'),{code:'SYNTHETIC_POSTCOMMIT_ACK_LOSS'});
  const run=(sql,params=[])=>db.run(sql,params);
  const key=epoch=>'weekly_context_manual_override:'+epoch;
  const rows=(sql,params=[])=>{
    const stmt=db.prepare(sql);const out=[];
    try{stmt.bind(params);while(stmt.step())out.push(stmt.getAsObject());}
    finally{stmt.free();}
    return out;
  };
  const ctx={
    WEEKLY_MANUAL_OVERRIDE_SCHEMA:'weekly-context-manual-override/1.0',
    WEEKLY_MANUAL_OVERRIDE_VERSION:'weekly-manual-override-2026-08-11-b-data-preservation',
    settingKey:key,cleanFields:fields=>({...fields}),
    localIso:()=> '2026-11-16T12:00:00.000Z',
    withPrimarySqliteMutationLock:async cb=>cb(Object.freeze({lease:'disposable'})),
    beginSqliteExclusiveWriteWindow:()=>options=>signals.windows.push(options),
    withSqliteCoordinatedMutation:callback=>callback(),
    snapshot:async()=>{signals.snapshots++;},
    begin:()=>{signals.begins++;db.run('BEGIN IMMEDIATE');},
    commit:()=>{db.run('COMMIT');signals.commits++;},
    rollback:()=>{signals.rollbacks++;db.run('ROLLBACK');},
    run,rows,
    persist:async options=>{
      assert.ok(options?.primaryMutationLease,'exact native lease must be handed to persist');
      signals.persists++;
      if(failAck)throw expected;
    },
    readWeeklyManualOverride:epoch=>rows('SELECT value_json FROM settings WHERE key=?',[key(epoch)]).length?{fields:{camp:'demo'}}:null,
    Object,JSON,String,Error
  };
  const exported=vm.runInNewContext(bodies+'\n;({saveWeeklyManualOverride,clearWeeklyManualOverride})',ctx);
  return {db,signals,expected,...exported};
}
const input={weekStart:'2026-11-16',basedOnImportRevision:'IMPORTED-REV-1',fields:{camp:'demo'}};

test('baseline: both source-bound writers retain successful acknowledged behavior',async()=>{
  const f=fixture();
  const saved=await f.saveWeeklyManualOverride(input);
  assert.equal(saved.week_start,input.weekStart);
  assert.equal(f.signals.commits,1);
  assert.equal(f.signals.rollbacks,0);
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,false);
  assert.equal(await f.clearWeeklyManualOverride(input.weekStart),true);
  assert.equal(f.signals.commits,2);
  assert.equal(f.signals.rollbacks,0);
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,false);
  f.db.close();
});

test('weekly save: lost durable ACK after real COMMIT must preserve original error',async()=>{
  const f=fixture({failAck:true});
  await assert.rejects(f.saveWeeklyManualOverride(input),e=>
    e?.code==='SYNTHETIC_POSTCOMMIT_ACK_LOSS',
    'G265_WEEKLY_SAVE_POSTCOMMIT_ROLLBACK_MUST_NOT_MASK_ACK_LOSS');
  assert.equal(f.signals.commits,1);
  assert.equal(f.signals.rollbacks,0,'no ROLLBACK is valid after COMMIT');
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,true);
  assert.equal(f.db.exec('SELECT COUNT(*) FROM settings')[0].values[0][0],1);
  f.db.close();
});

test('weekly clear: lost durable ACK after real COMMIT must preserve original error',async()=>{
  const f=fixture();
  await f.saveWeeklyManualOverride(input);
  f.signals.windows.length=0;
  // Swap to an ACK failure after the setup write is already committed.
  // The source callback resolves persist via its closure; configure a dedicated fixture instead.
  f.db.close();
  const g=fixture({failAck:true});
  g.db.run("INSERT INTO settings VALUES('weekly_context_manual_override:2026-11-16','{}','2026-11-16')");
  await assert.rejects(g.clearWeeklyManualOverride(input.weekStart),e=>
    e?.code==='SYNTHETIC_POSTCOMMIT_ACK_LOSS',
    'G265_WEEKLY_CLEAR_POSTCOMMIT_ROLLBACK_MUST_NOT_MASK_ACK_LOSS');
  assert.equal(g.signals.commits,1);
  assert.equal(g.signals.rollbacks,0,'no ROLLBACK is valid after COMMIT');
  assert.equal(g.signals.windows.at(-1).uncertainOutcome,true);
  assert.equal(g.db.exec('SELECT COUNT(*) FROM settings')[0].values[0][0],0);
  g.db.close();
});

test('pre-COMMIT SQL failure still rolls back and preserves original source error',async()=>{
  const f=fixture({failSql:true});
  await assert.rejects(f.saveWeeklyManualOverride(input),/SYNTHETIC_SQL_ABORT/);
  assert.equal(f.signals.commits,0);
  assert.equal(f.signals.rollbacks,1,'an active transaction still needs rollback');
  assert.equal(f.signals.windows.at(-1).uncertainOutcome,true);
  assert.equal(f.db.exec('SELECT COUNT(*) FROM settings')[0].values[0][0],0);
  f.db.close();
});
