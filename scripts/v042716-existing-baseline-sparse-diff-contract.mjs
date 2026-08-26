import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [version,target,executor,multi,workbench,unified,master,exporter,transfer,production,sw]=await Promise.all([
  text('assets/js/version-authority.js'),
  text('assets/js/analysis-target-identity.js'),
  text('assets/js/ai-review-queue-executor.js'),
  text('assets/js/data-consistency-multicapture.js'),
  text('assets/js/analysis-confirmation-workbench.js'),
  text('assets/js/unified-import-analysis-workbench.js'),
  text('assets/js/pokemon-master-options.js'),
  text('assets/js/ai-image-analysis-export.js'),
  text('assets/js/pokemon-professor-transfer.js'),
  text('assets/js/production-authority-registry.js'),
  text('service-worker.js'),
]);

assert.match(version,/app_version:\s*'v0\.4\.27\.16'/u,'v0.4.27.16 version authority missing');
assert.match(version,/app_build:\s*'20260819-v042716-existing-baseline-sparse-diff'/u,'v0.4.27.16 build authority missing');
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.16-v042716-existing-baseline-sparse-diff'/u,'v0.4.27.16 cache authority missing');
assert.ok(version.includes("// app_version: 'v0.4.27.15'"),'v0.4.27.15 lineage marker missing');

// Existing-target baseline is local player state used only as reference. The returned baseline object
// must not expose private IDs, nickname, or editable display label to the Provider.
for(const token of [
  "EXISTING_BASELINE_SCHEMA='pokemon-sleep-existing-pokemon-baseline/1.0'",
  'buildExistingPokemonBaselineReference',
  "authority:'PLAYER_SQLITE_CURRENT_REFERENCE'",
  "evidence_role:'REFERENCE_ONLY_NOT_IMAGE_EVIDENCE'",
  'immutable_reference:true',
  'display_identity_excluded:true',
  'private_platform_ids_excluded:true',
  'baseline_reference_provider_visible:true',
])assert.ok(target.includes(token),`existing baseline target contract missing ${token}`);
const baselineSlice=target.slice(target.indexOf('export function buildExistingPokemonBaselineReference'),target.indexOf('async function ensurePokemonInstanceId'));
assert.doesNotMatch(baselineSlice,/\bnickname\s*:/u,'provider baseline must not expose nickname');
assert.doesNotMatch(baselineSlice,/\bpokemon_instance_id\s*:/u,'provider baseline must not expose pokemon_instance_id');
assert.doesNotMatch(baselineSlice,/\btarget_label_snapshot\s*:/u,'provider baseline must not expose editable target label');
for(const token of ['ingredients','subskills','main_skill','main_skill_level','helper_seconds','carry_limit'])assert.ok(baselineSlice.includes(token),`baseline detail missing ${token}`);

// New Pokémon mode must not receive an existing baseline.
const newContextSlice=target.slice(target.indexOf('export function createNewPokemonAnalysisContext'),target.indexOf('export function setActiveAnalysisTargetContext'));
assert.ok(newContextSlice.includes('baseline_reference:null'),'new capture group must have no existing baseline');
assert.ok(newContextSlice.includes('baseline_reference_provider_visible:false'),'new capture group baseline provider flag must be false');

// Provider prompt separates Reference from Evidence and asks for sparse direct-observation differences.
for(const token of [
  "BASELINE_PROMPT_POLICY_VERSION='existing-baseline-reference-2026-08-19-a'",
  'buildExistingBaselinePrompt',
  'current_profile_reference',
  '只是唯讀 Reference，不是這張圖片的 Evidence',
  '禁止複製 Reference 來填滿 profile、ingredients、subskills 或 visual_evidence',
  '主要目標是找出可直接觀測的差異，輸出應偏 Sparse',
  'BASELINE_CONFLICT_REVIEW_REQUIRED',
  'baseline_reference_used',
  'baseline_prompt_policy_version',
])assert.ok(executor.includes(token),`baseline prompt contract missing ${token}`);
assert.ok(executor.includes('prompt:effectivePrompt'),'AI execution must use the baseline-aware effective prompt');
assert.ok(executor.includes("baselineCacheContext=promptContext.baseline_reference_used?JSON.stringify(promptContext.baseline):'NO_BASELINE'"),'cache key must vary with baseline context');

