// G265 ninth legacy operation: unchanged manual ingredient writer two-ACK lost-update NEGATIVE.
// Source-bound, disposable VM tabs and synthetic ingredient/audit rows only.
// A successful negative reproduction is NOT a production fix, CAS admission, or Android UAT.
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
const normalize=exactBetween('function normalizeIngredientUnlockInput(', '// Quantity and player progression');
const save=exactBetween('export async function saveIngredient(', 'export async function saveItem(');
assert.match(source,/const now=\(\)=>localIso\(\);/);
assert.match(save,/await snapshot\(/);
assert.match(save,/begin\(\)/);
assert.match(save,/await audit\('ingredient_inventory'/);
assert.match(save,/commit\(\);await persist\(\)/);
assert.match(save,/q>0&&unlocked===0/);
assert.match(save,/if\(q>0\)unlocked=1/);
assert.doesNotMatch(save,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=x=>JSON.parse(JSON.stringify(x));
const ingredientA='SYNTHETIC_INGREDIENT_A',ingredientB='SYNTHETIC_INGREDIENT_B';
let durable={
  ingredient_inventory:[{ingredient_name:'SYNTHETIC_SEED',quantity:2,unlocked:1}],
  import_batches:[],import_changes:[],
};
let releaseFirst,firstEnteredResolve,ackCount=0,snapshotCount=0;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function createTab(hold=false){
  const local=clone(durable);
  let snapshotReady=false,inTransaction=false;
  const api={
    rows(sql,params=[]){
      if(sql.startsWith('SELECT 1 FROM ingredient_master'))return [{exists:1}]; // synthetic read-only master
      assert.match(sql,/SELECT \* FROM ingredient_inventory WHERE ingredient_name=\?/);
      return local.ingredient_inventory.filter(row=>row.ingredient_name===params[0]).map(clone);
    },
    run(sql,params=[]){
      assert.ok(snapshotReady&&inTransaction,'snapshot and BEGIN required before SQL mutation');
      if(sql.startsWith('INSERT INTO ingredient_inventory')){
        assert.equal(params.length,5);
        const [ingredient_name,quantity,unlocked,updated_at,source_update_id]=params;
        assert.equal(source_update_id,'MANUAL-EDIT');
        local.ingredient_inventory=local.ingredient_inventory.filter(x=>x.ingredient_name!==ingredient_name)
          .concat({ingredient_name,quantity,unlocked,updated_at,source_update_id});
      }else if(sql.startsWith('INSERT INTO import_batches')){
        assert.equal(params.length,7);
        local.import_batches.push({update_id:params[0],source:params[4]});
      }else if(sql.startsWith('INSERT INTO import_changes')){
        assert.equal(params.length,9);
        local.import_changes.push({update_id:params[0],entity:params[2],key_json:params[4]});
      }else throw Error('unexpected SQL in isolated legacy source: '+sql);
    },
    async snapshot(reason){
      assert.match(reason,/^manual:ingredient:SYNTHETIC_INGREDIENT_[AB]$/);
      snapshotCount++;snapshotReady=true;
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
    localIso:()=> '2026-10-29T16:55:00.000Z',
    Date,Math,JSON,Number,String,Object,Promise,Error,console,
  };
  const ctx=vm.createContext(api);
  vm.runInContext('const now=()=>localIso();\n'+audit+'\n'+normalize+'\n'+save.replace(/^export /,'')+'\n;globalThis.__save=saveIngredient;',ctx,{timeout:3000});
  return ctx.__save;
}
await assert.rejects(createTab(false)('SYNTHETIC_INGREDIENT_BAD',4,0),/不可標記為尚未解鎖/);
assert.equal(snapshotCount,0,'contradictory unlock rejected before snapshot');
assert.equal(ackCount,0,'invalid input cannot persist');
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_POSITIVE_QUANTITY_UNLOCK_CONTRADICTION_FAIL_CLOSED');

const firstTab=createTab(true),secondTab=createTab(false);
const first=firstTab(ingredientA,9);
await firstEntered;
const second=await secondTab(ingredientB,0);
assert.equal(second.ingredient_name,ingredientB);
assert.equal(second.unlocked,null,'zero quantity without explicit unlock remains UNKNOWN');
assert.equal(durable.ingredient_inventory.length,2);
assert.ok(durable.ingredient_inventory.some(x=>x.ingredient_name===ingredientB));
assert.equal(durable.import_batches.length,1);
releaseFirst();
const earlier=await first;
assert.equal(earlier.ingredient_name,ingredientA);
assert.equal(earlier.unlocked,1,'positive quantity deterministically unlocks ingredient');
assert.equal(ackCount,2,'both legacy tabs returned successful persistence ACK');
assert.equal(durable.ingredient_inventory.length,2,'stale full-image persist erased acknowledged ingredient');
assert.ok(durable.ingredient_inventory.some(x=>x.ingredient_name===ingredientA&&x.unlocked===1));
assert.ok(!durable.ingredient_inventory.some(x=>x.ingredient_name===ingredientB),'acknowledged ingredient B lost');
assert.equal(durable.import_batches.length,1,'acknowledged audit batch also lost');
assert.equal(durable.import_changes.length,1,'acknowledged audit change also lost');
assert.ok(durable.ingredient_inventory.some(x=>x.ingredient_name==='SYNTHETIC_SEED'));
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_TWO_TABS_TWO_ACKS_STALE_INGREDIENT_AND_AUDIT_LOST_UPDATE_NEGATIVE');
console.log('HOLD G265_NINTH_LEGACY_NOT_ADMITTED_PRODUCTION_INGREDIENT_INVENTORY_ANDROID_UAT');
