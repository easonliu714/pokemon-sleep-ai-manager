import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Source-bound negative gate: prove a recipe failure COMMIT may overlap with a
// recommendation toggle while the first IndexedDB persistence is unresolved.
// Synthetic only: no player SQLite, browser storage, or public master writes.
const actual=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const stripped=actual.replace(/^import[\s\S]*?from '\.\/recipe-attempt-feedback\.js';\s*/,'');
assert.notEqual(stripped,actual,'production import boundary must be recognized');
const executable=stripped.replace(/\bexport\s+(?=(?:async\s+)?function\s)/g,'');
assert.match(executable,/async function recordRecipeAttemptFailure/);
assert.match(executable,/async function setRecipeRecommendationPaused/);

const pending=[];
const sqlWrites=[];
let concurrentPersists=0,maxConcurrentPersists=0,commits=0;
const storage=new Map();
const context=vm.createContext({
  rows:(sql)=>{
    if(sql.includes('FROM recipe_master'))return [{recipe_id:'r1',recipe_name:'Synthetic Recipe',category:'synthetic'}];
    if(sql.includes('FROM ingredient_master'))return [{ingredient_name:'特選蘋果'}];
    return [];
  },
  run:(sql,params)=>{sqlWrites.push({sql,params});},
  begin:()=>{},commit:()=>{commits++;},rollback:()=>{},
  isDatabaseReady:()=>true,isRescueReadonly:()=>false,
  persist:()=>{
    concurrentPersists++;
    maxConcurrentPersists=Math.max(maxConcurrentPersists,concurrentPersists);
    return new Promise(resolve=>pending.push(()=>{concurrentPersists--;resolve();}));
  },
  sessionStorage:{
    getItem:key=>storage.get(key)||null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key),
  },
  PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
  buildRecipeAttemptFeedbackRecord:input=>({
    attempt_id:input.attempt_id,recipe_id:input.recipe_id,attempted_at:input.attempted_at,
    outcome:'FAILED_TO_UNLOCK',actual_ingredients:input.actual_ingredients,
    source:input.source,reference_maybe_wrong:input.reference_maybe_wrong,
    recommendation_paused:input.recommendation_paused,notes:input.notes,created_at:input.created_at,
  }),
  RECIPE_ATTEMPT_FEEDBACK_VERSION:'synthetic',
  crypto:{randomUUID:()=> 'synthetic-id'},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  dispatchEvent:()=>{},
});
vm.runInContext(executable+'\n;globalThis.__record=recordRecipeAttemptFailure;globalThis.__toggle=setRecipeRecommendationPaused;',context,{timeout:3000});
const input={recipe_id:'r1',attempted_at:'2026-10-24T08:00:00Z',actual_ingredients:[{ingredient_name:'特選蘋果',quantity:2}],recommendation_paused:true};
const recording=context.__record(input);
assert.equal(commits,1,'failure attempt SQL COMMIT must occur before persistence acknowledgment');
assert.equal(pending.length,1,'failure attempt persistence must be unresolved');
const toggling=context.__toggle('r1',false);
assert.equal(pending.length,2,'known risk: toggle is admitted before attempt persistence resolves');
assert.equal(maxConcurrentPersists,2,'known risk: two player-private persist operations overlap');
assert.equal(sqlWrites.filter(x=>x.sql.includes('INSERT INTO recipe_feedback_state')).length,2,
  'known risk: state is mutated twice across an unresolved durability boundary');
// Resolve synthetic promises without writing any durable storage.
pending[1]();await toggling;
pending[0]();await recording;
assert.equal(concurrentPersists,0);
console.log('REPRODUCED_HOLD G62_UNRESOLVED_ATTEMPT_PERSIST_OVERLAPS_PAUSE_TOGGLE concurrent_persists=2 state_writes=2');
console.log('G62_SOURCE_BOUND_CONCURRENT_PLAYER_WRITE_RISK_ONLY; NOT_A_FIX; OWNER_UAT_PENDING; ISSUE_6_OPEN');