// Known physical-validation typo is normalized safely before the canonical allowlist rejects it.
assert.ok(master.includes("'流星群（樹果遽增）'"),'correct Latios main skill canonical spelling missing');
assert.ok(master.includes("'樹果遽增'"),'correct berry surge canonical spelling missing');
assert.ok(!master.includes("'流星群（樹果速增）'"),'wrong canonical Latios spelling must be removed');
assert.ok(!master.includes("'樹果速增'"),'wrong canonical berry surge spelling must be removed');
assert.ok(executor.includes("replace(/樹果速增/g,'樹果遽增')"),'safe known-text normalization missing');
assert.ok(executor.includes("allowed.find(item=>text(item)===normalized)"),'main-skill canonical matching must normalize punctuation/forms');
assert.ok(executor.includes("row.reason!=='SAFE_MAIN_SKILL_TEXT_NORMALIZED'"),'safe main-skill normalization must not turn the whole observation into hard REVIEW_REQUIRED');
assert.ok(workbench.includes("replace(/樹果速增/g,'樹果遽增')"),'confirmation form must also normalize the known legacy typo');

// Existing baseline may hydrate blank/conflicted confirmation fields for display, but it is dehydrated
// again when unchanged so Reference does not become a new Observation or write.
for(const token of [
  'overlayExistingBaseline',
  "baseline_reference_status='REFERENCE_OVERLAY_ACTIVE'",
  'baseline_hydrated_fields',
  "hydrated.push('ingredients')",
  "hydrated.push('subskills')",
])assert.ok(multi.includes(token),`baseline confirmation overlay missing ${token}`);
for(const token of [
  'dehydrateBaselineDraft',
  "draft.baseline_reference_status='SPARSE_DIFF_DEHYDRATED'",
  'draft.baseline_preserved_fields=preserved',
  "draft.ingredients=[]",
  "draft.subskills=[]",
])assert.ok(workbench.includes(token),`baseline sparse-write dehydration missing ${token}`);
assert.ok(workbench.includes('維持原值不會建立新 Evidence 或 update'),'human review must disclose baseline display semantics');

// Cross-image disagreements remain fail closed. The v0.4.27.16 predecessor cleared whole
// collections. Successors may narrow isolation to the contradictory unlock level, but may never
// silently pick first/last writer or treat Baseline as conflict authority.
for(const token of ['REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT','out[key]=null','Baseline 只供參考'])assert.ok(multi.includes(token),`cross-image fail-closed invariant missing ${token}`);
const levelAwareCollections=multi.includes('function mergeCollectionRows(out,key,nextRows)');
if(levelAwareCollections){
  for(const token of [
    'const field=`${key}@${level}`',
    "mergeCollectionRows(out,'ingredients',next.ingredients)",
    "mergeCollectionRows(out,'subskills',next.subskills)",
    'map.delete(level)',
  ])assert.ok(multi.includes(token),`successor per-level collection fail-closed invariant missing ${token}`);
}else{
  for(const token of ['out.ingredients=[]','out.subskills=[]'])assert.ok(multi.includes(token),`predecessor whole-array fail-closed invariant missing ${token}`);
}

// v0.4.27.16 auto-focused a newly imported platform target and requested a snapshot first.
// v0.4.27.40+ deliberately strengthens this: once human review has an active group, revisions for
// other platform targets queue in the background and cannot steal focus at all. Both policies must
// preserve the current review; the successor no longer needs an implicit snapshot-before-focus fix.
const backgroundTargetQueue=multi.includes('platform_target_background_revision')&&multi.includes('background_target_queue:true');
for(const token of ['pokemon-sleep:analysis-confirmation-navigation-changed','publishNavigation'])assert.ok(multi.includes(token),`live review queue synchronization missing ${token}`);
if(backgroundTargetQueue){
  for(const token of [
    "reason:'platform_target_background_revision'",
    "publishNavigation('platform_target_background_revision_queued')",
    'platform_target_auto_focus:false',
    'background_target_queue:true',
  ])assert.ok(multi.includes(token),`successor background review authority missing ${token}`);
  assert.ok(!multi.includes("selectGroup(target.id,{reason:'platform_target_new_run_focus'})"),'successor must not auto-focus a background target');
}else{
  for(const token of [
    'pokemon-sleep:analysis-confirmation-snapshot-request',
    'platform_target_new_run_focus',
    'requestActiveDraftSnapshot',
    'confirmation_group_auto_focused',
  ])assert.ok(multi.includes(token),`predecessor auto-focus/snapshot synchronization missing ${token}`);
  assert.ok(workbench.includes("globalThis.addEventListener('pokemon-sleep:analysis-confirmation-snapshot-request'"),'predecessor snapshot listener missing');
  assert.ok(workbench.includes('replaceActiveDraft?.(draft'),'predecessor snapshot request must persist unsaved confirmation edits');
}
assert.ok(workbench.includes('id="analysisReviewPosition"'),'review position badge needs a live DOM target');
assert.ok(workbench.includes('refreshNavigationControls'),'live navigation control updater missing');
assert.ok(workbench.includes("globalThis.addEventListener('pokemon-sleep:analysis-confirmation-navigation-changed'"),'navigation-changed listener missing');

