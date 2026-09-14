import assert from 'node:assert/strict';
import {
  buildWeeklyBerryVisualPromptAddon,
  evaluateWeeklyBerryVisualEnvelope,
  stripWeeklyBerryVisualEnvelope,
  UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT,
} from '../assets/js/uc-img-a-weekly-berry-visual-authority-v042755339.js';

const baseOperation={
  operation_id:'OP-20260914-001',
  entity:'weekly_context',
  action:'upsert',
  key:{context_id:'weekly_context_2026-09-14_import'},
  data:{dish_category:'咖哩／濃湯',week_start:'2026-09-14',updated_at:'2026-09-14T00:37:58.421Z'},
  evidence:{source_image_ref:'image-140',confidence:0.98},
  review_required:false,
};
const observedOwnerPayload={
  schema_version:'1.1',
  update_id:'UPD-20260914003758-AI',
  generated_at:'2026-09-14T00:37:58.421Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  operations:[structuredClone(baseOperation)],
  context_authority:'UPDATE_CENTER_JSON',
};

let result=evaluateWeeklyBerryVisualEnvelope(observedOwnerPayload,{allowedImageRefs:['image-140']});
assert.equal(result.ok,false,'owner evidence must not be accepted as complete');
assert.equal(result.summary.visual_surface_complete,false);
assert.equal(result.summary.favorite_berry_icon_count,null);
assert.ok(result.review.some(item=>item.kind==='weekly_berry_visual_surface_unreported'));
assert.ok(result.review.some(item=>item.kind==='weekly_field_confidence_missing'));
assert.equal(result.summary.ai_is_rule_authority,false);
assert.equal(result.summary.unknown_is_absent,false);

const threeObserved=structuredClone(observedOwnerPayload);
threeObserved.operations[0].evidence.field_confidence={dish_category:0.98,week_start:0.98};
threeObserved.visual_observation_summary={favorite_berry_icon_count:3,complete:true};
threeObserved.visual_observations=[1,2,3].map(slot=>({
  observation_type:'favorite_berry_icon',
  slot,
  status:'OBSERVED',
  source_image_ref:'image-140',
  confidence:null,
  authority:'AI_VISUAL_OBSERVATION_ONLY',
  review_required:true,
}));
result=evaluateWeeklyBerryVisualEnvelope(threeObserved,{allowedImageRefs:['image-140']});
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.summary.favorite_berry_icon_count,3);
assert.equal(result.summary.observation_count,3);
assert.equal(result.summary.unresolved_count,3);
assert.equal(result.review.filter(item=>item.kind==='weekly_berry_visual_observation').length,3);
assert.equal(result.ok,false,'observed-only berry icons must remain review gated');
assert.equal(stripWeeklyBerryVisualEnvelope(threeObserved).visual_observations,undefined);
assert.equal(stripWeeklyBerryVisualEnvelope(threeObserved).visual_observation_summary,undefined);
assert.equal(stripWeeklyBerryVisualEnvelope(threeObserved).operations[0].data.dish_category,'咖哩／濃湯');

const candidate=structuredClone(threeObserved);
candidate.visual_observations[0]={
  observation_type:'favorite_berry_icon',slot:1,status:'CANDIDATE',source_image_ref:'image-140',confidence:0.72,
  authority:'AI_VISUAL_CANDIDATE_ONLY',candidate_name:'候選樹果',review_required:true,
};
result=evaluateWeeklyBerryVisualEnvelope(candidate,{allowedImageRefs:['image-140']});
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.ok(result.review.some(item=>item.kind==='weekly_berry_visual_candidate'));
assert.equal(result.summary.unresolved_count,3);

const fakeVerified=structuredClone(threeObserved);
fakeVerified.visual_observations[0]={
  observation_type:'favorite_berry_icon',slot:1,status:'VERIFIED',source_image_ref:'image-140',confidence:0.99,
  authority:'AI_VISUAL_CANDIDATE_ONLY',canonical_berry_name:'不得由 AI 升格',review_required:false,
};
result=evaluateWeeklyBerryVisualEnvelope(fakeVerified,{allowedImageRefs:['image-140']});
assert.ok(result.errors.some(message=>message.includes('CANONICAL_BERRY_ICON_AUTHORITY')),'AI candidate authority must never verify a berry');

const governedVerified=structuredClone(threeObserved);
governedVerified.visual_observations=governedVerified.visual_observations.map((item,index)=>({
  ...item,
  status:'VERIFIED',
  confidence:0.99,
  authority:'CANONICAL_BERRY_ICON_AUTHORITY',
  canonical_berry_name:`canonical-${index+1}`,
  review_required:false,
}));
result=evaluateWeeklyBerryVisualEnvelope(governedVerified,{allowedImageRefs:['image-140']});
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.review.length,0);
assert.equal(result.ok,true);
assert.equal(result.summary.verified_count,3);

const countMismatch=structuredClone(threeObserved);
countMismatch.visual_observations.pop();
result=evaluateWeeklyBerryVisualEnvelope(countMismatch,{allowedImageRefs:['image-140']});
assert.ok(result.errors.some(message=>message.includes('contains 2 item')));

const duplicateSlot=structuredClone(threeObserved);
duplicateSlot.visual_observations[1].slot=1;
result=evaluateWeeklyBerryVisualEnvelope(duplicateSlot,{allowedImageRefs:['image-140']});
assert.ok(result.errors.some(message=>message.includes('duplicates slot 1')));

const wrongImage=structuredClone(threeObserved);
wrongImage.visual_observations[2].source_image_ref='image-999';
result=evaluateWeeklyBerryVisualEnvelope(wrongImage,{allowedImageRefs:['image-140']});
assert.ok(result.errors.some(message=>message.includes('not assigned to the weekly scenario')));

const noBerry=structuredClone(observedOwnerPayload);
noBerry.operations[0].evidence.field_confidence={dish_category:0.98,week_start:0.98};
noBerry.visual_observation_summary={favorite_berry_icon_count:0,complete:true};
noBerry.visual_observations=[];
result=evaluateWeeklyBerryVisualEnvelope(noBerry,{allowedImageRefs:['image-140']});
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.review.length,0);
assert.equal(result.ok,true,'explicitly reviewed zero-icon surface is distinct from unreported/unknown');

const prompt=buildWeeklyBerryVisualPromptAddon();
for(const token of ['visual_observation_summary','visual_observations','OBSERVED','CANDIDATE','VERIFIED','AI_VISUAL_CANDIDATE_ONLY','CANONICAL_BERRY_ICON_AUTHORITY','field-scoped'])assert.ok(prompt.includes(token),`prompt contract missing ${token}`);

assert.equal(UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.version,'v0.4.27.55.3.3.9');
assert.equal(UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.ai_is_rule_authority,false);
assert.equal(UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.unknown_is_absent,false);

console.log('UC_IMG_A_WEEKLY_BERRY_VISUAL_AUTHORITY_REGRESSION=PASS');
console.log('OWNER_SAMPLE_CLASSIFICATION=INCOMPLETE_REVIEW_REQUIRED');
console.log('OWNER_SAMPLE_TEXT_PARTIAL_KNOWN=PRESERVED');
console.log('VISIBLE_BERRY_SLOTS=3');
console.log('AI_VISUAL_CANDIDATE_IS_RULE_AUTHORITY=FALSE');
console.log('UNKNOWN_IS_NO_BERRY_REQUIREMENT=FALSE');
console.log('FAKE_AI_VERIFIED=REJECTED');
console.log('CANONICAL_RESOLVER_VERIFIED=PASS');
