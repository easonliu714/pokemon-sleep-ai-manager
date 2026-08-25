import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const modulePath='assets/js/explicit-manual-draft-save-v042737.js';
const syntax=spawnSync(process.execPath,['--check',modulePath],{stdio:'inherit'});
assert.equal(syntax.status,0,'explicit manual draft authority syntax must pass');
const mod=await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);

const index=fs.readFileSync('index.html','utf8');
const predecessor=fs.readFileSync('assets/js/per-image-target-wiring-recovery-v042728.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const consistencyPos=index.indexOf('./assets/js/data-consistency-multicapture.js');
const reviewAuthorityPos=index.indexOf('./assets/js/review-group-isolation-v042717.js');
const explicitSavePos=index.indexOf('./assets/js/explicit-manual-draft-save-v042737.js');
const recoveryPos=index.indexOf('./assets/js/per-image-target-wiring-recovery-v042728.js');
assert.ok(consistencyPos>=0&&reviewAuthorityPos>consistencyPos,'review authority must load after MultiCapture consistency');
assert.ok(explicitSavePos>reviewAuthorityPos,'explicit manual save authority must load after review-group authority');
assert.ok(recoveryPos>explicitSavePos,'per-image recovery must load after the explicit write authority');
assert.doesNotMatch(predecessor,/explicit-manual-draft-save-v042737/,'v0.4.27.28 predecessor must remain release-compatible and must not import later write authority');
assert.match(serviceWorker,/\.\/assets\/js\/explicit-manual-draft-save-v042737\.js/,'offline precache must contain the explicit write authority runtime');
assert.match(versionAuthority,/\/\/ app_version:\s*'v0\.4\.27\.37'/,'v0.4.27.37 must remain a historical parser bridge');
assert.match(versionAuthority,/\/\/ app_build:\s*'20260825-v042737-explicit-manual-draft-save-authority'/);

assert.match(mod.EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,/^v0\.4\.27\.(?:37|38)-/,'current successor must preserve the v0.4.27.37 explicit-save contract');
assert.deepEqual(
  mod.classifyFormSnapshot({expected:{species:'小鍛匠',type:'妖精'},current:{species:'土王',type:'毒'},touched_keys:[]}),
  {clean:false,manual_dirty:false,unauthorized_drift:true,manual_keys:[],unauthorized_keys:['species','type']},
  'programmatic projection must never be classified as a manual edit',
);
const manual=mod.classifyFormSnapshot({expected:{species:'土王',type:'毒'},current:{species:'土王',type:'飛行'},touched_keys:['type']});
assert.equal(manual.manual_dirty,true);

const groups=[
  {id:'G1',draft:{species:'小鍛匠',type:'妖精',favorite_berry:''},latest_revision:{analysis_id:'A1',revision_no:1,source_image_ref:'smallsmith.png'}},
  {id:'G2',draft:{species:'土王',type:'毒',favorite_berry:'零餘果'},latest_revision:{analysis_id:'A2',revision_no:1,source_image_ref:'clodsire.png'}},
  {id:'G3',draft:{species:'信使鳥',type:'飛行',favorite_berry:'椰木果'},latest_revision:{analysis_id:'A3',revision_no:1,source_image_ref:'delibird.png'}},
];
let active='G1',writes=[];
const consistency={
  getState:()=>({active_group_id:active,groups:structuredClone(groups)}),
  replaceActiveDraft:(draft,{reason}={})=>{writes.push({active,draft:structuredClone(draft),reason});const row=groups.find(g=>g.id===active);row.draft={...row.draft,...structuredClone(draft)};return row;},
  selectGroup:id=>{active=id;return groups.find(g=>g.id===id)||null;},
};
const scope={PokemonSleepMultiCaptureConsistency:consistency};
assert.equal(mod.installExplicitManualDraftSave(scope),true);

const blocked=consistency.replaceActiveDraft({species:'土王',type:'毒'},{reason:'manual_next_navigation'});
assert.equal(blocked,null,'navigation must never persist the currently rendered DOM');
assert.equal(writes.length,0);
assert.equal(groups[0].draft.species,'小鍛匠');
assert.equal(groups[0].draft.type,'妖精');

const exact={group_id:'G1',analysis_id:'A1',revision_no:1,source_image_ref:'smallsmith.png'};
let result=(scope.PokemonSleepExplicitManualDraftSaveV042738||scope.PokemonSleepExplicitManualDraftSaveV042737).saveManualDraft({...groups[0].draft,nickname:'人工暱稱'},exact);
assert.equal(result.ok,true);
assert.equal(writes.length,1);
assert.equal(groups[0].draft.nickname,'人工暱稱');
assert.equal(groups[1].draft.species,'土王');
assert.equal(groups[2].draft.species,'信使鳥');

groups[0].latest_revision.revision_no=2;
result=(scope.PokemonSleepExplicitManualDraftSaveV042738||scope.PokemonSleepExplicitManualDraftSaveV042737).saveManualDraft({...groups[0].draft,type:'火'},exact);
assert.equal(result.ok,false);
assert.equal(result.status,'STALE_REVISION');
assert.equal(writes.length,1);
assert.equal(groups[0].draft.type,'妖精');

active='G2';
result=(scope.PokemonSleepExplicitManualDraftSaveV042738||scope.PokemonSleepExplicitManualDraftSaveV042737).saveManualDraft({...groups[0].draft,type:'水'},{...exact,revision_no:2});
assert.equal(result.ok,false);
assert.equal(result.status,'GROUP_MISMATCH');
assert.equal(writes.length,1);

const source=fs.readFileSync(modulePath,'utf8');
assert.doesNotMatch(source,/MutationObserver/,'manual draft authority must not introduce full-DOM observer races');
assert.match(source,/legacy_implicit_snapshot/);
assert.match(source,/STALE_REVISION/);
assert.match(source,/saveManualAnalysisDraftV0427(?:37|38)/);
assert.match(source,/revertManualAnalysisDraftV0427(?:37|38)/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.27_V042737_EXPLICIT_MANUAL_DRAFT_SAVE',
  successor_version:mod.EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,
  production_index_load_order:true,
  predecessor_release_compatibility_preserved:true,
  offline_precache_wired:true,
  v042737_historical_authority_preserved:true,
  implicit_navigation_write_blocked:true,
  explicit_save_only:true,
  exact_group_revision_cas:true,
  stale_revision_fail_closed:true,
  group_mismatch_fail_closed:true,
  physical_offset_fixture:['G1=小鍛匠/妖精','G2=土王/毒','G3=信使鳥/飛行'],
  programmatic_projection_not_manual:true,
  mutation_observer_added:false,
},null,2));