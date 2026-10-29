// G265 eighth legacy operation: manual item-inventory two-ACK lost-update NEGATIVE.
// Executes unchanged manual-editor.js::saveItem() and its audit helper in two
// disposable VM contexts with synthetic items. No player DB, production import,
// Public Master mutation, native Chromium, or crash-recovery claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/manual-editor.js',import.meta.url),'utf8');
function exactBetween(start,end){
  assert.equal(source.split(start).length,2,'source marker must be unique: '+start);
  const tail=source.split(start)[1];
  assert.ok(tail.includes(end),'source end marker missing: '+end);
  return start+tail.split(end)[0];
}
const audit=exactBetween('async function audit(', 'function emitPokemonEvaluationInputChanged(');
const save=exactBetween('export async function saveItem(', 'export async function savePokemonDetail(');
assert.match(source,/const now=\(\)=>localIso\(\);/);
assert.match(save,/await snapshot\(`manual:item:/);
assert.match(save,/begin\(\);try\{run\(`INSERT INTO item_inventory/);
assert.match(save,/await audit\('item_inventory'/);
assert.match(save,/commit\(\);await persist\(\)/);
assert.doesNotMatch(save,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=x=>JSON.parse(JSON.stringify(x));
const itemA='SYNTHETIC_ITEM_A',itemB='SYNTHETIC_ITEM_B';
let durable={
  item_inventory:[{item_name:'SYNTHETIC_SEED',quantity:3,safe_reserve:1,recommendation:'seed'}],
  import_batches:[],import_changes:[],
};
let releaseFirst,firstEnteredResolve,ackCount=0;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function createTab(hold=false){
  const local=clone(durable);
  let snapshotReady=false,inTransaction=false;
  const api={
    rows(sql,params=[]){
      if(sql.startsWith('SELECT 1 FROM item_master'))return [{exists:1}]; // read-only synthetic master
      assert.match(sql,/SELECT \* FROM item_inventory WHERE item_name=\?/);
      return local.item_inventory.filter(row=>row.item_name===params[0]).map(clone);
    },
    run(sql,params=[]){
      assert.ok(snapshotReady&&inTransaction,'snapshot and BEGIN required before SQL mutation');
      if(sql.startsWith('INSERT INTO item_inventory')){
        assert.equal(params.length,6);
        const [item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id]=params;
        assert.equal(source_update_id,'MANUAL-EDIT');
        const row={item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id};
        local.item_inventory=local.item_inventory.filter(x=>x.item_name!==item_name).concat(row);
      }else if(sql.startsWith('INSERT INTO import_batches')){
        assert.equal(params.length,7);
        local.import_batches.push({update_id:params[0],source:params[4]});
      }else if(sql.startsWith('INSERT INTO import_changes')){
        assert.equal(params.length,9);
        local.import_changes.push({update_id:params[0],entity:params[2],key_json:params[4]});
      }else throw Error('unexpected SQL in isolated legacy source: '+sql);
    },
    async snapshot(reason){
      assert.match(reason,/^manual:item:SYNTHETIC_ITEM_[AB]$/);
      snapshotReady=true;
      return {status:'synthetic-only'};
    },
    begin(){assert.ok(snapshotReady&&!inTransaction);inTransaction=true;},
    commit(){assert.ok(inTransaction);inTransaction=false;},
    rollback(){inTransaction=false;},
    async persist(){
      assert.equal(inTransaction,false);
      const next=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstEnteredResolve();});
      durable=next;ackCount++;
    },
    localIso:()=> '2026-10-29T13:55:00.000Z',
    Date,Math,JSON,Number,String,Object,Promise,Error,console,
  };
  const ctx=vm.createContext(api);
  vm.runInContext('const now=()=>localIso();\n'+audit+'\n'+save.replace(/^export /,'')+'\n;globalThis.__save=saveItem;',ctx,{timeout:3000});
  return ctx.__save;
}
const firstTab=createTab(true),secondTab=createTab(false);
const first=firstTab(itemA,11,2,'first-synthetic');
await firstEntered;
const second=await secondTab(itemB,22,4,'second-synthetic');
assert.equal(second.item_name,itemB);
assert.equal(durable.item_inventory.length,2);
assert.ok(durable.item_inventory.some(x=>x.item_name===itemB));
assert.equal(durable.import_batches.length,1);
releaseFirst();
const earlier=await first;
assert.equal(earlier.item_name,itemA);
assert.equal(ackCount,2,'both legacy tabs returned a successful persist ACK');
assert.equal(durable.item_inventory.length,2,'stale full-image persist erased second acknowledged item');
assert.ok(durable.item_inventory.some(x=>x.item_name===itemA));
assert.ok(!durable.item_inventory.some(x=>x.item_name===itemB),'acknowledged item B lost');
assert.equal(durable.import_batches.length,1,'acknowledged audit batch also lost');
assert.equal(durable.import_changes.length,1,'acknowledged audit change also lost');
assert.ok(durable.item_inventory.some(x=>x.item_name==='SYNTHETIC_SEED'));
console.log('PASS G265_EIGHTH_MANUAL_ITEM_TWO_TABS_TWO_ACKS_STALE_ITEM_AND_AUDIT_LOST_UPDATE_NEGATIVE');
console.log('HOLD G265_EIGHTH_LEGACY_NOT_ADMITTED_PRODUCTION_ITEM_INVENTORY_ANDROID_UAT');
