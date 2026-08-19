import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [version,runtime,overlay,serviceWorker,groupAuthority,production,exporter]=await Promise.all([
  text('assets/js/version-authority.js'),
  text('assets/js/runtime-version.js'),
  text('assets/js/analysis-manual-draft-overlay-v042719.js'),
  text('service-worker.js'),
  text('assets/js/review-group-isolation-v042717.js'),
  text('assets/js/production-authority-registry.js'),
  text('assets/js/ai-image-analysis-export.js'),
]);

assert.match(version,/app_version:\s*'v0\.4\.27\.19'/u);
assert.match(version,/app_build:\s*'20260819-v042719-manual-draft-querysafe-offline'/u);
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.19-v042719-manual-draft-querysafe-offline'/u);
assert.ok(version.includes("// app_version: 'v0.4.27.18'"),'v0.4.27.18 lineage missing');
assert.ok(runtime.includes("import './analysis-manual-draft-overlay-v042719.js'"),'manual draft overlay must load with first runtime probe');

for(const token of [
  "MANUAL_DRAFT_OVERLAY_VERSION='v0.4.27.19-group-local-manual-draft-2026-08-19-a'",
  "document.addEventListener('input'",
  "document.addEventListener('change'",
  "pokemon-sleep:analysis-confirmation-group-selected",
  "pokemon-sleep:analysis-confirmation-merged",
  "pokemon-sleep:analysis-confirmation-navigation-changed",
  'v042719_manual_form_restored',
  'group_id:groupId',
])assert.ok(overlay.includes(token),`manual-draft token missing: ${token}`);

assert.ok(serviceWorker.includes("'./assets/js/analysis-manual-draft-overlay-v042719.js'"),'manual draft overlay must be first-offline precached');
assert.ok(serviceWorker.includes('caches.match(request,{ignoreSearch:true})'),'offline module lookup must ignore build query strings');
assert.ok(serviceWorker.includes("const isNavigation=event.request.mode==='navigate'||event.request.destination==='document'"),'navigation-only shell policy missing');
assert.ok(serviceWorker.includes("if(isNavigation)return (await caches.match('./index.html'))||offlineAssetFailure()"),'HTML shell must be navigation-only fallback');
assert.ok(serviceWorker.includes("return offlineAssetFailure();"),'non-navigation cache misses must fail as assets, not HTML');
assert.ok(!serviceWorker.includes("hit||caches.match('./index.html')"),'legacy universal HTML fallback must be removed');

for(const token of ['replaceGroupDraft','navigateReviewGroupFrom','v042718_stale_or_contaminated_core_draft_rejected','preparePerImageTargetContexts'])assert.ok(groupAuthority.includes(token),`v0.4.27.18 group/per-image contract regressed: ${token}`);
assert.ok(exporter.includes("AI_IMAGE_ANALYSIS_EXPORT_SCHEMA='pokemon-sleep-ai-image-analysis-export/1.2'"),'export privacy schema regressed');
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`Production Numeric Authority changed unexpectedly: ${token}`);

console.log(JSON.stringify({status:'PASS',gate:'V042719_MANUAL_DRAFT_QUERYSAFE_OFFLINE',checks:{manual_dirty_control_overlay:true,group_local_restore:true,query_insensitive_module_cache:true,navigation_only_html_fallback:true,v042718_group_isolation_preserved:true,per_image_assignment_preserved:true,export_schema:'1.2',production_numeric_authority:'4/7'}},null,2));
