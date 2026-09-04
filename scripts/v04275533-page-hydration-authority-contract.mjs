import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const sw=read('service-worker.js');
const app=read('assets/js/app.js');
const scheduler=read('assets/js/v0395-dom-render-scheduler.js');
const bootstrap=read('assets/js/bootstrap.js');
const catalog=read('assets/js/public-catalog-workbench.js');
const knowledge=read('assets/js/shared-knowledge-ui.js');
const candy=read('assets/js/candy-inventory-ui.js');
const candyScreenshot=read('assets/js/candy-quantity-screenshot-ui.js');
const screenshot=read('assets/js/unified-screenshot-update-center.js');
const identity=read('assets/js/identity-import-wizard-entry.js');
const analysis=read('assets/js/analysis-confirmation-workbench.js');
const history=read('assets/js/review-reference-history-ux-v042745.js');
const css=read('assets/css/app.css');
const html=read('index.html');

const expected={
  version:'v0.4.27.55.3.3',
  build:'20260904-v04275533-page-hydration-authority',
  cache:'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority',
};
assert.match(authority,/app_version:\s*'v0\.4\.27\.55\.3\.3'/);
assert.match(authority,/app_build:\s*'20260904-v04275533-page-hydration-authority'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3-v04275533-page-hydration-authority'/);
assert.match(sw,/importScripts\('\.\/assets\/js\/version-authority\.js'\)/);
assert.match(sw,/const \{app_version:APP_VERSION,app_build:APP_BUILD,cache_name:CACHE\}=self\.PokemonSleepVersionAuthority/);

// Startup owns Dashboard only. Offscreen page SQL/DOM must not be materialized by refresh().
const refresh=app.slice(app.indexOf('async function refresh()'),app.indexOf('\nfunction download(',app.indexOf('async function refresh()')));
assert.match(refresh,/dashboard_only_startup:true/);
assert.match(refresh,/cross_page_render:false/);
assert.doesNotMatch(refresh,/renderIngredients\(\)/);
assert.doesNotMatch(refresh,/renderItems\(\)/);
assert.doesNotMatch(refresh,/renderTable\(\s*\$\('recipeTable'/);
assert.doesNotMatch(refresh,/listSnapshots\(/);
assert.match(app,/pokemon-sleep:view-activated/);
assert.match(app,/function refreshPokemonPage\(/);
assert.match(app,/function renderImportHistory\(/);

// v0395 innerHTML monkey patch and duplicate App Ready authority are retired.
assert.doesNotMatch(scheduler,/Object\.defineProperty\(element,'innerHTML'/);
assert.doesNotMatch(scheduler,/pending\.set\(/);
assert.doesNotMatch(scheduler,/pokemon-sleep:data-changed/);
assert.doesNotMatch(scheduler,/new CustomEvent\('pokemon-sleep:app-ready'/);
assert.match(scheduler,/DOM_RENDER_SCHEDULER_RETIRED/);
assert.match(scheduler,/single_owner_page_hydration:true/);

// Navigation is not mutation. Public catalog has one navigation-owned renderer.
assert.match(catalog,/pokemon-sleep:view-activated/);
assert.doesNotMatch(catalog,/button\.addEventListener\('click',\(\)=>requestRender/);
assert.match(catalog,/single_owner_page_hydration:true/);

// Fixed Layout slots exist before any page-specific module.
for(const id of [
  'itemsCandySlot','sharedKnowledgePanel','knowledgePokemonSlot','knowledgeCandySlot',
  'updateCenterCandyStaticShell','updateCenterCandyMount','updateCenterAnalysisStaticShell',
  'updateCenterScreenshotMount','updateCenterAnalysisMount','updateCenterOcrStaticShell',
  'updateCenterIdentityMount','ocrThumbnailOverlaySlot','importHistoryDetailsV042745',
  'importHistoryWrap','historyTable'
]) assert.ok(html.includes(`id="${id}"`),`missing stable page slot ${id}`);

// Knowledge renderers own siblings, never the shared parent.
assert.match(knowledge,/knowledgePokemonSlot/);
assert.doesNotMatch(knowledge,/sharedKnowledgePanel['"]?\)?\.innerHTML/);
assert.doesNotMatch(knowledge,/panel\.innerHTML/);
assert.match(candy,/knowledgeCandySlot/);
assert.match(candy,/itemsCandySlot/);
assert.doesNotMatch(candy,/import '\.\/candy-quantity-screenshot-ui\.js'/);
assert.doesNotMatch(candy,/import '\.\/candy-public-master-admission-ui\.js'/);
assert.doesNotMatch(candy,/import '\.\/uc-img-v04132-pot-capacity-bootstrap\.js'/);

// Update Center modules mount into their stable slots and readiness means real roots exist.
assert.match(candyScreenshot,/updateCenterCandyMount/);
assert.match(candyScreenshot,/replaceChildren\(section\)/);
assert.match(screenshot,/updateCenterScreenshotMount/);
assert.match(identity,/updateCenterIdentityMount/);
assert.match(analysis,/updateCenterAnalysisMount/);
for(const file of [
  'candy-quantity-screenshot-ui.js','candy-public-master-admission-ui.js',
  'analysis-confirmation-workbench.js','identity-import-wizard-entry.js',
  'data1d1-ocr-region-direct-minimal-hotfix.js','two-stage-forced-ocr-entry.js'
]) assert.ok(bootstrap.includes(`'${file}'`),`Update Center page group missing ${file}`);
assert.match(bootstrap,/update_center_page_hydration_completed/);
assert.match(bootstrap,/import_history_dom_ownership/);
assert.match(bootstrap,/static_shell_is_mount_authority:true/);
assert.match(bootstrap,/hydration_state_requires_real_mount:true/);

// The heavy Update Center modules moved off initial HTML execution.
for(const src of [
  './assets/js/data1d1-ocr-region-direct-minimal-hotfix.js',
  './assets/js/analysis-confirmation-workbench.js',
  './assets/js/two-stage-forced-ocr-entry.js',
  './assets/js/full75-recovery-workbench.js',
]) assert.ok(!html.includes(`<script type="module" src="${src}"></script>`),`eager Update Center module remains: ${src}`);

// Import History is one DOM tree. Native details collapse is reinforced, not faked.
assert.match(history,/details\.contains\(wrap\)/);
assert.match(history,/wrap\.contains\(table\)/);
assert.match(history,/querySelectorAll\('#importHistoryDetailsV042745'\)\.length===1/);
assert.match(history,/ownershipInitialized/);
assert.match(css,/#importHistoryDetailsV042745:not\(\[open\]\)>:not\(summary\)\{display:none!important\}/);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V04275533_PAGE_HYDRATION_AUTHORITY',
  status:'PASS',
  ...expected,
  dashboard_only_startup:true,
  hidden_dom_buffer:false,
  navigation_is_not_mutation:true,
  stable_page_slots:true,
  knowledge_single_owner:true,
  update_center_real_mount_gate:true,
  import_history_dom_ownership:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));
