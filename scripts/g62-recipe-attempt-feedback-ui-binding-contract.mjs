import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G6.2: exercise actual production UI event bindings with isolated synthetic
// local-store doubles. No player SQLite, IndexedDB, or Public Master is opened.
const path=new URL('../assets/js/recipe-attempt-feedback-ui.js',import.meta.url);
const actual=fs.readFileSync(path,'utf8');
const stripped=actual.replace(/^import\s*\{[\s\S]*?\}\s*from '\.\/recipe-attempt-feedback-local\.js';\s*/,'');
assert.notEqual(stripped,actual,'source-bound import boundary must be recognized');
const runnable=stripped.replace('export function bindRecipeAttemptFeedbackUi','function bindRecipeAttemptFeedbackUi');
assert.notEqual(runnable,stripped,'source-bound UI export must be recognized');

const saved=[],pauseChanges=[],history=[{
  recipe_id:'r1',recipe_name:'<synthetic unsafe markup>',
  attempted_at:'2026-10-24T00:00:00Z',
  actual_ingredients:[{ingredient_name:'特選蘋果',quantity:3}],
  source_name:'Synthetic',recommendation_paused:1,
}];
let rejectSave=false,renderCount=0;
const context=vm.createContext({
  listRecipeAttemptFeedbackHistory:()=>history,
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
    if(selector==='[data-g62-toggle]')return [this.buttons.toggle];
    return [];
  },
  insertAdjacentHTML(_position,markup){
    this.html=markup;
    this.buttons={
      attempt:button({g62AttemptFailed:'r1'}),
      toggle:button({g62Toggle:'r1',g62Paused:'1'}),
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

assert.ok(renderCount>=7,'real UI rerender callback exercised');
console.log('NOTE G62_SYNTHETIC_SOURCE_BOUND_UI_GATE_NOT_ANDROID_OWNER_UAT');
