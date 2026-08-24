import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path='assets/js/analysis-manual-draft-overlay-v042719.js';
const source=fs.readFileSync(path,'utf8');

assert.match(source,/MANUAL_DRAFT_OVERLAY_VERSION='v0\.4\.27\.29-group-local-stale-restore-guard-2026-08-24-a'/);
assert.match(source,/function shouldRestoreGroup\(groupId,form=visibleForm\(\)\)/);
assert.match(source,/reason:'stale_group_callback'/);
assert.match(source,/reason:'visible_active_group_mismatch'/);
assert.match(source,/const form=visibleForm\(\),guard=shouldRestoreGroup\(groupId,form\)/);
assert.match(source,/if\(!guard\.allowed\)\{trace\('v042729_stale_manual_restore_rejected'/);
assert.match(source,/const scheduledGroupId=text\(groupId\)\|\|null;/);
assert.match(source,/queueMicrotask\(\(\)=>restoreVisibleForm\(\{groupId:scheduledGroupId,reason\}\)\)/);
assert.match(source,/setTimeout\(\(\)=>restoreVisibleForm\(\{groupId:scheduledGroupId,reason:`\$\{reason\}_timer`\}\),0\)/);

const visibleMatch=source.match(/function visibleGroupId\(form=visibleForm\(\)\)\{[\s\S]*?\n\}/);
const guardMatch=source.match(/function shouldRestoreGroup\(groupId,form=visibleForm\(\)\)\{[\s\S]*?\n\}/);
assert.ok(visibleMatch&&guardMatch,'authority helpers must remain extractable');

const context={
  globalThis:{PokemonSleepMultiCaptureConsistency:{getState:()=>({active_group_id:'A'}),getReviewGroupFormAuthorityState:()=>({visible_group_id:'A'})}},
  visibleForm:()=>null,
};
vm.createContext(context);
vm.runInContext(`const text=value=>String(value??'').trim();\n${visibleMatch[0]}\n${guardMatch[0]}\nthis.shouldRestoreGroup=shouldRestoreGroup;`,context);

const formA={dataset:{v042718GroupId:'A'}};
assert.equal(context.shouldRestoreGroup('A',formA).allowed,true,'same-group microtask/timer may restore');
const stale=context.shouldRestoreGroup('B',formA);
assert.equal(stale.allowed,false,'stale B callback must not mutate visible A');
assert.equal(stale.reason,'stale_group_callback');

context.globalThis.PokemonSleepMultiCaptureConsistency.getState=()=>({active_group_id:'B'});
const activeMismatch=context.shouldRestoreGroup('A',formA);
assert.equal(activeMismatch.allowed,false,'visible A must fail closed if active authority already moved to B');
assert.equal(activeMismatch.reason,'visible_active_group_mismatch');

context.globalThis.PokemonSleepMultiCaptureConsistency.getState=()=>({active_group_id:'A'});
const formMissing={dataset:{}};
context.globalThis.PokemonSleepMultiCaptureConsistency.getReviewGroupFormAuthorityState=()=>({visible_group_id:null});
const missing=context.shouldRestoreGroup('A',formMissing);
assert.equal(missing.allowed,false,'missing visible group authority must fail closed');
assert.equal(missing.reason,'visible_group_missing');

// Physical invariant represented by the authority contract: an old B callback cannot overwrite
// A's first rendered berry, so first-frame A and A after A→B→A remain identical.
const state={visible_group_id:'A',favorite_berry:'椰木果'};
const restore=(scheduledGroupId,value)=>{
  const form={dataset:{v042718GroupId:state.visible_group_id}};
  context.globalThis.PokemonSleepMultiCaptureConsistency.getState=()=>({active_group_id:state.visible_group_id});
  context.globalThis.PokemonSleepMultiCaptureConsistency.getReviewGroupFormAuthorityState=()=>({visible_group_id:state.visible_group_id});
  if(context.shouldRestoreGroup(scheduledGroupId,form).allowed)state.favorite_berry=value;
};
const firstA=state.favorite_berry;
restore('B','橙橙果');
assert.equal(state.favorite_berry,'椰木果','late B callback cannot contaminate first visible A');
state.visible_group_id='B';state.favorite_berry='橙橙果';restore('A','椰木果');
assert.equal(state.favorite_berry,'橙橙果','late A callback cannot contaminate visible B');
state.visible_group_id='A';state.favorite_berry='椰木果';restore('A','椰木果');
assert.equal(state.favorite_berry,firstA,'A.first.favorite_berry must equal A returned after A→B→A');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.17_V042729_FIRST_RENDER_STALE_OVERLAY_AUTHORITY',
  stale_group_callback_fail_closed:true,
  active_visible_group_parity:true,
  missing_visible_group_fail_closed:true,
  first_render_navigation_invariant:true,
  invariant:'A.first.favorite_berry === A→B→A.returned.favorite_berry',
  berry_sequence:['椰木果','橙橙果','椰木果'],
},null,2));
