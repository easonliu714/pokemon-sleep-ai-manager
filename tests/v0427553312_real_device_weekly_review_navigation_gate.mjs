import fs from 'node:fs';
import assert from 'node:assert/strict';

import {normalizeUcImgWeeklyProviderPayload} from '../assets/js/uc-img-weekly-platform-authority.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';
import {resolveWeeklyBerryVisualCandidate} from '../assets/js/uc-img-a-weekly-berry-visual-authority-v042755339.js';

// Frozen minimal reproduction of the .55.3.3.11 owner real-device diagnostic.
// Provider recognized all three icons, but returned OBSERVED + AI_VISUAL_CANDIDATE_ONLY.
// week_start is platform authority and therefore must not require AI field confidence.
const ownerDiagnostic={
  schema_version:'1.1',
  update_id:'UPD-20260920144448-AI',
  generated_at:'2026-09-20T14:44:48.250Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  operations:[{
    operation_id:'op-001',
    entity:'weekly_context',
    action:'upsert',
    key:{context_id:'weekly_context_2026-09-14_import'},
    data:{
      dish_category:'咖哩／濃湯',
      week_start:'2026-09-14',
      updated_at:'2026-09-20T14:44:48.250Z',
    },
    evidence:{
      source_image_ref:'image-149',
      confidence:0.95,
      field_confidence:{dish_category:1,base_notes:1},
    },
    review_required:false,
  }],
  context_authority:'UPDATE_CENTER_JSON',
  visual_observation_summary:{favorite_berry_icon_count:3,complete:true},
  visual_observations:[1,2,3].map(slot=>({
    observation_type:'favorite_berry_icon',
    slot,
    source_image_ref:'image-149',
    status:'OBSERVED',
    confidence:0.95,
    authority:'AI_VISUAL_CANDIDATE_ONLY',
    review_required:true,
  })),
};

const frozen=structuredClone(ownerDiagnostic);
const normalized=normalizeUcImgWeeklyProviderPayload(ownerDiagnostic);
assert.deepEqual(ownerDiagnostic,frozen,'provider/raw diagnostic evidence must stay immutable');
assert.deepEqual(normalized.visual_observations.map(row=>row.status),['OBSERVED','OBSERVED','OBSERVED']);
assert.ok(
  normalized.visual_observations.every(row=>row.authority==='AI_VISUAL_OBSERVATION_ONLY'&&row.review_required===true),
  'OBSERVED items without a named candidate must normalize to observation-only authority, never VERIFIED',
);
assert.equal(normalized.operations[0].review_required,true,'unresolved visual slots must force operation review');

let workflow=validateWorkflow(structuredClone(normalized));
assert.equal(workflow.errors.length,0,workflow.errors.join('\n'));
assert.equal(
  workflow.review.filter(row=>row.kind==='weekly_berry_visual_observation').length,
  3,
  'three visible icons must become three actionable slot reviews',
);
assert.ok(
  !workflow.review.some(row=>row.kind==='weekly_field_confidence_missing'),
  'platform-injected week_start must not require AI field confidence when observed image fields are already field-scoped',
);
assert.equal(workflow.summary.weekly_berry_unresolved_count,3);
assert.equal(workflow.summary.business_outcome,'HOLD');

let resolved=structuredClone(normalized);
resolved=resolveWeeklyBerryVisualCandidate(resolved,1,'桃桃果',{confirmedAt:'2026-09-20T15:00:00.000Z'});
resolved=resolveWeeklyBerryVisualCandidate(resolved,2,'文柚果',{confirmedAt:'2026-09-20T15:00:01.000Z'});
resolved=resolveWeeklyBerryVisualCandidate(resolved,3,'橙橙果',{confirmedAt:'2026-09-20T15:00:02.000Z'});
workflow=validateWorkflow(structuredClone(resolved));
assert.equal(workflow.errors.length,0,workflow.errors.join('\n'));
assert.equal(workflow.review.length,0,'explicitly resolving all three slots must clear weekly review blockers');
assert.equal(workflow.summary.weekly_berry_unresolved_count,0);
assert.equal(workflow.summary.business_outcome,'PASS');
assert.equal(resolved.operations[0].review_required,false);

const nav=fs.readFileSync(new URL('../assets/js/update-center-task-navigation-v0427553311.js',import.meta.url),'utf8');
assert.ok(nav.includes("preferredSelector:'#ucImgA'"),'shared screenshot routes must identify the real hydrated function root');
assert.ok(nav.includes("preferredSelector:'#candyQuantityScreenshotB5'"),'candy route must identify the real hydrated function root');
assert.ok(nav.includes("preferredSelector:'#identityImportWizardRoot'"),'pokemon route must identify the real hydrated function root');
assert.ok(nav.includes('waitForPreferredTarget'),'navigation must re-anchor after dynamic hydration instead of staying on a fallback shell');
assert.ok(nav.includes('getBoundingClientRect'),'navigation must calculate the functional root top at click time');
assert.ok(nav.includes('nav[aria-label="主要功能"]'),'navigation must compensate for the sticky main navigation height');
assert.ok(nav.includes('window.scrollTo'),'navigation must scroll to the governed top coordinate rather than relying on font-dependent layout');

console.log('V0427553312_REAL_DEVICE_WEEKLY_REVIEW_NAVIGATION_GATE=PASS');
