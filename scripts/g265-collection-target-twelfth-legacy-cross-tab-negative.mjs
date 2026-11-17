// G265 #861: the old two-ACK overwrite is no longer an expected outcome after
// production native pre-SQL admission. Preserve a strict executable denial
// contract here; the adjacent real Chromium two-tab gate checks native locks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(source.split(marker).length,2);
const operation=source.slice(source.indexOf(marker)).replace(/^export /,'');
assert.match(operation,/INSERT OR REPLACE INTO collection_targets/);
assert.match(operation,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(operation,/withPrimarySqliteMutationLock\(async \(lease\)/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(operation,/close\(\{uncertainOutcome:!acknowledged\}\)/);
const leaseAt=operation.indexOf('await withPrimarySqliteMutationLock(');
const snapshotAt=operation.indexOf("await snapshot('manual:collection-target')");
const sqlAt=operation.indexOf('INSERT OR REPLACE INTO collection_targets');
assert.ok(leaseAt>=0&&leaseAt<snapshotAt&&snapshotAt<sqlAt);
let snapshots=0,sql=0,persists=0,leases=0,closes=[];
const form={onsubmit:null};
const api={
  ensureUi(){},weeklyForm(){},warroomForm(){},renderCollection(){},installStrategyRefreshListeners(){},
  document:{getElementById(id){assert.equal(id,'collectionAddForm');return form;}},
  FormData:class{constructor(target){this.values=target.values;}get(key){return this.values[key]??null;}},
  alert(){},
  beginSqliteExclusiveWriteWindow(){return options=>closes.push(options);},
  async withPrimarySqliteMutationLock(){leases++;throw new Error('SQLITE_PRIMARY_NATIVE_LOCK_UNAVAILABLE');},
  async snapshot(){snapshots++;},run(){sql++;},async persist(){persists++;},
  withSqliteCoordinatedMutation(fn){return fn();},
  begin(){throw Error('DENIAL_MUST_NOT_BEGIN');},commit(){throw Error('DENIAL_MUST_NOT_COMMIT');},
  rollback(){throw Error('DENIAL_MUST_NOT_ROLLBACK');},now(){return '2026-11-17T00:00:00Z';}
};
vm.runInContext(operation+'\nsetupG3Pages();',vm.createContext(api),{timeout:3000});
await assert.rejects(form.onsubmit({
  preventDefault(){},target:{values:{species:'SYNTHETIC_DENIED'},reset(){throw Error('DENIAL_MUST_NOT_RESET');}}
}),/SQLITE_PRIMARY_NATIVE_LOCK_UNAVAILABLE/);
assert.deepEqual({leases,snapshots,sql,persists},{leases:1,snapshots:0,sql:0,persists:0});
assert.equal(closes.length,1);
assert.equal(closes[0].uncertainOutcome,true);
console.log('PASS G265_TWELFTH_COLLECTION_PRODUCTION_DENIED_ZERO_EFFECT_STICKY_HOLD');
