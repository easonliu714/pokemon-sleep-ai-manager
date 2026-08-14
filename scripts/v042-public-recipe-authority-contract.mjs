import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.resolve(__dirname,'..');

// Historical v0.4.2 base-fact contract: formula identity remains owned here even
// when a later release layers a canonical/current zh-TW name projection on top.
const recipeModule=await import(pathToFileURL(path.join(root,'assets/js/public-recipe-master.js')).href);
const {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_ALIASES,PUBLIC_RECIPE_MASTER_VERSION}=recipeModule;

function assert(condition,message){if(!condition)throw new Error(message);}
function read(relative){return fs.readFileSync(path.join(root,relative),'utf8');}
function extractArrayLiteral(source,marker){
  const markerIndex=source.indexOf(marker);assert(markerIndex>=0,`marker_not_found:${marker}`);
  const equalsIndex=source.indexOf('=',markerIndex+marker.length);
  const start=source.indexOf('[',equalsIndex+1);assert(equalsIndex>=0&&start>=0,`array_start_not_found:${marker}`);
  let depth=0,quote=null,escaped=false;
  for(let index=start;index<source.length;index+=1){
    const char=source[index];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
    if(char==='[')depth+=1;else if(char===']'){depth-=1;if(depth===0)return source.slice(start,index+1);}
  }
  throw new Error(`array_end_not_found:${marker}`);
}
function ingredientMap(recipe){return Object.fromEntries(recipe.ingredients.map(row=>[row.ingredient_name,Number(row.quantity)]));}
function recipe(name){const found=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_name===name);assert(found,`missing_recipe:${name}`);return found;}
function assertIngredients(name,expected){
  const actual=ingredientMap(recipe(name));
  assert(JSON.stringify(actual)===JSON.stringify(expected),`ingredient_fixture_mismatch:${name}:${JSON.stringify(actual)}`);
}

assert(PUBLIC_RECIPE_MASTER_VERSION==='public-recipe-master-2026-08-09-a','unexpected_recipe_master_version');
assert(PUBLIC_RECIPE_MASTER.length===76,`recipe_count:${PUBLIC_RECIPE_MASTER.length}`);
assert(new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id)).size===76,'duplicate_recipe_id');
assert(new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_name)).size===76,'duplicate_recipe_name');

const categories=PUBLIC_RECIPE_MASTER.reduce((out,row)=>{out[row.category]=(out[row.category]||0)+1;return out;},{});
assert(categories['咖哩／濃湯']===23,`curry_count:${categories['咖哩／濃湯']}`);
assert(categories['沙拉']===26,`salad_count:${categories['沙拉']}`);
assert(categories['甜點／飲料']===27,`dessert_count:${categories['甜點／飲料']}`);

assert(PUBLIC_RECIPE_ALIASES.length===89,`alias_count:${PUBLIC_RECIPE_ALIASES.length}`);
assert(new Set(PUBLIC_RECIPE_ALIASES.map(row=>`${row.alias_type}|${row.alias_value}`)).size===89,'duplicate_recipe_alias');
const aliasTypes=PUBLIC_RECIPE_ALIASES.reduce((out,row)=>{out[row.alias_type]=(out[row.alias_type]||0)+1;return out;},{});
assert(aliasTypes.legacy_recipe_id===76,`legacy_id_alias_count:${aliasTypes.legacy_recipe_id}`);
assert(aliasTypes.legacy_recipe_name===13,`legacy_name_alias_count:${aliasTypes.legacy_recipe_name}`);

const sharedSource=read('assets/js/shared-master-data.js');
const historicalSource=read('assets/js/v0383-catalog-ocr-review-contract.js');
const rendererSource=read('assets/js/public-catalog-workbench.js');
const syncSource=read('assets/js/public-recipe-master-sync.js');
const migrationsSource=read('assets/js/migrations.js');
const serviceWorkerSource=read('service-worker.js');
assert(!sharedSource.includes('const RECIPES'),'shared_master_duplicate_recipe_authority');
assert(!historicalSource.includes('const RECIPES'),'historical_runtime_duplicate_recipe_authority');
assert(!rendererSource.includes('PokemonSleepPublicRecipeRegistry'),'renderer_uses_legacy_registry');
const rendererUsesProjectedAuthority=rendererSource.includes("from './public-recipe-canonical-authority.js'")||rendererSource.includes("from './public-recipe-current-authority.js'");
assert(rendererUsesProjectedAuthority,'renderer_missing_recipe_runtime_authority_import');
assert(!rendererSource.includes("from './public-recipe-master.js'"),'renderer_bypasses_recipe_canonical_projection');
assert(migrationsSource.includes("import {syncPublicRecipeMaster} from './public-recipe-master-sync.js'"),'migration_missing_controlled_recipe_sync');
assert(!migrationsSource.includes('applyPublicRecipeMaster(db)'),'migration_uses_legacy_full_rebuild');
assert(serviceWorkerSource.includes("'./assets/js/public-recipe-master.js'"),'offline_cache_missing_recipe_base_authority');
assert(serviceWorkerSource.includes("'./assets/js/public-recipe-master-sync.js'"),'offline_cache_missing_recipe_sync');

