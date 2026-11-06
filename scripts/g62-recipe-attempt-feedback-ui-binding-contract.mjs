import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G6.2: exercise actual production UI event bindings with isolated synthetic
// local-store doubles. No player SQLite, IndexedDB, or Public Master is opened.
const path=new URL('../assets/js/recipe-attempt-feedback-ui.js',import.meta.url);
const actual=fs.readFileSync(path,'utf8');
const localSource=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
assert.match(localSource,/s\.recommendation_paused AS recommendation_paused,/,'history must expose raw nullable SQLite flag');
assert.doesNotMatch(localSource,/COALESCE\(s\.recommendation_paused,0\) AS recommendation_paused/,'NULL must not be presented as verified unpause');
// Independent current-state authority: an older attempt's verified flag cannot
// authorize a toggle if the latest recipe_feedback_state reference flag is NULL.
assert.match(localSource,/s\.reference_maybe_wrong AS current_reference_maybe_wrong/,
  'current reference state must preserve raw nullable SQLite authority');
const stripped=actual.replace(/^import\s*\{[\s\S]*?\}\s*from '\.\/recipe-attempt-feedback-local\.js';\s*/,'');
assert.notEqual(stripped,actual,'source-bound import boundary must be recognized');
const runnable=stripped.replace('export function bindRecipeAttemptFeedbackUi','function bindRecipeAttemptFeedbackUi');
assert.notEqual(runnable,stripped,'source-bound UI export must be recognized');

const saved=[],pauseChanges=[],history=[{
  recipe_id:'r1',recipe_name:'<synthetic unsafe markup>',
  attempted_at:'2026-10-24T00:00:00Z',
  actual_ingredients:[{ingredient_name:'特選蘋果',quantity:3}],
  source_name:'Synthetic',recommendation_paused:1,reference_maybe_wrong:0,current_reference_maybe_wrong:0,
}];
let rejectSave=false,renderCount=0,holdStatus='CLEAR';
const context=vm.createContext({
  listRecipeAttemptFeedbackHistory:()=>history,
  getRecipeAttemptPersistenceStatus:()=>{
    if(holdStatus==='THROW')throw new Error('synthetic persistence status denied');
    if(holdStatus==='NULL')return null;
    return {status:holdStatus};
  },
  recipeAttemptDefaultSource:()=>({
    source_type:'PLAYER_REPORTED_REFERENCE',
    source_name:'Synthetic Reference',source_ref:null,
  }),
  recordRecipeAttemptFailure:async input=>{
    if(rejectSave)throw new Error('synthetic_local_write_denied');
    saved.push(input);
    return {recipe_name:'Synthetic Recipe',recommendation_paused:input.recommendation_paused};
  },
  setRecipeRecommendationPaused:async(recipeId,paused)=>{
    pauseChanges.push({recipeId,paused});
    return {recipe_name:'Synthetic Recipe',recommendation_paused:paused};
  },
});
vm.runInContext(runnable+'\n;globalThis.__bind=bindRecipeAttemptFeedbackUi;',context,{
  filename:'actual-recipe-attempt-feedback-ui.js',timeout:3000,
});
assert.equal(typeof context.__bind,'function');

