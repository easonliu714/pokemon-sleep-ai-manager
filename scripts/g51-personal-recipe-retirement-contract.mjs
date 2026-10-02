import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const version=read('assets/js/version-authority.js');
const bootstrap=read('assets/js/bootstrap.js');
const sw=read('service-worker.js');
const ui=read('assets/js/personal-recipe-ui.js');
const service=read('assets/js/personal-recipe-service.js');
const workbench=read('assets/js/recipe-unified-player-workbench.js');

assert.match(version,/app_version: 'v0\.4\.27\.55\.3\.3\.16'/);
assert.match(version,/app_build: '20261001-v0427553316-personal-recipe-retirement-hotfix'/);
assert.match(version,/cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.16-v0427553316-personal-recipe-retirement-hotfix'/);
assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3.15'"),'.16 must retain exact .15 predecessor version marker');

assert.ok(bootstrap.includes("LEGACY_PERSONAL_RECIPE_ROOT_ID='g51PersonalRecipeRoot'"),'bootstrap must own stale legacy surface retirement');
assert.ok(bootstrap.includes("legacy_personal_recipe_surface_retired"),'bootstrap must trace retirement');
assert.ok(!bootstrap.includes("'personal-recipe-ui.js'"),'page loader must not activate retired personal recipe UI');

assert.ok(!sw.includes("'./assets/js/personal-recipe-ui.js'"),'retired UI must not be PWA precached');
assert.ok(!sw.includes("'./assets/js/personal-recipe-authority.js'"),'retired personal recipe authority must not be PWA precached');
assert.ok(!sw.includes("'./assets/js/personal-recipe-service.js'"),'retired personal recipe mutation service must not be PWA precached');

assert.match(ui,/PERSONAL_RECIPE_UI_RETIRED=true/);
assert.match(ui,/retirePersonalRecipeUi/);
assert.ok(!ui.includes('新增個人食譜'),'retired UI module must not expose create controls');
assert.ok(!ui.includes('我的食譜'),'retired UI module must not expose the old product surface');
assert.doesNotMatch(ui,/SELECT\s+\*\s+FROM\s+recipes|source\s*=\s*['\"]player_manual['\"]/,'retired UI module must not query player_manual recipes');
assert.ok(!ui.includes('createPersonalRecipeService'),'retired UI module must not bind mutation service');

assert.match(service,/PERSONAL_RECIPE_MUTATION_RETIRED=true/);
assert.match(service,/personal recipe mutation retired/);
assert.ok(!service.includes("INSERT INTO recipes"),'retired service must not write recipes');
assert.ok(!service.includes("DELETE FROM recipes"),'retired service must not delete recipes');

assert.ok(workbench.includes("document.getElementById('g51PersonalRecipeRoot')?.remove()"),'canonical recipe workbench must remove stale legacy surface');
assert.ok(workbench.includes("SELECT * FROM recipe_catalog_state"),'canonical recipe workbench must remain Public Master + player-state projection');
assert.ok(workbench.includes("ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,recipe_level=excluded.recipe_level,current_energy=excluded.current_energy"),'player edits must remain state-only');

console.log(JSON.stringify({
  gate:'G51_PERSONAL_RECIPE_RETIREMENT',
  status:'PASS',
  legacy_product_surface_active:false,
  player_manual_mutation_active:false,
  canonical_recipe_state_only:true,
},null,2));
