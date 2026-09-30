import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GROUP_BOUND_REVIEW_SESSION_VERSION,
  createReviewSessionCacheModel,
  mergeFirstNonblankDraft,
  humanizeConflict,
  stripBaselineReviewOverlay,
} from '../assets/js/group-bound-review-session-cache-v042743.js';
import {createExactGroupSealTracker,projectSessionDraftForReview} from '../assets/js/group-bound-review-session-event-guard-v042743.js';

assert.match(GROUP_BOUND_REVIEW_SESSION_VERSION,/v0\.4\.27\.43/);

const merged=mergeFirstNonblankDraft(
  {level:12,sp:null,ingredients:[{unlock_level:30,ingredient_name:'哞哞鮮奶',quantity:2}],subskills:[{unlock_level:25,subskill_name:'幫忙速度S',is_unlocked:1}]},
  {level:13,sp:777,ingredients:[{unlock_level:30,ingredient_name:'特選蘋果',quantity:2}],subskills:[{unlock_level:25,subskill_name:'技能機率提升S',is_unlocked:1}]},
  {analysis_id:'a2',source_ref:'a2.png'},
);
assert.equal(merged.level,12,'scalar conflict must preserve first nonblank');
assert.equal(merged.sp,777,'blank scalar must be filled by later image');
assert.equal(merged.ingredients[0].ingredient_name,'哞哞鮮奶','ingredient conflict must preserve first row');
assert.equal(merged.subskills[0].subskill_name,'幫忙速度S','subskill conflict must preserve first row');
assert.equal(merged.conflicts.length,3);
for(const conflict of merged.conflicts){
  const message=humanizeConflict(conflict);
  assert.ok(message.includes('目前保留'));
  assert.ok(message.includes('請人工確認'));
  assert.equal(message.includes('{'),false,'human conflict message must not expose JSON');
  assert.equal(message.includes('}'),false,'human conflict message must not expose JSON');
}

// Existing Baseline is a review-only display reference. It must never become the
// Group Session's first-nonblank image evidence.
const baselineContext={
  mode:'existing',
  baseline_reference:{
    level:20,
    sp:1000,
    helper_seconds:2400,
    carry_limit:20,
    sleep_hours:100,
    main_skill:'基準技能',
    ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}],
    subskills:[{unlock_level:10,subskill_name:'基準副技能',is_unlocked:true}],
  },
};
const hydratedBaselineSeed={
  level:20,
  sp:1000,
  helper_seconds:2400,
  carry_limit:20,
  sleep_hours:100,
  main_skill:'基準技能',
  ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}],
  subskills:[{unlock_level:10,subskill_name:'基準副技能',is_unlocked:true}],
  baseline_reference_status:'REFERENCE_OVERLAY_ACTIVE',
  baseline_hydrated_fields:['level','sp','helper_seconds','carry_limit','sleep_hours','main_skill','ingredients','subskills'],
  analysis_target_context:baselineContext,
};
const evidenceSeed=stripBaselineReviewOverlay(hydratedBaselineSeed);
for(const field of ['level','sp','helper_seconds','carry_limit','sleep_hours','main_skill'])assert.equal(evidenceSeed[field],null,`baseline-only ${field} must not seed session evidence`);
assert.deepEqual(evidenceSeed.ingredients,[],'baseline-only ingredients must not seed session evidence');
assert.deepEqual(evidenceSeed.subskills,[],'baseline-only subskills must not seed session evidence');

