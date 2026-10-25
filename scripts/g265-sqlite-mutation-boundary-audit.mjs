import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

// G265: source-bound boundary audit. This is a NEGATIVE proof of missing
// transaction-wide coordination, not a fix or an Android device UAT.
const read=path=>fs.readFileSync(path,'utf8');
const database=read('assets/js/database.js');
const coordinator=read('assets/js/sqlite-persist-coordinator.js');
const directGuard=read('assets/js/sqlite-direct-write-window-guard.js');
const draft=read('assets/js/war-room-named-team-draft-store.js');
const goal=read('assets/js/strategy-goal-store.js');
const feedback=read('assets/js/recipe-attempt-feedback-local.js');
const importer=read('assets/js/importer.js');
assert.match(database,/sqlitePersistCoordinator\.persist\(\)/);
assert.match(database,/export function run\(sql,params=\[\]\)\{[^\n]*db\.run\(sql,params\)/);
assert.match(database,/export function begin\(\)\{run\('BEGIN IMMEDIATE'\);\}/);
assert.match(database,/export function commit\(\)\{run\('COMMIT'\);\}/);
assert.match(database,/export async function snapshot\(reason\)/);
assert.match(draft,/await snapshot\('war-room:named-team-draft:'/);
assert.match(draft,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
assert.match(goal,/runSqliteWriteSession\(/,'goal writer migrated to opt-in session');
assert.match(goal,/runSqliteWriteSession\(/,'goal write-session now owns persist boundary');
assert.match(feedback,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
assert.match(importer,/await snapshot\(/);
assert.match(importer,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
const directImport=/from\s*['"]\.\/database\.js['"]/;
const callsite=/\b(?:run|begin|commit|persist|snapshot)\s*\(/;
const writerModules=fs.readdirSync('assets/js').filter(n=>n.endsWith('.js'))
  .filter(n=>{const s=read('assets/js/'+n);return directImport.test(s)&&callsite.test(s);});
for(const required of ['war-room-named-team-draft-store.js','strategy-goal-store.js',
  'recipe-attempt-feedback-local.js','importer.js'])
  assert.ok(writerModules.includes(required),'missing writer source: '+required);
assert.ok(writerModules.length>=10,'writer inventory unexpectedly small');

// Execute the actual database.js BEGIN/run/COMMIT/snapshot functions with
// an isolated SQL.js database, never the owner's IndexedDB or SQLite bytes.
const SQL=await initSqlJs();
const fixture=new SQL.Database();
fixture.run('CREATE TABLE audit_boundary(id TEXT PRIMARY KEY, owner TEXT NOT NULL)');
let releaseSnapshot;
const snapshotWait=new Promise(resolve=>{releaseSnapshot=resolve;});
const ctx=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout,
  console,fixture,createSnapshot:()=>snapshotWait,saveDatabaseBytes:async()=>{}});
vm.runInContext(coordinator.replace(/^export /gm,''),ctx,{timeout:3000});
// Actual database.js now imports the pure guard; keep this historic negative in an unguarded window.
vm.runInContext(directGuard.replace(/^export /gm,''),ctx,{timeout:3000});
vm.runInContext(database.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
vm.runInContext('db=fixture;rescueReadonly=false;',ctx);
ctx.begin();
ctx.run("INSERT INTO audit_boundary VALUES('writer-A','first')");
assert.throws(()=>ctx.begin(),/within a transaction|cannot start a transaction/i,
  'second writer has no queued transaction acquisition');
ctx.run("INSERT INTO audit_boundary VALUES('writer-B','interleaved')");
ctx.commit();
assert.equal(ctx.scalar('SELECT COUNT(*) FROM audit_boundary'),2,
  'independent module run() entered first writer transaction');
const pending=ctx.snapshot('g265-isolated-boundary-audit');
ctx.run("INSERT INTO audit_boundary VALUES('writer-C','during-snapshot-await')");
assert.equal(ctx.scalar("SELECT COUNT(*) FROM audit_boundary WHERE id='writer-C'"),1,
  'SQL mutation is not held while async snapshot remains unresolved');
releaseSnapshot({status:'synthetic-snapshot-completed'});
await pending;
fixture.close();
console.log('PASS G265_SQLITE_MUTATION_BOUNDARY_SOURCE_BOUND_WRITER_INVENTORY='+writerModules.length);
console.log('REPRODUCED_HOLD G265_SAME_CONNECTION_TRANSACTION_INTERLEAVING_AND_SNAPSHOT_AWAIT');
console.log('HOLD G265_ALL_WRITER_TRANSACTION_COORDINATION_MULTI_TAB_ANDROID_UAT_NOT_VERIFIED');