const button=dataset=>({dataset,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
const fields={
  '[data-g62-attempted-at]':{value:'2026-10-24T11:00'},
  '[data-g62-ingredients]':{value:'特選蘋果=2\n哞哞鮮奶=3'},
  '[data-g62-source-name]':{value:'Synthetic Third Party'},
  '[data-g62-source-ref]':{value:'synthetic-source-ref'},
  '[data-g62-reference-wrong]':{checked:true},
  '[data-g62-pause]':{checked:true},
  '[data-g62-notes]':{value:'fixture only'},
};
const form={querySelector:selector=>fields[selector]||null};
const root={
  html:'',buttons:{},
  querySelector(selector){
    if(selector==='[data-g62-feedback-panel]')return {remove(){}};
    if(selector==='[data-g62-feedback-form]')
      return this.html.includes('data-g62-feedback-form')?form:null;
    return {
      '[data-g62-save]':this.buttons.save,
      '[data-g62-cancel]':this.buttons.cancel,
    }[selector]||null;
  },
  querySelectorAll(selector){
    if(selector==='[data-g62-attempt-failed]')return [this.buttons.attempt];
    if(selector==='[data-g62-toggle]')return this.buttons.toggle?[this.buttons.toggle]:[];
    return [];
  },
  insertAdjacentHTML(_position,markup){
    this.html=markup;
    this.buttons={
      attempt:button({g62AttemptFailed:'r1'}),
      toggle:(()=>{const match=markup.match(/data-g62-toggle="([^"]+)" data-g62-paused="([01])"/);
        return match?button({g62Toggle:match[1],g62Paused:match[2]}):null;})(),
      save:button({}),cancel:button({}),
    };
  },
};
const projection={
  alternatives:[{steps:[{
    recipe_id:'r1',recipe_name:'Synthetic Recipe',
    ingredients:[{ingredient_name:'特選蘋果',consumed:2}],
  }]}],
  suppressed_by_feedback:[],
};
const rerender=()=>{
  renderCount++;
  context.__bind(root,projection,{rerender});
};
rerender();
assert.match(root.html,/&lt;synthetic unsafe markup&gt;/,'history must escape markup');
assert.doesNotMatch(root.html,/<synthetic unsafe markup>/,'history cannot inject raw markup');
console.log('PASS G62_ACTUAL_UI_HISTORY_HTML_ESCAPED');

await root.buttons.attempt.handlers.click();
assert.match(root.html,/data-g62-feedback-form/,'failure action opens local draft');
assert.match(root.html,/只保存在你的本機 SQLite/);
console.log('PASS G62_ACTUAL_UI_FAILURE_ACTION_OPENS_LOCAL_DRAFT');

fields['[data-g62-ingredients]'].value='特選蘋果=0';
await root.buttons.save.handlers.click();
assert.equal(saved.length,0,'invalid quantity cannot reach local store');
assert.match(root.html,/儲存失敗/);
assert.match(root.html,/data-g62-feedback-form/,'invalid input must preserve draft');
console.log('PASS G62_ACTUAL_UI_INVALID_QUANTITY_FAIL_CLOSED');

fields['[data-g62-ingredients]'].value='特選蘋果=2\n哞哞鮮奶=3';
rejectSave=true;
await root.buttons.save.handlers.click();
assert.equal(saved.length,0,'failed local storage must not report success');
assert.match(root.html,/synthetic_local_write_denied/);
assert.match(root.html,/data-g62-feedback-form/,'local store failure preserves draft');
rejectSave=false;
console.log('PASS G62_ACTUAL_UI_LOCAL_WRITE_FAILURE_PRESERVES_DRAFT');

await root.buttons.save.handlers.click();
assert.equal(saved.length,1,'one successful local write');
assert.equal(saved[0].recipe_id,'r1');
assert.equal(saved[0].source.source_name,'Synthetic Third Party');
assert.equal(saved[0].source.source_ref,'synthetic-source-ref');
assert.equal(saved[0].reference_maybe_wrong,true);
assert.equal(saved[0].recommendation_paused,true);
assert.deepEqual(Array.from(saved[0].actual_ingredients,entry=>[entry.ingredient_name,entry.quantity]),[
  ['特選蘋果',2],['哞哞鮮奶',3],
]);
assert.match(saved[0].attempted_at,/^2026-10-24T/);
assert.doesNotMatch(root.html,/data-g62-feedback-form/,'successful save clears draft');
console.log('PASS G62_ACTUAL_UI_LOCAL_FAILURE_RECORD_AND_PAUSE');

await root.buttons.toggle.handlers.click();
assert.deepEqual(pauseChanges,[{recipeId:'r1',paused:false}]);
assert.match(root.html,/已恢復推薦/);
console.log('PASS G62_ACTUAL_UI_PAUSE_RESUME_EVENT');

await root.buttons.attempt.handlers.click();
assert.match(root.html,/data-g62-feedback-form/);
await root.buttons.cancel.handlers.click();
assert.doesNotMatch(root.html,/data-g62-feedback-form/);
assert.equal(saved.length,1,'cancel must not create another failure record');
console.log('PASS G62_ACTUAL_UI_CANCEL_NO_WRITE');

// Read-side fail-closed: SQL NULL/invalid pause flags must never render an
// actionable unpause label or a toggle that could write player state.
for(const invalid of [null,2,'',false,'2']){
  history[0].recommendation_paused=invalid;
  rerender();
  assert.match(root.html,/推薦狀態待核對/);
  assert.match(root.html,/data-g62-pause-state-hold/);
  assert.doesNotMatch(root.html,/data-g62-toggle=/);
  assert.equal(root.buttons.toggle,null,'invalid readback must expose no toggle');
}
assert.equal(pauseChanges.length,1,'invalid history flags must not write');
history[0].recommendation_paused=0;
rerender();
assert.match(root.html,/可重新推薦/);
assert.match(root.html,/data-g62-paused="0"/);
await root.buttons.toggle.handlers.click();
assert.deepEqual(pauseChanges.at(-1),{recipeId:'r1',paused:true});
history[0].recommendation_paused=1;
rerender();
assert.match(root.html,/已暫停推薦/);
assert.match(root.html,/data-g62-paused="1"/);
root.buttons.toggle.dataset.g62Paused='2';
await root.buttons.toggle.handlers.click();
assert.equal(pauseChanges.length,2,'forged invalid DOM flag must not trigger write');
assert.match(root.html,/推薦暫停狀態未驗證/);
console.log('PASS G62_ACTUAL_UI_HISTORY_NULL_INVALID_PAUSE_READBACK_FAIL_CLOSED');

// Independent G6.2 source-bound negative: a malformed SQLite history
// reference flag must not be interpreted as verified "not suspect" or offer
// an actionable pause toggle. The attempt-history table has no CHECK(0,1).
history[0].recommendation_paused=0;
for(const invalidReference of [null,2,'',false,'2',true,'01']){
  history[0].reference_maybe_wrong=invalidReference;
  rerender();
  assert.match(root.html,/data-g62-reference-state-hold/,
    'unverified reference flag must display HOLD: '+String(invalidReference));
  assert.doesNotMatch(root.html,/data-g62-toggle=/,
    'unverified reference flag must suppress player-state toggle: '+String(invalidReference));
  assert.equal(root.buttons.toggle,null);
}
assert.equal(pauseChanges.length,2,'invalid reference flags must not trigger writes');
history[0].reference_maybe_wrong=1;
rerender();
assert.match(root.html,/參考配方可能錯誤/,'verified suspect flag remains visible');
assert.match(root.html,/data-g62-toggle=/,'verified pause and reference flags retain existing action');
history[0].reference_maybe_wrong=0;
rerender();
assert.doesNotMatch(root.html,/data-g62-reference-state-hold/,'verified zero remains valid');
assert.match(root.html,/data-g62-toggle=/,'verified zero retains existing action');
console.log('PASS G62_HISTORY_REFERENCE_FLAG_UNVERIFIED_FAIL_CLOSED');

// The attempt flag can be valid while current state is missing/corrupt.
// Never use historical attempt provenance to authorize a current player toggle.
history[0].reference_maybe_wrong=0;
history[0].recommendation_paused=0;
for(const invalidCurrent of [null,2,'',false,'2',true,'01']){
  history[0].current_reference_maybe_wrong=invalidCurrent;
  rerender();
  assert.match(root.html,/data-g62-current-reference-state-hold/,
    'unverified current reference state must HOLD: '+String(invalidCurrent));
  assert.doesNotMatch(root.html,/data-g62-toggle=/,
    'unverified current state cannot authorize player toggle: '+String(invalidCurrent));
  assert.equal(root.buttons.toggle,null);
}
assert.equal(pauseChanges.length,2,'invalid current reference state must never write');
history[0].current_reference_maybe_wrong=1;
rerender();
assert.match(root.html,/data-g62-toggle=/,'verified current suspect flag preserves action');
history[0].current_reference_maybe_wrong=0;
rerender();
assert.match(root.html,/data-g62-toggle=/,'verified current zero preserves action');
console.log('PASS G62_HISTORY_CURRENT_REFERENCE_STATE_RAW_NULL_INVALID_HOLD');

// An uncertain post-COMMIT write is not an ordinary retryable validation error.
holdStatus='UNVERIFIED';
rerender();
assert.match(root.html,/PERSISTENCE_UNCERTAIN/);
await root.buttons.attempt.handlers.click();
assert.doesNotMatch(root.html,/data-g62-feedback-form/,'uncertain session must not open another draft');
await root.buttons.toggle.handlers.click();
assert.equal(pauseChanges.length,2,'uncertain session must not write recommendation state');
console.log('PASS G62_ACTUAL_UI_PERSISTENCE_UNCERTAIN_FAIL_CLOSED');

// Independent G6.2 negative-first: an unknown/unavailable durability status is
// NOT authorization for the UI to write player feedback or toggle recommendations.
// Existing source only blocks UNVERIFIED/IN_FLIGHT, so UNKNOWN wrongly permits
// a toggle; null/throw additionally crash rendering instead of showing HOLD.
for(const invalidStatus of ['UNKNOWN','NULL','THROW']){
  holdStatus=invalidStatus;
  rerender();
  const beforeWrites=pauseChanges.length;
  await root.buttons.toggle.handlers.click();
  assert.equal(pauseChanges.length,beforeWrites,
    'unverified persistence authority must not permit toggle: '+invalidStatus);
  await root.buttons.attempt.handlers.click();
  assert.doesNotMatch(root.html,/data-g62-feedback-form/,
    'unverified persistence authority must not open a new write draft: '+invalidStatus);
  assert.match(root.html,/PERSISTENCE_UNCERTAIN/,
    'unknown persistence status must display explicit HOLD: '+invalidStatus);
}
holdStatus='CLEAR';
rerender();
console.log('PASS G62_UI_UNKNOWN_NULL_THROW_PERSISTENCE_AUTHORITY_FAIL_CLOSED');

assert.ok(renderCount>=7,'real UI rerender callback exercised');
console.log('NOTE G62_SYNTHETIC_SOURCE_BOUND_UI_GATE_NOT_ANDROID_OWNER_UAT');
