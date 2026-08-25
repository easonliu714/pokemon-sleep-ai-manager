import assert from 'node:assert/strict';
import {
  CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,
  resolveConfirmationFirstRenderProjection,
  shouldProjectConfirmationGroup,
  patchConfirmationEventDraft,
} from '../assets/js/confirmation-first-render-authority-v042732.js';

assert.equal(CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,'confirmation-first-render-authority-2026-08-25-a');

const tinkatinkDetail={
  group_id:'A',
  draft:{species:'',type:'妖精',favorite_berry:'桃桃果'},
  identity_context:{mode:'existing',target_species_snapshot:'小鍛匠',baseline_reference:{species:'小鍛匠',type:'妖精',favorite_berry:'桃桃果'}},
};
const tinkatinkGroup={id:'A',draft:{species:'',type:'妖精',favorite_berry:'桃桃果'},identity_context:tinkatinkDetail.identity_context};
const tinkatink=resolveConfirmationFirstRenderProjection({detail:tinkatinkDetail,group:tinkatinkGroup});
assert.equal(tinkatink.species,'小鍛匠','existing target species must hydrate the first visible name when the observation draft is blank');
assert.equal(tinkatink.favorite_berry,'桃桃果');

// Physical failure replay: C (信使鳥 / 椰木果) was visible, then B (土王) first rendered with C's berry.
// The current group draft/identity, never the previous DOM or stale corrected event, is authoritative.
const staleBDetail={
  group_id:'B',
  draft:{species:'土王',type:'毒',favorite_berry:'椰木果'},
  identity_context:{mode:'existing',target_species_snapshot:'土王',baseline_reference:{species:'土王',type:'毒',favorite_berry:'零餘果'}},
  v042718_form_authority_corrected:true,
};
const currentBGroup={id:'B',draft:{species:'土王',type:'毒',favorite_berry:'零餘果'},identity_context:staleBDetail.identity_context};
const b=resolveConfirmationFirstRenderProjection({detail:staleBDetail,group:currentBGroup});
assert.equal(b.species,'土王');
assert.equal(b.type,'毒');
assert.equal(b.favorite_berry,'零餘果','previous-group 椰木果 must never survive B first render');
const patched=patchConfirmationEventDraft(staleBDetail,currentBGroup);
assert.equal(patched.patched,true);
assert.equal(staleBDetail.draft.favorite_berry,'零餘果','stale v0.4.27.18 corrected event must be repaired before workbench render');

const canonicalRepair=resolveConfirmationFirstRenderProjection({
  detail:{group_id:'B',draft:{species:'土王',type:'毒',favorite_berry:'椰木果'}},
  group:{id:'B',draft:{species:'土王',type:'毒',favorite_berry:'椰木果'}},
});
assert.equal(canonicalRepair.favorite_berry,'零餘果');
assert.equal(canonicalRepair.berry_corrected,true);

const newUnobserved=resolveConfirmationFirstRenderProjection({
  detail:{group_id:'N',draft:{species:'',type:'',favorite_berry:''},identity_context:{mode:'new'}},
  group:{id:'N',draft:{species:'',type:'',favorite_berry:''},identity_context:{mode:'new'}},
});
assert.equal(newUnobserved.species,'');
assert.equal(newUnobserved.favorite_berry,'','new/unobserved values must remain blank; no invented master fill');

assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:'B'}),true);
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'C',active_group_id:'B',visible_group_id:'B'}),false,'adjacent merged group cannot project into visible form');
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:'C'}),false,'visible marker mismatch must fail closed');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.21_V042732_CONFIRMATION_FIRST_RENDER_PROJECTION',
  first_species_authority_hydrated:true,
  previous_group_berry_not_reused:true,
  stale_corrected_event_repaired_before_render:true,
  deterministic_type_berry_projection:true,
  noncurrent_merged_projection_rejected:true,
  unobserved_new_group_fail_closed:true,
  first_render_roundtrip_invariant:'first render uses same group-local projection as return render',
  behavioral_gates_removed:0,
},null,2));
