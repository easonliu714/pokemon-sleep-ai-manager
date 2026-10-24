import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// G6.2 source-bound positive regression; all rows and persistence are synthetic.
const actual=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const stripped=actual.replace(/^import[\s\S]*?from '\.\/recipe-attempt-feedback\.js';\s*/,'');
assert.notEqual(stripped,actual,'source import boundary must match');
const executable=stripped.replace(/\bexport\s+(?=(?:async\s+)?function\s)/g,'');
assert.match(executable,/async function recordRecipeAttemptFailure/);
assert.match(executable,/async function setRecipeRecommendationPaused/);
const storage=new Map();
const writes=[],pending=[];
let active=0,maxActive=0,commits=0,rejectPersist=false;
function boot(durablePaused=null){
  const ctx=vm.createContext({
    rows:sql=>{
      if(sql.includes('FROM recipe_master'))return [{recipe_id:'r1',recipe_name:'Synthetic Recipe',category:'synthetic'}];
      if(sql.includes('FROM ingredient_master'))return [{ingredient_name:'特選蘋果'}];
      if(sql.includes('SELECT recommendation_paused FROM recipe_feedback_state'))return durablePaused===null?[]:[{recommendation_paused:durablePaused}];
      return [];
    },
    run:(sql,params)=>writes.push({sql,params}),
    begin:()=>{},commit:()=>{commits++;},rollback:()=>{},
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    persist:()=>{
      active++;maxActive=Math.max(maxActive,active);
      if(rejectPersist){active--;return Promise.reject(new Error('synthetic_idb_ack_lost'));}
      return new Promise(resolve=>pending.push(()=>{active--;resolve();}));
    },
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
    buildRecipeAttemptFeedbackRecord:x=>({...x,outcome:'FAILED_TO_UNLOCK'}),
    RECIPE_ATTEMPT_FEEDBACK_VERSION:'synthetic',
    crypto:{randomUUID:()=> 'synthetic-id'},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    dispatchEvent:()=>{},
  });
  vm.runInContext(executable+'\n;globalThis.__record=recordRecipeAttemptFailure;globalThis.__toggle=setRecipeRecommendationPaused;globalThis.__status=getRecipeAttemptPersistenceStatus;',ctx,{timeout:3000});
  return ctx;
}
const ctx=boot(),input={recipe_id:'r1',attempted_at:'2026-10-24T08:00:00Z',actual_ingredients:[{ingredient_name:'特選蘋果',quantity:2}],recommendation_paused:true};
const recording=ctx.__record(input);
assert.equal(commits,1);
assert.equal(pending.length,1);
assert.equal(ctx.__status().status,'IN_FLIGHT');
await assert.rejects(ctx.__toggle('r1',false),e=>e.code==='RECIPE_ATTEMPT_WRITE_IN_FLIGHT');
assert.equal(pending.length,1);
assert.equal(writes.filter(x=>x.sql.includes('INSERT INTO recipe_feedback_state')).length,1);
pending.shift()();await recording;
const toggling=ctx.__toggle('r1',false);
assert.equal(pending.length,1);
await assert.rejects(ctx.__record(input),e=>e.code==='RECIPE_ATTEMPT_WRITE_IN_FLIGHT');
pending.shift()();await toggling;
assert.equal(maxActive,1);
assert.equal(active,0);
rejectPersist=true;
await assert.rejects(ctx.__toggle('r1',true),e=>e.code==='PERSISTENCE_UNCERTAIN'&&e.recipe_id==='r1');
assert.equal(ctx.__status().status,'UNVERIFIED');
await assert.rejects(ctx.__toggle('r1',false),e=>e.code==='PERSISTENCE_UNCERTAIN');
assert.equal(storage.size,1);
const marker=JSON.parse([...storage.values()][0]);
assert.equal(marker.operation,'PAUSE_TOGGLE');
assert.equal(marker.target_paused,1);
assert.equal(marker.attempt_id,undefined);
const before=writes.length;
const reload=boot(0);
assert.equal(reload.__status().status,'NOT_PERSISTED');
assert.equal(storage.size,0);
assert.equal(writes.length,before);
console.log('PASS G62_PLAYER_WRITE_SINGLE_FLIGHT max_concurrent_persists=1');
console.log('PASS G62_TOGGLE_UNCERTAIN_HOLD RELOADED=NOT_PERSISTED SHARED_MASTER_WRITES=0');
