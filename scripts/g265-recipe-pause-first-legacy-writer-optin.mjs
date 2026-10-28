import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createRecipeFeedbackPauseOptIn} from '../assets/js/sqlite-recipe-feedback-pause-optin.js';

// Source-bound exact legacy writer; no production import, private DB, or UI.
const legacy=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const original=legacy.split('export async function setRecipeRecommendationPaused(')[1];
assert.ok(original,'legacy pause-toggle writer must exist');
assert.match(original,/canonicalRecipe\(recipeId\)/);
assert.ok(original.includes('INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at)'));
assert.match(original,/VALUES\(\?,\?,0,NULL,\?\)/);
assert.match(original,/ON CONFLICT\(recipe_id\) DO UPDATE SET recommendation_paused=excluded\.recommendation_paused,updated_at=excluded\.updated_at/);
assert.match(original,/await persist\(\)/);
assert.match(original,/operation:'PAUSE_TOGGLE'/);
assert.doesNotMatch(legacy,/sqlite-recipe-feedback-pause-optin/);
console.log('PASS G265_RECIPE_PAUSE_EXACT_LEGACY_WRITER_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

// Actual disposable SQL.js, fake IndexedDB and cooperative test-only locks.
globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,closeStorageConnection}=await import('../assets/js/storage.js');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
seedDb.run('CREATE TABLE recipe_feedback_state(recipe_id TEXT PRIMARY KEY,recommendation_paused INTEGER NOT NULL,reference_maybe_wrong INTEGER NOT NULL,last_attempt_id TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO recipe_master VALUES('recipe-A','Synthetic','curry')");
seedDb.run("INSERT INTO recipe_feedback_state VALUES('recipe-A',0,1,'attempt-preserved','2026-10-01T00:00:00.000Z')");
const seed=new Uint8Array(seedDb.export());seedDb.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
await saveDatabaseBytes(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('pokemon_sleep_ai_manager');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
const seedHash=await hash(seed);
await new Promise((resolve,reject)=>{
  const tx=db.transaction('metadata','readwrite');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let lockTail=Promise.resolve();
const locks={request(_name,_options,callback){
  const next=lockTail.then(()=>callback({mode:'exclusive'}));
  lockTail=next.catch(()=>{});return next;
}};
let opened=0;
const make=({locksOverride=locks}={})=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:locksOverride,fingerprint:hash});
  const writer=createRecipeFeedbackPauseOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
  return {writer};
};
const {writer}=make();
// Date.parse normalizes impossible calendar days (e.g. Feb 30) into March.
// Reject before opening SQLite or acquiring a player-facing write path.
for(const invalidAt of ['2026-02-29T12:34:56.000Z','2026-02-30T12:34:56.000Z',
  '2026-04-31T12:34:56.000Z','2026-01-01T24:00:00.000Z']){
  await assert.rejects(writer.execute({recipeId:'recipe-A',paused:true,updatedAt:invalidAt,
    expectedGeneration:0,expectedFingerprint:seedHash}),
    error=>error.code==='G265_RECIPE_PAUSE_TIMESTAMP_REQUIRED');
}
assert.equal(opened,0,'invalid calendar timestamps must not open SQL.js');
console.log('PASS G265_RECIPE_PAUSE_CALENDAR_ROLLOVER_REJECTED_BEFORE_SQL');
const updatedAt='2026-10-28T12:34:56.000Z';
await assert.rejects(writer.execute({recipeId:'recipe-A',paused:1,updatedAt,
  expectedGeneration:0,expectedFingerprint:seedHash}),
  error=>error.code==='G265_RECIPE_PAUSE_BOOLEAN_REQUIRED');
assert.equal(opened,0);
const result=await writer.execute({recipeId:' recipe-A ',paused:true,updatedAt,
  expectedGeneration:0,expectedFingerprint:seedHash});
assert.equal(result.status,'PERSISTED');assert.equal(result.generation,1);
const persisted=new Uint8Array(await loadDatabaseBytes());
const reloaded=new SQL.Database(persisted);
const row=reloaded.exec("SELECT recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at FROM recipe_feedback_state WHERE recipe_id='recipe-A'")[0].values[0];
assert.deepEqual(row,['recipe-A',1,1,'attempt-preserved',updatedAt]);
assert.equal(reloaded.exec('SELECT COUNT(*) FROM recipe_master')[0].values[0][0],1);
reloaded.close();
assert.equal(result.sha256,await hash(persisted));
console.log('PASS G265_RECIPE_PAUSE_FRESH_DURABLE_SQLJS_UPSERT_ATOMIC_CAS_READBACK');

const beforeStaleOpen=opened;
await assert.rejects(writer.execute({recipeId:'recipe-A',paused:false,updatedAt,
  expectedGeneration:0,expectedFingerprint:seedHash}),
  error=>error.code==='G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(opened,beforeStaleOpen,'stale writer must never open SQL.js');
assert.equal(writer.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash(new Uint8Array(await loadDatabaseBytes())),result.sha256);
console.log('PASS G265_RECIPE_PAUSE_STALE_REJECTS_BEFORE_MUTATION_STICKY_HOLD');

const {writer:unknown}=make();
await assert.rejects(unknown.execute({recipeId:'unknown-recipe',paused:false,updatedAt,
  expectedGeneration:1,expectedFingerprint:result.sha256}),
  error=>error.code==='G265_RECIPE_PAUSE_UNKNOWN_RECIPE');
assert.equal(unknown.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash(new Uint8Array(await loadDatabaseBytes())),result.sha256);
const {writer:withoutLocks}=make({locksOverride:null});
await assert.rejects(withoutLocks.execute({recipeId:'recipe-A',paused:false,updatedAt,
  expectedGeneration:1,expectedFingerprint:result.sha256}),
  error=>error.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(withoutLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash(new Uint8Array(await loadDatabaseBytes())),result.sha256);
console.log('PASS G265_RECIPE_PAUSE_UNKNOWN_RECIPE_ROLLBACK_NO_ACK_NO_LOCKS_FAIL_CLOSED');
// Two independent opt-in tabs both begin with the same durable generation.
// Only the first may mutate; the stale contender must not open SQL.js.
const {writer:competingA}=make(),{writer:competingB}=make();
const beforeCompeteOpen=opened;
const firstTime='2026-10-28T13:00:00.000Z';
const secondTime='2026-10-28T13:01:00.000Z';
const [first,second]=await Promise.allSettled([
  competingA.execute({recipeId:'recipe-A',paused:false,updatedAt:firstTime,
    expectedGeneration:1,expectedFingerprint:result.sha256}),
  competingB.execute({recipeId:'recipe-A',paused:true,updatedAt:secondTime,
    expectedGeneration:1,expectedFingerprint:result.sha256}),
]);
assert.equal(first.status,'fulfilled');
assert.equal(first.value.generation,2);
assert.equal(second.status,'rejected');
assert.equal(second.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(opened,beforeCompeteOpen+1,'stale competing tab must not open SQL.js');
assert.equal(competingB.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const afterRace=new Uint8Array(await loadDatabaseBytes());
const raceDb=new SQL.Database(afterRace);
assert.deepEqual(raceDb.exec("SELECT recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at FROM recipe_feedback_state WHERE recipe_id='recipe-A'")[0].values[0],
  [0,1,'attempt-preserved',firstTime]);
raceDb.close();
assert.equal(first.value.sha256,await hash(afterRace));
console.log('PASS G265_RECIPE_PAUSE_TWO_OPTIN_WRITERS_ONE_WINNER_STALE_NEVER_OPENS_SQLJS');
console.log('HOLD G265_RECIPE_PAUSE_PRODUCTION_ADMISSION_ALL_23_LEGACY_WRITERS_ANDROID_OWNER_UAT');
db.close();closeStorageConnection();
