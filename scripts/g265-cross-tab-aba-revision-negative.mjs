import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

// G265 independent NEGATIVE gate. Disposable SQL.js bytes and a simulated
// exclusive Web Lock only; never open the player's IndexedDB/SQLite.
// The SHA-256-only contract cannot detect A -> B -> A (ABA) durable history.
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_aba (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
seed.run("INSERT INTO g265_aba VALUES('seed','A')");
const originalBytes=new Uint8Array(seed.export());
seed.close();
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const originalHash=await digest(originalBytes);
let durable=new Uint8Array(originalBytes);
let durableGeneration=0;
const writes=[];
const locks={
  async request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.equal(options.signal.aborted,false);
    return callback({name,mode:'exclusive'});
  }
};
const gate=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),
  fingerprint:digest,timeoutMs:2000
});
const write=bytes=>{durable=new Uint8Array(bytes);durableGeneration++;
  writes.push({generation:durableGeneration,hash:null});
  return {persistedBytes:new Uint8Array(durable)};
};
const addRow=(bytes,id)=>{
  const sql=new SQL.Database(new Uint8Array(bytes));
  sql.run('INSERT INTO g265_aba VALUES(?,?)',[id,id]);
  const next=new Uint8Array(sql.export());sql.close();return next;
};
// A tab opened at generation 0 and retained the original fingerprint.
const staleTab=gate();
const staleGeneration=durableGeneration;
// Tab A writes an intermediate, acknowledged SQLite image (generation 1).
const first=await gate().execute({
  reason:'intermediate-write',expectedFingerprint:originalHash,
  writeUnderLock:async({latestBytes})=>write(addRow(latestBytes,'intermediate'))
});
assert.equal(first.status,'PERSISTED');
assert.notEqual(await digest(durable),originalHash);
assert.equal(durableGeneration,1);
// A separate legitimate restore puts the EXACT original bytes back under
// the lock (generation 2). Byte hash returns to A despite intervening write.
const second=await gate().execute({
  reason:'restore-original-bytes',expectedFingerprint:await digest(durable),
  writeUnderLock:async()=>write(originalBytes)
});
assert.equal(second.status,'PERSISTED');
assert.equal(await digest(durable),originalHash);
assert.equal(durableGeneration,2);
// Stale tab from generation 0 now passes SHA-only admission. This MUST be
// recorded as a reproduced safety gap, not mistaken for a successful fix.
const third=await staleTab.execute({
  reason:'stale-tab-after-aba',expectedFingerprint:originalHash,
  writeUnderLock:async({latestBytes})=>write(addRow(latestBytes,'stale-accepted'))
});
assert.equal(third.status,'PERSISTED');
assert.equal(durableGeneration,3);
assert.equal(staleGeneration,0);
assert.notEqual(staleGeneration,durableGeneration);
assert.equal(writes.length,3);
const check=new SQL.Database(new Uint8Array(durable));
assert.deepEqual(check.exec('SELECT id FROM g265_aba ORDER BY id')[0].values.flat(),['seed','stale-accepted']);
check.close();
console.log('PASS G265_ABA_SOURCE_BOUND_REAL_SQLITE_THREE_DURABLE_GENERATIONS');
console.log('REPRODUCED_HOLD G265_SHA256_ONLY_CANNOT_DETECT_A_B_A_DURABLE_REVISION_CHANGE');
console.log('HOLD G265_ATOMIC_DURABLE_REVISION_POLICY_PRODUCTION_WIRING_LEGACY_23_ANDROID_UAT');
