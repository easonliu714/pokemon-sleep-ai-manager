// G265 fifth exact legacy operation: saveAnalysisRevision() lost acknowledged update.
// Two independent disposable VM tabs execute the actual source. NEGATIVE proof only;
// never import the production app, read player SQLite, or modify IndexedDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/analysis-revision-store.js',import.meta.url),'utf8');
const operation=source.split('export async function saveAnalysisRevision(')[1]?.split('\nexport {TABLE_SQL}')[0];
assert.ok(operation,'exact fifth legacy operation must remain source identifiable');
assert.match(operation,/await snapshot\(/);
assert.match(operation,/run\('INSERT INTO image_analysis_revision/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_FIFTH_ANALYSIS_REVISION_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const evaluated=source.replace(/^import[^\n]*\n/gm,'').replace(/^export \{[^\n]*\n/gm,'').replace(/^export /gm,'');
const clone=value=>JSON.parse(JSON.stringify(value));
let durable={revisions:[]},enteredA,releaseA,ackCount=0;
const firstPersistEntered=new Promise(resolve=>{enteredA=resolve;});
function createTab(name,hold=false){
  let local=clone(durable);
  const api={
    run(sql,params=[]){
      if(/^\s*CREATE (TABLE|INDEX)/i.test(sql))return;
      assert.match(sql,/INSERT INTO image_analysis_revision/);
      assert.equal(params.length,13);
      local.revisions.push({
        analysis_id:params[0],image_sha256:params[1],analysis_type:params[3],
        revision_no:params[4],result_json:params[9],supersedes_analysis_id:params[12],
      });
    },
    rows(sql,params=[]){
      assert.match(sql,/SELECT analysis_id,revision_no FROM image_analysis_revision/);
      const found=local.revisions.filter(row=>row.image_sha256===params[0]&&row.analysis_type===params[1])
        .sort((a,b)=>b.revision_no-a.revision_no);
      return found.slice(0,1);
    },
    snapshot:async()=>({status:'disposable-snapshot'}),
    async persist(){
      const image=clone(local);
      if(hold)await new Promise(resolve=>{releaseA=resolve;enteredA();});
      durable=image;
      ackCount++;
    },
    crypto:{randomUUID:()=>name+'-uuid'},
    Promise,Date,Math,JSON,Object,Number,String,Array,Error,console,
  };
  const ctx=vm.createContext(api);
  vm.runInContext(evaluated+'\n;globalThis.__save=saveAnalysisRevision;',ctx,{timeout:3000});
  return ctx.__save;
}
const a=createTab('tab-A',true),b=createTab('tab-B');
const first=a({imageSha256:'synthetic-image-hash',analysisType:'synthetic-type',result:{tab:'A'}});
await firstPersistEntered;
const second=await b({imageSha256:'synthetic-image-hash',analysisType:'synthetic-type',result:{tab:'B'}});
assert.equal(second.revision_no,1);
assert.equal(durable.revisions.length,1);
assert.equal(durable.revisions[0].analysis_id,second.analysis_id);
releaseA();
const earlier=await first;
assert.equal(earlier.revision_no,1,'both tabs chose the same stale revision number');
assert.notEqual(earlier.analysis_id,second.analysis_id);
assert.equal(ackCount,2,'both legacy tabs acknowledged direct persistence');
assert.equal(durable.revisions.length,1,'one acknowledged revision was lost');
assert.equal(durable.revisions[0].analysis_id,earlier.analysis_id);
assert.ok(!durable.revisions.some(row=>row.analysis_id===second.analysis_id));
console.log('PASS G265_FIFTH_ANALYSIS_REVISION_TWO_TABS_TWO_ACKS_STALE_OVERWRITE_NEGATIVE');
console.log('HOLD G265_FIFTH_LEGACY_WRITER_NOT_ADMITTED_PRODUCTION_CROSS_TAB_ANDROID_UAT');
