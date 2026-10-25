import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createSqliteWriteSessionCoordinator} from '../assets/js/sqlite-write-session-coordinator.js';
// Disposable SQL.js fixture executing BOTH actual runtime writer functions.
const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('assets/js/sqlite-write-session-runtime.js');
const goal=read('assets/js/strategy-goal-store.js');
const bonus=read('assets/js/weekly-manual-activity-bonuses.js');
assert.match(runtime,/const sharedWriteSession=createSqliteWriteSessionCoordinator/);
for(const source of [goal,bonus])assert.match(source,/import \{runSqliteWriteSession\} from '.\/sqlite-write-session-runtime.js'/);
const SQL=await initSqlJs(),db=new SQL.Database();
db.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
db.run('CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,profile_name TEXT,primary_goal TEXT,secondary_goals_json TEXT,weights_json TEXT,hard_constraints_json TEXT,profile_version TEXT,is_active INTEGER,created_at TEXT,updated_at TEXT)');
const rows=(sql,params=[])=>{const s=db.prepare(sql);try{s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());return out;}finally{s.free();}};
let release,firstHeld=false,durable=db.export(),saves=0;const events=[];
const gate=new Promise(resolve=>{release=resolve;});
const shared=createSqliteWriteSessionCoordinator({
  snapshot:async reason=>{events.push('snapshot');if(reason.startsWith('war-room:goal-profile:')&&!firstHeld){firstHeld=true;await gate;}},
  begin:()=>{events.push('begin');db.run('BEGIN IMMEDIATE');},
  commit:()=>{db.run('COMMIT');events.push('commit');},
  rollback:()=>{try{db.run('ROLLBACK');}catch{}},
  persist:async()=>{durable=db.export();saves++;events.push('persist');}
});
const scope={rows,run:(sql,params=[])=>db.run(sql,params),runSqliteWriteSession:x=>shared.execute(x),
  isRescueReadonly:()=>false,localIso:()=> '2026-10-25T10:00:00+08:00',
  normalizeStrategyGoalProfile:x=>x,strategyGoalProfileValidation:x=>({valid:true,normalized:x,errors:[],fingerprint:'fixture'}),
  STRATEGY_GOAL_PROFILE_VERSION:'fixture',window:{dispatchEvent:()=>{}},CustomEvent:class{},
  Promise,Error,Object,Number,Date,JSON,Math,Set};
const load=(source,name)=>{const ctx=vm.createContext({...scope});vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+'\n;globalThis.__entry='+name+';',ctx,{timeout:3000});return ctx.__entry;};
const saveGoal=load(goal,'saveStrategyGoalProfile'),saveBonus=load(bonus,'saveWeeklyManualActivityBonus');
const first=saveGoal({profile_name:'Fixture',primary_goal:'x',secondary_goals:[],weights:{},hard_constraints:{}},{goalProfileId:'g1'});
await new Promise(r=>setTimeout(r,0));
const second=saveBonus({weekStart:'2026-10-19',values:{pot_multiplier:2}});
await new Promise(r=>setTimeout(r,0));
assert.equal(rows('SELECT COUNT(*) AS n FROM strategy_goal_profile')[0].n,0);
assert.equal(rows('SELECT COUNT(*) AS n FROM settings')[0].n,0);
assert.deepEqual(events,['snapshot']);
release();await first;await second;
assert.deepEqual(events,['snapshot','begin','commit','persist','snapshot','begin','commit','persist']);
assert.equal(saves,2);
const reloaded=new SQL.Database(durable);
for(const table of ['strategy_goal_profile','settings']){const s=reloaded.prepare('SELECT COUNT(*) AS n FROM '+table);s.step();assert.equal(s.getAsObject().n,1);s.free();}
reloaded.close();
let attempted=0;
const fail=createSqliteWriteSessionCoordinator({snapshot:async()=>{},begin:()=>db.run('BEGIN IMMEDIATE'),
  commit:()=>db.run('COMMIT'),rollback:()=>{try{db.run('ROLLBACK');}catch{}},persist:async()=>{throw Error('synthetic IDB denied');}});
await assert.rejects(fail.execute({reason:'fail',mutate:()=>db.run("INSERT INTO settings VALUES('fail','{}','now')")}),e=>e.code==='SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(fail.execute({reason:'later',mutate:()=>{attempted++;}}),e=>e.code==='SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(attempted,0);db.close();
console.log('PASS G265_TWO_RUNTIME_WRITERS_SOURCE_BOUND_REAL_SQLITE_FIFO_RELOAD_FAIL_CLOSED');
console.log('HOLD G265_LEGACY_WRITERS_MULTI_TAB_ANDROID_UAT_NAMED_DRAFT_UI');
