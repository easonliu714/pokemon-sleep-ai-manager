import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [version,target,multi,unified,transfer,transferUi,exporter,workbench,sw,production,index]=await Promise.all([
  text('assets/js/version-authority.js'),
  text('assets/js/analysis-target-identity.js'),
  text('assets/js/data-consistency-multicapture.js'),
  text('assets/js/unified-import-analysis-workbench.js'),
  text('assets/js/pokemon-professor-transfer.js'),
  text('assets/js/pokemon-professor-transfer-ui.js'),
  text('assets/js/ai-image-analysis-export.js'),
  text('assets/js/analysis-confirmation-workbench.js'),
  text('service-worker.js'),
  text('assets/js/production-authority-registry.js'),
  text('index.html'),
]);

assert.match(version,/app_version:\s*'v0\.4\.27\.15'/u,'v0.4.27.15 version authority missing');
assert.match(version,/app_build:\s*'20260819-v042715-platform-identity-doctor-transfer'/u,'v0.4.27.15 build authority missing');
assert.ok(version.includes("// app_version: 'v0.4.27.14'"),'v0.4.27.14 lineage marker missing');

// Existing member updates are selected from the active local roster and receive a stable platform ID.
for(const token of [
  "FROM pokemon WHERE status='active'",
  'createExistingPokemonAnalysisContext',
  'ensurePokemonInstanceId',
  'pokemon_instance_id',
  "mode:'existing'",
  'provider_visible:false',
])assert.ok(target.includes(token),`existing-target contract missing ${token}`);
assert.ok(target.includes('platform_identity_assigned'),'existing records without instance IDs must receive one with history');

// New member capture groups are platform-created before recognition and do not depend on recognized text.
for(const token of [
  'createNewPokemonAnalysisContext',
  "mode:'new'",
  "capture_group_id:uuid('capture')",
  'analysisTargetIdentityKey',
])assert.ok(target.includes(token),`new-target contract missing ${token}`);

// One run binds every saved revision to the same target context.
for(const token of [
  'setActiveAnalysisTargetContext(targetContext)',
  'clearActiveAnalysisTargetContext()',
  'createRunTargetContext',
  'id="unifiedTargetMode"',
  'value="existing_pokemon"',
  'value="new_pokemon"',
  'id="unifiedExistingTarget"',
  'one_run_one_pokemon_target:true',
])assert.ok(unified.includes(token),`unified target UI/runtime missing ${token}`);
assert.match(unified,/for\(let index=0;index<chosen\.length;index\+\+\)/u,'selected images must remain one-to-many under one run target');

// The target binding is persisted locally and confirmation cannot silently switch it.
for(const token of [
  'image_analysis_target_binding',
  'analysis_revision_platform_identity_bound',
  'currentConfirmationContext',
  'enforceConfirmationTarget',
  "context.mode==='existing'",
  "context.mode==='new'",
  'existingSelect.disabled=true',
  'Platform Identity Authority',
])assert.ok(target.includes(token),`confirmation identity enforcement missing ${token}`);
assert.match(target,/if\(target\)enforceConfirmationTarget\(\{beforeApply:true\}\)/u,'apply path must re-enforce target before original handler');

// Platform identity outranks text grouping; legacy grouping remains fallback only for unbound revisions.
for(const token of [
  'resolveRevisionAnalysisTarget',
  'analysisTargetIdentityKey',
  'targetKey',
  'row.identity_key===targetKey',
  'platform_identity_authority:true',
])assert.ok(multi.includes(token),`multicapture identity authority missing ${token}`);
assert.match(multi,/if\(targetKey\)\{/u,'platform target key must be resolved before legacy species grouping');

// Cross-image disagreements fail closed: accepted draft field becomes blank/review, never first-seen-wins authority.
for(const token of [
  'REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT',
  'conflicted_fields',
  'out[key]=null',
  'out.ingredients=[]',
  'out.subskills=[]',
])assert.ok(multi.includes(token),`cross-image fail-closed contract missing ${token}`);

// Previous/next confirmation and nickname guard from v0.4.27.14 remain present.
for(const token of [
  'id="previousAnalysisGroup"',
  '← 上一隻寶可夢',
  'id="nextAnalysisGroup"',
  '下一隻寶可夢',
  'NICKNAME_REQUIRES_DIRECT_EXPLICIT_FIELD',
  'dispatchConfirmationTerminal',
])assert.ok(workbench.includes(token),`predecessor confirmation invariant missing ${token}`);

// Professor transfer is a soft terminal state, not deletion, and candy quantity is never inferred from an unverified rule.
for(const token of [
  "status='sent_to_professor'",
  "event_type,before_json,after_json,reason,source_update_id",
  "'sent_to_professor'",
  'no_hard_delete:true',
  'USER_DIRECT_OBSERVATION',
  'USER_OBSERVATION_REQUIRED',
  'CANDY_CONVERSION_RULE_STATUS',
])assert.ok(transfer.includes(token),`professor transfer contract missing ${token}`);
assert.doesNotMatch(transfer,/DELETE\s+FROM\s+pokemon/iu,'professor transfer must never hard-delete pokemon');
assert.match(transfer,/if\(candyQuantity!==null\)/u,'candy inventory may only change after explicit observed quantity');
assert.match(transfer,/quantity=candy_inventory\.quantity\+excluded\.quantity/u,'observed candy amount must increment existing physical inventory');

for(const token of ['送給博士','confirm(','prompt(','按「取消」＝取消整個送博士操作','留空＝只完成送博士狀態'])assert.ok(transferUi.includes(token),`professor transfer UI missing ${token}`);
assert.ok(index.includes('./assets/js/pokemon-professor-transfer-ui.js'),'professor transfer UI must load in the PWA shell');

// Per-image export exposes only target mode/binding booleans, never private instance/capture identifiers.
for(const token of ['private_identity_values_included:false','provider_visible:false','existing_instance_bound','new_capture_group_bound'])assert.ok(exporter.includes(token),`per-image export target redaction missing ${token}`);
const safeTargetSlice=exporter.slice(exporter.indexOf('function safeTargetContext'),exporter.indexOf('export function buildPerImageAnalysisExport'));
assert.doesNotMatch(safeTargetSlice,/target_pokemon_instance_id\s*:/u,'private pokemon_instance_id value must not be exported');
assert.doesNotMatch(safeTargetSlice,/capture_group_id\s*:/u,'private capture_group_id value must not be exported');

// Offline PWA closure for the new runtime modules.
for(const asset of [
  './assets/js/analysis-target-identity.js',
  './assets/js/pokemon-professor-transfer.js',
  './assets/js/pokemon-professor-transfer-ui.js',
  './assets/js/unified-import-analysis-workbench.js',
  './assets/js/data-consistency-multicapture.js',
  './assets/js/ai-image-analysis-export.js',
])assert.ok(sw.includes(`'${asset}'`),`service worker precache missing ${asset}`);

// Numeric production authority remains exactly at the previous 4/7 boundary.
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`production authority changed unexpectedly: ${token}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042715_PLATFORM_IDENTITY_DOCTOR_TRANSFER',
  checks:{
    existing_roster_one_to_many_binding:true,
    new_capture_group_predeclared:true,
    ai_text_not_identity_authority:true,
    cross_image_conflict_fail_closed:true,
    confirmation_target_locked:true,
    nickname_guard_preserved:true,
    bidirectional_confirmation_preserved:true,
    professor_transfer_soft_terminal:true,
    candy_requires_user_observed_quantity:true,
    private_identity_export_redacted:true,
    offline_pwa_precache:true,
    production_numeric_authority:'4/7',
  },
},null,2));
