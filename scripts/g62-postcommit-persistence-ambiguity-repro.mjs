import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {indexedDB} from 'fake-indexeddb';
import {buildRecipeAttemptFeedbackRecord,RECIPE_ATTEMPT_FEEDBACK_VERSION} from '../assets/js/recipe-attempt-feedback.js';

// Negative reproduction only: this is NOT a safety PASS or Android UAT.
// Both SQL.js and IndexedDB contain synthetic fixtures; no player data is opened.
const source=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const withoutImports=source.replace(/^import[\s\S]*?from '\.\/recipe-attempt-feedback\.js';\s*/,'');
assert.notEqual(withoutImports,source,'actual local module import boundary must match');
const executable=withoutImports.replace(/\bexport\s+(?=(?:async\s+)?function\s)/g,'');
assert.match(executable,/async function recordRecipeAttemptFailure/);
const SQL=await initSqlJs();

async function openStore(name){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>resolve(req.result);
  });
}
async function writeSnapshot(store,bytes){
  await new Promise((resolve,reject)=>{
    const tx=store.transaction('snapshots','readwrite');
    tx.objectStore('snapshots').put(bytes,'player-synthetic');
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}
async function readSnapshot(store){
  return new Promise((resolve,reject)=>{
    const tx=store.transaction('snapshots','readonly');
    const req=tx.objectStore('snapshots').get('player-synthetic');
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
}
const query=(db,sql,params=[])=>{
  const stmt=db.prepare(sql);
  try{stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}
  finally{stmt.free();}
};
const count=db=>Number(query(db,'SELECT COUNT(*) AS n FROM recipe_attempt_feedback')[0].n);
const setup=db=>{
  db.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
  db.run("INSERT INTO recipe_master VALUES('r1','Synthetic Recipe','synthetic')");
  db.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
  db.run("INSERT INTO ingredient_master VALUES('特選蘋果')");
  db.run('CREATE TABLE recipe_attempt_feedback(attempt_id TEXT PRIMARY KEY,recipe_id TEXT,attempted_at TEXT,outcome TEXT,actual_ingredients_json TEXT,source_type TEXT,source_name TEXT,source_ref TEXT,reference_maybe_wrong INTEGER,recommendation_paused_after_attempt INTEGER,notes TEXT,created_at TEXT)');
  db.run('CREATE TABLE recipe_feedback_state(recipe_id TEXT PRIMARY KEY,recommendation_paused INTEGER,reference_maybe_wrong INTEGER,last_attempt_id TEXT,updated_at TEXT)');
};

for(const mode of ['DENY_BEFORE_IDB_WRITE','ACK_LOST_AFTER_IDB_WRITE']){
  const db=new SQL.Database();setup(db);
  const store=await openStore('g62-isolated-'+mode);
  let persistMode=mode,commits=0,idCounter=0;
  const context=vm.createContext({
    rows:(sql,params)=>query(db,sql,params),
    run:(sql,params)=>db.run(sql,params),
    begin:()=>db.run('BEGIN'),
    commit:()=>{db.run('COMMIT');commits++;},
    rollback:()=>db.run('ROLLBACK'),
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    persist:async()=>{
      if(persistMode==='DENY_BEFORE_IDB_WRITE')throw new Error('synthetic_idb_write_denied');
      await writeSnapshot(store,db.export());
      if(persistMode==='ACK_LOST_AFTER_IDB_WRITE')throw new Error('synthetic_idb_ack_lost');
    },
    PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
    buildRecipeAttemptFeedbackRecord,RECIPE_ATTEMPT_FEEDBACK_VERSION,
    crypto:{randomUUID:()=> 'synthetic-id-'+(++idCounter)},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    dispatchEvent:()=>{},
  });
  vm.runInContext(executable+'\n;globalThis.__record=recordRecipeAttemptFailure;',context,{timeout:3000});
  const input={recipe_id:'r1',attempted_at:'2026-10-24T00:00:00Z',actual_ingredients:[{ingredient_name:'特選蘋果',quantity:2}],recommendation_paused:true};
  await assert.rejects(context.__record(input),/synthetic_idb_(write_denied|ack_lost)/);
  assert.equal(commits,1,'SQL COMMIT must precede rejected persist');
  assert.equal(count(db),1,'one attempt is already committed in memory');
  const before=await readSnapshot(store);
  assert.equal(Boolean(before),mode==='ACK_LOST_AFTER_IDB_WRITE','durability differs despite same UI rejection');
  if(before){const reloaded=new SQL.Database(before);assert.equal(count(reloaded),1);reloaded.close();}
  persistMode='OK';
  await context.__record(input); // Existing UI offers retry after ambiguous failure.
  assert.equal(count(db),2,'KNOWN UNSAFE behavior: retry creates a distinct second attempt');
  assert.equal(commits,2);
  const after=await readSnapshot(store);
  const reloaded=new SQL.Database(after);
  assert.equal(count(reloaded),2,'retry duplicate survives synthetic IndexedDB reload');
  assert.equal(query(db,'SELECT COUNT(*) AS n FROM recipe_master')[0].n,1,'public recipe master untouched');
  reloaded.close();db.close();store.close();
  console.log('REPRODUCED_HOLD G62_POSTCOMMIT_'+mode+' committed=2 durable=2 distinct_attempt_ids=2');
}
console.log('G62_SOURCE_BOUND_PERSISTENCE_AMBIGUITY_REPRO_PASS; SAFETY_FIX_NOT_IMPLEMENTED; ISSUE_6_REMAINS_OPEN');
