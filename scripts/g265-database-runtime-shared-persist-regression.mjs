import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// G265 actual database.persist() VM replay; synthetic bytes and mocked IDB only.
const dbSource=fs.readFileSync('assets/js/database.js','utf8');
const coordSource=fs.readFileSync('assets/js/sqlite-persist-coordinator.js','utf8');
assert.match(dbSource,/import \{createSqlitePersistCoordinator\} from '\.\/sqlite-persist-coordinator\.js'/);
assert.match(dbSource,/sqlitePersistCoordinator\.persist\(\)/);
assert.doesNotMatch(dbSource,/const exported=db\.export\(\);await timeout\(saveDatabaseBytes\(exported\)/);
const bypass=fs.readdirSync('assets/js').filter(n=>n.endsWith('.js')&&!['database.js','storage.js'].includes(n))
  .filter(n=>/\bsaveDatabaseBytes\b/.test(fs.readFileSync('assets/js/'+n,'utf8')));
assert.deepEqual(bypass,[],'all direct SQLite byte saves must use database.persist()');
function runtime(captureBytes,saveDatabaseBytes){
  const c=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout,saveDatabaseBytes,captureBytes,console});
  vm.runInContext(coordSource.replace(/^export /gm,''),c,{timeout:3000});
  vm.runInContext(dbSource.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),c,{timeout:3000});
  vm.runInContext('db={export:()=>captureBytes()};rescueReadonly=false;',c);
  return c;
}
const live=new Map([['named-draft','v1']]);
let durable='[]',saveCount=0,releaseFirst;
const c=runtime(()=>Buffer.from(JSON.stringify([...live.entries()])),async bytes=>{
  saveCount++;if(saveCount===1)await new Promise(resolve=>{releaseFirst=resolve;});
  durable=Buffer.from(bytes).toString('utf8');
});
const first=c.persist();
for(let i=0;i<80&&saveCount<1;i++)await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(saveCount,1);
live.set('independent-writer','new-value');
const second=c.persist();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(saveCount,1,'second save cannot race first');
releaseFirst();
await Promise.all([first,second]);
assert.equal(saveCount,2);
assert.equal(new Map(JSON.parse(durable)).get('independent-writer'),'new-value');
assert.equal(c.getSqlitePersistStatus().status,'READY');
let attempts=0;
const failed=runtime(()=>Buffer.from('synthetic'),async()=>{attempts++;throw Error('synthetic_idb_failure');});
await assert.rejects(failed.persist(),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
assert.equal(failed.getSqlitePersistStatus().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(failed.persist(),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
assert.equal(attempts,1,'uncertain save must block retry');
console.log('PASS G265_DATABASE_RUNTIME_SHARED_COORDINATOR_SOURCE_BOUND_INTERLEAVING_AND_FAIL_CLOSED');
console.log('HOLD G265_ANDROID_OWNER_UAT_NAMED_DRAFT_UI_AND_DEVICE_PERSISTENCE_NOT_VERIFIED');