const ingredientLiteral=extractArrayLiteral(sharedSource,'const INGREDIENTS');
const ingredientRows=vm.runInNewContext(`(${ingredientLiteral})`,Object.create(null),{timeout:1000});
const ingredientNames=new Set(ingredientRows.map(String));
for(const row of PUBLIC_RECIPE_MASTER){
  assert(row.recipe_id&&row.category&&row.recipe_name,'recipe_identity_incomplete');
  assert(Array.isArray(row.ingredients)&&row.ingredients.length>0,`recipe_ingredients_empty:${row.recipe_name}`);
  assert(row.source_type&&row.source_name&&row.source_ref&&row.verification_status,`recipe_provenance_incomplete:${row.recipe_name}`);
  const total=row.ingredients.reduce((sum,item)=>sum+Number(item.quantity||0),0);
  assert(total===Number(row.total_ingredients),`total_ingredient_mismatch:${row.recipe_name}:${total}:${row.total_ingredients}`);
  for(const item of row.ingredients){
    assert(ingredientNames.has(item.ingredient_name),`unknown_ingredient:${row.recipe_name}:${item.ingredient_name}`);
    assert(Number.isInteger(Number(item.quantity))&&Number(item.quantity)>0,`invalid_quantity:${row.recipe_name}:${item.ingredient_name}`);
  }
}

assertIngredients('忍者咖哩',{'品鮮蘑菇':5,'粗枝大蔥':12,'萌綠大豆':24,'豆製肉':9});
assertIngredients('電光香料可樂',{'暖暖薑':20,'特選蘋果':35,'粗枝大蔥':20,'醒腦咖啡豆':12});
assertIngredients('鬼面鬆餅',{'好眠番茄':29,'沉甸甸南瓜':18,'特選蛋':24,'甜甜蜜':32});
assertIngredients('採蜜巧克力鬆餅',{'放鬆可可':21,'甜甜蜜':38,'純粹油':28,'萌綠玉米':28});

const authoritySource=read('assets/js/public-recipe-master.js');
for(const [label,source] of [['authority',authoritySource],['sync',syncSource]]){
  for(const forbidden of ['DELETE FROM recipes','UPDATE recipes SET','INSERT INTO recipes(','INSERT OR REPLACE INTO recipes']){
    assert(!source.includes(forbidden),`${label}_player_recipe_write:${forbidden}`);
  }
}
assert(syncSource.includes("DELETE FROM recipe_master WHERE recipe_id=? AND recipe_name=?"),'controlled_master_retirement_missing_identity_guard');
assert(!syncSource.includes("db.run('DELETE FROM recipe_master')"),'unqualified_master_delete');
assert(syncSource.includes('preserved_unrecognized_master_rows'),'unrecognized_master_preservation_missing');
assert(syncSource.includes("row=>row.alias_type==='legacy_recipe_name'"),'legacy_name_retirement_not_explicit');
assert(syncSource.includes("alias.alias_type==='legacy_recipe_id'"),'legacy_id_retirement_not_explicit');

const coverage=recipeModule.recipeMasterCoverage();
assert(coverage.recipe_count===76,'coverage_recipe_count');
assert(coverage.alias_count===89,'coverage_alias_count');

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-public-recipe-authority-contract/1.3',
  version:PUBLIC_RECIPE_MASTER_VERSION,
  recipe_count:PUBLIC_RECIPE_MASTER.length,
  alias_count:PUBLIC_RECIPE_ALIASES.length,
  alias_types:aliasTypes,
  categories,
  ingredient_relation_count:coverage.ingredient_relation_count,
  review_required:coverage.review_required,
  duplicate_runtime_authority:false,
  runtime_name_projection_forward_compatible:true,
  player_write_performed:false,
  controlled_legacy_retirement:true,
  preserve_unrecognized_master_rows:true,
  offline_base_authority_cached:true,
  critical_conflict_fixtures:['忍者咖哩','電光香料可樂','鬼面鬆餅','採蜜巧克力鬆餅'],
},null,2)}\n`);
