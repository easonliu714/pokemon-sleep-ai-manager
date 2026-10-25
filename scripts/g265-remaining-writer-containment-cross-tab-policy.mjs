import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createSqlitePersistCoordinator} from '../assets/js/sqlite-persist-coordinator.js';
import {createSqliteWriteSessionCoordinator} from '../assets/js/sqlite-write-session-coordinator.js';

// G265: enforce the audited direct-writer inventory and reproduce an actual
// legacy database.run() bypass while the opt-in write session awaits snapshot.
// This is a NEGATIVE gate; it must never be called all-writer or multi-tab safety.
const read=p=>fs.readFileSync(p,'utf8');
const database=read('assets/js/database.js');
const runtime=read('assets/js/sqlite-write-session-runtime.js');
const directImport=/from\s*['"]\.\/database\.js['"]/;
const callsite=/\b(?:run|begin|commit|persist|snapshot)\s*\(/;
const writerModules=fs.readdirSync('assets/js').filter(n=>n.endsWith('.js'))
  .filter(n=>{const s=read('assets/js/'+n);return directImport.test(s)&&callsite.test(s);})
  .sort();
assert.equal(writerModules.length,25,'direct-writer inventory drift: audit every added/removed writer');
const opted=writerModules.filter(n=>{
  const s=read('assets/js/'+n);
  return /import\s*\{\s*runSqliteWriteSession\s*\}\s*from\s*['"]\.\/sqlite-write-session-runtime\.js['"]/.test(s)
    && /\brunSqliteWriteSession\s*\(/.test(s);
}).sort();
assert.deepEqual(opted,['strategy-goal-store.js','weekly-manual-activity-bonuses.js']);
for(const required of ['war-room-named-team-draft-store.js','recipe-attempt-feedback-local.js','importer.js'])
  assert.ok(writerModules.includes(required)&&!opted.includes(required),'critical legacy writer classification drift: '+required);
assert.equal(writerModules.length-opted.length,23);
assert.match(runtime,/const sharedWriteSession=createSqliteWriteSessionCoordinator/);
assert.doesNotMatch(runtime,/navigator\.locks|BroadcastChannel/,'cross-tab policy changed: independently audit before accepting');

// Execute actual production database.js run/snapshot/persist with a disposable
// SQL.js fixture. Hold the opt-in session's snapshot, then prove a legacy
// direct writer can mutate the same connection without acquiring that session.
const SQL=await initSqlJs();
const fixture=new SQL.Database();
fixture.run('CREATE TABLE g265_containment(id TEXT PRIMARY KEY, owner TEXT NOT NULL)');
let releaseSnapshot,durable=null;
const snapshotGate=new Promise(resolve=>{releaseSnapshot=resolve;});
const ctx=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout,console,
  fixture,createSqlitePersistCoordinator,
  createSnapshot:()=>snapshotGate,
  saveDatabaseBytes:async bytes=>{durable=new Uint8Array(bytes);}
});
vm.runInContext(database.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
vm.runInContext('db=fixture;rescueReadonly=false;',ctx,{timeout:3000});
const shared=createSqliteWriteSessionCoordinator({
  snapshot:reason=>ctx.snapshot(reason),begin:()=>ctx.begin(),commit:()=>ctx.commit(),
  rollback:()=>ctx.rollback(),persist:()=>ctx.persist(),timeoutMs:5000
});
const participating=shared.execute({reason:'g265:opt-in-snapshot-held',
  mutate:()=>ctx.run("INSERT INTO g265_containment VALUES('session','opt-in')")});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(shared.status().status,'IN_FLIGHT');
ctx.run("INSERT INTO g265_containment VALUES('legacy','direct-during-snapshot')");
assert.equal(ctx.scalar("SELECT COUNT(*) FROM g265_containment WHERE id='legacy'"),1,
  'legacy run unexpectedly blocked: inspect runtime containment before updating gate');
releaseSnapshot({status:'synthetic-snapshot'});
const ack=await participating;
assert.equal(ack.status,'PERSISTED');
assert.ok(durable?.byteLength>0);
const reloaded=new SQL.Database(durable);
const s=reloaded.prepare('SELECT COUNT(*) AS n FROM g265_containment');s.step();
assert.equal(s.getAsObject().n,2);s.free();reloaded.close();fixture.close();
console.log('PASS G265_DIRECT_WRITER_INVENTORY_25_OPTIN_2_LEGACY_23_SOURCE_BOUND');
console.log('REPRODUCED_HOLD G265_LEGACY_DATABASE_RUN_BYPASSES_OPTIN_SNAPSHOT_SESSION');
console.log('HOLD G265_ALL_WRITER_CONTAINMENT_CROSS_TAB_ANDROID_UAT_NOT_VERIFIED');
