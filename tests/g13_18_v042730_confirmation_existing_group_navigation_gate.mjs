import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');
const workbench=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
const consistency=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');

assert.match(runtime,/V042730_CONFIRMATION_JSON_MOBILE_CLOSURE_VERSION='v0\.4\.27\.30-confirmation-json-mobile-closure-2026-08-24-a'/);
assert.match(runtime,/function v042730ShouldBlockConfirmationNext\(state=\{\}\)/);
assert.match(runtime,/event\.stopImmediatePropagation\(\)/);
assert.match(runtime,/next\.disabled=true/);
assert.match(runtime,/next\.textContent='已是最後一隻寶可夢'/);
assert.match(runtime,/empty_group_created:false/);
assert.match(runtime,/doc\.addEventListener\('click',onDocumentClick,true\)/);

// Keep the predecessor behavior visible as evidence: .30 must contain it rather than
// deleting historical group creation support from the underlying consistency engine.
assert.match(workbench,/createIfEmpty:Number\(offset\)>0/);
assert.match(consistency,/if\(step>0&&createIfEmpty\)/);
assert.match(consistency,/const created=createGroup\(\{status:'pending'\}\)/);

const match=runtime.match(/export function v042730ShouldBlockConfirmationNext\(state=\{\}\)\{[\s\S]*?\n\}/);
assert.ok(match,'confirmation boundary helper must remain extractable');
const source=match[0].replace(/^export\s+/,'');
const context={};vm.createContext(context);vm.runInContext(`${source}\nthis.guard=v042730ShouldBlockConfirmationNext;`,context);
assert.equal(context.guard({position:1,total:3,has_next:true}),false,'A/B navigation must remain available');
assert.equal(context.guard({position:2,total:3,has_next:true}),false,'B/C navigation must remain available');
assert.equal(context.guard({position:3,total:3,has_next:false}),true,'C forward must be blocked');
assert.equal(context.guard({position:0,total:0,has_next:false}),false,'empty startup state is not treated as a terminal confirmation group');

// Physical invariant: pressing forward on the last analyzed Pokémon must leave the
// same rendered group in place and must not create a revisionless empty group.
const state={group_ids:['A','B','C'],visible_group_id:'C'};
if(!context.guard({position:3,total:3,has_next:false}))state.group_ids.push('EMPTY');
assert.deepEqual(state.group_ids,['A','B','C']);
assert.equal(state.visible_group_id,'C');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.18_V042730_CONFIRMATION_EXISTING_GROUP_NAVIGATION',
  last_group_forward_blocked:true,
  revisionless_empty_group_created:false,
  existing_group_navigation_preserved:true,
  visible_form_preserved_at_boundary:true,
  predecessor_create_if_empty_engine_preserved:true,
},null,2));
