import {
  PUBLIC_RECIPE_MASTER as PREVIOUS_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES as PREVIOUS_PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION as PREVIOUS_NAME_VERSION,
  PUBLIC_RECIPE_BASE_MASTER_VERSION,
  PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,
} from './public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_NAME_AUDIT_VERSION,
  PUBLIC_RECIPE_ZH_TW_NAME_AUDIT,
  auditedRecipeNameById,
} from './public-recipe-name-audit-v0425.js';

export const PUBLIC_RECIPE_CANONICAL_NAME_VERSION='public-recipe-zh-tw-names-2026-08-14-b';
export const PUBLIC_RECIPE_MASTER_VERSION='public-recipe-master-2026-08-14-c';
export const PUBLIC_RECIPE_PREVIOUS_NAME_VERSION=PREVIOUS_NAME_VERSION;
export {PUBLIC_RECIPE_BASE_MASTER_VERSION,PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,PUBLIC_RECIPE_NAME_AUDIT_VERSION};

const auditById=auditedRecipeNameById();
const previousById=new Map(PREVIOUS_PUBLIC_RECIPE_MASTER.map(row=>[String(row.recipe_id),row]));

export const PUBLIC_RECIPE_MASTER=Object.freeze(PREVIOUS_PUBLIC_RECIPE_MASTER.map(recipe=>{
  const audit=auditById.get(String(recipe.recipe_id));
  if(!audit){
    if(recipe.source_type==='migration_baseline')throw new Error(`recipe_name_authority_migration_baseline_forbidden:${recipe.recipe_id}`);
    return Object.freeze({...recipe,data_version:PUBLIC_RECIPE_MASTER_VERSION,name_contract_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION});
  }
  return Object.freeze({
    ...recipe,
    recipe_name:audit.canonical_name_zh_tw,
    source_type:audit.source_type,
    source_name:audit.source_name,
    source_ref:audit.source_ref,
    verified_at:audit.verified_at,
    verification_status:'CURRENT_ZH_TW_NAME_AUDITED',
    name_contract_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
    name_audit_version:PUBLIC_RECIPE_NAME_AUDIT_VERSION,
    data_version:PUBLIC_RECIPE_MASTER_VERSION,
  });
}));

if(PUBLIC_RECIPE_MASTER.length!==78)throw new Error(`recipe_name_authority_expected_78_got_${PUBLIC_RECIPE_MASTER.length}`);
if(PUBLIC_RECIPE_MASTER.some(row=>row.source_type==='migration_baseline'))throw new Error('recipe_name_authority_migration_baseline_survived');
if(PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.length!==38)throw new Error(`recipe_name_audit_expected_38_got_${PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.length}`);

const currentNameById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[String(row.recipe_id),String(row.recipe_name)]));
const aliasMap=new Map();
const addAlias=alias=>{
  const canonical=currentNameById.get(String(alias.recipe_id));
  if(!canonical||!alias.alias_value||String(alias.alias_value)===canonical)return;
  const key=`${alias.alias_type||'legacy_recipe_name'}|${alias.alias_value}`;
  aliasMap.set(key,Object.freeze({...alias,data_version:PUBLIC_RECIPE_MASTER_VERSION}));
};
for(const alias of PREVIOUS_PUBLIC_RECIPE_ALIASES)addAlias(alias);
for(const audit of PUBLIC_RECIPE_ZH_TW_NAME_AUDIT){
  if(!audit.legacy_public_name||audit.legacy_public_name===audit.canonical_name_zh_tw)continue;
  addAlias(Object.freeze({
    alias_value:audit.legacy_public_name,
    alias_type:'legacy_recipe_name',
    recipe_id:audit.recipe_id,
    confidence:1,
    is_auto_replace_safe:true,
    source_type:'historical_migration_name_compatibility',
    source_ref:`internal:${PUBLIC_RECIPE_NAME_AUDIT_VERSION}`,
    data_version:PUBLIC_RECIPE_MASTER_VERSION,
  }));
}
export const PUBLIC_RECIPE_ALIASES=Object.freeze([...aliasMap.values()]);

export const PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT=Object.freeze({
  audit_version:PUBLIC_RECIPE_NAME_AUDIT_VERSION,
  current_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  master_version:PUBLIC_RECIPE_MASTER_VERSION,
  recipe_count:PUBLIC_RECIPE_MASTER.length,
  audited_migration_baseline_count:PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.length,
  migration_baseline_current_authority_count:PUBLIC_RECIPE_MASTER.filter(row=>row.source_type==='migration_baseline').length,
  policy:'MIGRATION_BASELINE_HISTORY_ONLY_CURRENT_ZH_TW_NAME_REQUIRES_AUDITED_AUTHORITY',
  formulas_mutated:false,
  player_rows_mutated:false,
});

export function currentRecipeNameRow(recipeId){return PUBLIC_RECIPE_MASTER.find(row=>String(row.recipe_id)===String(recipeId))||previousById.get(String(recipeId))||null;}
