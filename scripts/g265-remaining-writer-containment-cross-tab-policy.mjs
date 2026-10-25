import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createSqlitePersistCoordinator} from '../assets/js/sqlite-persist-coordinator.js';
import {createSqliteWriteSessionCoordinator} from '../assets/js/sqlite-write-session-coordinator.js';

// G265: preserve exact source-bound inventory while proving same-page direct
// database.run() cannot interleave an opt-in snapshot or uncertain durable save.
// NOT a cross-tab lock or proof that all non-run() SQL entrypoints are guarded.
const read=p=>fs.readFileSync(p,'utf8');
const database=read('assets/js/database.js');
const runtime=read('assets/js/sqlite-write-session-runtime.js');
const guard=read('assets/js/sqlite-direct-write-window-guard.js');
const directImport=/from\s*['"]\.\/database\.js['"]/;
const callsite=/\b(?:run|begin|commit|persist|snapshot)\s*\(/;
const writerModules=fs.readdirSync('assets/js').filter(n=>n.endsWith('.js'))
  .filter(n=>{const s=read('assets/js/'+n);return directImport.test(s)&&callsite.test(s);}).sort();
assert.equal(writerModules.length,25,'direct-writer inventory drift: audit each changed module');
const opted=writerModules.filter(n=>{
  const s=read('assets/js/'+n);
  return /import\s*\{\s*runSqliteWriteSession\s*\}\s*from\s*['"]\.\/sqlite-write-session-runtime\.js['"]/.test(s)
    && /\brunSqliteWriteSession\s*\(/.test(s);
}).sort();
assert.deepEqual(opted,['strategy-goal-store.js','weekly-manual-activity-bonuses.js']);
assert.equal(writerModules.length-opted.length,23);
for(const required of ['war-room-named-team-draft-store.js','recipe-attempt-feedback-local.js','importer.js'])
  assert.ok(writerModules.includes(required)&&!opted.includes(required));
assert.doesNotMatch(runtime,/navigator\.locks|BroadcastChannel/,'cross-tab policy changed; independent audit required');
assert.match(database,/assertSqliteDirectWriteAllowed\(\);db\.run\(sql,params\)/);
assert.match(runtime,/beginSqliteWriteWindow\(\)/);

const SQL=await initSqlJs(),fixture=new SQL.Database();
fixture.run('CREATE TABLE g265_containment(id TEXT PRIMARY KEY, owner TEXT NOT NULL)');
let releaseSnapshot,durable=null,denySave=false;
const snapshotGate=new Promise(resolve=>{releaseSnapshot=resolve;});
const ctx=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout,console,
  fixture,createSqlitePersistCoordinator,createSqliteWriteSessionCoordinator,
  createSnapshot:()=>snapshotGate,
  saveDatabaseBytes:async bytes=>{if(denySave)throw Error('synthetic IDB rejection');durable=new Uint8Array(bytes);}
});
vm.runInContext(guard.replace(/^export /gm,''),ctx,{timeout:3000});
vm.runInContext(database.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
vm.runInContext('db=fixture;rescueReadonly=false;',ctx,{timeout:3000});
vm.runInContext(runtime.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
const participating=ctx.runSqliteWriteSession({reason:'g265:opt-in-snapshot-held',
  mutate:()=>ctx.run("INSERT INTO g265_containment VALUES('session','opt-in')")});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(ctx.getSqliteWriteSessionStatus().status,'IN_FLIGHT');
assert.equal(ctx.getSqliteDirectWriteGuardStatus().status,'IN_FLIGHT');
assert.throws(()=>ctx.run("INSERT INTO g265_containment VALUES('legacy','unsafe')"),
  e=>e.code==='SQLITE_LEGACY_DIRECT_WRITE_BLOCKED_DURING_SESSION');
assert.equal(ctx.scalar("SELECT COUNT(*) FROM g265_containment WHERE id='legacy'"),0);
releaseSnapshot({status:'synthetic-snapshot'});
assert.equal((await participating).status,'PERSISTED');
assert.equal(ctx.getSqliteDirectWriteGuardStatus().status,'READY');
let reloaded=new SQL.Database(durable);
assert.equal(reloaded.exec('SELECT COUNT(*) FROM g265_containment')[0].values[0][0],1);reloaded.close();
// Legitimate legacy run() remains operational after an acknowledged session.
ctx.run("INSERT INTO g265_containment VALUES('legacy','safe-after-ack')");
await ctx.persist();
reloaded=new SQL.Database(durable);
assert.equal(reloaded.exec('SELECT COUNT(*) FROM g265_containment')[0].values[0][0],2);reloaded.close();
// Uncertain durable outcome sticks to same-page direct writes until full reload.
denySave=true;
await assert.rejects(ctx.runSqliteWriteSession({reason:'g265:IDB-denial',
  mutate:()=>ctx.run("INSERT INTO g265_containment VALUES('unverified','inside')")}),
  e=>e.code==='SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(ctx.getSqliteDirectWriteGuardStatus().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.throws(()=>ctx.run("INSERT INTO g265_containment VALUES('later','blocked')"),
  e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
fixture.close();
console.log('PASS G265_DIRECT_WRITER_INVENTORY_25_OPTIN_2_LEGACY_23_SOURCE_BOUND');
console.log('PASS G265_SAME_PAGE_LEGACY_DIRECT_RUN_BLOCKED_DURING_OPTIN_SNAPSHOT');
console.log('PASS G265_SAME_PAGE_LEGACY_RUN_STICKY_HOLD_ON_IDB_DENIAL');
console.log('HOLD G265_ALL_WRITER_DIRECT_SQL_CROSS_TAB_ANDROID_UAT_NOT_VERIFIED');
