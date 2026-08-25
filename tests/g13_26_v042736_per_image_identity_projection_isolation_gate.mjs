import assert from 'node:assert/strict';
import {
  PLAYER_PROFILE_CONSISTENCY_VERSION,
  TYPE_BERRY_CONSISTENCY_VERSION,
  repairPlayerProfileDraft,
} from '../assets/js/player-profile-consistency-v042723.js';
import {
  resolveConfirmationFirstRenderProjection,
  shouldProjectConfirmationGroup,
} from '../assets/js/confirmation-first-render-authority-v042732.js';

assert.equal(PLAYER_PROFILE_CONSISTENCY_VERSION,'v0.4.27.36-player-profile-consistency-review-only-2026-08-25-a');
assert.equal(TYPE_BERRY_CONSISTENCY_VERSION,'v0.4.27.36-type-berry-review-only-2026-08-25-a');

// Replay the user-provided AI revisions: each provider result is correct and must stay local.
const tinkatink={id:'A',draft:{species:'小鍛匠',type:'妖精',favorite_berry:''},identity_context:{mode:'existing',target_species_snapshot:'小鍛匠',baseline_reference:{species:'小鍛匠',type:'妖精',favorite_berry:'桃桃果'}}};
const clodsire={id:'B',draft:{species:'土王',type:'毒',favorite_berry:''},identity_context:{mode:'existing',target_species_snapshot:'土王',baseline_reference:{species:'土王',type:'毒',favorite_berry:'零餘果'}}};
const delibird={id:'C',draft:{species:'信使鳥',type:'飛行',favorite_berry:'椰木果'},identity_context:{mode:'existing',target_species_snapshot:'信使鳥',baseline_reference:{species:'信使鳥',type:'飛行',favorite_berry:'椰木果'}}};

const a=resolveConfirmationFirstRenderProjection({detail:{group_id:'A',draft:{...tinkatink.draft},identity_context:tinkatink.identity_context},group:tinkatink});
const b=resolveConfirmationFirstRenderProjection({detail:{group_id:'B',draft:{...clodsire.draft},identity_context:clodsire.identity_context},group:clodsire});
const c=resolveConfirmationFirstRenderProjection({detail:{group_id:'C',draft:{...delibird.draft},identity_context:delibird.identity_context},group:delibird});
assert.deepEqual([a.species,a.type,a.favorite_berry],['小鍛匠','妖精','桃桃果']);
assert.deepEqual([b.species,b.type,b.favorite_berry],['土王','毒','零餘果']);
assert.deepEqual([c.species,c.type,c.favorite_berry],['信使鳥','飛行','椰木果']);
assert.equal(a.berry_derived_from_type,false);
assert.equal(b.berry_derived_from_type,false);
assert.equal(c.berry_derived_from_type,false);

// Stale C must never write while B is active/visible, and B must never write while A is visible.
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'C',active_group_id:'B',visible_group_id:'B'}),false);
assert.equal(shouldProjectConfirmationGroup({incoming_group_id:'B',active_group_id:'B',visible_group_id:'A'}),false);

// A bad cross-group-looking pair must be surfaced, never silently rewritten.
const mismatch=repairPlayerProfileDraft({species:'小鍛匠',type:'毒',favorite_berry:'桃桃果',registered_at:'2026年8月24日'});
assert.equal(mismatch.draft.type,'毒');
assert.equal(mismatch.draft.favorite_berry,'桃桃果','review-only consistency must not convert to 零餘果');
assert.equal(mismatch.draft.registered_at,'2026-08-24','date normalization remains deterministic');
const berryReview=mismatch.corrections.find(row=>row.field==='favorite_berry');
assert.equal(berryReview?.status,'REVIEW_REQUIRED_TYPE_BERRY_MISMATCH');
assert.equal(berryReview?.auto_rewrite,false);
assert.equal(berryReview?.canonical_value,'零餘果');

// Null / zero / false semantics remain intact.
const zero=repairPlayerProfileDraft({type:'妖精',favorite_berry:'',sleep_hours:0,is_favorite:false});
assert.equal(zero.draft.sleep_hours,0);
assert.equal(zero.draft.is_favorite,false);
assert.equal(zero.draft.favorite_berry,'','missing berry must not be master-filled');
assert.equal(zero.corrections.some(row=>row.field==='favorite_berry'),false);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.26_V042736_PER_IMAGE_IDENTITY_PROJECTION_ISOLATION',
  uploaded_provider_revision_replay_preserved:true,
  provider_to_confirmation_identity_chain_preserved:true,
  adjacent_group_dom_write_rejected:true,
  type_berry_mismatch_review_only:true,
  public_relation_not_player_evidence:true,
  date_normalization_preserved:true,
  null_zero_false_semantics_preserved:true,
},null,2));
