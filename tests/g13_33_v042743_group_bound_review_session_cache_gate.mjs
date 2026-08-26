import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GROUP_BOUND_REVIEW_SESSION_VERSION,
  createReviewSessionCacheModel,
  mergeFirstNonblankDraft,
  humanizeConflict,
} from '../assets/js/group-bound-review-session-cache-v042743.js';
import {createExactGroupSealTracker} from '../assets/js/group-bound-review-session-event-guard-v042743.js';

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
assert.match(legacyProjection,/import '\.\/group-bound-review-session-event-guard-v042743\.js';/,'runtime must install the v0.4.27.43 authority');
assert.match(legacyProjection,/full_review_projection_blocked_v042743/,'legacy shared-DOM projection must be fail-closed under .43');
assert.match(legacyProjection,/groupSessionAuthorityActive\(\)/,'legacy projection must recheck .43 authority before delayed DOM write');
assert.match(eventGuard,/analysis-confirmation-group-selected',event=>canonicalize\(event,'selected'\),true/,'selected event must be canonicalized in capture phase');
assert.match(eventGuard,/analysis-confirmation-merged',event=>canonicalize\(event,'merged'\),true/,'merged event must be canonicalized in capture phase');
assert.match(eventGuard,/v042743_group_source_expectations_frozen/,'assigned source expectations must be frozen before execution');
assert.match(eventGuard,/v042743_exact_group_ai_sealed/,'exact per-Group seal must be traced');
assert.doesNotMatch(eventGuard,/setTimeout\([^)]*seal/,'AI seal must not depend on a timeout');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.33',
  version:GROUP_BOUND_REVIEW_SESSION_VERSION,
  checks:{
    first_nonblank:true,
    human_conflicts:true,
    background_isolation:true,
    roundtrip:true,
    ai_seal:true,
    exact_group_source_completion:true,
    manual_authority:true,
    capture_phase_projection:true,
    legacy_dom_projection_blocked:true,
  },
},null,2));
