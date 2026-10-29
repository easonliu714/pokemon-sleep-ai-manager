// G265 seventh exact legacy writer: account pot capacity acknowledged stale overwrite.
// Disposable VM contexts and synthetic values ONLY. This negative fixture is not a
// production repair, native Chromium test, persistent recovery snapshot or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/weekly-context-ui-bridge.js',import.meta.url),'utf8');
function exactBetween(start,end){
  assert.equal(source.split(start).length,2,'exact legacy function marker must be unique: '+start);
  const tail=source.split(start)[1];
  assert.ok(tail.includes(end),'exact legacy function end marker must exist: '+end);
  return start+tail.split(end)[0];
}
const typed=exactBetween('function typedValue(field,raw){','function resolvedValue(');
const write=exactBetween('function writeAccountPotCapacity(capacity,source=', 'async function saveAccountPotCapacity(');
const save=exactBetween('async function saveAccountPotCapacity(edit){','async function saveFallback(');
assert.match(write,/INSERT INTO account_capacity/);
assert.match(save,/await snapshot\(/);
assert.match(save,/writeAccountPotCapacity\(edit\.value,edit\.source\)/);
assert.match(save,/await persist\(\)/);
assert.doesNotMatch(save,/navigator\.locks|createSqliteFreshDurableTransactionAdapter|runSqliteWriteSession/);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=x=>JSON.parse(JSON.stringify(x));
let durable={account_capacity:[{capacity_key:'pot',total_capacity:30,source:'synthetic-seed'}]};
let releaseFirst,firstEnteredResolve,ackCount=0;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function tab(hold=false){
  const local=clone(durable);
  let snapshotCount=0;
  const ctx=vm.createContext({
    Number,String,Error,Date,Promise,console,
    localIso:()=> '2026-10-29T10:55:00.000Z',
    snapshot:async reason=>{
      assert.match(reason,/account-pot-capacity/);
      snapshotCount++;
      return {status:'synthetic-snapshot-only'};
    },
    run:(sql,params)=>{
      assert.ok(snapshotCount>0,'snapshot required before mutation');
      assert.match(sql,/INSERT INTO account_capacity/);
      assert.match(sql,/ON CONFLICT\(capacity_key\) DO UPDATE/);
      assert.equal(params.length,3);
      local.account_capacity=[{capacity_key:'pot',total_capacity:params[0],updated_at:params[1],source:params[2]}];
    },
    persist:async()=>{
      const next=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstEnteredResolve();});
      durable=next;ackCount++;
    },
  });
  vm.runInContext(typed+'\n'+write+'\n'+save+'\n;globalThis.__save=saveAccountPotCapacity;',ctx,{timeout:3000});
  return ctx.__save;
}
const firstTab=tab(true),secondTab=tab(false);
const first=firstTab({changed:true,value:55,source:'SYNTHETIC_FIRST'});
await firstEntered;
const second=await secondTab({changed:true,value:70,source:'SYNTHETIC_SECOND'});
assert.equal(second,70);
assert.equal(durable.account_capacity[0].total_capacity,70);
releaseFirst();
const earlier=await first;
assert.equal(earlier,55);
assert.equal(ackCount,2,'both legacy tabs acknowledged independent persist');
assert.equal(durable.account_capacity.length,1);
assert.equal(durable.account_capacity[0].total_capacity,55,'delayed stale writer overwrites acknowledged value 70');
assert.equal(durable.account_capacity[0].source,'SYNTHETIC_FIRST');
console.log('PASS G265_SEVENTH_ACCOUNT_POT_TWO_ACKS_STALE_CAPACITY_OVERWRITE_NEGATIVE');
console.log('HOLD G265_SEVENTH_LEGACY_NOT_ADMITTED_PRODUCTION_ACCOUNT_CAPACITY_ANDROID_UAT');
