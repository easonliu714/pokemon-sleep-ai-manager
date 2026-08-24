import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');

assert.match(runtime,/V042731_DOM_STABILITY_VERSION='dom-observer-reentrancy-closure-2026-08-24-a'/);
assert.doesNotMatch(runtime,/new\s+MutationObserver\s*\(/,'successor runtime must not install a whole-document MutationObserver');
assert.doesNotMatch(runtime,/observer\.observe\(doc\.documentElement/,'whole-document childList observation is forbidden');
assert.match(runtime,/pokemon-sleep:analysis-confirmation-navigation-changed/);
assert.match(runtime,/pokemon-sleep:analysis-confirmation-group-selected/);
assert.match(runtime,/pokemon-sleep:analysis-confirmation-merged/);
assert.match(runtime,/next\.textContent!==desired\.text/,'boundary text write must be guarded');
assert.match(runtime,/desired\.write_count===0/,'no-op boundary state must perform zero writes');
assert.match(runtime,/whole_document_mutation_observer:false/);
assert.match(runtime,/idempotent_boundary_writes:true/);
assert.match(runtime,/preview_dom_untouched:true/);

// .31 is a stability successor only: keep .30 batch continuation / terminal JSON behavior.
assert.match(runtime,/function v042730RemainingItemIds\(selectedIds=\[\],terminalIds=\[\]\)/);
assert.match(runtime,/v042730_batch_continuation_started/);
assert.match(runtime,/Failure JSON 已保留/);
assert.match(runtime,/pre\.style\.overflowY='auto'/);

const blockMatch=runtime.match(/export function v042730ShouldBlockConfirmationNext\(state=\{\}\)\{[\s\S]*?\n\}/);
const desiredMatch=runtime.match(/export function v042731BoundaryDesiredState\(state=\{\},current=\{\}\)\{[\s\S]*?\n\}/);
assert.ok(blockMatch,'predecessor boundary predicate must remain extractable');
assert.ok(desiredMatch,'idempotent boundary helper must remain extractable');
const source=`${blockMatch[0].replace(/^export\s+/,'')}\n${desiredMatch[0].replace(/^export\s+/,'')}`;
const context={};
vm.createContext(context);
vm.runInContext(`${source}\nthis.desired=v042731BoundaryDesiredState;`,context);

const lastState={position:3,total:3,has_previous:true,has_next:false};
let current={disabled:false,text:'下一隻寶可夢／建立新群組 →',marker:''};
let totalWrites=0;
for(let i=0;i<100;i++){
  const desired=context.desired(lastState,current);
  totalWrites+=desired.write_count;
  current={disabled:desired.disabled,text:desired.text,marker:desired.marker};
}
assert.equal(totalWrites,3,'repeated last-group refresh must converge after one DOM patch');
assert.deepEqual(current,{disabled:true,text:'已是最後一隻寶可夢',marker:'last_existing_group'});
assert.equal(context.desired(lastState,current).write_count,0,'second application must be a strict no-op');

const previousState={position:2,total:3,has_previous:true,has_next:true};
const restored=context.desired(previousState,current);
assert.equal(restored.blocked,false);
assert.equal(restored.disabled,false);
assert.equal(restored.text,'下一隻寶可夢 →');
assert.equal(restored.marker,'');
assert.equal(restored.write_count,3);
const restoredAgain=context.desired(previousState,{disabled:restored.disabled,text:restored.text,marker:restored.marker});
assert.equal(restoredAgain.write_count,0,'restored navigation state must also be idempotent');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.20_V042731_DOM_OBSERVER_REENTRANCY',
  whole_document_mutation_observer:false,
  mutation_feedback_loop_closed:true,
  repeated_boundary_refresh_iterations:100,
  total_dom_writes_after_convergence:totalWrites,
  second_boundary_application_writes:0,
  event_driven_confirmation_boundary:true,
  preview_dom_untouched:true,
  v042730_batch_terminal_continuation_preserved:true,
  android_json_scroll_preserved:true,
  behavioral_gates_removed:0,
},null,2));
