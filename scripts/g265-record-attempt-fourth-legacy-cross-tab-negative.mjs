// G265 fourth exact legacy operation: recordRecipeAttemptFailure() cross-tab negative.
// Source-bound VM tabs and disposable in-memory durable images ONLY. This is a
// reproducible HOLD, not a production fix or a safe writer admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
assert.match(source,/export async function recordRecipeAttemptFailure\(/);
const target=source.split('export async function recordRecipeAttemptFailure(')[1]
  ?.split('// G6.2: share the attempt-write')[0];
assert.ok(target,'exact legacy failure writer must remain source-identifiable');
assert.match(target,/begin\(\)/);
assert.match(target,/INSERT INTO recipe_attempt_feedback/);
assert.match(target,/INSERT INTO recipe_feedback_state/);
assert.match(target,/await persist\(\)/);
assert.doesNotMatch(target,/navigator\.locks|createSqliteFreshDurableTransactionAdapter|runSqliteWriteSession/);
console.log('PASS G265_RECORD_ATTEMPT_FOURTH_EXACT_LEGACY_OPERATION_SOURCE_BOUND_DIRECT_PERSIST');

const evaluated=source
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'')
  .replace(/^export /gm,'');
assert.doesNotMatch(evaluated,/^import /m);
const clone=value=>JSON.parse(JSON.stringify(value));
let durable={attempts:[],lastAttempt:null};
let enteredA,releaseA,writeCount=0;
const firstPersistEntered=new Promise(resolve=>{enteredA=resolve;});
function tab(name,holdPersist=false){
  let staged=null;
  const api={
    rows(sql){
      if(sql.includes('FROM recipe_master'))return [{recipe_id:'fixture-recipe',recipe_name:'Fixture',category:'fixture'}];
      if(sql.includes('FROM ingredient_master'))return [];
      throw Error('unexpected source read: '+sql);
    },
    run(sql,params){
      assert.ok(staged,'SQL write must follow begin');
      if(sql.includes('INSERT INTO recipe_attempt_feedback'))staged.attempts.push(params[0]);
      else if(sql.includes('INSERT INTO recipe_feedback_state'))staged.lastAttempt=params[3];
      else throw Error('unexpected source write: '+sql);
    },
    begin(){assert.equal(staged,null);staged=clone(durable);},
    commit(){assert.ok(staged);},
    rollback(){staged=null;},
    async persist(){
      assert.ok(staged);
      writeCount++;
      const image=clone(staged);
      if(holdPersist){
        await new Promise(resolve=>{releaseA=resolve;enteredA();});
      }
      durable=image;
    },
    isDatabaseReady:()=>true,
    isRescueReadonly:()=>false,
    PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'fixture-recipe',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
    buildRecipeAttemptFeedbackRecord:input=>({...input,outcome:'FAILURE'}),
    decodeRecipeAttemptIngredientJson:JSON.parse,
    RECIPE_ATTEMPT_FEEDBACK_VERSION:'fixture',
    Promise,Date,Math,JSON,Object,Set,Error,Number,String,Array,console,
  };
  const context=vm.createContext(api);
  vm.runInContext(evaluated+'\n;globalThis.__record=recordRecipeAttemptFailure;',context,{timeout:3000});
  return context.__record;
}
const a=tab('A',true),b=tab('B',false);
const first=a({recipe_id:'fixture-recipe',attempted_at:'2026-10-29T01:00:00.000Z'});
await firstPersistEntered;
const second=await b({recipe_id:'fixture-recipe',attempted_at:'2026-10-29T01:01:00.000Z'});
assert.equal(durable.attempts.length,1);
assert.equal(durable.lastAttempt,second.attempt_id);
releaseA();
const earlier=await first;
assert.notEqual(earlier.attempt_id,second.attempt_id);
assert.equal(writeCount,2,'both independent tabs acknowledged a direct persistence');
assert.equal(durable.attempts.length,1,'stale first tab overwrote second acknowledged attempt');
assert.equal(durable.lastAttempt,earlier.attempt_id);
assert.ok(!durable.attempts.includes(second.attempt_id),'second ACK is lost from durable image');
console.log('PASS G265_RECORD_ATTEMPT_TWO_TABS_DIRECT_PERSIST_LOST_ACKNOWLEDGED_UPDATE_NEGATIVE');
console.log('HOLD G265_RECORD_ATTEMPT_LEGACY_BYPASSES_WEB_LOCK_NO_PRODUCTION_ADMISSION_NO_ANDROID_UAT');
