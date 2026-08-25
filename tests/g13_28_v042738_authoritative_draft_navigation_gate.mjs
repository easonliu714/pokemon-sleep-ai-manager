import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const modulePath='assets/js/explicit-manual-draft-save-v042737.js';
const syntax=spawnSync(process.execPath,['--check',modulePath],{stdio:'inherit'});
assert.equal(syntax.status,0,'v0.4.27.38 authority runtime syntax must pass');
const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);

const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert.match(versionAuthority,/app_version:\s*'v0\.4\.27\.38'/);
assert.match(versionAuthority,/app_build:\s*'20260825-v042738-authoritative-draft-navigation'/);
assert.match(versionAuthority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.38-v042738-authoritative-draft-navigation'/);
assert.match(serviceWorker,/\.\/assets\/js\/explicit-manual-draft-save-v042737\.js/,'successor runtime must remain offline-precache reachable');
assert.ok(index.indexOf('./assets/js/explicit-manual-draft-save-v042737.js')>index.indexOf('./assets/js/review-group-isolation-v042717.js'));
assert.equal(mod.EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,'v0.4.27.38-authoritative-draft-navigation-2026-08-25-a');
assert.equal(mod.EXPLICIT_MANUAL_DRAFT_SAVE_REASON,'explicit_manual_save_v042738');

// Physical regression: freshly rendered form differs from structured draft only because of
// programmatic formatting/projection. No trusted user input happened. Navigation must remain allowed.
const systemOnly=mod.classifyFormSnapshot({
  expected:{species:'信使鳥',type:'飛行',confidence:null},
  current:{species:'信使鳥',type:'飛行',confidence:''},
  touched_keys:[],
});
assert.equal(systemOnly.manual_dirty,false);
assert.equal(systemOnly.unauthorized_drift,true);
let policy=mod.confirmationActionPolicy({action:'previousAnalysisGroup',classification:systemOnly});
assert.equal(policy.allowed,true,'system-only DOM drift must never block previous navigation');
assert.equal(policy.discard_system_drift,true);
assert.equal(policy.prepare_authoritative_apply,false);
policy=mod.confirmationActionPolicy({action:'nextAnalysisGroup',classification:systemOnly});
assert.equal(policy.allowed,true,'system-only DOM drift must never block next navigation');
policy=mod.confirmationActionPolicy({action:'applyConfirmedAnalysis',classification:systemOnly});
assert.equal(policy.allowed,true);
assert.equal(policy.prepare_authoritative_apply,true,'apply must first restore structured authority when system drift exists');

// Actual trusted user edits still block until explicit save/revert.
const manual=mod.classifyFormSnapshot({
  expected:{species:'信使鳥',type:'飛行'},
  current:{species:'信使鳥',type:'毒'},
  touched_keys:['type'],
});
assert.equal(manual.manual_dirty,true);
policy=mod.confirmationActionPolicy({action:'previousAnalysisGroup',classification:manual});
assert.equal(policy.allowed,false);
assert.equal(policy.block_reason,'UNSAVED_MANUAL_CHANGES');

// Mixed state: only touched fields are eligible for save; unrelated programmatic drift is discarded.
const typeNode={type:'text',value:'毒',dataset:{field:'type'}};
const confidenceNode={type:'number',value:'',dataset:{field:'confidence'}};
const fakePatchRoot={
  querySelector:selector=>selector==='[data-field="type"]'?typeNode:null,
};
const patched=mod.applyManualPatch({species:'信使鳥',type:'飛行',confidence:null},fakePatchRoot,['field:type']);
assert.equal(patched.type,'毒');
assert.equal(patched.confidence,null,'untouched system drift must not enter manual save patch');

// Before final apply, visible system drift is projected back to the authoritative draft.
const speciesNode={type:'text',value:'土王',dataset:{field:'species'}};
const projectedTypeNode={type:'text',value:'毒',dataset:{field:'type'}};
const levelNode={type:'number',value:'30',dataset:{field:'level'}};
const fakeForm={
  querySelectorAll:selector=>selector==='[data-field]'?[speciesNode,projectedTypeNode,levelNode]:[],
};
const projected=mod.projectAuthoritativeForm(fakeForm,{species:'信使鳥',type:'飛行',level:30});
assert.deepEqual(projected,['field:species','field:type']);
assert.equal(speciesNode.value,'信使鳥');
assert.equal(projectedTypeNode.value,'飛行');
assert.equal(levelNode.value,'30');

// Public draft boundary still rejects every implicit navigation snapshot.
const groups=[{id:'G1',draft:{species:'信使鳥',type:'飛行'},latest_revision:{analysis_id:'A1',revision_no:1,source_image_ref:'delibird.png'}}];
let writes=0;
const consistency={
  getState:()=>({active_group_id:'G1',groups:structuredClone(groups)}),
  replaceActiveDraft:(draft,{reason}={})=>{writes++;groups[0].draft=structuredClone(draft);return {draft,reason};},
  selectGroup:()=>groups[0],
};
const scope={PokemonSleepMultiCaptureConsistency:consistency};
assert.equal(mod.installExplicitManualDraftSave(scope),true);
assert.equal(consistency.replaceActiveDraft({species:'土王'},{reason:'manual_previous_navigation'}),null);
assert.equal(writes,0,'navigation must have zero permanent draft writes');
const exact={group_id:'G1',analysis_id:'A1',revision_no:1,source_image_ref:'delibird.png'};
const saved=scope.PokemonSleepExplicitManualDraftSaveV042738.saveManualDraft({species:'信使鳥',type:'飛行',nickname:'人工確認'},exact);
assert.equal(saved.ok,true);
assert.equal(writes,1);
assert.equal(groups[0].draft.nickname,'人工確認');

const source=fs.readFileSync(modulePath,'utf8');
assert.doesNotMatch(source,/MutationObserver/);
assert.match(source,/v042738_system_dom_drift_isolated/);
assert.match(source,/v042738_navigation_system_drift_discarded/);
assert.match(source,/v042738_authoritative_apply_projection/);
assert.match(source,/system_drift_navigation_blocked:false/);
assert.match(source,/scope\.PokemonSleepExplicitManualDraftSaveV042738=api/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.28_V042738_AUTHORITATIVE_DRAFT_NAVIGATION',
  physical_failure_replay:'freshly loaded confirmation blocked Previous despite zero user edits',
  trusted_user_event_required_for_manual_dirty:true,
  system_dom_drift_navigation_allowed:true,
  system_dom_drift_write_authority:false,
  implicit_navigation_write_blocked:true,
  apply_restores_authoritative_draft:true,
  manual_patch_touched_fields_only:true,
  explicit_save_required:true,
  offline_runtime_path_preserved:true,
  mutation_observer_added:false,
},null,2));