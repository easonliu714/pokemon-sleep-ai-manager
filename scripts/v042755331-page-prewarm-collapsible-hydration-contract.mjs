import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const html=read('index.html');
const css=read('assets/css/app.css');
const app=read('assets/js/app.js');
const bootstrap=read('assets/js/bootstrap.js');
const watchdog=read('assets/js/v0394-startup-watchdog.js');
const hydrator=read('assets/js/page-hydration-authority-v04275533.js');
const candy=read('assets/js/candy-inventory-ui.js');
const knowledge=read('assets/js/shared-knowledge-ui.js');
const catalog=read('assets/js/public-catalog-workbench.js');

assert.match(authority,/app_version:\s*'v0\.4\.27\.55\.3\.3\.1'/);
assert.match(authority,/app_build:\s*'20260905-v042755331-page-prewarm-collapsible-hydration'/);
assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.1-v042755331-page-prewarm-collapsible-hydration'/);
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3'/,'exact .55.3.3 predecessor bridge must remain');

// Visible page-hydration status is part of normal watchdog telemetry, not an error-only path.
assert.ok(html.includes('id="pageLoadStatus"'));
assert.ok(html.includes('aria-live="polite"'));
assert.match(watchdog,/pokemon-sleep:page-hydration-progress/);
assert.match(watchdog,/PAGE_HYDRATION_/);
assert.match(watchdog,/pageLoadStatus/);

// Knowledge layout is structurally fixed before page data materialization.
const pokemonSlotIndex=html.indexOf('id="knowledgePokemonSlot"');
const candySlotIndex=html.indexOf('id="knowledgeCandySlot"');
assert.ok(pokemonSlotIndex>=0&&candySlotIndex>pokemonSlotIndex,'knowledge renderer slots must have stable order');
assert.ok(html.includes('id="candyMasterDetailsV042755331" data-default-collapsed="true"'));
assert.ok(html.includes('id="candyMasterContentV042755331" data-materialized="false"'));
assert.match(css,/#candyMasterDetailsV042755331:not\(\[open\]\)>#candyMasterContentV042755331\{display:none!important\}/);

// Candy master data is prewarmed without DOM, then the large table materializes only on expand.
assert.match(candy,/export function prewarmCandyData/);
assert.match(candy,/export async function materializeCandyMaster/);
assert.match(candy,/if\(ui\.details\.open\)void materializeCandyMaster\(\)/);
assert.match(candy,/dom_materialized:false/);
assert.doesNotMatch(candy,/import '\.\/candy-quantity-screenshot-ui\.js'/,'Candy inventory surface must not eager-load Update Center screenshot analysis');
assert.doesNotMatch(candy,/import '\.\/uc-img-v04132-pot-capacity-bootstrap\.js'/,'Candy inventory surface must not eager-load Update Center image stack');

// Shared knowledge owns only its fixed slot and may not wipe the parent that also owns Candy.
assert.match(knowledge,/export function prewarmSharedKnowledge/);
assert.match(knowledge,/knowledgePokemonSlot/);
assert.match(knowledge,/knowledgeCandySlot/);
assert.doesNotMatch(knowledge,/panel\.innerHTML\s*=/,'shared knowledge must never replace sharedKnowledgePanel contents');

// Startup App Ready does not build hidden page tables or Import History / Backup DOM.
const refresh=app.slice(app.indexOf('async function refresh()'),app.indexOf('function download('));
assert.ok(refresh.length>0,'refresh source slice must exist');
for(const forbidden of ['renderIngredients();','renderItems();',"$('recipeTable')","$('historyTable')",'await listSnapshots()']){
  assert.ok(!refresh.includes(forbidden),`startup refresh must not materialize offscreen work: ${forbidden}`);
}
assert.match(refresh,/offscreen_dom_materialized:false/);

// Items / Ingredients data is prewarmed after App Ready and first navigation only materializes cached projection.
assert.match(catalog,/function prewarmPublicViewData/);
assert.match(catalog,/runtime\.prewarmed/);
assert.match(catalog,/pokemon-sleep:app-ready/);
assert.match(catalog,/dom_materialized:false/);
assert.match(catalog,/pokemon-sleep:page-hydration-progress/);

// Import History is one owned subtree with an explicit hidden contract, not native-details appearance alone.
assert.ok(html.includes('id="importHistoryContentV042755331" data-import-history-content="true" hidden'));
assert.match(css,/#importHistoryDetailsV042745:not\(\[open\]\)>#importHistoryContentV042755331/);
for(const token of [
  'prewarmImportHistory',
  'materializeImportHistory',
  'syncHistoryCollapsed',
  'details.contains(content)',
  'content.contains(wrap)',
  'wrap.contains(table)',
  'MutationObserver',
  'explicit_hidden_contract:true',
]) assert.ok(hydrator.includes(token),`missing Import History ownership token: ${token}`);

// Update Center may not claim ready from root existence alone.
assert.match(hydrator,/candyRoot\.querySelector\('#candyB5Parse'\)/);
assert.match(hydrator,/candyRoot\.querySelector\('#candyB5GateStatus'\)/);
assert.match(hydrator,/analysisRoot\.querySelector\('#analysisConfirmationStatus'\)/);
assert.match(hydrator,/waitForUpdateCenterMounts/);
assert.match(hydrator,/MutationObserver/);
assert.match(hydrator,/root_only_ready_forbidden:true/);

// Page data is prewarmed after App Ready, while heavyweight DOM stays unopened.
assert.match(hydrator,/scheduleIdlePrewarm/);
assert.match(hydrator,/pokemon-sleep:app-ready/);
assert.match(hydrator,/page_data_idle_prewarm:true/);
assert.match(hydrator,/candy_collapsed_lazy_materialization:true/);
assert.match(hydrator,/PokemonSleepPageHydrationAuthorityV042755331/);
assert.match(bootstrap,/PokemonSleepPageHydrationAuthorityV042755331/);
assert.match(bootstrap,/pokemon-sleep:page-hydration-progress/);
assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V042755331_PAGE_PREWARM_COLLAPSIBLE_HYDRATION',
  status:'PASS',
  version:'v0.4.27.55.3.3.1',
  page_watchdog_progress:true,
  offscreen_startup_dom:false,
  item_ingredient_data_prewarm:true,
  knowledge_fixed_slot_order:true,
  candy_master_default_collapsed:true,
  candy_master_lazy_dom_materialization:true,
  update_center_root_only_ready:false,
  import_history_explicit_owned_collapse:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));
