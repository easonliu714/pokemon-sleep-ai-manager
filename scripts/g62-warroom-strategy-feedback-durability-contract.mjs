import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G6.2 independent War Room consumer: an unresolved player-feedback durable
// write must not leak actionable strategy candidates through a legacy adapter.
// Source-bound synthetic VM only; no real player SQLite, IDB or production writer.
const raw=fs.readFileSync('assets/js/recipe-strategy-local.js','utf8');
const executable=raw.replace(/^import[\s\S]*?from '[^']+';\r?\n/gm,'')
  .replace(/^export function /gm,'function ');
assert.match(raw,/function buildLocalRecipeStrategyProjection/);
let status='UNVERIFIED',throwStatus=false,sqlReads=0,feedbackReads=0,projectCalls=0;
const context=vm.createContext({
  isRescueReadonly:()=>false,
  getRecipeAttemptPersistenceStatus:()=>{
    if(throwStatus)throw new Error('synthetic feedback status denied');
    return {status};
  },
  getActiveStrategyGoalProfile:()=>({goal_profile_id:'synthetic-goal',hard_constraints:{}}),
  currentEffectiveWeeklyContext:()=>({pot_size:20,dish_category:'甜點／飲料',week_start:'2026-11-02',context_id:'synthetic'}),
  rows:sql=>{sqlReads++;if(sql.includes('FROM recipe_master '))return [{recipe_id:'r1',recipe_name:'Synthetic Recipe',category:'甜點／飲料'}];return [];},
  listRecipeAttemptFeedbackSummaries:()=>{feedbackReads++;return [{recipe_id:'r1',recommendation_paused:1}];},
  projectRecipeStrategy:()=>{projectCalls++;return {
    schema:'pokemon-sleep-recipe-strategy-projection/1.0',
    candidates:[{recipe_id:'r1',candidate_status:'COOK_NOW_UNLOCKED',hard_constraint_status:'PASS'}],
    summary:{candidate_count:1,status_counts:{COOK_NOW_UNLOCKED:1},hard_constraint_counts:{PASS:1},excluded_counts:{}},
  };},
  PUBLIC_RECIPE_MASTER_VERSION:'synthetic',
  PUBLIC_RECIPE_PROVENANCE_VERSION:'synthetic',
  PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE'}],
});
vm.runInContext(executable+'\n;globalThis.__build=buildLocalRecipeStrategyProjection;',context,{timeout:3000});
for(const blocked of ['UNVERIFIED','IN_FLIGHT','UNKNOWN']){
  status=blocked;throwStatus=false;
  const before=[sqlReads,feedbackReads,projectCalls];
  const result=context.__build();
  assert.equal(result.projection_status,'FEEDBACK_PERSISTENCE_UNVERIFIED',
    blocked+' must fail closed before actionable War Room strategy');
  assert.equal(result.candidates.length,0,blocked+' cannot recommend player recipes');
  assert.deepEqual([sqlReads,feedbackReads,projectCalls],before,
    blocked+' must not query player recipe data or compute actionable strategy');
  assert.equal(result.player_data_write,false);
}
throwStatus=true;
const beforeError=[sqlReads,feedbackReads,projectCalls];
const denied=context.__build();
assert.equal(denied.projection_status,'FEEDBACK_PERSISTENCE_UNVERIFIED');
assert.equal(denied.candidates.length,0);
assert.deepEqual([sqlReads,feedbackReads,projectCalls],beforeError);
throwStatus=false;
for(const verified of ['CLEAR','PERSISTED','NOT_PERSISTED']){
  status=verified;
  const before=projectCalls;
  const result=context.__build();
  assert.equal(result.projection_status,'READY',verified+' preserves existing verified strategy');
  assert.equal(result.candidates.length,1);
  assert.equal(projectCalls,before+1);
}
console.log('PASS G62_WARROOM_STRATEGY_FEEDBACK_DURABILITY_HOLD_AND_VERIFIED_CONTROL');
console.log('HOLD G62_ANDROID_OWNER_UAT_NOT_VERIFIED');
