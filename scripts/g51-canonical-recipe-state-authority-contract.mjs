import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';

const schema=buildUpdatePackageJsonSchema({scenario:'recipe_status_update',entities:['recipes']});
const operation=schema.properties.operations.items.properties;
assert.deepEqual(Object.keys(operation.data.properties).sort(),['current_energy','notes','recipe_level','unlocked']);
assert.equal(operation.data.additionalProperties,false,'recipe Update Package data must reject recipe identity/master fields');
assert.deepEqual(operation.clear_fields.items.enum.slice().sort(),['current_energy','notes','recipe_level']);

const importer=fs.readFileSync('assets/js/importer.js','utf8');
assert.match(importer,/RECIPE_PLAYER_STATE_FIELDS = new Set\(\['unlocked','recipe_level','current_energy','notes'\]\)/);
assert.match(importer,/料理 identity\/name\/category\/formula 只能由 Public Recipe Master 提供/);
assert.doesNotMatch(importer,/SELECT recipe_id FROM recipes WHERE recipe_name=\?/,'recipe name resolution must never fall back to player-created identities');
assert.match(importer,/recipe_master_alias WHERE alias_value=\? AND is_auto_replace_safe=1/,'approved public aliases must remain canonical-resolution compatible');

const sync=fs.readFileSync('assets/js/public-recipe-master-sync.js','utf8');
assert.doesNotMatch(sync,/PLAYER_ONLY/,'canonical recipe catalog must not expose player-only recipe identities');
assert.doesNotMatch(sync,/matched_player_ids/,'player-only union support must be retired from the canonical catalog view');

const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
assert.doesNotMatch(bootstrap,/personal-recipe-ui\.js/,'personal recipe editor must not be loaded by the Recipe page');
assert.doesNotMatch(serviceWorker,/personal-recipe-ui\.js/,'retired personal recipe UI must not be part of the active offline runtime cache');
const retiredService=fs.readFileSync('assets/js/personal-recipe-service.js','utf8');
assert.match(retiredService,/PERSONAL_RECIPE_MUTATION_RETIRED=true/,'legacy service may remain only as fail-closed read compatibility');
assert.doesNotMatch(retiredService,/INSERT INTO recipes|DELETE FROM recipes/,'retired compatibility service must not mutate recipes');
assert.doesNotMatch(serviceWorker,/personal-recipe-authority\.js/,'retired personal recipe authority must not remain in active PWA precache');
assert.doesNotMatch(serviceWorker,/personal-recipe-service\.js/,'retired personal recipe mutation service must not remain in active PWA precache');

console.log(JSON.stringify({
  gate:'G51R_G52_CANONICAL_RECIPE_STATE_AUTHORITY',
  status:'PASS',
  public_recipe_identity_only:true,
  player_state_fields:['unlocked','recipe_level','current_energy','notes'],
  player_only_catalog_projection:false,
  personal_recipe_ui_runtime:false,
  approved_public_alias_resolution:true,
  historical_personal_recipe_modules_runtime_entry:false
},null,2));
