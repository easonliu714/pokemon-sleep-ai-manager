// G265 sixth legacy operation: exact named-team draft save acknowledged lost-update.
// Isolated disposable VM contexts only. This NEGATIVE fixture is not a production fix,
// an Android test, a recovery snapshot, or a player SQLite/IndexedDB access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/war-room-named-team-draft-store.js',import.meta.url),'utf8');
const marker='export async function saveNamedTeamDraftLocal(';
assert.equal(source.split(marker).length,2,'exact sixth legacy writer source must be unique');
const operation=source.split(marker)[1];
assert.match(operation,/await snapshot\('war-room:named-team-draft:'/);
assert.match(operation,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|createSqliteFreshDurableTransactionAdapter|runSqliteWriteSession/);
console.log('PASS G265_SIXTH_NAMED_DRAFT_EXACT_LEGACY_SOURCE_BOUND_DIRECT_PERSIST');

const evaluated=source.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,'');
const clone=value=>JSON.parse(JSON.stringify(value));
const draftA='draft_AAAAAAAAAAAAAAAA';
const draftB='draft_BBBBBBBBBBBBBBBB';
let durable={settings:[]},releaseFirst,firstEnteredResolve,ackCount=0;
const firstEntered=new Promise(resolve=>{firstEnteredResolve=resolve;});
function payload(name){
  return {
    schema:'pokemon-sleep-named-team-draft/1.0',team_name:name,
    goal_profile_id:'goal-synthetic',optimizer_result_fingerprint:'synthetic-result',
    team_id:'team-'+name,team_input_fingerprint:'synthetic-input',
    optimizer_version:'synthetic-optimizer',game_applied:false,local_only:true,
    members:Array.from({length:5},(_,i)=>({
      slot_index:i+1,pokemon_id:'species-'+i,pokemon_instance_id:'synthetic-'+i,
    })),
  };
}
function createTab(hold=false){
  const local=clone(durable);
  let transaction=false,snapshotReady=false;
  const api={
    rows(sql,params=[]){
      if(sql.includes('strategy_goal_profile'))return [{goal_profile_id:'goal-synthetic'}];
      assert.match(sql,/SELECT value_json FROM settings WHERE key=/);
      return local.settings.filter(row=>row.key===params[0]).map(row=>({value_json:row.value_json}));
    },
    run(sql,params=[]){
      assert.ok(transaction&&snapshotReady,'snapshot and BEGIN required before SQL mutation');
      assert.match(sql,/INSERT INTO settings/);
      assert.equal(params.length,3);
      assert.ok(!local.settings.some(row=>row.key===params[0]));
      local.settings.push({key:params[0],value_json:params[1],updated_at:params[2]});
    },
    begin(){assert.ok(snapshotReady&&!transaction);transaction=true;},
    commit(){assert.ok(transaction);transaction=false;},
    rollback(){transaction=false;},
    async snapshot(){snapshotReady=true;return {status:'synthetic-snapshot'};},
    async persist(){
      assert.equal(transaction,false);
      const next=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstEnteredResolve();});
      durable=next;ackCount++;
    },
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    classifyNamedTeamDraftEligibility:({name})=>({eligible:true,payload:payload(name)}),
    Promise,Date,Math,JSON,Object,Number,String,Array,Error,console,
  };
  const ctx=vm.createContext(api);
  vm.runInContext(evaluated+'\n;globalThis.__save=saveNamedTeamDraftLocal;',ctx,{timeout:3000});
  return ctx.__save;
}
const firstTab=createTab(true);
const secondTab=createTab(false);
const first=firstTab({draftId:draftA,name:'first-synthetic'});
await firstEntered;
const second=await secondTab({draftId:draftB,name:'second-synthetic'});
assert.equal(second.status,'PERSISTED');
assert.equal(durable.settings.length,1);
assert.equal(durable.settings[0].key,'war-room:named-team-draft:v1:'+draftB);
releaseFirst();
const earlier=await first;
assert.equal(earlier.status,'PERSISTED');
assert.equal(ackCount,2,'two independent legacy tabs acknowledged their saves');
assert.equal(durable.settings.length,1,'one acknowledged draft was lost');
assert.equal(durable.settings[0].key,'war-room:named-team-draft:v1:'+draftA);
assert.ok(!durable.settings.some(row=>row.key==='war-room:named-team-draft:v1:'+draftB));
console.log('PASS G265_SIXTH_NAMED_DRAFT_TWO_TABS_TWO_ACKS_STALE_OVERWRITE_NEGATIVE');
console.log('HOLD G265_SIXTH_LEGACY_NOT_ADMITTED_PRODUCTION_NAMED_DRAFT_APPLY_ANDROID_UAT');
