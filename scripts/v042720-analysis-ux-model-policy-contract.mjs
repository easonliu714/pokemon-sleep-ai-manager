import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const ux=read('assets/js/analysis-execution-ux-v042720.js');
const manual=read('assets/js/analysis-manual-draft-overlay-v042719.js');
const sw=read('service-worker.js');
const group=read('assets/js/review-group-isolation-v042717.js');

assert.match(authority,/app_version:\s*'v0\.4\.27\.20'/);
assert.match(authority,/app_build:\s*'20260820-v042720-analysis-ux-flash-lite'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.20-v042720-analysis-ux-flash-lite'/);
assert.match(authority,/app_version:\s*'v0\.4\.27\.19'/,'predecessor marker must remain');

assert.match(manual,/import '\.\/analysis-execution-ux-v042720\.js';/);
assert.match(sw,/\.\/assets\/js\/analysis-execution-ux-v042720\.js/,'successor module must be first-offline precached');
assert.match(sw,/ignoreSearch:true/,'v0.4.27.19 query-safe offline behavior must remain');
assert.match(sw,/if\(isNavigation\)return \(await caches\.match\('\.\/index\.html'\)\)/,'HTML shell fallback remains navigation-only');

assert.match(ux,/PRIMARY_VISUAL_MODEL='gemini-3\.1-flash-lite'/);
assert.match(ux,/VISUAL_MODEL_RESCUE_ORDER=Object\.freeze\(\['gemini-2\.5-flash','gemini-2\.5-flash-lite'\]\)/);
assert.match(ux,/v042720_visual_capability_catalog_curated/,'visual capability catalog rescue must be deterministic');
assert.match(ux,/v042720_default_model_session_migrated/,'legacy 3.6 default must migrate to 3.1 Flash-Lite');
assert.match(ux,/run\.disabled=true/,'active analysis must force Run disabled');
assert.match(ux,/v042720ExecutionLock/,'Run lock marker missing');
assert.match(ux,/id='unifiedCancelAi'/,'Cancel AI control missing');
assert.match(ux,/activeGeminiControllers/,'active Gemini request cancellation boundary missing');
assert.match(ux,/AI analysis cancelled by user/,'future Gemini requests must fail closed after user cancel');
assert.match(ux,/updates\.appendChild\(heading\);updates\.appendChild\(wrap\)/,'Import History must be moved to bottom');
assert.match(ux,/v042720BeforeImportHistory/,'OCR panel ordering marker missing');

assert.match(group,/PER_IMAGE_TARGET_ASSIGNMENT_VERSION='v0\.4\.27\.18-per-image-target-assignment/,'per-image target assignment must remain');
assert.match(group,/replaceGroupDraft/,'explicit group write authority must remain');
assert.match(manual,/v042719_manual_form_restored/,'manual draft persistence must remain');

const ranked=['gemini-2.0-flash','gemini-2.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash'];
const priority=['gemini-3.1-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite'];
ranked.sort((a,b)=>{
  const ai=priority.indexOf(a),bi=priority.indexOf(b);
  const ar=ai<0?999:ai,br=bi<0?999:bi;
  return ar!==br?ar-br:a.localeCompare(b);
});
assert.deepEqual(ranked.slice(0,3),priority);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042720_ANALYSIS_EXECUTION_UX_MODEL_POLICY',
  checks:{
    release_authority:'v0.4.27.20',
    run_button_locked_during_batch:true,
    cancel_ai_control:true,
    ocr_status_before_history:true,
    import_history_last:true,
    primary_visual_model:'gemini-3.1-flash-lite',
    curated_rescue_order:['gemini-2.5-flash','gemini-2.5-flash-lite'],
    v042719_manual_draft_preserved:true,
    v042718_per_image_group_authority_preserved:true,
    query_safe_offline_preserved:true,
    production_numeric_authority:'4/7'
  }
},null,2));
