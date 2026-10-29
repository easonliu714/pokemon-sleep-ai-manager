// G265 tenth legacy operation: unchanged g3-planning.js::warroomForm onsubmit.
// Two disposable VM tabs and synthetic weekly_strategy rows prove a two-ACK stale
// full-image overwrite. A PASS is a vulnerability reproduction, NOT production admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const start='function warroomForm() {',end='function renderCollection() {';
assert.equal(source.split(start).length,2,'exact warroomForm source marker must be unique');
const tail=source.split(start)[1];
assert.ok(tail.includes(end),'exact warroomForm end marker missing');
const operation=start+tail.split(end)[0];
assert.match(operation,/document\.getElementById\('warroomForm'\)\.onsubmit\s*=\s*async/);
assert.match(operation,/await snapshot\('manual:weekly-strategy'\)/);
assert.match(operation,/INSERT OR REPLACE INTO weekly_strategy/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=value=>JSON.parse(JSON.stringify(value));
const seed={strategy_id:'strategy_seed',week_start:'2026-10-26',team_summary:'SYNTHETIC_SEED'};
let durable=[clone(seed)],ackCount=0,snapshotCount=0,releaseFirst,enteredResolve;
const firstEntered=new Promise(resolve=>{enteredResolve=resolve;});
function createTab(hold=false){
  const local=clone(durable),panels={warroomPanel:{innerHTML:''},warroomForm:{onsubmit:null}};
  let snapshotReady=false;
  const api={
    rows(sql){assert.match(sql,/SELECT \* FROM weekly_strategy/);return clone(local);},
    run(sql,params){
      assert.ok(snapshotReady,'legacy writer must snapshot before SQL');
      assert.match(sql,/^INSERT OR REPLACE INTO weekly_strategy\(/);
      assert.equal(params.length,12);
      const names=['strategy_id','week_start','team_summary','substitution_rules','time_schedule','meal_strategy','ingredient_estimate','berry_estimate','shard_estimate','snorlax_energy_estimate','assumptions','updated_at'];
      const row=Object.fromEntries(names.map((name,index)=>[name,params[index]]));
      const previous=local.findIndex(item=>item.strategy_id===row.strategy_id);
      if(previous<0)local.push(row);else local[previous]=row;
    },
    async snapshot(reason){assert.equal(reason,'manual:weekly-strategy');snapshotReady=true;snapshotCount++;},
    async persist(){
      assert.ok(snapshotReady);
      const exported=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;enteredResolve();});
      durable=exported;ackCount++;
    },
    document:{getElementById(id){assert.ok(panels[id]);return panels[id];}},
    FormData:class{constructor(target){this.values=target.values;}get(key){return this.values[key]??null;}},
    field:()=>'',area:()=>'',renderRecipeStrategyProjection:()=>{},
    now:()=> '2026-10-30T03:55:00+08:00',alert:()=>{},
    console,Number,Set,Promise,Error,
  };
  const context=vm.createContext(api);
  vm.runInContext(operation+'\nwarroomForm();',context,{timeout:3000});
  assert.equal(typeof panels.warroomForm.onsubmit,'function');
  return async values=>panels.warroomForm.onsubmit({
    preventDefault(){},
    target:{values},
  });
}
const tabA=createTab(true),tabB=createTab(false);
const first=tabA({week_start:'2026-11-02',team_summary:'SYNTHETIC_A'});
await firstEntered;
await tabB({week_start:'2026-11-09',team_summary:'SYNTHETIC_B'});
assert.equal(ackCount,1);
assert.ok(durable.some(row=>row.strategy_id==='strategy_2026-11-09'));
releaseFirst();
await first;
assert.equal(ackCount,2,'both independent legacy writers acknowledged persistence');
assert.equal(snapshotCount,2,'both legacy writers took pre-write snapshots');
assert.ok(durable.some(row=>row.strategy_id==='strategy_2026-11-02'&&row.team_summary==='SYNTHETIC_A'));
assert.ok(!durable.some(row=>row.strategy_id==='strategy_2026-11-09'),'second acknowledged strategy was erased');
assert.ok(durable.some(row=>row.strategy_id==='strategy_seed'),'unrelated seed remains');
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_TWO_TABS_TWO_ACKS_STALE_CONFIRMED_STRATEGY_LOST_NEGATIVE');
console.log('HOLD G265_TENTH_WEEKLY_STRATEGY_LEGACY_UNADMITTED_PRODUCTION_ANDROID_UAT');
