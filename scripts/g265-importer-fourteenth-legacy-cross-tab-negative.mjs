// G265 fourteenth distinct legacy writer: importer.js::applyPayload().
// Exact unchanged production function in disposable VM tabs; this NEGATIVE
// demonstrates two successful legacy ACKs with stale full-image loss.
// It is NOT an import-policy test, production admission, or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/importer.js',import.meta.url),'utf8');
const marker='export async function applyPayload(payload) {';
const writeMarker='function write(entity, key, data, mode) {';
assert.equal(source.split(marker).length,2,'importer applyPayload source must be unique');
assert.equal(source.split(writeMarker).length,2,'importer write helper source must be unique');
const operation=source.slice(source.indexOf(writeMarker)).replace(/^export /gm,'');
assert.match(operation,/await snapshot\(/);
assert.match(operation,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
assert.match(operation,/INSERT INTO import_batches/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_FOURTEENTH_IMPORTER_EXACT_LEGACY_APPLY_PAYLOAD_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO settings VALUES('seed','preserved')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acks=0,snapshots=0,releaseFirst,signalFirst;
const firstEntered=new Promise(resolve=>{signalFirst=resolve;});
const payload=(id)=>({schema_version:'synthetic',update_id:'synthetic_'+id,generated_at:'2026-10-31T15:55:00Z',source:'synthetic',operations:[{entity:'settings',action:'insert',key:{key:'setting_'+id},data:{value:id}}]});
function tab(hold){
  const local=new SQL.Database(new Uint8Array(durable));
  let snapshotReady=false,transaction=false;
  const ctx={
    KEYS:{settings:['key']},
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
    localIso:()=> '2026-10-31T15:55:00Z',
    dryRun(p){
      assert.equal(p.operations.length,1);
      const o=p.operations[0];
      assert.equal(o.entity,'settings');
      return {conflict_count:0,changes:[{effective_action:'insert',key:{...o.key},data:{...o.data},before:null,after:{...o.key,...o.data},message:'',candy_storage:null}],audit_summary:{},visual_preflight:{status:'SYNTHETIC'}};
    },
    async snapshot(reason){assert.equal(reason.startsWith('before:synthetic_'),true);snapshots++;snapshotReady=true;return {status:'SYNTHETIC_ONLY'};},
    begin(){assert.ok(snapshotReady);local.run('BEGIN IMMEDIATE');transaction=true;},
    run(sql,params=[]){assert.ok(transaction);local.run(sql,params);},
    commit(){local.run('COMMIT');transaction=false;},
    rollback(){if(transaction){local.run('ROLLBACK');transaction=false;}},
    async persist(){
      assert.equal(transaction,false);
      const exported=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;signalFirst();});
      durable=exported;acks++;
    },
    JSON,Object,Promise,Error,Map,Set,Number,String,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__apply=applyPayload;',context,{timeout:3000});
  return {apply:context.__apply,close:()=>local.close()};
}
const first=tab(true);
const pending=first.apply(payload('A'));
await firstEntered;
const second=tab(false);
const secondResult=await second.apply(payload('B'));
assert.equal(secondResult.operation_count,1);
assert.equal(acks,1);
let observed=new SQL.Database(durable);
assert.equal(observed.exec("SELECT COUNT(*) FROM settings WHERE key='setting_B'")[0].values[0][0],1);
observed.close();
releaseFirst();
const firstResult=await pending;
assert.equal(firstResult.operation_count,1);
assert.equal(acks,2,'both legacy tabs falsely believe their imports persisted');
assert.equal(snapshots,2);
observed=new SQL.Database(durable);
const count=sql=>observed.exec(sql)[0].values[0][0];
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_B'"),0,'second acknowledged import lost after stale export');
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_B'"),0);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='seed'"),1);
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
observed.close();first.close();second.close();
console.log('PASS G265_FOURTEENTH_IMPORTER_TWO_ACK_STALE_IMPORT_AND_BATCH_LOST_NEGATIVE');
console.log('HOLD G265_IMPORTER_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
