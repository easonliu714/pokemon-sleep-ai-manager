import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  REVIEW_GROUP_ISOLATION_VERSION,
  REVIEW_GROUP_FORM_AUTHORITY_VERSION,
  PER_IMAGE_TARGET_ASSIGNMENT_VERSION,
  createGroupBoundReviewController,
  createImmutableFormGroupAuthority,
  preparePerImageTargetContexts,
} from '../assets/js/review-group-isolation-v042717.js';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [version,patch,workbench,serviceWorker,production,exporter]=await Promise.all([
  text('assets/js/version-authority.js'),
  text('assets/js/review-group-isolation-v042717.js'),
  text('assets/js/unified-import-analysis-workbench.js'),
  text('service-worker.js'),
  text('assets/js/production-authority-registry.js'),
  text('assets/js/ai-image-analysis-export.js'),
]);

assert.equal(REVIEW_GROUP_ISOLATION_VERSION,'v0.4.27.17-group-bound-snapshot-2026-08-19-a');
assert.equal(REVIEW_GROUP_FORM_AUTHORITY_VERSION,'v0.4.27.18-immutable-form-group-2026-08-19-a');
assert.equal(PER_IMAGE_TARGET_ASSIGNMENT_VERSION,'v0.4.27.18-per-image-target-assignment-2026-08-19-a');
assert.match(version,/app_version:\s*'v0\.4\.27\.18'/u,'v0.4.27.18 version authority missing');
assert.match(version,/app_build:\s*'20260819-v042718-per-image-target-group-authority'/u,'v0.4.27.18 build authority missing');
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.18-v042718-per-image-target-group-authority'/u,'v0.4.27.18 cache authority missing');
assert.ok(version.includes("// app_version: 'v0.4.27.17'"),'v0.4.27.17 lineage missing');
assert.ok(serviceWorker.includes('./assets/js/review-group-isolation-v042717.js'),'successor carrier must remain first-offline precached');

for(const token of [
  'replaceGroupDraft',
  'navigateReviewGroupFrom',
  'REVIEW_FORM_GROUP_ID_REQUIRED',
  'v042718_stale_or_contaminated_core_draft_rejected',
  'v042718_form_authority_corrected',
  'data-v042718-target-mode',
  'data-v042718-existing-target',
  'data-v042718-new-group',
  'preparePerImageTargetContexts',
  'v042718_per_image_context_activated',
  '每張圖片指定寶可夢',
])assert.ok(patch.includes(token),`v0.4.27.18 successor token missing ${token}`);

// v0.4.27.17 factory remains importable for predecessor replay.
const predecessorGroups=new Map([['A',{id:'A'}],['B',{id:'B'}]]);let predecessorActive='B';
const predecessorApi={
  getState:()=>({active_group_id:predecessorActive,groups:[...predecessorGroups.values()]}),
  selectGroup:id=>{predecessorActive=id;return {id};},
  replaceActiveDraft:draft=>({id:predecessorActive,draft}),
  navigateReviewGroup:offset=>{predecessorActive=Number(offset)<0?'A':'B';return {id:predecessorActive};},
};
assert.equal(createGroupBoundReviewController(predecessorApi).version,REVIEW_GROUP_ISOLATION_VERSION);

const clone=value=>JSON.parse(JSON.stringify(value));
const groups=new Map([
  ['A',{id:'A',order:1,status:'active',draft:{species:'拉帝歐斯',nickname:'',level:31,sp:1111,main_skill:'流星群（樹果遽增）',ingredients:[{unlock_level:1,ingredient_name:'好眠番茄',quantity:1}],analysis_ids:['A1'],source_refs:['A.png']}}],
  ['B',{id:'B',order:2,status:'pending',draft:{species:'信使鳥',nickname:'',level:42,sp:2222,main_skill:'禮物',ingredients:[{unlock_level:1,ingredient_name:'特選蛋',quantity:2}],analysis_ids:['B1'],source_refs:['B.png']}}],
  ['C',{id:'C',order:3,status:'pending',draft:{species:'雷丘',nickname:'',level:53,sp:3333,main_skill:'能量補給S',ingredients:[{unlock_level:1,ingredient_name:'窩心洋芋',quantity:3}],analysis_ids:['C1'],source_refs:['C.png']}}],
  ['D',{id:'D',order:4,status:'pending',draft:{species:'小鍛匠',nickname:'',level:14,sp:4444,main_skill:'幫手支援S',ingredients:[{unlock_level:1,ingredient_name:'暖暖薑',quantity:1}],analysis_ids:['D1'],source_refs:['D.png']}}],
]);
let active='D';let visible='B';
const api={
  getState:()=>({active_group_id:active,groups:[...groups.values()].map(clone)}),
  selectGroup:id=>{if(!groups.has(id))return null;active=id;return {id,draft:clone(groups.get(id).draft)};},
};
const traces=[];
const authority=createImmutableFormGroupAuthority(api,{getVisibleGroupId:()=>visible,traceFn:(event,detail)=>traces.push({event,detail})});
for(const row of groups.values())authority.acceptCoreDraft(row.id,row.draft,{reason:'seed'});
authority.noteRenderedGroup('B');
authority.replaceVisibleDraft({...groups.get('B').draft,nickname:'USER_MANUAL_B'},{reason:'manual_previous_navigation'});
assert.equal(authority.getDraft('B').nickname,'USER_MANUAL_B');
assert.equal(authority.getDraft('A').species,'拉帝歐斯');
assert.equal(authority.getDraft('C').species,'雷丘');
assert.equal(authority.getDraft('D').species,'小鍛匠');
assert.equal(active,'D','direct form-group write must not mutate mutable active pointer');

