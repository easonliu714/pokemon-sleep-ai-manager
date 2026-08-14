import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PUBLIC_RECIPE_MASTER as PREDECESSOR_RECIPE_MASTER,
  PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES,
  PUBLIC_RECIPE_ACTIVATION_ADDITIONS,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT,
} from '../assets/js/public-recipe-current-authority.js';
import {PUBLIC_RECIPE_ZH_TW_NAME_AUDIT} from '../assets/js/public-recipe-name-audit-v0425.js';
import {PUBLIC_RECIPE_PROVENANCE,REVIEWED_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-provenance.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.resolve(__dirname,'..');
const jsRoot=path.join(root,'assets/js');

function collectJsFiles(directory){
  const out=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())out.push(...collectJsFiles(full));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);
  }
  return out;
}
function rel(file){return path.relative(root,file).replaceAll('\\','/');}
function importTargets(source){
  const out=[];
  const pattern=/(?:from\s+|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
  for(const match of source.matchAll(pattern))out.push(match[1]);
  return out;
}

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');
assert.equal(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-14-b');
assert.equal(PUBLIC_RECIPE_MASTER.length,78,'current recipe master must contain exactly 78 recipes');
assert.equal(new Set(PUBLIC_RECIPE_MASTER.map(row=>String(row.recipe_id))).size,78,'recipe IDs must be unique');
assert.equal(new Set(PUBLIC_RECIPE_MASTER.map(row=>String(row.recipe_name))).size,78,'current zh-TW recipe names must be unique');
assert.equal(PUBLIC_RECIPE_MASTER.filter(row=>row.source_type==='migration_baseline').length,0,'migration baseline may never remain current name authority');
assert.equal(PUBLIC_RECIPE_MASTER.filter(row=>row.verification_status==='REVIEW_REQUIRED').length,0,'current 78-name catalog may not contain REVIEW_REQUIRED names');

const categories=PUBLIC_RECIPE_MASTER.reduce((out,row)=>{out[row.category]=(out[row.category]||0)+1;return out;},{});
assert.deepEqual(categories,{'咖哩／濃湯':25,'沙拉':26,'甜點／飲料':27});

const predecessorBaseline=PREDECESSOR_RECIPE_MASTER.filter(row=>row.source_type==='migration_baseline');
assert.equal(predecessorBaseline.length,38,'predecessor must expose exactly the 38 historical baseline names that v0.4.25 audited');
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.length,38,'v0.4.25 current-name audit must cover exactly 38 rows');
const predecessorBaselineIds=new Set(predecessorBaseline.map(row=>String(row.recipe_id)));
const auditIds=new Set(PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.map(row=>String(row.recipe_id)));
assert.deepEqual([...auditIds].sort(),[...predecessorBaselineIds].sort(),'the 38-name audit must exactly cover every predecessor migration-baseline recipe');
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,34,'screenshot-confirmed predecessor name overrides must remain 34');
assert.equal(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.length,2,'current activation additions must remain 2');
assert.equal(PREDECESSOR_RECIPE_MASTER.filter(row=>row.source_type==='current_reference_crosscheck').length,4,'base current-reference rows must remain 4');
assert.equal(38+34+2+4,78,'current-name evidence partition must cover all 78 recipes');

const currentSourceTypeCounts={};
for(const row of PUBLIC_RECIPE_MASTER){
  assert.ok(String(row.recipe_id||'').trim(),`recipe_id missing`);
  assert.ok(String(row.recipe_name||'').trim(),`recipe_name missing:${row.recipe_id}`);
  assert.ok(String(row.source_type||'').trim(),`source_type missing:${row.recipe_id}`);
  assert.ok(String(row.source_name||'').trim(),`source_name missing:${row.recipe_id}`);
  assert.ok(String(row.source_ref||'').trim(),`source_ref missing:${row.recipe_id}`);
  assert.ok(String(row.verified_at||'').trim(),`verified_at missing:${row.recipe_id}`);
  currentSourceTypeCounts[row.source_type]=(currentSourceTypeCounts[row.source_type]||0)+1;
}
assert.deepEqual(currentSourceTypeCounts,{current_reference_crosscheck:40,game_screenshot_verified:35,game_screenshot_reference_crosscheck:3});
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.recipe_count,78);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.audited_migration_baseline_count,38);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.migration_baseline_current_authority_count,0);

