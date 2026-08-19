import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGroupBoundReviewController,REVIEW_GROUP_ISOLATION_VERSION} from '../assets/js/review-group-isolation-v042717.js';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [version,index,patch,multi,workbench,executor,master,transfer,exporter,production]=await Promise.all([
  text('assets/js/version-authority.js'),
  text('index.html'),
  text('assets/js/review-group-isolation-v042717.js'),
  text('assets/js/data-consistency-multicapture.js'),
  text('assets/js/analysis-confirmation-workbench.js'),
  text('assets/js/ai-review-queue-executor.js'),
  text('assets/js/pokemon-master-options.js'),
  text('assets/js/pokemon-professor-transfer.js'),
  text('assets/js/ai-image-analysis-export.js'),
  text('assets/js/production-authority-registry.js'),
]);

assert.equal(REVIEW_GROUP_ISOLATION_VERSION,'v0.4.27.17-group-bound-snapshot-2026-08-19-a');
assert.match(version,/app_version:\s*'v0\.4\.27\.17'/u,'v0.4.27.17 version authority missing');
assert.match(version,/app_build:\s*'20260819-v042717-review-group-isolation'/u,'v0.4.27.17 build authority missing');
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.17-v042717-review-group-isolation'/u,'v0.4.27.17 cache authority missing');
assert.ok(version.includes("// app_version: 'v0.4.27.16'"),'v0.4.27.16 lineage marker missing');

const multiIndex=index.indexOf('./assets/js/data-consistency-multicapture.js');
const patchIndex=index.indexOf('./assets/js/review-group-isolation-v042717.js');
assert.ok(multiIndex>=0,'multicapture runtime missing from index');
assert.ok(patchIndex>multiIndex,'review-group isolation runtime must load after multicapture runtime');

for(const token of [
  'createGroupBoundReviewController',
  'renderedGroupId',
  'ensureRenderedGroupActive',
  'review_group_snapshot_group_bound',
  'source_group_id:sourceGroupId',
  'target_group_id:targetGroupId',
  'REVIEW_GROUP_SNAPSHOT_TARGET_MISMATCH',
  'v042717_snapshot_source_resync',
  'review_group_navigation_group_bound',
  'api.replaceActiveDraft=controller.replaceRenderedDraft',
  'api.navigateReviewGroup=controller.navigateFromRendered',
  'getRenderedReviewGroupState',
])assert.ok(patch.includes(token),`group-bound runtime contract missing ${token}`);

// v0.4.27.16 physical PASS invariants remain intact.
for(const token of [
  'REFERENCE_OVERLAY_ACTIVE',
  'baseline_hydrated_fields',
  'pokemon-sleep:analysis-confirmation-navigation-changed',
  'platform_target_new_run_focus',
])assert.ok(multi.includes(token),`v0.4.27.16 multicapture invariant missing ${token}`);
for(const token of [
  'dehydrateBaselineDraft',
  '維持原值不會建立新 Evidence 或 update',
  'replaceActiveDraft?.(draft',
])assert.ok(workbench.includes(token),`v0.4.27.16 confirmation invariant missing ${token}`);
for(const token of [
  'current_profile_reference',
  'REFERENCE，不是這張圖片的 Evidence',
  "replace(/樹果速增/g,'樹果遽增')",
])assert.ok(executor.includes(token),`v0.4.27.16 baseline/canonical invariant missing ${token}`);
assert.ok(master.includes("'流星群（樹果遽增）'"),'Latios main-skill canonical regressed');
for(const token of ["status='sent_to_professor'",'no_hard_delete:true','USER_DIRECT_OBSERVATION'])assert.ok(transfer.includes(token),`Professor Transfer regressed: ${token}`);
assert.ok(exporter.includes("AI_IMAGE_ANALYSIS_EXPORT_SCHEMA='pokemon-sleep-ai-image-analysis-export/1.2'"),'per-image export 1.2 regressed');
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`Production Numeric Authority changed unexpectedly: ${token}`);

// Functional sentinel simulation of the physical N4c failure mode.
const groups=new Map([
  ['A',{id:'A',draft:{species:'拉帝歐斯',nickname:'',level:31,sp:1111,main_skill:'流星群（樹果遽增）',ingredients:[{unlock_level:1,ingredient_name:'好眠番茄',quantity:1}]}}],
  ['B',{id:'B',draft:{species:'信使鳥',nickname:'',level:42,sp:2222,main_skill:'禮物',ingredients:[{unlock_level:1,ingredient_name:'特選蛋',quantity:2}]}}],
  ['C',{id:'C',draft:{species:'雷丘',nickname:'',level:53,sp:3333,main_skill:'能量補給S',ingredients:[{unlock_level:1,ingredient_name:'窩心洋芋',quantity:3}]}}],
]);
let active='C';
const order=['A','B','C'];
const clone=value=>JSON.parse(JSON.stringify(value));
const fakeApi={
  getState:()=>({active_group_id:active,groups:[...groups.values()].map(clone)}),
  selectGroup:id=>{if(!groups.has(id))return null;active=id;return {id};},
  replaceActiveDraft:draft=>{const row=groups.get(active);row.draft={...row.draft,...clone(draft)};return {id:active,draft:clone(row.draft)};},
  navigateReviewGroup:offset=>{const index=order.indexOf(active),next=index+(Number(offset)<0?-1:1);if(next<0||next>=order.length)return null;active=order[next];return {id:active,draft:clone(groups.get(active).draft)};},
  advanceReviewGroup:()=>{const index=order.indexOf(active);if(index>=order.length-1)return null;active=order[index+1];return {id:active,draft:clone(groups.get(active).draft)};},
};
const traces=[];
const controller=createGroupBoundReviewController(fakeApi,{traceFn:(event,detail)=>traces.push({event,detail})});

