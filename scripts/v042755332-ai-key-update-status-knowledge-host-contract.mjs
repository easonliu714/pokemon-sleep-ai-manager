import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const bootstrap=read('assets/js/bootstrap.js');
const hydrator=read('assets/js/page-hydration-authority-v04275533.js');
const settings=read('assets/js/ai-project-pool-settings.js');
const vault=read('assets/js/ai-key-vault.js');
const analysis=read('assets/js/analysis-confirmation-workbench.js');
const coverage=read('assets/js/v03993-public-knowledge-coverage-ui.js');
const candy=read('assets/js/candy-quantity-screenshot-ui.js');
const appVersion=authority.match(/app_version:\s*'([^']+)'/)?.[1]||'';

if(appVersion==='v0.4.27.55.3.3.6'){
  assert.match(authority,/app_build:\s*'20260910-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.6-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.5'){
  assert.match(authority,/app_build:\s*'20260908-v042755335-g121a-authority-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.5-v042755335-g121a-authority-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.4'){
  assert.match(authority,/app_build:\s*'20260908-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.4-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.3'){
  assert.match(authority,/app_build:\s*'20260907-v042755333-candy-master-progressive-render'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.3-v042755333-candy-master-progressive-render'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3.2');
  assert.match(authority,/app_build:\s*'20260906-v042755332-ai-key-update-status-knowledge-host'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.2-v042755332-ai-key-update-status-knowledge-host'/);
}
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.1'/,'exact .55.3.3.1 predecessor bridge must remain');

assert.match(bootstrap,/updates:Object\.freeze\(\[\s*'ai-project-pool-settings\.js'/,'Update Center must restore the Gemini pool before internal AI use');
assert.match(bootstrap,/guide:Object\.freeze\(\['ai-project-pool-settings\.js'\]\)/,'Guide navigation must load the Gemini settings UI');
assert.match(bootstrap,/const moduleLoads=new Map\(\)/);
assert.match(bootstrap,/if\(moduleLoads\.has\(file\)\)return moduleLoads\.get\(file\)/);
assert.match(bootstrap,/canonical_esm_identity:true/);

assert.match(settings,/export function ensureAiProjectPoolSettings\(\)/);
assert.match(settings,/if\(settingsReadyPromise\)return settingsReadyPromise/,'Gemini settings restore must be single-flight');
assert.match(settings,/hasEncryptedProjectPool\(\)/);
assert.match(settings,/loadEncryptedProjectPool\(\)/);
assert.match(settings,/saveEncryptedProjectPool\(/);
assert.match(settings,/publishPool\(restored\)/,'restored encrypted pool must become runtime authority');
assert.match(settings,/(?:id=["']aiProjectPoolSettings["']|\.id=["']aiProjectPoolSettings["'])/,'Gemini settings panel must retain the canonical aiProjectPoolSettings DOM identity');
assert.match(settings,/id="aiApiKeysInput"/);
assert.match(settings,/在此裝置加密保存 API Key/);
assert.match(settings,/api_key_included:false/,'settings readiness diagnostics must never expose API keys');
assert.match(vault,/AES-GCM/);
assert.match(vault,/pokemon-sleep-ai-key-vault/);
assert.match(vault,/project-pool-v1/);

assert.match(analysis,/root\.dataset\.analysisConfirmationReady='true'/,'analysis module must expose a stable readiness sentinel even without an active draft');
assert.match(hydrator,/analysis\?\.dataset\?\.analysisConfirmationReady==='true'/);
assert.match(hydrator,/analysisRoot\.dataset\.analysisConfirmationReady==='true'/);
assert.doesNotMatch(hydrator,/analysisRoot\.querySelector\('#analysisConfirmationStatus'\)/,'idle analysis placeholder must not be misclassified as an incomplete module');

assert.match(hydrator,/ensureAiProjectPoolSettings\?\.\(\)/,'Update Center must await Gemini settings restoration');
assert.match(hydrator,/missingPrimary\.push\('糖果截圖庫存覆核'\)/);
assert.match(hydrator,/missingPrimary\.push\('AI／OCR 結果確認'\)/);
assert.match(hydrator,/missingPrimary\.push\('Gemini Key 設定'\)/);
assert.match(hydrator,/更新中心未完成：/,'failure status must identify the missing tools');
assert.match(hydrator,/Gemini Key 已恢復/);
assert.match(hydrator,/Gemini Key 尚未設定（仍可使用外部 AI Prompt）/);
assert.match(hydrator,/ocr_optional:true/);
assert.match(hydrator,/api_key_included:false/);
assert.match(candy,/globalThis\.PokemonSleepAiProjectPool/,'internal Candy Gemini must keep using the restored project-pool authority');

assert.match(coverage,/const slot=document\.getElementById\('knowledgePokemonSlot'\)\|\|panel/);
assert.match(coverage,/firstHeading&&firstHeading\.parentNode===slot/);
assert.match(coverage,/slot\.insertBefore\(block,firstHeading\)/);
assert.doesNotMatch(coverage,/panel\.insertBefore\(block,firstHeading\)/,'Knowledge coverage must not insert before a descendant owned by another slot');

assert.match(hydrator,/let lastHistoryOwnershipTraceSignature=''/);
assert.match(hydrator,/ownershipSignature!==lastHistoryOwnershipTraceSignature/);
assert.match(hydrator,/import_history_trace_deduped:true/);
assert.match(hydrator,/historyObserver\.disconnect\(\)/,'Import History ownership repair must remain fail-closed');
assert.match(hydrator,/canonicalizeImportHistoryDom\(\)/);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V042755332_AI_KEY_UPDATE_STATUS_KNOWLEDGE_HOST',
  status:'PASS',
  version:appVersion,
  gemini_settings_guide_page_aware:true,
  gemini_key_restore_before_update_ready:true,
  key_count_zero_is_not_module_failure:true,
  update_center_missing_tool_names_visible:true,
  analysis_idle_ready_sentinel:true,
  knowledge_slot_insert_before_safe:true,
  import_history_trace_deduped:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));

if(['v0.4.27.55.3.3.3','v0.4.27.55.3.3.4','v0.4.27.55.3.3.5','v0.4.27.55.3.3.6'].includes(appVersion))await import('./v042755333-candy-master-progressive-render-contract.mjs');
