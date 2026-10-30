// G265 thirteenth direct legacy writer: unchanged weekly manual override save.
// Disposable VM tabs reproduce two acknowledged writes with a lost unrelated week.
// This is an UNSAFE negative reproduction, not production admission or a player-data test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/weekly-context-manual-override.js',import.meta.url),'utf8');
const start='export async function saveWeeklyManualOverride(';
const end='export async function clearWeeklyManualOverride(';
assert.equal(source.split(start).length,2,'exact weekly manual override writer must be unique');
assert.equal(source.split(end).length,2,'exact clear writer must be unique');
const save=start+source.split(start)[1].split(end)[0];
assert.match(source,/import \{rows,run,persist,snapshot\} from '\.\/database\.js'/);
assert.match(save,/await snapshot\('manual:weekly-context-override'\)/);
assert.match(save,/INSERT OR REPLACE INTO settings/);
assert.match(save,/await persist\(\)/);
assert.doesNotMatch(save,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_WEEKLY_OVERRIDE_EXACT_LEGACY_SAVE_SOURCE_BOUND_DIRECT_PERSIST');

const clone=value=>JSON.parse(JSON.stringify(value));
const seed={key:'weekly_context_manual_override:2026-10-26',
  value_json:'SYNTHETIC_SEED',updated_at:'2026-10-26T00:00:00.000Z'};
let durable={settings:[clone(seed)],public_master:[{id:'synthetic-master',value:'IMMUTABLE'}]};
let snapshots=0,acks=0,releaseFirst,enteredFirst;
const firstEntered=new Promise(resolve=>{enteredFirst=resolve;});
function tab(hold=false){
  const local=clone(durable);
  let snapshotReady=false;
  const context={
    rows(sql,params=[]){
      assert.match(sql,/SELECT value_json,updated_at FROM settings WHERE key=\?/);
      return local.settings.filter(row=>row.key===params[0]).map(clone);
    },
    async snapshot(reason){
      assert.equal(reason,'manual:weekly-context-override');
      snapshots++;snapshotReady=true;
      return {status:'SYNTHETIC_SNAPSHOT'};
    },
    run(sql,params){
      assert.ok(snapshotReady,'snapshot must precede SQL mutation');
      assert.match(sql,/^INSERT OR REPLACE INTO settings\(key,value_json,updated_at\) VALUES\(\?,\?,\?\)$/);
      assert.equal(params.length,3);
      const [key,value_json,updated_at]=params;
      local.settings=local.settings.filter(row=>row.key!==key);
      local.settings.push({key,value_json,updated_at});
    },
    async persist(){
      assert.ok(snapshotReady,'persist without snapshot');
      const exported=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;enteredFirst();});
      durable=exported;acks++;
    },
    localIso:()=> '2026-10-31T05:55:00.000Z',
    Object,String,Array,JSON,Promise,Error,console,
  };
  const stripped=source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
  const ctx=vm.createContext(context);
  vm.runInContext(stripped+'\n;globalThis.__save=saveWeeklyManualOverride;',ctx,{timeout:3000});
  return ctx.__save;
}
const a=tab(true);
await assert.rejects(a({weekStart:'',basedOnImportRevision:'revision-A',fields:{camp:'A'}}),/week_start/);
await assert.rejects(a({weekStart:'2026-11-02',basedOnImportRevision:'',fields:{camp:'A'}}),/revision/);
await assert.rejects(a({weekStart:'2026-11-02',basedOnImportRevision:'revision-A',fields:{unknown:'IGNORED'}}),/人工覆寫欄位/);
assert.equal(snapshots,0,'invalid input must not snapshot');
assert.equal(acks,0,'invalid input must not persist');
assert.equal(durable.settings.length,1);
console.log('PASS G265_WEEKLY_OVERRIDE_INVALID_INPUT_PRE_SNAPSHOT_ZERO_DURABLE_DELTA');

const first=a({weekStart:'2026-11-02',basedOnImportRevision:'revision-A',fields:{camp:'SYNTHETIC_A'}});
await firstEntered;
const b=tab(false);
const second=await b({weekStart:'2026-11-09',basedOnImportRevision:'revision-B',fields:{event_name:'SYNTHETIC_B'}});
assert.equal(second.week_start,'2026-11-09');
assert.equal(acks,1);
assert.ok(durable.settings.some(row=>row.key==='weekly_context_manual_override:2026-11-09'));
releaseFirst();
const earlier=await first;
assert.equal(earlier.week_start,'2026-11-02');
assert.equal(acks,2,'both legacy writes received success ACK');
assert.equal(snapshots,2,'both legacy writes took pre-write snapshots');
assert.ok(durable.settings.some(row=>row.key==='weekly_context_manual_override:2026-11-02'));
assert.ok(!durable.settings.some(row=>row.key==='weekly_context_manual_override:2026-11-09'),
  'later stale export erased the independently acknowledged week');
assert.ok(durable.settings.some(row=>row.key===seed.key&&row.value_json===seed.value_json));
assert.deepEqual(durable.public_master,[{id:'synthetic-master',value:'IMMUTABLE'}]);
console.log('PASS G265_WEEKLY_OVERRIDE_TWO_TABS_TWO_ACKS_UNRELATED_WEEK_LOST_UPDATE_NEGATIVE');
console.log('HOLD G265_WEEKLY_OVERRIDE_LEGACY_UNADMITTED_ALL_WRITERS_CRASH_RESTORE_ANDROID');
