import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const [transfer,ui,candyUi,version,sw,index]=await Promise.all([
  text('assets/js/pokemon-professor-transfer.js'),
  text('assets/js/pokemon-professor-transfer-ui.js'),
  text('assets/js/candy-inventory-ui.js'),
  text('assets/js/version-authority.js'),
  text('service-worker.js'),
  text('index.html'),
]);

assert.match(transfer,/PROFESSOR_TRANSFER_CANDY_AUTHORITY='USER_DIRECT_OBSERVATION_ONLY'/u);
assert.match(transfer,/schema:'pokemon-sleep-professor-transfer\/1\.1'/u);
assert.match(transfer,/inventory_mutation:candyInventoryApplied\?'OBSERVED_DELTA_INCREMENT':'NO_MUTATION'/u);
assert.match(transfer,/if\(candyQuantity!==null\)/u);
assert.match(transfer,/quantity=candy_inventory\.quantity\+excluded\.quantity/u);
assert.match(transfer,/candyQuantity===null\?'NOT_OBSERVED':PROFESSOR_TRANSFER_CANDY_AUTHORITY/u);
assert.doesNotMatch(transfer,/observedCandyQuantity\s*\?\?\s*[1-9]/u,'must not infer a fixed professor candy reward');
assert.doesNotMatch(transfer,/candyQuantity\s*=\s*[1-9][0-9]*\s*;/u,'must not hard-code a professor candy reward');
assert.match(ui,/留空＝只完成送博士狀態，不自行猜糖果數量/u);
assert.match(candyUi,/玩家數量可由 JSON 更新中心匯入，或由「送給博士」時使用者輸入的遊戲實際觀測糖果數量增量寫入/u);
assert.match(candyUi,/USER_DIRECT_OBSERVATION_ONLY/u);
assert.ok(index.includes('./assets/js/pokemon-professor-transfer-ui.js'));
assert.ok(index.includes('./assets/js/candy-inventory-ui.js'));
assert.ok(sw.includes("'./assets/js/pokemon-professor-transfer.js'"));
assert.ok(sw.includes("'./assets/js/pokemon-professor-transfer-ui.js'"));
assert.ok(sw.includes("'./assets/js/candy-inventory-ui.js'"));

// P0-B1 semantics stay frozen after v0.4.27.46. Historical implementation
// commits may still replay under .45/.46, while successor releases must preserve
// the exact P0-B1 lineage without claiming ownership.
const currentVersion=version.match(/app_version:\s*'([^']+)'/u)?.[1]||'';
const currentBuild=version.match(/app_build:\s*'([^']+)'/u)?.[1]||'';
const currentCache=version.match(/cache_name:\s*'([^']+)'/u)?.[1]||'';
const assertP0B1Lineage=successorLabel=>{
  assert.ok(version.includes("// app_version: 'v0.4.27.46'"),`${successorLabel} must retain exact P0-B1 v0.4.27.46 lineage marker`);
  assert.ok(version.includes("// app_build: '20260828-v042746-p0b1-professor-candy-observed-authority'"),`${successorLabel} must retain exact P0-B1 build lineage marker`);
  assert.ok(version.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.46-v042746-p0b1-professor-candy-observed-authority'"),`${successorLabel} must retain exact P0-B1 cache lineage marker`);
};

if(currentVersion==='v0.4.27.45'||currentVersion==='v0.4.27.46'){
  assert.match(version,/app_version:\s*'v0\.4\.27\.(?:45|46)'/u);
}else if(currentVersion==='v0.4.27.55.3.3.1'){
  assert.equal(currentBuild,'20260905-v042755331-page-prewarm-collapsible-hydration');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration');
  assertP0B1Lineage('page-prewarm successor');
}else if(currentVersion==='v0.4.27.55.3.3.2'){
  assert.equal(currentBuild,'20260906-v042755332-ai-key-update-status-knowledge-host');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.2-v042755332-ai-key-update-status-knowledge-host');
  assertP0B1Lineage('Gemini/Update/Knowledge successor');
}else if(currentVersion==='v0.4.27.55.3.3.3'){
  assert.equal(currentBuild,'20260907-v042755333-candy-master-progressive-render');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.3-v042755333-candy-master-progressive-render');
  assertP0B1Lineage('Candy Master progressive-render successor');
}else if(currentVersion==='v0.4.27.55.3.3.4'){
  assert.equal(currentBuild,'20260908-v042755334-page-status-visibility-watchdog');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.4-v042755334-page-status-visibility-watchdog');
  assertP0B1Lineage('Page-status/watchdog successor');
}else if(currentVersion==='v0.4.27.55.3.3.5'){
  assert.equal(currentBuild,'20260908-v042755335-g121a-authority-closure');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.5-v042755335-g121a-authority-closure');
  assertP0B1Lineage('G12.1A successor');
}else if(currentVersion==='v0.4.27.55.3.3.6'){
  assert.equal(currentBuild,'20260910-v042755336-g121d-evolution-recommendation-ui');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.6-v042755336-g121d-evolution-recommendation-ui');
  assertP0B1Lineage('G12.1D/E successor');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3.5'"),'G12.1D/E successor must retain exact .55.3.3.5 predecessor marker');
  assert.ok(version.includes("// app_build: '20260908-v042755335-g121a-authority-closure'"),'G12.1D/E successor must retain exact .55.3.3.5 predecessor build marker');
  assert.ok(version.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.5-v042755335-g121a-authority-closure'"),'G12.1D/E successor must retain exact .55.3.3.5 predecessor cache marker');
}else if(currentVersion==='v0.4.27.55.3.3.7'){
  assert.equal(currentBuild,'20260911-v042755337-g121d-real-device-closure');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.7-v042755337-g121d-real-device-closure');
  assertP0B1Lineage('G12.1D/E real-device closure successor');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3.6'"),'real-device closure successor must retain exact .55.3.3.6 predecessor marker');
  assert.ok(version.includes("// app_build: '20260910-v042755336-g121d-evolution-recommendation-ui'"),'real-device closure successor must retain exact .55.3.3.6 predecessor build marker');
  assert.ok(version.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.6-v042755336-g121d-evolution-recommendation-ui'"),'real-device closure successor must retain exact .55.3.3.6 predecessor cache marker');
}else{
  assert.fail(`P0-B1 professor-candy successor release not governed: ${currentVersion}`);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042746_P0B1_PROFESSOR_CANDY_OBSERVED_DELTA',
  current_version:currentVersion,
  authority:'USER_DIRECT_OBSERVATION_ONLY',
  automatic_professor_reward_inference:false,
  soft_delete:true,
  observed_delta_increment:true,
  offline_assets_present:true,
},null,2));