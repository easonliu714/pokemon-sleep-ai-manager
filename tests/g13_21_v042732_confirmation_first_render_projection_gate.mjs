import assert from 'node:assert/strict';
import {
  CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,
  PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION,
  resolveConfirmationFirstRenderProjection,
  shouldProjectConfirmationGroup,
  patchConfirmationEventDraft,
} from '../assets/js/confirmation-first-render-authority-v042732.js';

assert.equal(CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,'confirmation-first-render-authority-2026-08-25-b-v042736');
assert.equal(PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION,'v0.4.27.36-per-image-identity-projection-isolation-2026-08-25-a');

const tinkatinkDetail={
  group_id:'A',
  draft:{species:'',type:'妖精',favorite_berry:''},
  identity_context:{mode:'existing',target_species_snapshot:'小鍛匠',baseline_reference:{species:'小鍛匠',type:'妖精',favorite_berry:'桃桃果'}},
};
const tinkatinkGroup={id:'A',draft:{species:'',type:'妖精',favorite_berry:''},identity_context:tinkatinkDetail.identity_context};
const tinkatink=resolveConfirmationFirstRenderProjection({detail:tinkatinkDetail,group:tinkatinkGroup});
assert.equal(tinkatink.species,'小鍛匠','existing target species must hydrate first visible name');
assert.equal(tinkatink.type,'妖精');
assert.equal(tinkatink.favorite_berry,'桃桃果','exact existing baseline may fill a blank same-target berry');
assert.equal(tinkatink.berry_derived_from_type,false);

// Physical failure replay: a stale incoming event carried the previous group berry.
// The exact current group draft wins; no type→berry synthesis is permitted.
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
assert.equal(b.favorite_berry,'零餘果','same exact group draft must win over stale event draft');
const patched=patchConfirmationEventDraft(staleBDetail,currentBGroup);
assert.equal(patched.patched,true);
assert.equal(staleBDetail.draft.favorite_berry,'零餘果');

// v0.4.27.36 regression: public type relation is not player observation authority.
const mismatch=resolveConfirmationFirstRenderProjection({
  detail:{group_id:'B',draft:{species:'土王',type:'毒',favorite_berry:'椰木果'}},
  group:{id:'B',draft:{species:'土王',type:'毒',favorite_berry:'椰木果'}},
});
assert.equal(mismatch.favorite_berry,'椰木果','projection must preserve exact-group observation even when type/berry relation conflicts');
assert.equal(mismatch.berry_corrected,false);
assert.equal(mismatch.berry_derived_from_type,false);

const newUnobserved=resolveConfirmationFirstRenderProjection({
  detail:{group_id:'N',draft:{species:'',type:'妖精',favorite_berry:''},identity_context:{mode:'new'}},
  group:{id:'N',draft:{species:'',type:'妖精',favorite_berry:''},identity_context:{mode:'new'}},
});
assert.equal(newUnobserved.species,'');
assert.equal(newUnobserved.type,'妖精');
assert.equal(newUnobserved.favorite_berry,'','new target must not synthesize 桃桃果 from type');

assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:'B'}),true);
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'C',active_group_id:'B',visible_group_id:'B'}),false,'adjacent merged group cannot project into visible form');
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:'C'}),false,'visible marker mismatch must fail closed');
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:''}),false,'missing visible exact binding must fail closed');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.21_V042736_CONFIRMATION_FIRST_RENDER_PROJECTION',
  exact_group_projection:true,
  existing_target_species_hydrated:true,
  previous_group_berry_not_reused:true,
  type_berry_auto_rewrite:false,
  noncurrent_projection_rejected:true,
  missing_visible_binding_fail_closed:true,
  new_group_public_relation_fill:false,
  behavioral_gates_removed:0,
},null,2));
