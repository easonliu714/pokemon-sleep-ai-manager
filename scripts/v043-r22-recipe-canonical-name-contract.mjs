import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PUBLIC_RECIPE_MASTER as BASE_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION as BASE_PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_BASE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES,
  PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS,
  resolvePublicRecipeName,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  REVIEWED_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-provenance.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.resolve(__dirname,'..');

function signature(recipe){
  return [...(recipe.ingredients||[])]
    .map(row=>`${row.ingredient_name}=${Number(row.quantity)}`)
    .sort((a,b)=>a.localeCompare(b,'zh-Hant'))
    .join('|');
}

assert.equal(BASE_PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-09-a');
assert.equal(PUBLIC_RECIPE_BASE_MASTER_VERSION,BASE_PUBLIC_RECIPE_MASTER_VERSION);
assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-09-b');
assert.equal(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-09-a');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
assert.equal(BASE_PUBLIC_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,33);
assert.equal(PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,2);

const baseById=new Map(BASE_PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const canonicalById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
assert.equal(baseById.size,76);
assert.equal(canonicalById.size,76);
assert.deepEqual([...canonicalById.keys()].sort(),[...baseById.keys()].sort(),'stable recipe IDs must remain identical');

let renamed=0;
for(const [recipeId,base] of baseById){
  const canonical=canonicalById.get(recipeId);
  assert.ok(canonical,`missing canonical recipe ${recipeId}`);
  assert.equal(canonical.category,base.category,`category changed for ${recipeId}`);
  assert.equal(canonical.total_ingredients,base.total_ingredients,`ingredient total changed for ${recipeId}`);
  assert.equal(signature(canonical),signature(base),`ingredient formula changed for ${recipeId}`);
  if(canonical.recipe_name!==base.recipe_name)renamed+=1;
}
assert.equal(renamed,33,'exactly 33 screenshot-confirmed names must change');

const overrideIds=new Set();
for(const override of PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES){
  assert.equal(overrideIds.has(override.recipe_id),false,`duplicate override ${override.recipe_id}`);
  overrideIds.add(override.recipe_id);
  const base=baseById.get(override.recipe_id);
  const canonical=canonicalById.get(override.recipe_id);
  assert.ok(base&&canonical,`unknown override ID ${override.recipe_id}`);
  assert.equal(base.recipe_name,override.legacy_public_name,`legacy public name drifted for ${override.recipe_id}`);
  assert.equal(canonical.recipe_name,override.canonical_name_zh_tw,`canonical name projection failed for ${override.recipe_id}`);
  assert.equal(canonical.source_type,'game_screenshot_verified');
  assert.equal(canonical.verification_status,'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_MATCH');
  const legacyAlias=PUBLIC_RECIPE_ALIASES.find(row=>
    row.recipe_id===override.recipe_id
    && row.alias_type==='legacy_recipe_name'
    && row.alias_value===override.legacy_public_name
    && row.source_type==='pre_v043_public_recipe_name_compatibility');
  assert.ok(legacyAlias,`missing v0.4.2 legacy-name alias for ${override.recipe_id}`);
  assert.equal(Boolean(legacyAlias.is_auto_replace_safe),true,`legacy public name must resolve safely for ${override.recipe_id}`);
  const canonicalResolution=resolvePublicRecipeName(override.canonical_name_zh_tw);
  assert.deepEqual(canonicalResolution,{
    recipe_id:override.recipe_id,recipe_name:override.canonical_name_zh_tw,resolution:'CANONICAL_EXACT',requires_review:false,commit_allowed:true,
  });
  const legacyResolution=resolvePublicRecipeName(override.legacy_public_name);
  assert.equal(legacyResolution?.recipe_id,override.recipe_id);
  assert.equal(legacyResolution?.recipe_name,override.canonical_name_zh_tw);
  assert.equal(legacyResolution?.resolution,'LEGACY_NAME_ALIAS_SAFE');
  assert.equal(legacyResolution?.requires_review,false);
  assert.equal(legacyResolution?.commit_allowed,true);
}

const conflictIds=new Set(PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.map(row=>row.recipe_id));
assert.equal(conflictIds.has('curry_dizzy_punch'),true);
assert.equal(conflictIds.has('curry_parent_child'),true);
for(const id of conflictIds)assert.equal(overrideIds.has(id),false,`formula conflict must not be auto-renamed: ${id}`);
assert.equal(canonicalById.get('curry_dizzy_punch').recipe_name,'暈眩拳辣味咖哩');
assert.equal(signature(canonicalById.get('curry_dizzy_punch')),signature(baseById.get('curry_dizzy_punch')));
assert.equal(canonicalById.get('curry_parent_child').recipe_name,'親子愛咖哩');
assert.equal(signature(canonicalById.get('curry_parent_child')),signature(baseById.get('curry_parent_child')));
const conflictAlias=resolvePublicRecipeName('迷昏拳辣味咖哩');
assert.equal(conflictAlias?.recipe_id,'curry_dizzy_punch');
assert.equal(conflictAlias?.resolution,'LEGACY_NAME_ALIAS_REVIEW');
assert.equal(conflictAlias?.requires_review,true);
assert.equal(conflictAlias?.commit_allowed,false);

assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-09-b');
assert.equal(REVIEWED_RECIPE_MASTER_VERSION,PUBLIC_RECIPE_MASTER_VERSION);
assert.equal(PUBLIC_RECIPE_PROVENANCE.length,76);
for(const row of PUBLIC_RECIPE_PROVENANCE){
  assert.equal(row.recipe_name_zh_tw,canonicalById.get(row.recipe_id)?.recipe_name,`provenance name drifted for ${row.recipe_id}`);
}

const screenshotAliasRows=PUBLIC_RECIPE_ALIASES.filter(row=>row.source_type==='pre_v043_public_recipe_name_compatibility');
assert.equal(screenshotAliasRows.length,33,'exactly 33 pre-v0.4.3 legacy public-name aliases required');

const versionAuthority=fs.readFileSync(path.join(root,'assets/js/version-authority.js'),'utf8');
assert.match(versionAuthority,/app_version:\s*'v0\.4\.2'/,'R2.2 must not bump central app version before R2.3 closure');

function collectJsFiles(directory){
  const out=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())out.push(...collectJsFiles(full));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);
  }
  return out;
}
const directRawImports=[];
for(const file of collectJsFiles(path.join(root,'assets/js'))){
  const relative=path.relative(root,file).replaceAll('\\','/');
  if(relative==='assets/js/public-recipe-canonical-authority.js')continue;
  const source=fs.readFileSync(file,'utf8');
  if(/from\s+['"]\.\/public-recipe-master\.js['"]/.test(source))directRawImports.push(relative);
}
assert.deepEqual(directRawImports,[],`Runtime consumers must use canonical recipe authority, direct raw imports: ${directRawImports.join(', ')}`);

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'R2.2_RECIPE_CANONICAL_ZH_TW_NAME_ALIAS_CONTRACT',
  base_master_version:BASE_PUBLIC_RECIPE_MASTER_VERSION,
  canonical_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  canonical_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,
  stable_recipe_id_count:canonicalById.size,
  renamed_recipe_count:renamed,
  legacy_public_name_alias_count:screenshotAliasRows.length,
  formula_conflict_review_count:PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,
  ingredient_formula_changes:0,
  direct_runtime_raw_master_imports:directRawImports,
  central_app_version_unchanged:'v0.4.2',
},null,2)}\n`);