const contaminatedC={...groups.get('D').draft,analysis_ids:['C1'],source_refs:['C.png']};
const reconciled=authority.acceptCoreDraft('C',contaminatedC,{reason:'physical_one_position_shift'});
assert.equal(reconciled.draft.species,'雷丘','same-revision contaminated core draft must be rejected');
assert.ok(traces.some(row=>row.event==='v042718_stale_or_contaminated_core_draft_rejected'));

visible='B';assert.equal(authority.navigateVisible(-1,{reason:'manual_previous'})?.id,'A');
visible='A';assert.equal(authority.navigateVisible(1,{reason:'manual_next'})?.id,'B');
visible='B';assert.equal(authority.navigateVisible(1,{reason:'manual_next'})?.id,'C');
visible='C';assert.equal(authority.navigateVisible(1,{reason:'manual_next'})?.id,'D');
assert.equal(authority.getDraft('B').nickname,'USER_MANUAL_B');

let existingCalls=0,newCalls=0;
const identityApi={
  createExistingPokemonAnalysisContext:async pokemonId=>{existingCalls++;return {mode:'existing',target_pokemon_id:pokemonId,target_pokemon_instance_id:`private-${pokemonId}`,baseline_reference:{species:pokemonId}};},
  createNewPokemonAnalysisContext:()=>{newCalls++;return {mode:'new',capture_group_id:`private-new-${newCalls}`,baseline_reference:null};},
};
const prepared=await preparePerImageTargetContexts([
  {item_id:'A1',mode:'existing',pokemon_id:'A'},
  {item_id:'A2',mode:'existing',pokemon_id:'A'},
  {item_id:'B1',mode:'existing',pokemon_id:'B'},
  {item_id:'C1',mode:'existing',pokemon_id:'C'},
  {item_id:'D1',mode:'new',new_group_key:'new-1'},
  {item_id:'D2',mode:'new',new_group_key:'new-1'},
],identityApi,{existingCache:new Map(),newCache:new Map()});
assert.equal(prepared.unique_existing_targets,3);
assert.equal(prepared.unique_new_groups,1);
assert.equal(existingCalls,3,'same existing target must share one context');
assert.equal(newCalls,1,'same new group must share one capture context');
assert.equal(prepared.contextByItemId.get('A1').target_pokemon_instance_id,prepared.contextByItemId.get('A2').target_pokemon_instance_id);
assert.equal(prepared.contextByItemId.get('D1').capture_group_id,prepared.contextByItemId.get('D2').capture_group_id);
assert.notEqual(prepared.contextByItemId.get('A1').target_pokemon_instance_id,prepared.contextByItemId.get('B1').target_pokemon_instance_id);
assert.equal(prepared.contextByItemId.get('D1').baseline_reference,null);

for(const token of ["publishStage('ocr','running'","publishStage('ai','running'",'setActiveAnalysisTargetContext(targetContext)'])assert.ok(workbench.includes(token),`per-item stage/baseline predecessor invariant missing ${token}`);
assert.ok(exporter.includes("AI_IMAGE_ANALYSIS_EXPORT_SCHEMA='pokemon-sleep-ai-image-analysis-export/1.2'"),'export privacy schema regressed');
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`Production Numeric Authority changed unexpectedly: ${token}`);

console.log(JSON.stringify({status:'PASS',gate:'V042718_PER_IMAGE_TARGET_AND_IMMUTABLE_FORM_GROUP_AUTHORITY',checks:{per_image_multi_target_batch:true,same_existing_images_share_context:true,same_new_images_share_capture_group:true,immutable_form_group_write:true,stale_core_draft_rejected:true,direct_group_navigation:true,manual_snapshot_persists:true,predecessor_v042717_retained:true,export_schema:'1.2',production_numeric_authority:'4/7'}},null,2));
