// G265 fifth legacy writer isolated SQL.js + fake IndexedDB durable CAS contract.
// No production storage, app import, migration or player data. Original legacy writer unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createAnalysisRevisionOptIn} from '../assets/js/sqlite-analysis-revision-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/analysis-revision-store.js',import.meta.url),'utf8');
const exact=legacy.split('export async function saveAnalysisRevision(')[1]?.split('\nexport {TABLE_SQL}')[0];
assert.ok(exact,'fifth legacy source must remain identifiable');
assert.match(exact,/await snapshot\(/);
assert.match(exact,/await persist\(\)/);
assert.match(exact,/INSERT INTO image_analysis_revision/);
assert.doesNotMatch(legacy,/sqlite-analysis-revision-optin/);
const tick=String.fromCharCode(96);
const schema=legacy.split('const TABLE_SQL='+tick)[1]?.split(tick+';')[0];
assert.ok(schema&&schema.includes('image_analysis_revision'));
console.log('PASS G265_FIFTH_ANALYSIS_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run(schema);
seedDb.run('CREATE INDEX idx_image_analysis_revision_lookup ON image_analysis_revision(image_sha256,analysis_type,revision_no DESC)');
seedDb.run("INSERT INTO image_analysis_revision(analysis_id,image_sha256,analysis_type,revision_no,result_json,created_at) VALUES('unrelated','" + 'f'.repeat(64) + "','unrelated',1,'{}','2026-10-29T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_fixture_analysis_insert BEFORE INSERT ON image_analysis_revision WHEN NEW.analysis_id='analysis-trigger' BEGIN SELECT RAISE(ABORT,'synthetic-analysis-insert-rejection'); END");
const seed=new Uint8Array(seedDb.export());seedDb.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('g265-fifth-analysis-disposable-fixture',1);
  request.onupgradeneeded=()=>{
    request.result.createObjectStore('database');
    request.result.createObjectStore('metadata');
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
await new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readwrite');
  tx.objectStore('database').put(seed.slice().buffer,'primary');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let queue=Promise.resolve(),opened=0;
const locks={request(_name,_options,callback){
  const next=queue.then(()=>callback({mode:'exclusive'}));
  queue=next.catch(()=>{});return next;
}};
const make=(locksOverride=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:locksOverride,fingerprint:hash});
  return createAnalysisRevisionOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
};
const durable=()=>new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readonly');
  const bytes=tx.objectStore('database').get('primary');
  const rev=tx.objectStore('metadata').get('revision:primary');
  tx.oncomplete=()=>resolve({bytes:new Uint8Array(bytes.result),revision:rev.result});
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
const read=async()=>{
  const pair=await durable();
  assert.equal(await hash(pair.bytes),pair.revision.sha256);
  const sql=new SQL.Database(pair.bytes);
  const records=sql.exec('SELECT analysis_id,image_sha256,analysis_type,revision_no,result_json,supersedes_analysis_id FROM image_analysis_revision ORDER BY analysis_id')?.[0]?.values||[];
  sql.close();return {...pair,records};
};
const imageSha256='a'.repeat(64);
const input={
  analysisId:'analysis-1',imageSha256,analysisType:'synthetic-ocr',
  sourceImageRef:'fixture://image/1',forced:false,provider:'fixture',
  model:'synthetic',promptVersion:'fixture-v1',regionPreset:null,
  result:{synthetic:true},createdAt:'2026-10-29T00:00:00.000Z',
  expectedGeneration:0,expectedFingerprint:seedHash
};
const invalid=make();
for(const item of [
  {...input,analysisId:''},
  {...input,imageSha256:'not-a-hash'},
  {...input,createdAt:'2026-02-30T00:00:00.000Z'},
  {...input,forced:1},
  {...input,result:()=>0}
]){
  await assert.rejects(invalid.execute(item),e=>String(e.code||'').startsWith('G265_ANALYSIS_'));
}
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_FIFTH_ANALYSIS_INVALID_INPUT_PRE_SQL_NO_DURABLE_DELTA');

const writer=make();
const first=await writer.execute(input);
assert.equal(first.status,'PERSISTED');
assert.equal(first.generation,1);
assert.equal(first.revisionNo,1);
assert.equal(first.supersedesAnalysisId,null);
const afterFirst=await read();
assert.equal(afterFirst.revision.generation,1);
assert.equal(first.sha256,afterFirst.revision.sha256);
assert.equal(afterFirst.records.length,2,'unrelated revision must be preserved');
assert.deepEqual(afterFirst.records.find(row=>row[0]==='analysis-1').slice(3),[1,'{"synthetic":true}',null]);
assert.ok(afterFirst.records.some(row=>row[0]==='unrelated'));
console.log('PASS G265_FIFTH_ANALYSIS_FRESH_DURABLE_SQLJS_CAS_ACK_ROW_READBACK');

const a=make(),b=make();
const beforeRaceOpen=opened;
const next={...input,analysisId:'analysis-2',result:{tab:'A'},
  createdAt:'2026-10-29T00:01:00.000Z',expectedGeneration:1,expectedFingerprint:first.sha256};
const [win,stale]=await Promise.allSettled([
  a.execute(next),b.execute({...next,analysisId:'analysis-3',result:{tab:'B'}})
]);
assert.equal(win.status,'fulfilled');
assert.equal(win.value.revisionNo,2);
assert.equal(win.value.supersedesAnalysisId,'analysis-1');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender must open zero SQL.js connections');
const afterRace=await read();
assert.deepEqual(afterRace.records.filter(row=>row[1]===imageSha256).map(row=>row[0]),['analysis-1','analysis-2']);
assert.equal(afterRace.revision.generation,2);
console.log('PASS G265_FIFTH_ANALYSIS_TWO_WRITERS_ONE_ACK_UNIQUE_REVISION_STALE_ZERO_SQLJS');

const fresh=make();
const third=await fresh.execute({...next,analysisId:'analysis-3',
  expectedGeneration:2,expectedFingerprint:win.value.sha256,
  createdAt:'2026-10-29T00:02:00.000Z'});
assert.equal(third.revisionNo,3);
assert.equal(third.supersedesAnalysisId,'analysis-2');
assert.equal((await read()).records.filter(row=>row[1]===imageSha256).length,3);
console.log('PASS G265_FIFTH_ANALYSIS_EXPLICIT_FRESH_RELOAD_REVISION_CHAIN');

const stable=await read();
const current={...next,expectedGeneration:3,expectedFingerprint:third.sha256};
const duplicate=make();
await assert.rejects(duplicate.execute({...current,analysisId:'analysis-1'}),
  e=>e.code==='G265_ANALYSIS_DUPLICATE_ID_REPLAY');
assert.equal(duplicate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal((await read()).revision.sha256,stable.revision.sha256);
const rollback=make();
await assert.rejects(rollback.execute({...current,analysisId:'analysis-trigger'}),
  e=>String(e.message||'').includes('synthetic-analysis-insert-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal((await read()).revision.sha256,stable.revision.sha256);
assert.equal((await read()).records.length,stable.records.length);
console.log('PASS G265_FIFTH_ANALYSIS_DUPLICATE_REPLAY_AND_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...current,analysisId:'analysis-4'}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,stable.revision.sha256);
console.log('PASS G265_FIFTH_ANALYSIS_MISSING_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_FIFTH_LEGACY_PRODUCTION_UNADMITTED_ANDROID_UAT_NOT_VERIFIED');