const baselineModel=createReviewSessionCacheModel();
baselineModel.activate('BASELINE',hydratedBaselineSeed);
let baselineResult=baselineModel.ingest('BASELINE',{
  level:25,
  sp:1500,
  helper_seconds:2300,
  carry_limit:24,
  ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}],
},{analysis_id:'image-1',source_ref:'image-1.png'});
assert.equal(baselineResult.session.draft.level,25,'first AI level must outrank old baseline');
assert.equal(baselineResult.session.draft.sp,1500,'first AI SP must outrank old baseline');
assert.equal(baselineResult.session.draft.helper_seconds,2300,'first AI helper interval must outrank old baseline');
assert.equal(baselineResult.session.draft.carry_limit,24,'first AI carry limit must outrank old baseline');
assert.equal(baselineResult.session.draft.conflicts.length,0,'baseline-vs-AI differences must not be cross-image conflicts');
baselineResult=baselineModel.ingest('BASELINE',{
  nature:'害羞',
  main_skill:'新辨識技能',
  subskills:[{unlock_level:10,subskill_name:'新辨識副技能',is_unlocked:1}],
},{analysis_id:'image-2',source_ref:'image-2.png'});
assert.equal(baselineResult.session.draft.nature,'害羞','later AI may fill previously unseen fields');
assert.equal(baselineResult.session.draft.main_skill,'新辨識技能','AI main skill must not be blocked by baseline display default');
assert.equal(baselineResult.session.draft.subskills[0].subskill_name,'新辨識副技能','AI subskill must not be blocked by baseline display default');
assert.equal(baselineResult.session.draft.conflicts.length,0,'baseline defaults must remain outside AI conflict authority');

const reviewProjection=projectSessionDraftForReview({
  overlayExistingBaseline(draft,context){
    return {
      ...draft,
      sleep_hours:draft.sleep_hours??context.baseline_reference.sleep_hours,
      baseline_reference_status:'REFERENCE_OVERLAY_ACTIVE',
      baseline_hydrated_fields:draft.sleep_hours==null?['sleep_hours']:[],
    };
  },
},baselineModel.get('BASELINE').draft,baselineContext);
assert.equal(reviewProjection.level,25,'review projection must preserve AI evidence');
assert.equal(reviewProjection.sleep_hours,100,'missing AI field may still display baseline as review-only default');
assert.equal(baselineModel.get('BASELINE').draft.sleep_hours??null,null,'display overlay must not mutate session evidence');

const model=createReviewSessionCacheModel();
model.activate('A',{species:'小鍛匠',level:12,sp:500,source_refs:['a1.png']});
let result=model.ingest('A',{species:'小鍛匠',level:13,sp:500,source_refs:['a2.png']},{analysis_id:'a2',source_ref:'a2.png'});
assert.equal(result.ok,true);
assert.equal(result.session.draft.level,12);
assert.equal(result.session.draft.conflicts.some(row=>row.field==='level'),true);
const aFingerprint=JSON.stringify(model.get('A').draft);

model.ingest('B',{species:'土王',level:31,sp:1000,source_refs:['b1.png']},{analysis_id:'b1',source_ref:'b1.png'});
model.ingest('C',{species:'信使鳥',level:28,sp:900,source_refs:['c1.png']},{analysis_id:'c1',source_ref:'c1.png'});
assert.equal(model.getState().active_group_id,'A','background group must not steal active review session');
assert.equal(JSON.stringify(model.get('A').draft),aFingerprint,'background revisions must not mutate active group cache');

model.activate('B');
assert.equal(model.getState().active_group_id,'B');
model.activate('A');
assert.equal(JSON.stringify(model.get('A').draft),aFingerprint,'Previous must round-trip exact group cache');

model.seal('A');
result=model.ingest('A',{level:99},{analysis_id:'a3',source_ref:'a3.png'});
assert.equal(result.ok,false);
assert.equal(result.status,'AI_SESSION_SEALED');
assert.equal(model.get('A').draft.level,12,'sealed AI must not mutate cache');

const manual={...model.get('A').draft,level:14};
model.manualReplace('A',manual);
assert.equal(model.get('A').draft.level,14,'explicit manual save must become session authority');
assert.equal(model.get('A').phase,'MANUAL_AUTHORITY');

