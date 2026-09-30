import fs from 'node:fs';
import assert from 'node:assert/strict';

const bootstrap=fs.readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/personal-recipe-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(html,/button data-view="recipes">食譜<\/button>/,'top navigation must expose Recipe page');
assert.match(html,/<section id="recipes" class="view">/,'Recipe page shell must exist');
assert.match(bootstrap,/recipes:Object\.freeze\(\['personal-recipe-ui\.js'\]\)/,'Recipe page hydration must load personal recipe UI');
assert.ok(sw.includes("'./assets/js/personal-recipe-ui.js'"),'Personal recipe UI must be available in PWA offline precache');
assert.match(ui,/id="g51PersonalRecipeRoot"/,'G5.1 personal recipe root must remain explicit');
assert.match(ui,/>我的食譜</,'G5.1 UI must visibly identify the player-private recipe area');
assert.match(ui,/id="g51NewRecipeBtn">新增個人食譜</,'G5.1 UI must expose the create action');
assert.match(ui,/section\.insertBefore\(root,section\.querySelector\('\.table-wrap'\)\)/,'Personal recipe panel must render above the public recipe table');
assert.match(ui,/公版料理主檔保持唯讀/,'UI must preserve the Public Master read-only boundary');

console.log(JSON.stringify({
  gate:'G51_PERSONAL_RECIPE_UI_WIRING',
  status:'PASS',
  recipe_page_loader:true,
  pwa_precache:true,
  player_private_panel_above_public_table:true,
  public_master_read_only:true,
},null,2));
