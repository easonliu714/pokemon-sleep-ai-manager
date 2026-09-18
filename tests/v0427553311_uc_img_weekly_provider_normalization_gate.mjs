import assert from 'node:assert/strict';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';
import {
  buildUcImgWeeklyPlatformAuthority,
  constrainUcImgWeeklyJsonSchema,
  normalizeUcImgWeeklyProviderPayload,
} from '../assets/js/uc-img-weekly-platform-authority.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const ownerRaw={
  schema_version:'1.1',
  update_id:'UPD-20260918044357-AI',
  generated_at:'2026-09-18T04:43:57.996Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  operations:[{
    operation_id:'OP-20260918-001',
    entity:'weekly_context',
    action:'upsert',
    key:{context_id:'weekly_context_2026-09-14_import'},
    data:{
      dish_category:'咖哩／濃湯',
      favorite_berry_1:'甜桃果',
      favorite_berry_2:'文旦果',
      favorite_berry_3:'巨香果',
      week_start:'2026-09-14',
      updated_at:'2026-09-18T04:43:57.996Z',
    },
    evidence:{source_image_ref:'image-148',confidence:0.95},
    review_required:false,
  }],
  context_authority:'UPDATE_CENTER_JSON',
};
const frozen=structuredClone(ownerRaw);
const normalized=normalizeUcImgWeeklyProviderPayload(ownerRaw);
assert.deepEqual(ownerRaw,frozen,'provider/raw owner evidence must remain immutable');
assert.equal(normalized.visual_observation_summary.favorite_berry_icon_count,3);
assert.equal(normalized.visual_observation_summary.complete,true);
assert.deepEqual(normalized.visual_observations.map(row=>row.slot),[1,2,3]);
assert.deepEqual(normalized.visual_observations.map(row=>row.status),['CANDIDATE','CANDIDATE','CANDIDATE']);
assert.deepEqual(normalized.visual_observations.map(row=>row.candidate_name),['甜桃果','文旦果','巨香果']);
assert.ok(normalized.visual_observations.every(row=>row.authority==='AI_VISUAL_CANDIDATE_ONLY'&&row.review_required===true));
assert.equal(normalized.operations[0].data.favorite_berry_1,undefined);
assert.equal(normalized.operations[0].data.favorite_berry_2,undefined);
assert.equal(normalized.operations[0].data.favorite_berry_3,undefined);
assert.equal(normalized.operations[0].review_required,true,'legacy provider berry guesses must become explicit review, never silent authority');

const workflow=validateWorkflow(structuredClone(normalized));
const slotReview=workflow.review.filter(row=>row.kind==='weekly_berry_visual_candidate');
assert.equal(slotReview.length,3,'owner physical FAIL must become three actionable slot reviews');
assert.equal(workflow.summary.weekly_berry_unresolved_count,3);
assert.notEqual(workflow.summary.business_outcome,'PASS');

const authority=buildUcImgWeeklyPlatformAuthority(new Date('2026-09-18T04:43:57.996Z'));
const schema=constrainUcImgWeeklyJsonSchema(buildUpdatePackageJsonSchema({
  scenario:'weekly_context_update',
  entities:['weekly_context'],
  weekly:true,
}),authority);
for(const root of ['visual_observation_summary','visual_observations']){
  assert.ok(schema.properties[root],`weekly structured-output schema must expose ${root}`);
  assert.ok(schema.required.includes(root),`weekly structured-output schema must require ${root}`);
}
const dataProps=schema.properties.operations.items.properties.data.properties;
for(const field of ['favorite_berry_1','favorite_berry_2','favorite_berry_3']){
  assert.equal(dataProps[field],undefined,`internal Gemini must not directly authorize ${field}`);
}
console.log('V0427553311_UC_IMG_WEEKLY_PROVIDER_NORMALIZATION_GATE=PASS');
