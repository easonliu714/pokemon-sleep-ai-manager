import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateWeeklyBerryVisualEnvelope} from '../assets/js/uc-img-a-weekly-berry-visual-authority-v042755339.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const fixtureUrl=new URL('./fixtures/v0427553310_business_outcome_telemetry.json',import.meta.url);
const fixture=JSON.parse(await readFile(fixtureUrl,'utf8'));

assert.equal(fixture.contract_version,'v0.4.27.55.3.3.10');
assert.equal(fixture.invariants.http_200_is_not_business_success,true);
assert.equal(fixture.invariants.high_confidence_is_not_verification_authority,true);
assert.equal(fixture.invariants.unknown_is_not_zero,true);
assert.equal(fixture.invariants.raw_screenshot_immutable,true);

const byId=new Map(fixture.cases.map(row=>[row.id,row]));
assert.equal(byId.size,3,'expected the three frozen predecessor regressions');

const review=byId.get('http200_review_required_must_emit_business_warning');
assert.ok(review);
assert.equal(review.transport.http_status,200);
assert.equal(review.transport.request_completed,true);
assert.equal(review.business.outcome,'REVIEW_REQUIRED');
assert.ok(Number(review.business.warning_count_min)>=1,'REVIEW_REQUIRED must not export warning_count=0');
assert.ok(String(review.business.reason||'').length>0,'REVIEW_REQUIRED requires a business reason');
assert.equal(review.assertions.warning_count_zero_forbidden,true);
assert.equal(review.assertions.transport_success_must_not_override_business_outcome,true);

const hold=byId.get('http200_hold_must_emit_business_error_or_hold_trace');
assert.ok(hold);
assert.equal(hold.transport.http_status,200);
assert.equal(hold.business.outcome,'HOLD');
assert.equal(hold.business.unresolved_slot_count,3);
assert.equal(hold.assertions.all_clean_trace_forbidden,true);
assert.equal(hold.assertions.business_reason_required,true);
assert.equal(hold.assertions.unresolved_slot_count_required,3);
assert.ok(String(hold.business.reason||'').length>0,'HOLD requires a business reason');

const slots=byId.get('three_visual_slots_observed_not_silently_omitted');
assert.ok(slots);
assert.equal(slots.transport.http_status,200);
assert.equal(slots.transport.operation_confidence,0.98);
assert.equal(slots.business.outcome,'REVIEW_REQUIRED');
assert.equal(slots.business.visual_slots.length,3,'all three visible berry slots must survive observation');
assert.deepEqual(slots.business.visual_slots.map(row=>row.slot),[1,2,3]);
for(const row of slots.business.visual_slots){
  assert.equal(row.state,'OBSERVED');
  assert.equal(row.resolved_authority,null,'unresolved observation must not be auto-promoted to authority');
}
assert.equal(slots.assertions.visual_slot_count,3);
assert.equal(slots.assertions.candidate_must_not_auto_verify,true);
assert.equal(slots.assertions.operation_confidence_must_not_authorize_slots,true);
assert.equal(slots.assertions.review_required,true);

