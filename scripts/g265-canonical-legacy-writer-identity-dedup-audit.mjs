// G265 canonical Legacy Direct Writer identity and duplicate-gate source audit.
// This is a read-only SOURCE/TEST gate: it never opens player SQLite or IndexedDB.
// Detect duplicate ordinal coverage before falsely crediting another globally admitted writer.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const dir='assets/js/';
const directImport=/from\s*['"]\.\/database\.js['"]/;
const callsite=/\b(?:run|begin|commit|persist|snapshot)\s*\(/;
const modules=fs.readdirSync(dir).filter(name=>name.endsWith('.js'))
  .filter(name=>{const source=read(dir+name);return directImport.test(source)&&callsite.test(source);})
  .sort();
const opted=modules.filter(name=>{
  const source=read(dir+name);
  return /import\s*\{\s*runSqliteWriteSession\s*\}\s*from\s*['"]\.\/sqlite-write-session-runtime\.js['"]/.test(source)
    && /\brunSqliteWriteSession\s*\(/.test(source);
}).sort();
assert.equal(modules.length,25,'source-bound direct writer inventory changed; audit before modifying cardinality');
assert.deepEqual(opted,['strategy-goal-store.js','weekly-manual-activity-bonuses.js']);
const legacy=modules.filter(name=>!opted.includes(name));
assert.equal(legacy.length,23);
console.log('PASS G265_CANONICAL_DIRECT_WRITER_INVENTORY_25_OPTIN_2_LEGACY_23');

const scriptsDir='scripts/';
const targets=new Map();
for(const file of fs.readdirSync(scriptsDir).filter(name=>name.startsWith('g265-')&&name.endsWith('.mjs'))){
  const source=read(scriptsDir+file);
  // A source path reference is an audit lead, not proof that a CI Gate or Android UAT passed.
  const refs=legacy.filter(name=>source.includes('../assets/js/'+name)
    ||source.includes("'assets/js/"+name+"'")
    ||source.includes('"assets/js/'+name+'"'));
  for(const name of refs){
    if(!targets.has(name))targets.set(name,[]);
    targets.get(name).push(file);
  }
}
const exactSource=file=>{
  const source=read(scriptsDir+file);
  const matches=legacy.filter(name=>source.includes('../assets/js/'+name)
    ||source.includes("'assets/js/"+name+"'")
    ||source.includes('"assets/js/'+name+'"'));
  assert.equal(matches.length,1,file+' must identify exactly one production direct writer');
  return matches[0];
};
const fifthNegative='g265-analysis-revision-fifth-legacy-cross-tab-negative.mjs';
const fifthIsolated='g265-analysis-revision-fifth-legacy-writer-optin.mjs';
const fifthChromium='g265-native-chromium-fifth-analysis-revision-cas.mjs';
const twentyFirstNegative='g265-analysis-revision-twenty-first-legacy-cross-tab-negative.mjs';
for(const file of [fifthNegative,fifthIsolated,fifthChromium,twentyFirstNegative])
  assert.equal(exactSource(file),'analysis-revision-store.js');
const production=read(dir+'analysis-revision-store.js');
assert.match(production,/export async function saveAnalysisRevision\(/);
assert.match(production,/await snapshot\(/);
assert.match(production,/await persist\(\)/);
assert.doesNotMatch(production,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const priorIsolated=read(scriptsDir+fifthIsolated);
const priorNative=read(scriptsDir+fifthChromium);
assert.match(priorIsolated,/FRESH_DURABLE_SQLJS_CAS_ACK_ROW_READBACK/);
assert.match(priorIsolated,/DUPLICATE_REPLAY_AND_SQL_ROLLBACK_ZERO_DURABLE_DELTA/);
assert.match(priorIsolated,/MISSING_WEB_LOCKS_FAIL_CLOSED/);
assert.match(priorNative,/TAB_CLOSE_ACK_LOSS_RELOAD_STALE_REPLAY_ZERO_SQLJS/);
assert.match(priorNative,/SQL_ROLLBACK_RELOAD_ZERO_DURABLE_DELTA/);
assert.match(read(scriptsDir+twentyFirstNegative),/TWO_ACK_STALE_INDEPENDENT_REVISION_LOST_NEGATIVE/);
console.log('PASS G265_FIFTH_AND_TWENTY_FIRST_SAME_EXACT_ANALYSIS_REVISION_PRODUCTION_WRITER');
console.log('PASS G265_FIFTH_EXISTING_NEGATIVE_CAS_CHROMIUM_ROLLBACK_ACK_LOSS_ALREADY_SOURCE_BOUND');

const withoutDirectReference=legacy.filter(name=>!targets.has(name));
const inventory=legacy.map(name=>({
  module:name,source_reference_count:(targets.get(name)||[]).length,
  source_reference_examples:(targets.get(name)||[]).slice(0,3)
}));
assert.equal(new Set(inventory.map(row=>row.module)).size,23);
assert.equal(inventory.find(row=>row.module==='analysis-revision-store.js').module,'analysis-revision-store.js');
console.log('G265_CANONICAL_LEGACY_WRITER_SOURCE_REFERENCE_INVENTORY='+JSON.stringify(inventory));
console.log('G265_LEGACY_WRITERS_WITHOUT_G265_SOURCE_PATH_REFERENCE='+JSON.stringify(withoutDirectReference));
console.log('HOLD G265_TWENTY_FIRST_DUPLICATES_FIFTH_NO_NEW_DISTINCT_WRITER_CREDIT');
console.log('HOLD G265_23_LEGACY_WRITERS_GLOBAL_ADMISSION_CRASH_RESTORE_NAMED_DRAFT_ANDROID_DOD');
