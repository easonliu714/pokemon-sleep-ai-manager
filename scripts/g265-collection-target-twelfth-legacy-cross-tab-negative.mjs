// G265 twelfth exact legacy operation: unchanged g3-planning.js::setupG3Pages collectionAddForm.
// Disposable VM tabs reproduce acknowledged stale full-image overwrite. PASS is an UNSAFE negative,
// not production writer admission. No player SQLite, IndexedDB, app bootstrap, or network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(source.split(marker).length,2,'exact collection form source marker must be unique');
const operation=source.slice(source.indexOf(marker)).replace(/^export /,'');
assert.match(operation,/document\.getElementById\('collectionAddForm'\)\.onsubmit\s*=\s*async/);
assert.match(operation,/await snapshot\('manual:collection-target'\)/);
assert.match(operation,/INSERT OR REPLACE INTO collection_targets/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=value=>JSON.parse(JSON.stringify(value));
const seed={target_id:'target_seed',species:'SYNTHETIC_SEED',target_type:'observe',priority:'B'};
let durable=[clone(seed)],acks=0,snapshots=0,resets=0,releaseFirst,firstEnteredResolve;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function createTab(hold=false){
  const local=clone(durable),form={onsubmit:null},alerts=[];
  let snapshotReady=false;
  const api={
    ensureUi:()=>{},weeklyForm:()=>{},warroomForm:()=>{},renderCollection:()=>{},
    installStrategyRefreshListeners:()=>{},
    document:{getElementById(id){assert.equal(id,'collectionAddForm');return form;}},
    FormData:class{constructor(target){this.values=target.values;}get(key){return this.values[key]??null;}},
    Date:class extends Date{static now(){return hold?1001:1002;}},
    now:()=> '2026-10-30T09:03:00+08:00',
    alert:message=>alerts.push(message),
    async snapshot(reason){assert.equal(reason,'manual:collection-target');snapshotReady=true;snapshots++;},
    run(sql,params){
      assert.ok(snapshotReady,'legacy writer must snapshot before SQL');
      assert.match(sql,/^INSERT OR REPLACE INTO collection_targets\(/);
      assert.equal(params.length,10);
      const names=['target_id','species','target_type','priority','camp','desired_traits','capture_strategy','status','notes','updated_at'];
      const row=Object.fromEntries(names.map((name,index)=>[name,params[index]]));
      const index=local.findIndex(item=>item.target_id===row.target_id);
      if(index<0)local.push(row);else local[index]=row;
    },
    async persist(){
      assert.ok(snapshotReady);
      const exported=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstEnteredResolve();});
      durable=exported;acks++;
    },
    console,Promise,Error,
  };
  vm.runInContext(operation+'\nsetupG3Pages();',vm.createContext(api),{timeout:3000});
  assert.equal(typeof form.onsubmit,'function');
  return {submit:values=>form.onsubmit({
    preventDefault(){},
    target:{values,reset(){resets++;}}
  }),alerts};
}
const tabA=createTab(true),tabB=createTab(false);
await tabA.submit({species:''});
assert.equal(acks,0,'empty species must reject before persist');
assert.equal(snapshots,0,'empty species must reject before snapshot');
assert.equal(tabA.alerts.length,1);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_EMPTY_SPECIES_PRE_SNAPSHOT_REJECTED');

const first=tabA.submit({species:'SYNTHETIC_A',target_type:'observe',priority:'A'});
await firstEntered;
await tabB.submit({species:'SYNTHETIC_B',target_type:'observe',priority:'S'});
assert.equal(acks,1);
assert.ok(durable.some(row=>row.target_id==='target_1002'&&row.species==='SYNTHETIC_B'));
releaseFirst();
await first;
assert.equal(acks,2,'both independent legacy writers acknowledged persistence');
assert.equal(snapshots,2,'both writers took snapshots');
assert.equal(resets,2,'both forms received success reset');
assert.ok(durable.some(row=>row.target_id==='target_1001'&&row.species==='SYNTHETIC_A'));
assert.ok(!durable.some(row=>row.target_id==='target_1002'),
  'second acknowledged target was erased by delayed stale export');
assert.ok(durable.some(row=>row.target_id==='target_seed'),'unrelated seed target remains');
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_TWO_TABS_TWO_ACKS_STALE_CONFIRMED_TARGET_LOST_NEGATIVE');
console.log('HOLD G265_TWELFTH_COLLECTION_TARGET_LEGACY_UNADMITTED_PRODUCTION_ANDROID_UAT');
