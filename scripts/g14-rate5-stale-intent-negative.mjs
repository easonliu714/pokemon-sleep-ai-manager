// RATE.5 #796 negative-first, non-release. Runs the exact #860 parked production function.
// Requires git access to the preserved commit; never reads or writes a player database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const parked='9d43afa4d5ef0a627b3714c766a3bd2116b73932';
const path='assets/js/manual-editor.js';
function git(...args){return execFileSync('git',args,{encoding:'utf8'});}
let source;
try {source=git('show',parked+':'+path);}
catch {git('fetch','--no-tags','origin',parked);source=git('show',parked+':'+path);}
assert.ok(source.includes('async function saveConfirmedPokemonSuggestedRating('));
const start=source.indexOf('async function saveConfirmedPokemonSuggestedRating(');
const fn=source.slice(start);
const make=(intent,{applyEnabled=true}={})=>{
  const metrics={snapshot:0,mutation:0,persist:0,window:0,lease:0};
  const row={pokemon_id:'fixture',pokemon_instance_id:'instance-X',rating:'S-',status:'active'};
  const ctx={
    RATE4_PRODUCTION_APPLY_ENABLED:applyEnabled,
    POKEMON_PROVISIONAL_RATING_RULE_VERSION:'rule-current',
    beginSqliteExclusiveWriteWindow:()=>{metrics.window++;return ()=>{};},
    withPrimarySqliteMutationLock:async cb=>{metrics.lease++;return cb({});},
    rows:sql=>sql.includes('FROM pokemon WHERE')?[row]:[],
    sourceTokenForPokemonRating:()=> 'same-content-token',
    scorePokemonProvisionalRating:()=>({status:'PROVISIONAL_HEURISTIC',current_rating:'S-',future_rating:'S-',rule_version:'rule-current'}),
    snapshot:async()=>{metrics.snapshot++;},
    withSqliteCoordinatedMutation:fn=>{metrics.mutation++;return fn();},
    persist:async()=>{metrics.persist++;},
    Error,Object
  };
  const run=vm.runInNewContext(fn+'\n;saveConfirmedPokemonSuggestedRating',ctx);
  return {run:()=>run('fixture',{instanceId:'instance-X',expectedSourceToken:'same-content-token',scope:'CURRENT',expectedGrade:'S-',confirmed:true,...intent}),metrics};
};
test('current intent retains NO_CHANGE without SQL',async()=>{
  const {run,metrics}=make({expectedRuleVersion:'rule-current',expectedSourceGeneration:'generation-current'});
  const result=await run();
  assert.equal(result.status,'NO_CHANGE');
  assert.equal(metrics.snapshot,0);assert.equal(metrics.persist,0);
});
test('stale rule intent must fail closed before NO_CHANGE or SQL',async()=>{
  const {run,metrics}=make({expectedRuleVersion:'rule-stale',expectedSourceGeneration:'generation-current'});
  await assert.rejects(run(),/STALE|RULE|RELOAD|HOLD/);
  assert.equal(metrics.snapshot,0);assert.equal(metrics.persist,0);
});
test('stale restored generation must fail closed before NO_CHANGE or SQL',async()=>{
  const {run,metrics}=make({expectedRuleVersion:'rule-current',expectedSourceGeneration:'generation-before-restore'});
  await assert.rejects(run(),/STALE|GENERATION|RELOAD|HOLD/);
  assert.equal(metrics.snapshot,0);assert.equal(metrics.persist,0);
});


// Guard regression: the parked function must never obtain a lease when production Apply is OFF.
test('default-off production apply refuses even a current confirmation before lease or SQL',async()=>{
  const {run,metrics}=make({expectedRuleVersion:'rule-current',expectedSourceGeneration:'generation-current'},{applyEnabled:false});
  await assert.rejects(run(),/RATE4_PRODUCTION_APPLY_NOT_AUTHORIZED/);
  assert.deepEqual(metrics,{snapshot:0,mutation:0,persist:0,window:0,lease:0});
});
