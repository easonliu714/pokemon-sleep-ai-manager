// G265 War Room / former tenth legacy negative: the historical unsafe two-ACK
// stale overwrite is no longer a valid *passing* production contract.
// Use the actual warroomForm source to assert pre-SQL native admission denial.
// Real Chromium + IDB generation/SHA durable CAS remains the separate required gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const start='function warroomForm() {',end='function renderCollection() {';
assert.equal(source.split(start).length,2,'exact production warroomForm marker');
const tail=source.split(start)[1];
assert.ok(tail.includes(end),'exact production warroomForm end marker');
const operation=start+tail.split(end)[0];
assert.match(operation,/document\.getElementById\('warroomForm'\)\.onsubmit\s*=\s*async/);
assert.match(operation,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(operation,/withPrimarySqliteMutationLock\(async \(lease\)/);
assert.match(operation,/await snapshot\('manual:weekly-strategy'\)/);
assert.match(operation,/INSERT OR REPLACE INTO weekly_strategy/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(operation,/close\(\{uncertainOutcome:!acknowledged\}\)/);
assert.doesNotMatch(operation,/await persist\(\)/,'unsafe legacy bare persist must be retired');
const admission=operation.indexOf('await withPrimarySqliteMutationLock(');
const snapshotAt=operation.indexOf("await snapshot('manual:weekly-strategy')");
const sqlAt=operation.indexOf('INSERT OR REPLACE INTO weekly_strategy');
assert.ok(admission>=0&&admission<snapshotAt&&snapshotAt<sqlAt,
  'native primary lease must be obtained before snapshot and SQL');

let snapshots=0,sql=0,persists=0,leases=0,alerts=0,closes=[];
let sticky=false;
const panels={warroomPanel:{innerHTML:''},warroomForm:{onsubmit:null}};
const api={
  rows(query){assert.match(query,/SELECT \* FROM weekly_strategy/);return [];},
  document:{getElementById(id){assert.ok(panels[id],id);return panels[id];}},
  FormData:class{constructor(target){this.values=target.values;}get(key){return this.values[key]??null;}},
  field:()=>'',area:()=>'',renderRecipeStrategyProjection(){},now:()=> '2026-11-17T00:00:00Z',
  alert(){alerts++;},
  beginSqliteExclusiveWriteWindow(){
    if(sticky)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
    return options=>{closes.push(options);if(options.uncertainOutcome)sticky=true};
  },
  async withPrimarySqliteMutationLock(){
    leases++;throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  },
  async snapshot(){snapshots++;},run(){sql++;},async persist(){persists++;},
  withSqliteCoordinatedMutation(fn){return fn();},
  begin(){throw Error('DENIAL_MUST_NOT_BEGIN')},
  commit(){throw Error('DENIAL_MUST_NOT_COMMIT')},
  rollback(){throw Error('DENIAL_MUST_NOT_ROLLBACK')},
};
vm.runInContext(operation+'\nwarroomForm();',vm.createContext(api),{timeout:3000});
assert.equal(typeof panels.warroomForm.onsubmit,'function','real War Room onsubmit installed');
const submit=()=>panels.warroomForm.onsubmit({
  preventDefault(){},target:{values:{week_start:'2026-11-16',team_summary:'SYNTHETIC_STALE'}}
});
await assert.rejects(submit(),/SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED/);
assert.deepEqual({leases,snapshots,sql,persists,alerts},
  {leases:1,snapshots:0,sql:0,persists:0,alerts:0},
  'stale production submit must have zero effects');
assert.equal(closes.length,1,'one exclusive window must be closed');
assert.equal(closes[0].uncertainOutcome,true,'stale admission failure sets sticky HOLD');
await assert.rejects(submit(),/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/,
  'blind retry must be rejected before native admission');
assert.deepEqual({leases,snapshots,sql,persists,alerts},
  {leases:1,snapshots:0,sql:0,persists:0,alerts:0},
  'sticky retry must not reacquire lease or mutate any data');
console.log('PASS G265_TENTH_WARROOM_PRODUCTION_PRE_SQL_NATIVE_STALE_ZERO_EFFECT_STICKY');
console.log('HISTORICAL_NEGATIVE_2ACK_OVERWRITE_RETIRED_AFTER_PRODUCTION_NATIVE_REPAIR');
