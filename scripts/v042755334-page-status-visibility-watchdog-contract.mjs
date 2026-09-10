import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const bootstrap=read('assets/js/bootstrap.js');
const watchdog=read('assets/js/v0394-startup-watchdog.js');

const appVersion=authority.match(/app_version:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.55.3.3.6'){
  assert.match(authority,/app_build:\s*'20260910-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.6-v042755336-g121d-evolution-recommendation-ui'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.5'/,'exact .55.3.3.5 predecessor bridge must remain');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
}else if(appVersion==='v0.4.27.55.3.3.5'){
  assert.match(authority,/app_build:\s*'20260908-v042755335-g121a-authority-closure'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.5-v042755335-g121a-authority-closure'/);
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3.4');
  assert.match(authority,/app_build:\s*'20260908-v042755334-page-status-visibility-watchdog'/);
  assert.match(authority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.4-v042755334-page-status-visibility-watchdog'/);
}
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.3'/,'exact .55.3.3.3 predecessor bridge must remain');

assert.match(bootstrap,/const hydration=await .*hydrateView\?\.\(page\)/,'generic module loading must inspect page hydration ownership');
assert.match(bootstrap,/if\(!hydration\?\.owned\)/,'pages without a dedicated hydration owner must receive a terminal state');
assert.match(bootstrap,/pageProgress\(page,'ready',/,'generic page module loading must emit READY');
assert.match(bootstrap,/generic_terminal:true/,'terminal page status must be identifiable in diagnostics');
assert.match(bootstrap,/hydration_owned:Boolean\(hydration\?\.owned\)/);

assert.match(watchdog,/const activeView=\(\)=>document\.querySelector\('\.view\.active'\)\?\.id\|\|''/);
assert.match(watchdog,/page!==visiblePage/,'offscreen page progress must not replace the current page badge');
assert.match(watchdog,/offscreen:true/,'offscreen progress must remain traceable without becoming visible status');
assert.match(watchdog,/page_hydration_badge_stale_cleared/,'navigation must clear stale badge ownership');
assert.match(watchdog,/badge\.dataset\.page!==targetPage/);

assert.match(watchdog,/document\.visibilityState!=='visible'/,'background documents must not trigger heartbeat stall warnings');
assert.match(watchdog,/main_thread_watchdog_visibility_reset/,'visibility transitions must reset heartbeat authority');
assert.match(watchdog,/foreground-resume/);
assert.match(watchdog,/background-pause/);
assert.match(watchdog,/visibilityGraceUntil=now\+1200/,'foreground resume must have a bounded watchdog grace period');
assert.match(watchdog,/heartbeatAt=now;return/,'hidden/grace interval must advance the heartbeat baseline instead of accumulating background time');
assert.match(watchdog,/main_thread_block_detected/,'real visible-page stalls must remain detectable');
assert.match(watchdog,/main_thread_block_recovered/,'real stall recovery must remain observable');

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V042755334_PAGE_STATUS_VISIBILITY_WATCHDOG',
  status:'PASS',
  version:appVersion,
  generic_page_terminal_ready:true,
  offscreen_status_ignored:true,
  stale_badge_cleared_on_navigation:true,
  background_timer_gap_ignored:true,
  foreground_grace_ms:1200,
  real_stall_detection_retained:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));

if(appVersion==='v0.4.27.55.3.3.5'||appVersion==='v0.4.27.55.3.3.6')await import('./g121a-authority-closure-contract.mjs');
