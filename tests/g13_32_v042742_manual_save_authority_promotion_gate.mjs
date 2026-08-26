import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const explicitPath='assets/js/explicit-manual-draft-save-v042737.js';
const reviewPath='assets/js/review-group-isolation-v042717.js';
for(const path of [explicitPath,reviewPath]){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  assert.equal(syntax.status,0,`syntax must pass: ${path}`);
}

const explicit=await import(`${pathToFileURL(explicitPath).href}?g1332=${Date.now()}`);
const review=await import(`${pathToFileURL(reviewPath).href}?g1332=${Date.now()}`);

const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const source=fs.readFileSync(explicitPath,'utf8');
assert.match(versionAuthority,/app_version:\s*'v0\.4\.27\.42'/);
assert.match(versionAuthority,/app_build:\s*'20260826-v042742-manual-save-authority-promotion'/);
assert.match(versionAuthority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.42-v042742-manual-save-authority-promotion'/);
assert.match(serviceWorker,/\.\/assets\/js\/explicit-manual-draft-save-v042737\.js/,'offline precache must retain the promoted explicit-save runtime');
assert.equal(explicit.MANUAL_SAVE_AUTHORITY_PROMOTION_VERSION,'v0.4.27.42-manual-save-authority-promotion-2026-08-26-a');
assert.equal(explicit.MANUAL_SAVE_AUTHORITY_PROMOTION_REASON,'explicit_manual_save_authority_promotion_v042742');

// Gate A — trusted unsaved manual edits remain blocked from navigation/apply.
const dirty=explicit.classifyFormSnapshot({
  expected:{nickname:'原值',type:'妖精'},
  current:{nickname:'TEST42',type:'妖精'},
  touched_keys:['nickname'],
});
assert.equal(dirty.manual_dirty,true);
for(const action of ['previousAnalysisGroup','nextAnalysisGroup','applyConfirmedAnalysis']){
  const policy=explicit.confirmationActionPolicy({action,classification:dirty});
  assert.equal(policy.allowed,false,`${action} must stay blocked while manual_dirty=true`);
  assert.equal(policy.block_reason,'UNSAVED_MANUAL_CHANGES');
}

const groups=[
  {
    id:'G1',status:'active',
    draft:{species:'小鍛匠',nickname:'',type:'妖精',source_refs:['smallsmith.png'],analysis_ids:['A1']},
    latest_revision:{analysis_id:'A1',revision_no:1,source_image_ref:'smallsmith.png'},
  },
  {
    id:'G2',status:'pending',
    draft:{species:'土王',nickname:'',type:'毒',source_refs:['clodsire.png'],analysis_ids:['A2']},
    latest_revision:{analysis_id:'A2',revision_no:1,source_image_ref:'clodsire.png'},
  },
  {
    id:'G3',status:'pending',
    draft:{species:'信使鳥',nickname:'',type:'飛行',source_refs:['delibird.png'],analysis_ids:['A3']},
    latest_revision:{analysis_id:'A3',revision_no:1,source_image_ref:'delibird.png'},
  },
];
let active='G1';
const consistency={
  review_group_form_authority_version:'v0.4.27.18-per-image-target-group-authority',
  getState:()=>({active_group_id:active,groups:structuredClone(groups)}),
  selectGroup:id=>{active=id;for(const group of groups)group.status=group.id===id?'active':'pending';return groups.find(group=>group.id===id)||null;},
};
const immutable=review.createImmutableFormGroupAuthority(consistency,{traceFn:()=>{},getVisibleGroupId:()=>active});
immutable.noteRenderedGroup('G1',{reason:'seed'});
immutable.acceptCoreDraft('G1',groups[0].draft,{reason:'seed'});

// Gate G predecessor protection — ordinary same-revision drift is still rejected.
const ordinaryDrift=immutable.acceptCoreDraft('G1',{...groups[0].draft,nickname:'UNAUTHORIZED'}, {reason:'ordinary_core_drift'});
assert.equal(ordinaryDrift.draft.nickname,'');
assert.equal(immutable.getRecord('G1').dirty,false);

const scope={PokemonSleepMultiCaptureConsistency:consistency,PokemonSleepReviewGroupAuthorityV042718:immutable};
let coreWrites=0;
const coreWriter=(draft,{reason}={})=>{
  const group=groups.find(row=>row.id===active);
  if(!group)return null;
  coreWrites++;
  group.draft=structuredClone(draft);
  group.last_write_reason=reason||null;
  return group;
};
const exact={group_id:'G1',analysis_id:'A1',revision_no:1,source_image_ref:'smallsmith.png'};
const candidate={...structuredClone(groups[0].draft),nickname:'TEST42'};

// Gate B — explicit exact save promotes both core and immutable authority immediately.
let promoted=explicit.promoteExplicitManualSaveAuthority({scope,consistency,expected:exact,draft:candidate,coreWriter});
assert.equal(promoted.ok,true);
assert.equal(promoted.status,'AUTHORITY_PROMOTED');
assert.equal(groups[0].draft.nickname,'TEST42');
assert.equal(promoted.draft.nickname,'TEST42');
const promotedRecord=immutable.getRecord('G1');
assert.equal(promotedRecord.draft.nickname,'TEST42');
assert.equal(promotedRecord.dirty,false,'saved manual draft is committed authority, not an unsaved immutable dirty overlay');
assert.equal(coreWrites,1);

// Same-group render after Save must no longer be corrected back to the pre-save draft.
const sameGroupRender=immutable.acceptCoreDraft('G1',groups[0].draft,{reason:explicit.EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
assert.equal(sameGroupRender.draft.nickname,'TEST42');
assert.equal(sameGroupRender.dirty,false);

// Gate C — save survives Next -> Previous round trip.
consistency.selectGroup('G2');
immutable.noteRenderedGroup('G2',{reason:'manual_next_pokemon'});
immutable.acceptCoreDraft('G2',groups[1].draft,{reason:'manual_next_pokemon'});
consistency.selectGroup('G1');
immutable.noteRenderedGroup('G1',{reason:'manual_previous_pokemon'});
const roundTrip=immutable.acceptCoreDraft('G1',groups[0].draft,{reason:'manual_previous_pokemon'});
assert.equal(roundTrip.draft.nickname,'TEST42');

// Gate D — promotion is group-local.
assert.equal(groups[1].draft.nickname,'');
assert.equal(groups[2].draft.nickname,'');
assert.equal(groups[1].draft.species,'土王');
assert.equal(groups[2].draft.species,'信使鳥');

// Gate E — stale revision remains fail-closed and causes zero additional core writes.
groups[0].latest_revision.revision_no=2;
const writesBeforeStale=coreWrites;
let blocked=explicit.promoteExplicitManualSaveAuthority({scope,consistency,expected:exact,draft:{...groups[0].draft,nickname:'STALE'},coreWriter});
assert.equal(blocked.ok,false);
assert.equal(blocked.status,'STALE_REVISION');
assert.equal(coreWrites,writesBeforeStale);
assert.equal(groups[0].draft.nickname,'TEST42');

// Gate F — exact source-image authority remains fail-closed.
const revision2={...exact,revision_no:2,source_image_ref:'wrong-source.png'};
blocked=explicit.promoteExplicitManualSaveAuthority({scope,consistency,expected:revision2,draft:{...groups[0].draft,nickname:'WRONG_SOURCE'},coreWriter});
assert.equal(blocked.ok,false);
assert.equal(blocked.status,'SOURCE_IMAGE_MISMATCH');
assert.equal(coreWrites,writesBeforeStale);
assert.equal(groups[0].draft.nickname,'TEST42');

// Missing expected source is also not allowed to promote a revision that has a source identity.
blocked=explicit.promoteExplicitManualSaveAuthority({scope,consistency,expected:{...revision2,source_image_ref:null},draft:{...groups[0].draft,nickname:'MISSING_SOURCE'},coreWriter});
assert.equal(blocked.ok,false);
assert.equal(blocked.status,'SOURCE_IMAGE_MISMATCH');
assert.equal(coreWrites,writesBeforeStale);

// Closed/missing group cannot be promoted through the API.
active='G9';
blocked=explicit.promoteExplicitManualSaveAuthority({scope,consistency,expected:{...revision2,group_id:'G9'},draft:candidate,coreWriter});
assert.equal(blocked.ok,false);
assert.ok(['GROUP_NOT_FOUND','GROUP_MISMATCH'].includes(blocked.status));
assert.equal(coreWrites,writesBeforeStale);
active='G1';

// Production source must use canonical raw core writer lazily, without adding a DOM observer race.
assert.match(source,/import\('\.\/data-consistency-multicapture\.js'\)/);
assert.match(source,/CORE_DRAFT_WRITER_NOT_READY/);
assert.match(source,/v042742_manual_save_authority_promotion_rollback/);
assert.match(source,/PokemonSleepManualSaveAuthorityPromotionV042742/);
assert.doesNotMatch(source,/new\s+MutationObserver/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.32_V042742_EXPLICIT_MANUAL_SAVE_AUTHORITY_PROMOTION',
  unsaved_navigation_and_apply_blocked:true,
  exact_manual_save_promotes_core:true,
  exact_manual_save_promotes_immutable_authority:true,
  same_group_render_retains_saved_text:true,
  navigation_round_trip_retains_saved_text:true,
  group_locality:true,
  stale_revision_fail_closed:true,
  source_image_fail_closed:true,
  missing_source_identity_fail_closed:true,
  ordinary_core_drift_still_rejected:true,
  rollback_path_present:true,
  mutation_observer_added:false,
},null,2));
