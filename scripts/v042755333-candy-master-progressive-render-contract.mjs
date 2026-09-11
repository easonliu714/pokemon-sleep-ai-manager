import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const candy=read('assets/js/candy-inventory-ui.js');
const appVersion=authority.match(/app_version:\s*'([^']+)'/)?.[1]||'';

if(appVersion==='v0.4.27.55.3.3.7'){
  assert.match(authority,/app_build:\s*'20260911-v042755337-g121d-real-device-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.7-v042755337-g121d-real-device-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.6'/,'exact .55.3.3.6 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.6'){
  assert.match(authority,/app_build:\s*'20260910-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.6-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.5'){
  assert.match(authority,/app_build:\s*'20260908-v042755335-g121a-authority-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.5-v042755335-g121a-authority-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.4'){
  assert.match(authority,/app_build:\s*'20260908-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.4-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3.3');
  assert.match(authority,/app_build:\s*'20260907-v042755333-candy-master-progressive-render'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.3-v042755333-candy-master-progressive-render'/);
}
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.2'/,'exact .55.3.3.2 predecessor bridge must remain');

assert.match(candy,/const CANDY_MASTER_BATCH_SIZE=24/,'Candy Master must use bounded row batches');
assert.match(candy,/candyMasterProgressOverlayV042755333/,'visible Candy Master progress overlay must exist');
assert.match(candy,/role','dialog'/);
assert.match(candy,/aria-modal','true'/);
assert.match(candy,/糖果資料載入中/);
assert.match(candy,/candyMasterProgressBarV042755333/);
assert.match(candy,/取消載入/);
assert.match(candy,/yieldToPaint/,'progressive renderer must yield to browser paint/input');
assert.match(candy,/requestAnimationFrame/,'progressive renderer must permit a real paint between chunks');
assert.match(candy,/for\(let start=0;start<total;start\+=CANDY_MASTER_BATCH_SIZE\)/,'rows must be materialized in bounded chunks');
assert.match(candy,/tbody\.insertAdjacentHTML\('beforeend',html\)/,'each chunk must append incrementally instead of replacing the full table');
assert.match(candy,/updateCandyMasterProgress\(end,total/,'visible progress must advance after each row chunk');
assert.match(candy,/pageProgress\('loading',`資料百科：糖果 Master \$\{end\}\/\$\{total\}/,'page hydration progress must expose completed/total');
assert.match(candy,/tableEl\.dataset\.candyRevision===String\(cache\.revision\)/,'same cache revision must reuse materialized Candy DOM');
assert.match(candy,/candy_master_materialization_completed/,'completion timing must be observable');
assert.match(candy,/cancelCandyMasterMaterialization\('details-collapsed'\)/,'collapsing must cancel an in-flight materialization');
assert.match(candy,/if\(content\)content\.dataset\.materialized='false'/,'data invalidation must mark the Candy table stale');
assert.doesNotMatch(
  candy.slice(candy.indexOf('export async function materializeCandyMaster'),candy.indexOf('function renderKnowledge')),
  /table\(document\.getElementById\('candyMasterTable'\),cache\.masterRows/,
  'Candy Master must not regress to the synchronous whole-table helper'
);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V042755333_CANDY_MASTER_PROGRESSIVE_RENDER',
  status:'PASS',
  version:appVersion,
  batch_size:24,
  visible_progress:true,
  cancellable:true,
  main_thread_yield:true,
  same_revision_reuse:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));

if(['v0.4.27.55.3.3.4','v0.4.27.55.3.3.5','v0.4.27.55.3.3.6','v0.4.27.55.3.3.7'].includes(appVersion))await import('./v042755334-page-status-visibility-watchdog-contract.mjs');