// Bind the frozen predecessor evidence to the production UC.IMG-A evaluator. This
// prevents a fixture-only PASS from hiding a regression where production silently
// drops image-only berry slots or treats operation confidence / HTTP 200 as authority.
const sourceImageRef='owner-predecessor-weekly.png';
// This must be a valid Update Package v1.1 weekly envelope. Otherwise the workflow
// correctly emits HOLD for envelope violations and the telemetry assertion would be
// testing malformed transport data rather than the intended REVIEW_REQUIRED domain path.
const productionPayload={
  schema_version:'1.1',
  update_id:'UPD-20260917000000-V0427553310-TELEMETRY',
  generated_at:'2026-09-17T00:00:00.000Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  context_authority:'UPDATE_CENTER_JSON',
  visual_observation_summary:{favorite_berry_icon_count:3,complete:true},
  visual_observations:slots.business.visual_slots.map(row=>({
    observation_type:'favorite_berry_icon',
    slot:row.slot,
    source_image_ref:sourceImageRef,
    status:'OBSERVED',
    confidence:null,
    authority:'AI_VISUAL_OBSERVATION_ONLY',
    review_required:true,
  })),
  operations:[{
    operation_id:'weekly-context-owner-predecessor',
    entity:'weekly_context',
    action:'upsert',
    key:{context_id:'weekly_context_2026-09-14_import'},
    data:{week_start:'2026-09-14',dish_category:'咖哩／濃湯',context_authority:'UPDATE_CENTER_JSON',updated_at:'2026-09-17T00:00:00.000Z'},
    evidence:{source_image_ref:sourceImageRef,confidence:slots.transport.operation_confidence},
  }],
};
const evaluated=evaluateWeeklyBerryVisualEnvelope(productionPayload,{allowedImageRefs:[sourceImageRef]});
assert.equal(evaluated.ok,false,'three unresolved production observations must remain REVIEW_REQUIRED');
assert.equal(evaluated.summary.observation_count,3,'production evaluator must retain all three visible slots');
assert.equal(evaluated.summary.unresolved_count,3,'all three unresolved slots must remain blockers');
assert.equal(evaluated.summary.verified_count,0,'operation confidence must not auto-verify slots');
assert.equal(evaluated.summary.ai_is_rule_authority,false);
assert.equal(evaluated.summary.unknown_is_absent,false);
assert.deepEqual(evaluated.review.filter(row=>row.kind==='weekly_berry_visual_observation').map(row=>row.slot),[1,2,3]);
assert.ok(evaluated.review.some(row=>row.kind==='weekly_field_confidence_missing'),'operation-level confidence alone must leave field-scoped confidence review required');
assert.deepEqual(evaluated.clean_payload.visual_observations,undefined,'clean payload must not leak visual candidate envelope into ordinary persistence');
assert.deepEqual(evaluated.clean_payload.visual_observation_summary,undefined,'clean payload must not leak visual summary into ordinary persistence');

// .55.3.3.10 regression-first contract: unresolved slot authority must be exported as
// explicit blockers and a deterministic Dry-run HOLD reason, not inferred later from UI.
assert.equal(evaluated.summary.blocker_count,4,'3 unresolved slots + missing field-scoped confidence must remain explicit blockers');
assert.deepEqual(evaluated.summary.blocker_slots,[1,2,3],'slot blockers must preserve exact visual slot identity');
assert.equal(evaluated.summary.dry_run_outcome,'HOLD','unresolved visual authority must fail closed in Dry-run');
assert.match(evaluated.summary.dry_run_hold_reason,/unresolved_visual_slots/,'Dry-run reason must expose unresolved visual slots');
assert.match(evaluated.summary.dry_run_hold_reason,/field_confidence_missing/,'Dry-run reason must expose missing field-scoped confidence');

const workflow=validateWorkflow(structuredClone(productionPayload));
assert.equal(workflow.summary.business_outcome,'REVIEW_REQUIRED','HTTP 200 transport must not collapse governed review into PASS');
assert.ok(workflow.summary.business_warning_count>=1,'REVIEW_REQUIRED must expose at least one business warning');
assert.equal(workflow.summary.business_error_count,0,'review-only outcome is not a validation error');
assert.ok(workflow.summary.business_review_required_count>=3,'all unresolved slot reviews must remain visible');
assert.equal(workflow.summary.business_unresolved_slot_count,3,'business telemetry must expose unresolved slot count');
assert.match(workflow.summary.business_reason,/unresolved_visual_slots/,'business reason must expose slot blocker');
assert.match(workflow.summary.business_reason,/review_required/,'business reason must expose review blocker');

console.log('V0427553310_BUSINESS_OUTCOME_TELEMETRY_REGRESSION_GATE=PASS');
console.log('V0427553310_PRODUCTION_UC_IMG_A_SLOT_BINDING=PASS');
console.log('V0427553310_SLOT_BLOCKER_DRY_RUN_REGRESSION=PASS');
console.log('V0427553310_WORKFLOW_BUSINESS_TELEMETRY_BINDING=PASS');