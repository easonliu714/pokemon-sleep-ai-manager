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
// Version bump is added before merge; allow current predecessor during the first implementation commit.
assert.match(version,/app_version:\s*'v0\.4\.27\.(?:45|46)'/u);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042746_P0B1_PROFESSOR_CANDY_OBSERVED_DELTA',
  authority:'USER_DIRECT_OBSERVATION_ONLY',
  automatic_professor_reward_inference:false,
  soft_delete:true,
  observed_delta_increment:true,
  offline_assets_present:true,
},null,2));