const tracker=createExactGroupSealTracker();
let trackerState=tracker.freeze([
  {item_id:'a1',mode:'new',new_group_key:'new-1'},
  {item_id:'a2',mode:'new',new_group_key:'new-1'},
  {item_id:'b1',mode:'existing',pokemon_id:'p-b'},
  {item_id:'c1',mode:'new',new_group_key:'new-2'},
]);
assert.equal(Object.keys(trackerState.expected_by_logical).length,3);
tracker.bind('a1','new:capture-a');
tracker.bind('a2','new:capture-a');
tracker.bind('b1','existing:instance-b');
tracker.bind('c1','new:capture-c');
let progress=tracker.complete('a1');
assert.equal(progress.expected_source_count,2);
assert.equal(progress.completed_source_count,1);
assert.equal(progress.ready_to_seal,false,'Group A must not seal after only one of two assigned images');
progress=tracker.complete('b1');
assert.equal(progress.expected_source_count,1);
assert.equal(progress.ready_to_seal,true,'single-image Group B may seal independently while A is incomplete');
progress=tracker.complete('a2');
assert.equal(progress.completed_source_count,2);
assert.equal(progress.ready_to_seal,true,'Group A seals only after its exact assigned source set completes');
trackerState=tracker.getState();
assert.deepEqual(trackerState.completed_by_identity['new:capture-a'].sort(),['a1','a2']);

const legacyProjection=fs.readFileSync('assets/js/v0383-catalog-ocr-review-contract.js','utf8');
const eventGuard=fs.readFileSync('assets/js/group-bound-review-session-event-guard-v042743.js','utf8');
const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const regressionRunner=fs.readFileSync('scripts/ci-g13-ocr-ai-regression.mjs','utf8');
assert.match(legacyProjection,/import '\.\/group-bound-review-session-event-guard-v042743\.js';/,'runtime must install the v0.4.27.43 authority');
assert.match(legacyProjection,/full_review_projection_blocked_v042743/,'legacy shared-DOM projection must be fail-closed under .43');
assert.match(legacyProjection,/groupSessionAuthorityActive\(\)/,'legacy projection must recheck .43 authority before delayed DOM write');
assert.match(eventGuard,/analysis-confirmation-group-selected',event=>canonicalize\(event,'selected'\),true/,'selected event must be canonicalized in capture phase');
assert.match(eventGuard,/analysis-confirmation-merged',event=>canonicalize\(event,'merged'\),true/,'merged event must be canonicalized in capture phase');
assert.match(eventGuard,/v042743_group_source_expectations_frozen/,'assigned source expectations must be frozen before execution');
assert.match(eventGuard,/v042743_exact_group_ai_sealed/,'exact per-Group seal must be traced');
assert.match(eventGuard,/#analysisConfirmationWorkbench #captureGroupStatus details\{display:none!important;\}/,'legacy JSON conflict details must be permanently hidden while .43 authority is active');
assert.doesNotMatch(eventGuard,/setTimeout\([^)]*seal/,'AI seal must not depend on a timeout');
assert.match(versionAuthority,/app_version: 'v0\.4\.27\.43'/,'central release authority must be .43');
assert.match(versionAuthority,/20260827-v042743-group-bound-review-session-cache-authority/,'central build authority must be .43');
assert.match(versionAuthority,/pokemon-sleep-ai-v0\.4\.27\.43-v042743-group-bound-review-session-cache-authority/,'central cache authority must be .43');
assert.match(serviceWorker,/\.\/assets\/js\/group-bound-review-session-cache-v042743\.js/,'session cache must be available offline');
assert.match(serviceWorker,/\.\/assets\/js\/group-bound-review-session-event-guard-v042743\.js/,'session event guard must be available offline');
assert.match(regressionRunner,/tests\/g13_33_v042743_group_bound_review_session_cache_gate\.mjs/,'G13.33 must be in consolidated G13 regression');
assert.match(regressionRunner,/g13-ocr-ai-regression-2026-08-27-v042743-group-bound-review-session-cache-authority/,'consolidated regression identity must be .43');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.33',
  version:GROUP_BOUND_REVIEW_SESSION_VERSION,
  checks:{
    baseline_reference_review_only:true,
    baseline_not_session_evidence:true,
    first_nonblank:true,
    human_conflicts:true,
    background_isolation:true,
    roundtrip:true,
    ai_seal:true,
    exact_group_source_completion:true,
    manual_authority:true,
    capture_phase_projection:true,
    legacy_dom_projection_blocked:true,
    legacy_json_hidden:true,
    central_release_authority:true,
    offline_precache:true,
    consolidated_runner:true,
  },
},null,2));
