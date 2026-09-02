import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  POT_CAPACITY_AUTHORITY_VERSION,
  resolveBasePotCapacity,
  validateRecipePotCapacityObservations,
  compileRecipePotCapacityOperation,
} from '../assets/js/pot-capacity-authority.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_ACTIVATION_ADDITIONS,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_MASTER as CURRENT_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION as CURRENT_PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-current-authority.js';
import {PUBLIC_RECIPE_MASTER as RAW_PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  REVIEWED_RECIPE_MASTER_VERSION,
  recipeProvenanceCoverage,
} from '../assets/js/public-recipe-provenance.js';
import {PUBLIC_RECIPE_DISCOVERY} from '../assets/js/public-recipe-discovery-master.js';
import {projectRecipeDiscoveryStockpile} from '../assets/js/recipe-discovery-stockpile.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionJsonSchema,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {recipeScenarioAcceptsPotCapacity} from '../assets/js/uc-img-v04132-pot-capacity-bootstrap.js';

const read=path=>fs.readFileSync(path,'utf8');
const signature=recipe=>[...(recipe.ingredients||[])].map(row=>`${row.ingredient_name}=${Number(row.quantity)}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');
const expectedSignature=rows=>rows.map(([name,qty])=>`${name}=${qty}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');
const versionTuple=value=>{const match=String(value||'').match(/^v(\d+)\.(\d+)\.(\d+)((?:\.\d+)*)$/);return match?[Number(match[1]),Number(match[2]),Number(match[3]),...String(match[4]||'').split('.').filter(Boolean).map(Number)]:null;};
const versionAtLeast=(value,minimum)=>{const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};

const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(appVersion==='v0.4.13.1'||versionAtLeast(appVersion,'v0.4.13.2'),`unexpected v0.4.13.2 behavior/release authority: ${appVersion}`);
if(appVersion==='v0.4.13.1')assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04131-data-preservation-hotfix','behavior-first stage must keep predecessor Release Authority');
else if(appVersion==='v0.4.13.2'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260812-v04132-pot-authority-recipe78');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78');
  assert.ok(version.includes("// app_version: 'v0.4.13.1'"));
}else{
  assert.ok(version.includes("// app_version: 'v0.4.13.2'"),'successor must retain v0.4.13.2 lineage bridge');
  assert.ok(version.includes("// app_build: '20260812-v04132-pot-authority-recipe78'"));
}

assert.equal(POT_CAPACITY_AUTHORITY_VERSION,'pot-capacity-authority-2026-08-12-a');
assert.deepEqual(resolveBasePotCapacity({accountCapacity:57,legacyWeeklyPot:69}),{pot_size:57,source:'ACCOUNT_CAPACITY',is_legacy_fallback:false});
assert.deepEqual(resolveBasePotCapacity({accountCapacity:null,legacyWeeklyPot:57}),{pot_size:57,source:'LEGACY_WEEKLY_POT_FALLBACK',is_legacy_fallback:true});
assert.deepEqual(resolveBasePotCapacity({accountCapacity:null,legacyWeeklyPot:null}),{pot_size:null,source:'MISSING',is_legacy_fallback:false});

