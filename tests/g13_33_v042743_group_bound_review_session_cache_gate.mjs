import assert from 'node:assert/strict';
import {
  GROUP_BOUND_REVIEW_SESSION_VERSION,
  createReviewSessionCacheModel,
  mergeFirstNonblankDraft,
  humanizeConflict,
} from '../assets/js/group-bound-review-session-cache-v042743.js';

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

console.log(JSON.stringify({status:'PASS',gate:'G13.33',version:GROUP_BOUND_REVIEW_SESSION_VERSION,checks:{first_nonblank:true,human_conflicts:true,background_isolation:true,roundtrip:true,ai_seal:true,manual_authority:true}},null,2));
