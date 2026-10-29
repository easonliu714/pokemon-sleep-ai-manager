// G265 fourth legacy writer: isolated synthetic SQL.js + IndexedDB opt-in only.
// No production player database, no runtime wiring, no migrations or shared writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {PUBLIC_RECIPE_PROVENANCE} from '../assets/js/public-recipe-provenance.js';
import {applyRecipeAttemptFeedbackSchema} from '../assets/js/recipe-attempt-feedback.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createRecipeAttemptFailureOptIn} from '../assets/js/sqlite-recipe-attempt-failure-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const target=legacy.split('export async function recordRecipeAttemptFailure(')[1]
  ?.split('// G6.2: share the attempt-write')[0];
assert.ok(target,'source-bound legacy writer must still exist');
assert.match(target,/INSERT INTO recipe_attempt_feedback/);
assert.match(target,/INSERT INTO recipe_feedback_state/);
assert.match(target,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-recipe-attempt-failure-optin/);
console.log('PASS G265_FOURTH_LEGACY_RECORD_ATTEMPT_SOURCE_BOUND_OPTIN_NOT_PRODUCTION_WIRED');

const provenance=PUBLIC_RECIPE_PROVENANCE.find(row=>row.lifecycle==='ACTIVE'&&row.formula_source_ref);
assert.ok(provenance,'real canonical provenance required');
const recipeId=provenance.recipe_id;
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
seedDb.run('INSERT INTO recipe_master VALUES(?,?,?)',[recipeId,provenance.recipe_name_zh_tw,provenance.category]);
seedDb.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
seedDb.run('INSERT INTO ingredient_master VALUES(?)',['fixture-ingredient']);
applyRecipeAttemptFeedbackSchema(seedDb);
seedDb.run("INSERT INTO recipe_feedback_state VALUES('unrelated',1,1,'keep-attempt','2026-10-01T00:00:00.000Z')");
seedDb.run(`CREATE TRIGGER deny_fixture_state_update BEFORE UPDATE ON recipe_feedback_state
  WHEN NEW.updated_at='2026-10-29T11:00:00.000Z'
  BEGIN SELECT RAISE(ABORT,'synthetic-state-upsert-rejection'); END`);
const seed=new Uint8Array(seedDb.export());seedDb.close();

globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,closeStorageConnection}=await import('../assets/js/storage.js');
await saveDatabaseBytes(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('pokemon_sleep_ai_manager');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
await new Promise((resolve,reject)=>{
  const tx=db.transaction('metadata','readwrite');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let tail=Promise.resolve(),opened=0;
const locks={request(_name,_options,callback){
  const next=tail.then(()=>callback({mode:'exclusive'}));
  tail=next.catch(()=>{});return next;
}};
const make=(locksOverride=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:locksOverride,fingerprint:hash});
  return createRecipeAttemptFailureOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
};
const input={
  attemptId:'fixture-attempt-1',recipeId,
  attemptedAt:'2026-10-29T10:00:00.000Z',createdAt:'2026-10-29T10:00:00.000Z',
  actualIngredients:[{ingredient_name:'fixture-ingredient',quantity:2}],
  referenceMaybeWrong:true,recommendationPaused:true,notes:'synthetic only',
  expectedGeneration:0,expectedFingerprint:seedHash,
};
const writer=make();
for(const invalid of [
  {...input,attemptId:''},
  {...input,attemptedAt:'2026-02-30T10:00:00.000Z'},
  {...input,actualIngredients:[{ingredient_name:'fixture-ingredient',quantity:0}]},
  {...input,actualIngredients:[{ingredient_name:'fixture-ingredient',quantity:1.5}]},
  {...input,referenceMaybeWrong:1},
  {...input,recipeId:'unknown-canonical-recipe'},
]){
  await assert.rejects(writer.execute(invalid),e=>String(e.code||'').startsWith('G265_ATTEMPT_'));
}
assert.equal(opened,0,'invalid input and missing provenance must fail before SQL');
console.log('PASS G265_FOURTH_ATTEMPT_INVALID_DATE_INGREDIENT_PROVENANCE_PRE_SQL_FAIL_CLOSED');

const read=async()=>{
  const bytes=new Uint8Array(await loadDatabaseBytes());
  const sql=new SQL.Database(bytes);
  const attempts=sql.exec('SELECT attempt_id,recipe_id,outcome,source_type,source_ref,actual_ingredients_json FROM recipe_attempt_feedback ORDER BY attempt_id');
  const state=sql.exec('SELECT recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at FROM recipe_feedback_state ORDER BY recipe_id');
  sql.close();
  return {bytes,attempts:attempts?.[0]?.values||[],state:state?.[0]?.values||[]};
};
const first=await writer.execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
const afterFirst=await read();
assert.equal(first.sha256,await hash(afterFirst.bytes));
assert.equal(afterFirst.attempts.length,1);
assert.equal(afterFirst.attempts[0][0],input.attemptId);
assert.equal(afterFirst.attempts[0][2],'DID_NOT_UNLOCK');
assert.equal(afterFirst.attempts[0][3],provenance.formula_source_type);
assert.equal(afterFirst.attempts[0][4],provenance.formula_source_ref);
assert.deepEqual(JSON.parse(afterFirst.attempts[0][5]),[{ingredient_name:'fixture-ingredient',quantity:2}]);
assert.deepEqual(afterFirst.state.find(row=>row[0]===recipeId).slice(1,4),[1,1,input.attemptId]);
assert.deepEqual(afterFirst.state.find(row=>row[0]==='unrelated').slice(1,4),[1,1,'keep-attempt']);
console.log('PASS G265_FOURTH_ATTEMPT_FRESH_DURABLE_TWO_TABLE_SQLJS_CAS_READBACK_PROVENANCE');

const a=make(),b=make(),beforeRaceOpen=opened;
const next={...input,attemptId:'fixture-attempt-2',createdAt:'2026-10-29T10:01:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const [winner,stale]=await Promise.allSettled([
  a.execute(next),
  b.execute({...next,attemptId:'fixture-attempt-3',createdAt:'2026-10-29T10:02:00.000Z'})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(winner.value.generation,2);
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+1,'stale contender must never open SQL.js');
const afterRace=await read();
assert.deepEqual(afterRace.attempts.map(row=>row[0]),['fixture-attempt-1','fixture-attempt-2']);
assert.equal(afterRace.state.find(row=>row[0]===recipeId)[3],'fixture-attempt-2');
console.log('PASS G265_FOURTH_ATTEMPT_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS');

const stableHash=await hash(afterRace.bytes);
const current={...next,expectedGeneration:2,expectedFingerprint:winner.value.sha256};
const duplicate=make();
await assert.rejects(duplicate.execute({...current,attemptId:'fixture-attempt-1'}),
  e=>e.code==='G265_ATTEMPT_DUPLICATE_REPLAY_FORBIDDEN');
assert.equal(duplicate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),stableHash);
const unknownIngredient=make();
await assert.rejects(unknownIngredient.execute({...current,attemptId:'fixture-attempt-4',
  actualIngredients:[{ingredient_name:'unknown-fixture',quantity:1}]}),
  e=>e.code==='G265_ATTEMPT_UNKNOWN_CANONICAL_INGREDIENT');
assert.equal(unknownIngredient.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),stableHash);
console.log('PASS G265_FOURTH_ATTEMPT_DUPLICATE_REPLAY_UNKNOWN_INGREDIENT_STICKY_HOLD');

const abort=make();
await assert.rejects(abort.execute({...current,attemptId:'fixture-attempt-5',
  createdAt:'2026-10-29T11:00:00.000Z'}),
  e=>String(e.message||'').includes('synthetic-state-upsert-rejection'));
assert.equal(abort.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),stableHash,'second-statement failure must roll back first insert');
const noLocks=make(null),beforeNoLockOpen=opened;
await assert.rejects(noLocks.execute({...current,attemptId:'fixture-attempt-6'}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(opened,beforeNoLockOpen);
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),stableHash);
console.log('PASS G265_FOURTH_ATTEMPT_SECOND_SQL_FAILURE_ROLLBACK_NO_LOCKS_ZERO_DURABLE_DELTA');
console.log('HOLD G265_FOURTH_ATTEMPT_NO_PRODUCTION_ADMISSION_ALL_23_LEGACY_ANDROID_OWNER_UAT');
db.close();closeStorageConnection();
