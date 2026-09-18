import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../assets/js/update-center-task-navigation-v0427553311.js',import.meta.url),'utf8');

for(const label of ['更新營地活動','更新食材庫存','更新料理等級','更新糖果庫存','更新寶可夢詳情']){
  assert.ok(html.includes(label),`missing semantic task card: ${label}`);
}
for(const route of ['shared-screenshot:weekly','shared-screenshot:ingredients','shared-screenshot:recipes','candy-screenshot','pokemon-ocr-ai-import']){
  assert.ok(html.includes(`data-update-task-route="${route}"`),`missing governed route: ${route}`);
}
assert.ok(nav.includes("'#ucImgA'"),'weekly/ingredient/recipe cards must converge on the shared screenshot intake');
assert.ok(nav.includes("'#candyQuantityScreenshotB5'"),'candy task must target the candy screenshot analyzer');
assert.ok(nav.includes("'#identityImportWizardRoot'"),'pokemon detail task must target Advanced OCR / AI import wizard');
assert.ok(nav.includes('scrollIntoView'),'task cards must perform mobile-friendly in-page navigation');
console.log('V0427553311_UPDATE_CENTER_TASK_NAVIGATION_GATE=PASS');
