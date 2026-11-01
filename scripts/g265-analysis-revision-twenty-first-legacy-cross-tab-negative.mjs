// G265 twenty-first distinct Legacy Direct Writer: analysis-revision-store.js::saveAnalysisRevision().
// Execute unchanged production source in disposable SQL.js VM tabs with synthetic image hashes.
// Two successful legacy ACKs can erase an independently acknowledged analysis revision.
// PASS denotes expected UNSAFE negative reproduction, not production CAS admission or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-revision-store.js',import.meta.url),'utf8');
assert.match(source,/export async function saveAnalysisRevision\(/);
assert.match(source,/await snapshot\(`before_analysis_revision_${analysisType}`\)/);
assert.match(source,/run\('INSERT INTO image_analysis_revision /);
assert.match(source,/await persist\(\)/);
assert.doesNotMatch(source,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const operation=source.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,'');
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();

const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(
    result[0].columns.map((column,i)=>[column,values[i]])));
};
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
let acknowledgments=0,snapshots=0,dispatches=0,releaseFirst,notifyFirst;
const firstPersistEntered=new Promise(resolve=>{notifyFirst=resolve;});

function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    async snapshot(reason){
      assert.equal(reason,'before_analysis_revision_roster');
      snapshots++;return {status:'SYNTHETIC'};
    },
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;notifyFirst();});
      durable=bytes;acknowledgments++;
    },
    crypto:{randomUUID:()=> 'synthetic-revision-'+label},
    dispatchEvent(event){
      assert.equal(event.type,'pokemon-sleep:analysis-revision-saved');dispatches++;
    },
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    JSON,Number,String,Promise,Error,Math,Date,Object,console,
  });
  vm.runInContext(operation+'\n;globalThis.__save=saveAnalysisRevision;',context,{timeout:3000});
  return {save:context.__save,close:()=>local.close()};
}

const first=makeTab('A',true);
const pending=first.save({
  imageSha256:'synthetic-image-sha-A',analysisType:'roster',provider:'synthetic-A',
  result:{pokemon:'synthetic-A',level:12},
});
await firstPersistEntered;
assert.equal(acknowledgments,0,'first legacy save paused before durable persist');
const second=makeTab('B',false);
const acknowledgedB=await second.save({
  imageSha256:'synthetic-image-sha-B',analysisType:'roster',provider:'synthetic-B',
  result:{pokemon:'synthetic-B',level:35},
});
assert.equal(acknowledgedB.revision_no,1);
assert.equal(acknowledgments,1);
let reload=new SQL.Database(durable);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM image_analysis_revision WHERE image_sha256='synthetic-image-sha-B'"),1);
assert.equal(JSON.parse(rowObjects(reload,"SELECT result_json FROM image_analysis_revision WHERE image_sha256='synthetic-image-sha-B'")[0].result_json).level,35);
reload.close();

releaseFirst();
const acknowledgedA=await pending;
assert.equal(acknowledgedA.revision_no,1);
assert.equal(acknowledgments,2,'both legacy full-image persists returned success');
assert.equal(snapshots,2);
assert.equal(dispatches,2);
reload=new SQL.Database(durable);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM image_analysis_revision WHERE image_sha256='synthetic-image-sha-A'"),1);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM image_analysis_revision WHERE image_sha256='synthetic-image-sha-B'"),0,
  'later-ACKed B revision is erased by stale A full-image persist');
assert.equal(scalar(reload,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reload.close();first.close();second.close();
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_TWO_ACK_STALE_INDEPENDENT_REVISION_LOST_NEGATIVE');
console.log('HOLD G265_ANALYSIS_REVISION_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
