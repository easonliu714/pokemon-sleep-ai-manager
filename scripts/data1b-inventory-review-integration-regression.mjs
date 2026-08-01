import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const bootstrap=read('assets/js/bootstrap.js');
const sw=read('service-worker.js');
const entry=read('assets/js/identity-import-wizard-entry.js');
const ui=read('assets/js/data1-inventory-review-ui.js');

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.40'/);
assert.match(bootstrap,/20260801-data1b-inventory-review/);
assert.match(bootstrap,/data1-inventory-review\.js/);
assert.match(bootstrap,/data1-inventory-review-ui\.js/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.40-data1b-inventory-review/);
assert.match(sw,/data1-inventory-review\.js/);
assert.match(sw,/data1-inventory-review-ui\.js/);
assert.match(entry,/createInventoryReviewWorkbench/);
assert.match(entry,/data1ReviewWorkbenchSlot/);
assert.match(ui,/inventory_review_batch_applied/);
assert.match(ui,/reviewed_manifest_exported/);
assert.match(ui,/review_package_exported/);
assert.match(ui,/匯出已覆核 Manifest/);
assert.match(ui,/匯出 Review Package/);

console.log(JSON.stringify({ok:true,version:'v0.3.40',build:'20260801-data1b-inventory-review'}));