const potValid=validateRecipePotCapacityObservations([
  {capacity_key:'pot',total_capacity:57,source_image_ref:'image-001',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'},
  {capacity_key:'pot',total_capacity:57,source_image_ref:'image-002',confidence:0.98,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'},
],{allowedImageRefs:['image-001','image-002']});
assert.equal(potValid.ok,true);assert.equal(potValid.observation.total_capacity,57);assert.equal(potValid.count,2);assert.equal(potValid.warnings.length,1);
const potConflict=validateRecipePotCapacityObservations([
  {capacity_key:'pot',total_capacity:57,source_image_ref:'image-001',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'},
  {capacity_key:'pot',total_capacity:69,source_image_ref:'image-002',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'},
],{allowedImageRefs:['image-001','image-002']});
assert.equal(potConflict.ok,false,'conflicting displayed pot capacity must fail closed');
const potOperation=compileRecipePotCapacityOperation({capacity_observations:[{capacity_key:'pot',total_capacity:57,source_image_ref:'image-001',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'}]},{allowedImageRefs:['image-001']});
assert.equal(potOperation.operation.entity,'account_capacity');assert.deepEqual(potOperation.operation.key,{capacity_key:'pot'});assert.deepEqual(potOperation.operation.data,{total_capacity:57});assert.equal(recipeScenarioAcceptsPotCapacity(),true);

const prompt=read('assets/js/prompt-catalog.js');assert.ok(prompt.includes('玩家基礎鍋子容量不屬於 Weekly Context'));assert.ok(prompt.includes('營地／活動截圖不得輸出 data.pot_size'));
const weeklyExampleMatch=prompt.match(/weekly:wrap\([\s\S]*?\{week_start:null[\s\S]*?\},\n\s*'weekly_context_update'/);assert.ok(weeklyExampleMatch);assert.equal(weeklyExampleMatch[0].includes('pot_size:null'),false);
const weeklyStore=read('assets/js/weekly-context-store.js');assert.ok(weeklyStore.includes('fieldSources.pot_size=potAuthority.source'));assert.ok(weeklyStore.includes('LEGACY_WEEKLY_POT_FALLBACK'));assert.ok(weeklyStore.includes("SELECT total_capacity FROM account_capacity WHERE capacity_key='pot'"));

assert.equal(RAW_PUBLIC_RECIPE_MASTER.length,76);assert.equal(PUBLIC_RECIPE_MASTER.length,78);assert.ok(['public-recipe-master-2026-08-12-a','public-recipe-master-2026-08-13-a','public-recipe-master-2026-08-13-b'].includes(PUBLIC_RECIPE_MASTER_VERSION));assert.equal(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.length,2);
assert.equal(CURRENT_PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');assert.equal(CURRENT_PUBLIC_RECIPE_MASTER.length,78);
const categoryCounts=Object.fromEntries(['咖哩／濃湯','沙拉','甜點／飲料'].map(category=>[category,CURRENT_PUBLIC_RECIPE_MASTER.filter(row=>row.category===category).length]));assert.deepEqual(categoryCounts,{'咖哩／濃湯':25,'沙拉':26,'甜點／飲料':27});
const rawIds=new Set(RAW_PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id));for(const row of RAW_PUBLIC_RECIPE_MASTER)assert.ok(CURRENT_PUBLIC_RECIPE_MASTER.some(current=>current.recipe_id===row.recipe_id));
const additions=Object.fromEntries(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.map(row=>[row.recipe_id,row]));
assert.equal(additions.curry_greengrass_bun.recipe_name,'萌綠咖哩麵包');assert.equal(additions.curry_greengrass_bun.base_energy,10945);assert.equal(additions.curry_greengrass_bun.total_ingredients,63);assert.equal(signature(additions.curry_greengrass_bun),expectedSignature([['暖暖薑',20],['火辣香草',20],['萌綠大豆',8],['純粹油',15]]));
assert.equal(additions.curry_bounce_udon.recipe_name,'彈跳咖哩烏龍麵');assert.equal(additions.curry_bounce_udon.base_energy,25539);assert.equal(additions.curry_bounce_udon.total_ingredients,112);assert.equal(signature(additions.curry_bounce_udon),expectedSignature([['暖暖薑',39],['品鮮蘑菇',31],['火辣香草',22],['豆製肉',20]]));
for(const id of Object.keys(additions))assert.equal(rawIds.has(id),false);

assert.match(PUBLIC_RECIPE_PROVENANCE_VERSION,/^public-recipe-provenance-2026-08-(?:12-d|13-a|14-[a-z](?:-[a-z0-9-]+)?)$/,'recipe provenance successor version invalid');assert.equal(REVIEWED_RECIPE_MASTER_VERSION,CURRENT_PUBLIC_RECIPE_MASTER_VERSION);assert.equal(PUBLIC_RECIPE_PROVENANCE.length,78);
const coverage=recipeProvenanceCoverage();assert.equal(coverage.active_recipe_count,78);assert.equal(coverage.runtime_recipe_master_version,CURRENT_PUBLIC_RECIPE_MASTER_VERSION);assert.equal(coverage.upcoming_evidence_count,0);assert.equal(coverage.promoted_historical_evidence_count,2);
assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);assert.ok(PUBLIC_RECIPE_DISCOVERY.every(row=>row.active_canonical===true&&row.lifecycle==='PROMOTED_TO_CANONICAL_ACTIVE'));
const discoveryPlan=projectRecipeDiscoveryStockpile({inventory:[],scoringProjection:{candidates:[]},weeklyContext:{}});assert.equal(discoveryPlan.summary.recipe_candidate_count,0);

const snapshot=buildPublicMasterCatalogSnapshot('recipes');assert.equal(snapshot.row_count,78);assert.equal(snapshot.data_version,CURRENT_PUBLIC_RECIPE_MASTER_VERSION);for(const row of PUBLIC_RECIPE_ACTIVATION_ADDITIONS)assert.ok(snapshot.rows.some(item=>item.recipe_id===row.recipe_id&&item.recipe_name===row.recipe_name));
const schema=buildPublicMasterRecognitionJsonSchema('recipes');assert.ok(schema.properties.capacity_observations);
const newRecipe=additions.curry_greengrass_bun;
const recognition={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'recipe_status_update',authority:'recipe_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-08-12T02:00:00Z',visible_target_count:1,observations:[{observation_id:'obs-1',status:'MATCHED',observed_text:'萌綠咖哩麵包',observed_data:{unlocked:true,recipe_level:1},canonical_key:{recipe_id:newRecipe.recipe_id,recipe_name:newRecipe.recipe_name},canonical_name:newRecipe.recipe_name,source_image_ref:'image-001',confidence:0.99}],capacity_observations:[{capacity_key:'pot',total_capacity:57,source_image_ref:'image-001',confidence:0.99,observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY'}]};
const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'recipes',{allowedImageRefs:['image-001']});assert.equal(compiled.ok,true);assert.equal(compiled.errors.length,0);assert.equal(compiled.summary.matched_count,1);assert.equal(compiled.summary.pot_capacity_observed,57);assert.equal(compiled.update_package.operations.length,2);assert.ok(compiled.update_package.operations.some(op=>op.entity==='recipes'&&op.key.recipe_id==='curry_greengrass_bun'));assert.ok(compiled.update_package.operations.some(op=>op.entity==='account_capacity'&&op.key.capacity_key==='pot'&&op.data.total_capacity===57));

const unified=read('assets/js/unified-screenshot-update-center.js');assert.equal((unified.match(/applyPayload\(/g)||[]).length,1);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false);
for(const privateToken of ['1000109624.png','1000109625.png','1000109626.png','1000109627.png','1000109628.png','1000109629.png'])for(const path of ['assets/js/public-recipe-canonical-authority.js','assets/js/public-recipe-current-authority.js','assets/js/public-recipe-provenance.js','assets/js/public-recipe-discovery-master.js'])assert.equal(read(path).includes(privateToken),false);

console.log(JSON.stringify({status:'PASS',gate:'V0.4.13.2_BEHAVIORAL_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,release_promoted:versionAtLeast(appVersion,'v0.4.13.2'),pot_capacity_authority:POT_CAPACITY_AUTHORITY_VERSION,account_capacity_primary:true,legacy_weekly_fallback:true,weekly_prompt_owns_base_pot:false,recipe_screen_capacity_compiles_same_update_package:true,conflicting_capacity_fail_closed:true,uc_img_apply_bridge_count:1,raw_recipe_count:RAW_PUBLIC_RECIPE_MASTER.length,predecessor_recipe_count:PUBLIC_RECIPE_MASTER.length,current_recipe_count:CURRENT_PUBLIC_RECIPE_MASTER.length,current_recipe_master_version:CURRENT_PUBLIC_RECIPE_MASTER_VERSION,category_counts:categoryCounts,activated_recipe_ids:PUBLIC_RECIPE_ACTIVATION_ADDITIONS.map(row=>row.recipe_id),discovery_candidates_remaining:discoveryPlan.summary.recipe_candidate_count,recognition_catalog_count:snapshot.row_count,sqlite_migration_added:false,private_screenshot_names_committed:false},null,2));
