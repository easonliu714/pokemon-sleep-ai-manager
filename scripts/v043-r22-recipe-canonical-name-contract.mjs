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
  PUBLIC_RECIPE_MASTER as CURRENT_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION as CURRENT_PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION as CURRENT_PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
} from '../assets/js/public-recipe-current-authority.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  REVIEWED_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-provenance.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.resolve(__dirname,'..');
function signature(recipe){return [...(recipe.ingredients||[])].map(row=>`${row.ingredient_name}=${Number(row.quantity)}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');}

assert.equal(BASE_PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-09-a');
assert.equal(PUBLIC_RECIPE_BASE_MASTER_VERSION,BASE_PUBLIC_RECIPE_MASTER_VERSION);
assert.match(PUBLIC_RECIPE_MASTER_VERSION,/^public-recipe-master-2026-08-(?:09-b|11-[a-z]|12-[a-z]|13-[a-z])$/,'canonical predecessor recipe master successor version invalid');
assert.match(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,/^public-recipe-zh-tw-names-2026-08-(?:09-a|11-[a-z]|12-[a-z]|13-[a-z])$/,'canonical predecessor name successor version invalid');
assert.equal(CURRENT_PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');
assert.equal(CURRENT_PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-14-b');
assert.ok(PUBLIC_RECIPE_MASTER.length>=76,'canonical predecessor may add evidence-backed recipes but may not remove historical 76');
assert.equal(BASE_PUBLIC_RECIPE_MASTER.length,76);
assert.equal(CURRENT_PUBLIC_RECIPE_MASTER.length,78,'current authority must contain exactly 78 recipes');
assert.ok(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length>=33,'v0.4.3 33-name baseline must never be lost');
assert.equal(PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,2,'historical two conflict audit rows must remain traceable');

const baseById=new Map(BASE_PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const canonicalById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const currentById=new Map(CURRENT_PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
assert.equal(baseById.size,76);assert.equal(canonicalById.size,PUBLIC_RECIPE_MASTER.length);assert.equal(currentById.size,78);
for(const id of baseById.keys())assert.ok(canonicalById.has(id),`historical stable recipe ID disappeared: ${id}`);
for(const id of canonicalById.keys())assert.ok(currentById.has(id),`predecessor recipe ID disappeared from current authority: ${id}`);
assert.equal(new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id)).size,PUBLIC_RECIPE_MASTER.length,'canonical predecessor recipe IDs must remain unique');
assert.equal(new Set(CURRENT_PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id)).size,78,'current recipe IDs must remain unique');
const historicalOverrideIds=new Set(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.filter(row=>row.recipe_id!=='curry_dizzy_punch').map(row=>row.recipe_id));
assert.equal(historicalOverrideIds.size,33,'the original v0.4.3 33-name baseline must remain exactly preserved');

let renamed=0;const formulaChanges=[];
for(const [recipeId,base] of baseById){const canonical=canonicalById.get(recipeId);assert.ok(canonical,`missing canonical recipe ${recipeId}`);assert.equal(canonical.category,base.category,`category changed for ${recipeId}`);if(signature(canonical)!==signature(base))formulaChanges.push(recipeId);if(canonical.recipe_name!==base.recipe_name)renamed+=1;}
assert.ok(renamed>=33,'at least the original 33 screenshot-confirmed names must remain promoted');
assert.deepEqual(formulaChanges,[],'full formula audit requires zero historical 76 formula drift');

const overrideIds=new Set();
for(const override of PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES){
  assert.equal(overrideIds.has(override.recipe_id),false,`duplicate override ${override.recipe_id}`);overrideIds.add(override.recipe_id);
  const base=baseById.get(override.recipe_id),canonical=canonicalById.get(override.recipe_id);assert.ok(base&&canonical,`unknown override ID ${override.recipe_id}`);
  assert.equal(base.recipe_name,override.legacy_public_name,`legacy public name drifted for ${override.recipe_id}`);assert.equal(canonical.recipe_name,override.canonical_name_zh_tw,`canonical name projection failed for ${override.recipe_id}`);assert.equal(canonical.source_type,'game_screenshot_verified');assert.equal(canonical.verification_status,'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_MATCH');
  const legacyAlias=PUBLIC_RECIPE_ALIASES.find(row=>row.recipe_id===override.recipe_id&&row.alias_type==='legacy_recipe_name'&&row.alias_value===override.legacy_public_name&&row.source_type==='pre_v043_public_recipe_name_compatibility');assert.ok(legacyAlias,`missing legacy-name alias for ${override.recipe_id}`);assert.equal(Boolean(legacyAlias.is_auto_replace_safe),true);
  const canonicalResolution=resolvePublicRecipeName(override.canonical_name_zh_tw);assert.deepEqual(canonicalResolution,{recipe_id:override.recipe_id,recipe_name:override.canonical_name_zh_tw,resolution:'CANONICAL_EXACT',requires_review:false,commit_allowed:true});
  const legacyResolution=resolvePublicRecipeName(override.legacy_public_name);assert.equal(legacyResolution?.recipe_id,override.recipe_id);assert.equal(legacyResolution?.recipe_name,override.canonical_name_zh_tw);assert.equal(legacyResolution?.resolution,'LEGACY_NAME_ALIAS_SAFE');assert.equal(legacyResolution?.requires_review,false);assert.equal(legacyResolution?.commit_allowed,true);
}

const conflictById=new Map(PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.map(row=>[row.recipe_id,row]));assert.ok(conflictById.has('curry_dizzy_punch'));assert.ok(conflictById.has('curry_parent_child'));for(const row of conflictById.values()){assert.equal(row.status,'FORMULA_CONFLICT_REVIEW');assert.equal(row.auto_apply,false);}
if(overrideIds.has('curry_dizzy_punch')){assert.equal(conflictById.get('curry_dizzy_punch')?.resolution,'CURRENT_PUBLIC_FORMULA_CONFIRMED_OLD_OCR_EVIDENCE_REJECTED');assert.equal(canonicalById.get('curry_dizzy_punch').recipe_name,'迷昏拳辣味咖哩');assert.equal(signature(canonicalById.get('curry_dizzy_punch')),signature(baseById.get('curry_dizzy_punch')));}else assert.equal(canonicalById.get('curry_dizzy_punch').recipe_name,'暈眩拳辣味咖哩');
assert.equal(conflictById.get('curry_parent_child')?.resolution,'CURRENT_PUBLIC_FORMULA_CONFIRMED_BAD_SCREENSHOT_OBSERVATION_REJECTED');
assert.equal(signature(canonicalById.get('curry_parent_child')),signature(baseById.get('curry_parent_child')));
assert.equal(signature(canonicalById.get('curry_parent_child')),'特選蛋=8|特選蘋果=11|甜甜蜜=12|窩心洋芋=4');

assert.match(PUBLIC_RECIPE_PROVENANCE_VERSION,/^public-recipe-provenance-2026-08-(?:09-b|11-[a-z]|12-[a-z]|13-[a-z]|14-[a-z](?:-[a-z0-9-]+)?)$/,'recipe provenance successor version invalid');
assert.equal(REVIEWED_RECIPE_MASTER_VERSION,CURRENT_PUBLIC_RECIPE_MASTER_VERSION);
assert.equal(PUBLIC_RECIPE_PROVENANCE.length,CURRENT_PUBLIC_RECIPE_MASTER.length);
for(const row of PUBLIC_RECIPE_PROVENANCE){
  const current=currentById.get(row.recipe_id);assert.ok(current,`provenance recipe missing from current authority: ${row.recipe_id}`);
  assert.equal(row.recipe_name_zh_tw,current.recipe_name,`provenance name drifted for ${row.recipe_id}`);
  assert.equal(row.name_source_type,current.source_type,`provenance source type drifted for ${row.recipe_id}`);
  assert.equal(row.name_source_ref,current.source_ref,`provenance source ref drifted for ${row.recipe_id}`);
}
const screenshotAliasRows=PUBLIC_RECIPE_ALIASES.filter(row=>row.source_type==='pre_v043_public_recipe_name_compatibility');assert.ok(screenshotAliasRows.length>=33);for(const recipeId of historicalOverrideIds)assert.ok(screenshotAliasRows.some(row=>row.recipe_id===recipeId),`historical legacy alias missing: ${recipeId}`);
const versionAuthority=fs.readFileSync(path.join(root,'assets/js/version-authority.js'),'utf8');assert.match(versionAuthority,/app_version:\s*'v0\.4\.3'/,'historical v0.4.3 release marker must remain available to legacy contract');
function collectJsFiles(directory){const out=[];for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())out.push(...collectJsFiles(full));else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);}return out;}
const directRawImports=[],directPredecessorImports=[];
for(const file of collectJsFiles(path.join(root,'assets/js'))){
  const relative=path.relative(root,file).replaceAll('\\','/');const source=fs.readFileSync(file,'utf8');
  if(relative!=='assets/js/public-recipe-canonical-authority.js'&&/from\s+['"]\.\/public-recipe-master\.js['"]/.test(source))directRawImports.push(relative);
  if(relative!=='assets/js/public-recipe-current-authority.js'&&/from\s+['"]\.\/public-recipe-canonical-authority\.js['"]/.test(source))directPredecessorImports.push(relative);
}
assert.deepEqual(directRawImports,[],`Runtime consumers must not import raw recipe master: ${directRawImports.join(', ')}`);
assert.deepEqual(directPredecessorImports,[],`Runtime consumers must use current recipe authority, predecessor imports: ${directPredecessorImports.join(', ')}`);
process.stdout.write(`${JSON.stringify({status:'PASS',gate:'R2.2_RECIPE_CANONICAL_ZH_TW_NAME_ALIAS_CONTRACT_AUDITED_SUCCESSOR',base_master_version:BASE_PUBLIC_RECIPE_MASTER_VERSION,predecessor_master_version:PUBLIC_RECIPE_MASTER_VERSION,current_master_version:CURRENT_PUBLIC_RECIPE_MASTER_VERSION,predecessor_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,current_name_version:CURRENT_PUBLIC_RECIPE_CANONICAL_NAME_VERSION,active_recipe_count:CURRENT_PUBLIC_RECIPE_MASTER.length,historical_stable_recipe_id_count:baseById.size,current_recipe_id_count:currentById.size,original_v043_renamed_baseline:historicalOverrideIds.size,predecessor_renamed_recipe_count:renamed,legacy_public_name_alias_count:screenshotAliasRows.length,historical_formula_conflict_audit_count:PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.length,current_historical_formula_changes:formulaChanges,direct_runtime_raw_master_imports:directRawImports,direct_runtime_predecessor_imports:directPredecessorImports,historical_release_marker_preserved:true},null,2)}\n`);