// Existing-member UI explicitly informs the user that detailed local profile reference is sent to the Provider.
for(const token of [
  'v0.4.27.16 Platform Identity + Existing Baseline Sparse-Diff',
  '唯讀 Baseline Reference',
  'pokemon_id、pokemon_instance_id、暱稱與可編輯 display label 不會送出',
  'existing_baseline_sparse_diff:true',
  'confirmation_target_auto_focus:true',
])assert.ok(unified.includes(token),`existing-baseline consent/UX missing ${token}`);

// Per-image exports disclose only policy/use booleans. They must not serialize baseline values.
assert.ok(exporter.includes("AI_IMAGE_ANALYSIS_EXPORT_SCHEMA='pokemon-sleep-ai-image-analysis-export/1.2'"),'per-image export schema 1.2 missing');
for(const token of ['existing_baseline_reference_sent','baseline_reference_values_exported:false','baseline_reference_used','baseline_prompt_policy_version'])assert.ok(exporter.includes(token),`baseline export metadata missing ${token}`);
const safeTargetSlice=exporter.slice(exporter.indexOf('function safeTargetContext'),exporter.indexOf('export function buildPerImageAnalysisExport'));
assert.doesNotMatch(safeTargetSlice,/baseline_reference\s*:/u,'actual baseline reference values must not be exported');
assert.doesNotMatch(safeTargetSlice,/target_pokemon_instance_id\s*:/u,'actual instance ID must not be exported');
assert.doesNotMatch(safeTargetSlice,/capture_group_id\s*:/u,'actual capture group ID must not be exported');

// Professor transfer remains the already-validated soft terminal lifecycle.
for(const token of ["status='sent_to_professor'",'no_hard_delete:true','USER_DIRECT_OBSERVATION','CANDY_CONVERSION_RULE_STATUS'])assert.ok(transfer.includes(token),`professor transfer regression invariant missing ${token}`);
assert.doesNotMatch(transfer,/DELETE\s+FROM\s+pokemon/iu,'professor transfer must remain soft-terminal');

// All edited runtime modules are already part of offline precache.
for(const asset of [
  './assets/js/analysis-target-identity.js',
  './assets/js/data-consistency-multicapture.js',
  './assets/js/analysis-confirmation-workbench.js',
  './assets/js/unified-import-analysis-workbench.js',
  './assets/js/ai-review-queue-executor.js',
  './assets/js/ai-image-analysis-export.js',
  './assets/js/pokemon-master-options.js',
])assert.ok(sw.includes(`'${asset}'`),`service worker precache missing ${asset}`);

// Production numeric authority remains exactly 4/7.
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`production authority changed unexpectedly: ${token}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042716_EXISTING_BASELINE_SPARSE_DIFF',
  checks:{
    existing_profile_reference_provider_context:true,
    reference_not_evidence:true,
    private_identity_excluded:true,
    new_capture_has_no_baseline:true,
    sparse_diff_prompt:true,
    latios_main_skill_canonical:'流星群（樹果遽增）',
    known_speed_typo_safe_normalization:true,
    baseline_confirmation_overlay:true,
    unchanged_baseline_dehydrated_before_write:true,
    cross_image_conflict_fail_closed:true,
    cross_image_collection_conflict_granularity:levelAwareCollections?'UNLOCK_LEVEL':'WHOLE_ARRAY',
    review_focus_policy:backgroundTargetQueue?'BACKGROUND_TARGET_QUEUE_NO_FOCUS_STEAL':'PREDECESSOR_AUTO_FOCUS_WITH_SNAPSHOT',
    live_review_pagination:true,
    unsaved_review_preserved:true,
    export_baseline_values_redacted:true,
    professor_transfer_regression_preserved:true,
    offline_pwa_precache:true,
    production_numeric_authority:'4/7',
  },
},null,2));