// Reproduce the v0.4.27.16 race: visible form is B while mutable active pointer has already become C.
controller.noteRenderedGroup('B',{reason:'physical_n4c_reproduction'});
assert.equal(fakeApi.getState().active_group_id,'C','fixture must begin with active pointer one group ahead');
controller.replaceRenderedDraft({
  species:'信使鳥',
  nickname:'USER_MANUAL_SNAPSHOT_B',
  level:42,
  sp:2222,
  main_skill:'禮物',
  ingredients:[{unlock_level:1,ingredient_name:'特選蛋',quantity:2}],
},{reason:'manual_previous_navigation'});

assert.equal(fakeApi.getState().active_group_id,'B','snapshot must first resync active pointer to rendered B');
assert.equal(groups.get('B').draft.species,'信使鳥','B species must remain B');
assert.equal(groups.get('B').draft.nickname,'USER_MANUAL_SNAPSHOT_B','B manual snapshot must persist');
assert.equal(groups.get('B').draft.level,42,'B level must remain isolated');
assert.equal(groups.get('B').draft.sp,2222,'B SP must remain isolated');
assert.equal(groups.get('B').draft.main_skill,'禮物','B main skill must remain isolated');
assert.deepEqual(groups.get('B').draft.ingredients,[{unlock_level:1,ingredient_name:'特選蛋',quantity:2}],'B ingredients must remain isolated');
assert.equal(groups.get('A').draft.species,'拉帝歐斯','A must not be overwritten by B snapshot');
assert.equal(groups.get('C').draft.species,'雷丘','C must not receive B snapshot');
assert.equal(groups.get('C').draft.nickname,'','C nickname must remain untouched');
assert.equal(groups.get('C').draft.level,53,'C level must remain untouched');
assert.equal(groups.get('C').draft.sp,3333,'C SP must remain untouched');
assert.equal(groups.get('C').draft.main_skill,'能量補給S','C main skill must remain untouched');
assert.deepEqual(groups.get('C').draft.ingredients,[{unlock_level:1,ingredient_name:'窩心洋芋',quantity:3}],'C ingredients must remain untouched');

// Navigation must be calculated from the rendered source group, not the stale mutable pointer.
const previous=controller.navigateFromRendered(-1,{reason:'manual_previous_pokemon'});
assert.equal(previous?.id,'A','B previous must be A');
controller.noteRenderedGroup('A',{reason:'selected_A'});
assert.equal(groups.get('A').draft.species,'拉帝歐斯');

const next=controller.navigateFromRendered(1,{reason:'manual_next_pokemon'});
assert.equal(next?.id,'B','A next must be B');
controller.noteRenderedGroup('B',{reason:'selected_B_again'});
assert.equal(groups.get('B').draft.nickname,'USER_MANUAL_SNAPSHOT_B','B manual edit must survive A/B roundtrip');

const next2=controller.navigateFromRendered(1,{reason:'manual_next_pokemon'});
assert.equal(next2?.id,'C','B next must be C');
controller.noteRenderedGroup('C',{reason:'selected_C_again'});
assert.equal(groups.get('C').draft.species,'雷丘','C must still be C after roundtrip');
assert.equal(groups.get('A').draft.species,'拉帝歐斯','A must still be A after roundtrip');
assert.equal(groups.get('B').draft.species,'信使鳥','B must still be B after roundtrip');
assert.ok(traces.some(row=>row.event==='review_group_source_resynced'),'race correction trace missing');
assert.ok(traces.some(row=>row.event==='review_group_snapshot_group_bound'&&row.detail.source_group_id==='B'&&row.detail.target_group_id==='B'),'group-bound snapshot trace missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042717_REVIEW_GROUP_ISOLATION',
  checks:{
    release_authority:'v0.4.27.17',
    patch_load_order:true,
    rendered_group_is_snapshot_authority:true,
    stale_active_pointer_resynchronized:true,
    source_target_group_parity_enforced:true,
    abc_species_isolation:true,
    abc_profile_field_isolation:true,
    manual_snapshot_persistence:true,
    bidirectional_navigation_from_rendered_group:true,
    v042716_baseline_sparse_diff_preserved:true,
    latios_main_skill_canonical:'流星群（樹果遽增）',
    professor_transfer_preserved:true,
    per_image_export_schema:'1.2',
    production_numeric_authority:'4/7',
  },
},null,2));