assert.equal(REVIEWED_RECIPE_MASTER_VERSION,PUBLIC_RECIPE_MASTER_VERSION,'provenance must review the current recipe master');
assert.equal(PUBLIC_RECIPE_PROVENANCE.length,78,'provenance must cover all current recipes');
const provenanceById=new Map(PUBLIC_RECIPE_PROVENANCE.map(row=>[String(row.recipe_id),row]));
assert.equal(provenanceById.size,78,'provenance recipe IDs must be unique');
for(const recipe of PUBLIC_RECIPE_MASTER){
  const provenance=provenanceById.get(String(recipe.recipe_id));
  assert.ok(provenance,`missing current provenance:${recipe.recipe_id}`);
  assert.equal(provenance.recipe_name_zh_tw,recipe.recipe_name,`provenance name drift:${recipe.recipe_id}`);
  assert.equal(provenance.name_source_type,recipe.source_type,`provenance source type drift:${recipe.recipe_id}`);
  assert.equal(provenance.name_source_name,recipe.source_name,`provenance source name drift:${recipe.recipe_id}`);
  assert.equal(provenance.name_source_ref,recipe.source_ref,`provenance source ref drift:${recipe.recipe_id}`);
  assert.equal(provenance.name_observed_at,recipe.verified_at,`provenance verified_at drift:${recipe.recipe_id}`);
}

const forbidden=[];
for(const file of collectJsFiles(jsRoot)){
  const relative=rel(file);
  const source=fs.readFileSync(file,'utf8');
  const targets=importTargets(source);
  for(const target of targets){
    if(target==='./public-recipe-master.js'&&relative!=='assets/js/public-recipe-canonical-authority.js'){
      forbidden.push({file:relative,target,reason:'RAW_BASE_AUTHORITY_IMPORT'});
    }
    if(target==='./public-recipe-canonical-authority.js'&&relative!=='assets/js/public-recipe-current-authority.js'){
      forbidden.push({file:relative,target,reason:'PREDECESSOR_AUTHORITY_IMPORT'});
    }
  }
}
assert.deepEqual(forbidden,[],`runtime recipe consumers must use current authority only: ${JSON.stringify(forbidden)}`);

const syncSource=fs.readFileSync(path.join(jsRoot,'public-recipe-master-sync.js'),'utf8');
const migrationsSource=fs.readFileSync(path.join(jsRoot,'migrations.js'),'utf8');
assert.match(syncSource,/from ['"]\.\/public-recipe-current-authority\.js['"]/,'recipe master sync must import current authority');
assert.match(migrationsSource,/PUBLIC_RECIPE_MASTER_VERSION} from ['"]\.\/public-recipe-current-authority\.js['"]/,'migrations must compare against current recipe authority version');
assert.match(migrationsSource,/syncPublicRecipeMaster\(db\)/,'migration path must run controlled recipe sync');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04251_RECIPE_CURRENT_AUTHORITY_LOCK',
  current_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  current_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  recipe_count:PUBLIC_RECIPE_MASTER.length,
  category_counts:categories,
  evidence_partition:{audited_predecessor_baseline:38,screenshot_name_overrides:34,activation_additions:2,base_current_reference_crosschecks:4,total:78},
  current_source_type_counts:currentSourceTypeCounts,
  migration_baseline_current_authority_count:0,
  duplicate_recipe_ids:0,
  duplicate_recipe_names:0,
  review_required_current_names:0,
  current_provenance_count:PUBLIC_RECIPE_PROVENANCE.length,
  forbidden_runtime_old_authority_imports:forbidden.length,
  sync_uses_current_authority:true,
  migrations_use_current_authority:true,
},null,2));
