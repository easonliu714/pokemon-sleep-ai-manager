import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  POT_CAPACITY_AUTHORITY_VERSION,
  resolveBasePotCapacity,
  compileRecipePotCapacityOperation,
} from '../assets/js/pot-capacity-authority.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  PUBLIC_RECIPE_ACTIVATION_ADDITIONS,
} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_RECIPE_MASTER as HISTORICAL_BASE_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  recipeProvenanceCoverage,
} from '../assets/js/public-recipe-provenance.js';
import {PUBLIC_RECIPE_DISCOVERY,activeCanonicalDiscoveryRows} from '../assets/js/public-recipe-discovery-master.js';
import {
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionJsonSchema,
} from '../assets/js/public-master-recognition.js';
import {DATA_PRESERVATION_POLICY_VERSION,isObservedWriteValue} from '../assets/js/data-preservation-policy.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION} from '../assets/js/uc-img-gemini-adapter.js';
import {recipeScenarioAcceptsPotCapacity} from '../assets/js/uc-img-v04132-pot-capacity-bootstrap.js';

const read=path=>fs.readFileSync(path,'utf8');
const signature=recipe=>[...(recipe.ingredients||[])].map(row=>`${row.ingredient_name}=${Number(row.quantity)}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');
const expectedSignature=rows=>rows.map(([name,qty])=>`${name}=${qty}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');

const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.13.2');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260812-v04132-pot-authority-recipe78');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78');
assert.ok(version.includes("// app_version: 'v0.4.13.1'"),'v0.4.13.1 predecessor bridge must remain');
assert.ok(version.includes("// app_build: '20260811-v04131-data-preservation-hotfix'"));

assert.equal(DATA_PRESERVATION_POLICY_VERSION,'data-preservation-policy-2026-08-11-a');
for(const value of [null,undefined,'','   '])assert.equal(isObservedWriteValue(value),false);
for(const value of [0,false])assert.equal(isObservedWriteValue(value),true);

