// G265 eleventh exact legacy operation: unchanged g3-planning.js::weeklyForm onsubmit.
// Two disposable VM tabs and synthetic weekly_context rows reproduce acknowledged
// stale full-image overwrite. PASS means a NEGATIVE is reproduced, NOT safe admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const start='function weeklyForm() {',end='function recipeShortageText(row) {';
assert.equal(source.split(start).length,2,'exact weeklyForm source marker must be unique');
const tail=source.split(start)[1];
assert.ok(tail.includes(end),'weeklyForm source end marker missing');
const operation=start+tail.split(end)[0];
assert.match(operation,/document\.getElementById\('weeklyContextForm'\)\.onsubmit\s*=\s*async/);
assert.match(operation,/await snapshot\('manual:weekly-context'\)/);
assert.match(operation,/INSERT OR REPLACE INTO weekly_context/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const clone=value=>JSON.parse(JSON.stringify(value));
const seed={context_id:'week_seed',week_start:'2026-10-26',camp:'SYNTHETIC_SEED'};
let durable=[clone(seed)],acks=0,snapshots=0,events=0,releaseFirst,firstEnteredResolve;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function createTab(hold=false){
  const local=clone(durable),panels={weeklyContextPanel:{innerHTML:''},weeklyContextForm:{onsubmit:null}};
  let snapshotReady=false;
  const alerts=[];
  const api={
    rows(sql){assert.match(sql,/SELECT \* FROM weekly_context/);return clone(local);},
    run(sql,params){
      assert.ok(snapshotReady,'legacy writer must snapshot before SQL');
      assert.match(sql,/^INSERT OR REPLACE INTO weekly_context\(/);
      assert.equal(params.length,12);
      const names=['context_id','week_start','camp','dish_category','favorite_berry_1',
        'favorite_berry_2','favorite_berry_3','event_name','event_effects','pot_size',
        'base_notes','updated_at'];
      const row=Object.fromEntries(names.map((name,index)=>[name,params[index]]));
      const index=local.findIndex(item=>item.context_id===row.context_id);
      if(index<0)local.push(row);else local[index]=row;
    },
    async snapshot(reason){
      assert.equal(reason,'manual:weekly-context');
      snapshotReady=true;snapshots++;
    },
    async persist(){
      assert.ok(snapshotReady);
      const exported=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstEnteredResolve();});
      durable=exported;acks++;
    },
    document:{
      getElementById(id){assert.ok(panels[id],id);return panels[id];},
      dispatchEvent(event){assert.equal(event.type,'pokemon-sleep-data-refreshed');events++;}
    },
    CustomEvent:class{constructor(type){this.type=type;}},
    FormData:class{constructor(target){this.values=target.values;}get(key){return this.values[key]??null;}},
    // The unchanged weeklyForm closure references these module-scope UI option constants.
    CAMP_OPTIONS:[],DISH_OPTIONS:[],EVENT_OPTIONS:[],
    field:()=>'',area:()=>'',selectField:()=>'',berryField:()=>'',renderRecipeStrategyProjection:()=>{},
    now:()=> '2026-10-30T06:55:00+08:00',alert:message=>alerts.push(message),
    console,Number,Set,Promise,Error,
  };
  const context=vm.createContext(api);
  vm.runInContext(operation+'\nweeklyForm();',context,{timeout:3000});
  assert.equal(typeof panels.weeklyContextForm.onsubmit,'function');
  return {
    submit:values=>panels.weeklyContextForm.onsubmit({preventDefault(){},target:{values}}),
    alerts
  };
}
const tabA=createTab(true),tabB=createTab(false);
await tabA.submit({week_start:'2026-11-02',favorite_berry_1:'DUPLICATE',favorite_berry_2:'DUPLICATE'});
assert.equal(acks,0,'duplicate berry validation must reject before persistence');
assert.equal(snapshots,0,'duplicate berry validation must reject before snapshot');
assert.equal(tabA.alerts.length,1);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_DUPLICATE_BERRY_PRE_SNAPSHOT_REJECTED');

const first=tabA.submit({week_start:'2026-11-02',camp:'SYNTHETIC_A',pot_size:'24',
  favorite_berry_1:'SYNTHETIC_BERRY_A'});
await firstEntered;
await tabB.submit({week_start:'2026-11-09',camp:'SYNTHETIC_B',pot_size:'30',
  favorite_berry_1:'SYNTHETIC_BERRY_B'});
assert.equal(acks,1);
assert.ok(durable.some(row=>row.context_id==='week_2026-11-09'&&row.camp==='SYNTHETIC_B'));
releaseFirst();
await first;
assert.equal(acks,2,'both independent legacy writers acknowledged persistence');
assert.equal(snapshots,2,'both legacy writers took snapshots');
assert.equal(events,2,'both legacy writers emitted success refresh');
assert.ok(durable.some(row=>row.context_id==='week_2026-11-02'&&row.camp==='SYNTHETIC_A'));
assert.ok(!durable.some(row=>row.context_id==='week_2026-11-09'),
  'second acknowledged weekly context was erased by delayed stale export');
assert.ok(durable.some(row=>row.context_id==='week_seed'),'unrelated seed row remains');
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_TWO_TABS_TWO_ACKS_STALE_CONFIRMED_CONTEXT_LOST_NEGATIVE');
console.log('HOLD G265_ELEVENTH_WEEKLY_CONTEXT_LEGACY_UNADMITTED_PRODUCTION_ANDROID_UAT');