assert.equal(POT_CAPACITY_AUTHORITY_VERSION,'pot-capacity-authority-2026-08-12-a');
assert.deepEqual(resolveBasePotCapacity({accountCapacity:57,legacyWeeklyPot:69}),{pot_size:57,source:'ACCOUNT_CAPACITY',is_legacy_fallback:false});
assert.deepEqual(resolveBasePotCapacity({accountCapacity:null,legacyWeeklyPot:57}),{pot_size:57,source:'LEGACY_WEEKLY_POT_FALLBACK',is_legacy_fallback:true});
const pot=compileRecipePotCapacityOperation({capacity_observations:[{capacity_key:'pot',total_capacity:57,source_image_ref:'image-release',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'}]},{allowedImageRefs:['image-release']});
assert.equal(pot.ok,true);assert.equal(pot.operation.entity,'account_capacity');assert.deepEqual(pot.operation.key,{capacity_key:'pot'});assert.deepEqual(pot.operation.data,{total_capacity:57});
assert.equal(recipeScenarioAcceptsPotCapacity(),true);

const prompt=read('assets/js/prompt-catalog.js');
assert.ok(prompt.includes('玩家基礎鍋子容量不屬於 Weekly Context'));
assert.ok(prompt.includes('營地／活動截圖不得輸出 data.pot_size'));
assert.ok(prompt.includes('account_capacity'));
const weeklyStore=read('assets/js/weekly-context-store.js');
assert.ok(weeklyStore.includes("SELECT total_capacity FROM account_capacity WHERE capacity_key='pot'"));
assert.ok(weeklyStore.includes('LEGACY_WEEKLY_POT_FALLBACK'));
assert.ok(weeklyStore.includes('fieldSources.pot_size=potAuthority.source'));

assert.equal(HISTORICAL_BASE_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-12-a');
assert.equal(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-12-a');
assert.equal(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.length,2);
const historicalIds=new Set(HISTORICAL_BASE_RECIPE_MASTER.map(row=>row.recipe_id));
const currentIds=new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id));
for(const id of historicalIds)assert.ok(currentIds.has(id),`historical recipe ID removed: ${id}`);
assert.equal(currentIds.size,78);
const categoryCounts=Object.fromEntries(['咖哩／濃湯','沙拉','甜點／飲料'].map(category=>[category,PUBLIC_RECIPE_MASTER.filter(row=>row.category===category).length]));
assert.deepEqual(categoryCounts,{'咖哩／濃湯':25,'沙拉':26,'甜點／飲料':27});
const additions=Object.fromEntries(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.map(row=>[row.recipe_id,row]));
assert.equal(additions.curry_greengrass_bun.recipe_name,'萌綠咖哩麵包');
assert.equal(additions.curry_greengrass_bun.base_energy,10945);
assert.equal(additions.curry_greengrass_bun.total_ingredients,63);
assert.equal(signature(additions.curry_greengrass_bun),expectedSignature([['暖暖薑',20],['火辣香草',20],['萌綠大豆',8],['純粹油',15]]));
assert.equal(additions.curry_bounce_udon.recipe_name,'彈跳咖哩烏龍麵');
assert.equal(additions.curry_bounce_udon.base_energy,25539);
assert.equal(additions.curry_bounce_udon.total_ingredients,112);
assert.equal(signature(additions.curry_bounce_udon),expectedSignature([['暖暖薑',39],['品鮮蘑菇',31],['火辣香草',22],['豆製肉',20]]));

assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-12-d');
assert.equal(PUBLIC_RECIPE_PROVENANCE.length,78);
const coverage=recipeProvenanceCoverage();
assert.equal(coverage.active_recipe_count,78);assert.equal(coverage.upcoming_evidence_count,0);assert.equal(coverage.promoted_historical_evidence_count,2);
assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);assert.equal(activeCanonicalDiscoveryRows().length,2);assert.ok(PUBLIC_RECIPE_DISCOVERY.every(row=>row.lifecycle==='PROMOTED_TO_CANONICAL_ACTIVE'&&row.active_canonical===true));

const snapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(snapshot.row_count,78);assert.equal(snapshot.data_version,PUBLIC_RECIPE_MASTER_VERSION);
const recognitionSchema=buildPublicMasterRecognitionJsonSchema('recipes');assert.ok(recognitionSchema.properties.capacity_observations);
assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-12-a-pot-capacity-authority');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-12-c-pot-capacity');

const sync=read('assets/js/public-recipe-master-sync.js');assert.ok(sync.includes('PUBLIC_RECIPE_MASTER'));assert.ok(sync.includes('for(const recipe of PUBLIC_RECIPE_MASTER)'));assert.ok(sync.includes('canonical_recipe_count:PUBLIC_RECIPE_MASTER.length'));
const ucImg=read('assets/js/unified-screenshot-update-center.js');assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'UC.IMG must retain exactly one Apply bridge');
const bootstrap=read('assets/js/uc-img-v04132-pot-capacity-bootstrap.js');assert.ok(bootstrap.includes("from './unified-screenshot-update-center.js'"));assert.ok(bootstrap.includes('account_capacity'));
const sw=read('service-worker.js');for(const asset of ['pot-capacity-authority.js','uc-img-v04132-pot-capacity-bootstrap.js','public-master-recognition.js','public-recipe-canonical-authority.js','public-recipe-provenance.js'])assert.ok(sw.includes(`'./assets/js/${asset}'`),`offline precache missing ${asset}`);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.13.2 must remain SQLite-migration-free');
for(const forbidden of ['1000109624.png','1000109625.png','1000109626.png','1000109627.png','1000109628.png','1000109629.png'])for(const path of ['assets/js/public-recipe-canonical-authority.js','assets/js/public-recipe-provenance.js'])assert.equal(read(path).includes(forbidden),false,`private screenshot filename leaked: ${path}`);

console.log(JSON.stringify({status:'PASS',gate:'V0.4.13.2_RELEASE_CONTRACT',app_version:'v0.4.13.2',build:'20260812-v04132-pot-authority-recipe78',pot_base_authority:'ACCOUNT_CAPACITY',legacy_weekly_pot_fallback:true,weekly_prompt_owns_base_pot:false,recipe_screen_pot_observation:true,data_preservation_predecessor:true,historical_recipe_count:76,canonical_recipe_count:78,category_counts:categoryCounts,activated_recipes:['curry_greengrass_bun','curry_bounce_udon'],historical_recipe_ids_preserved:true,recognition_catalog_count:snapshot.row_count,discovery_pending_count:0,uc_img_apply_bridge_count:1,sqlite_migration_added:false,private_screenshots_committed:false,offline_precache:true},null,2));