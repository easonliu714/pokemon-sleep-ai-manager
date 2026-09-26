export const PERSONAL_RECIPE_AUTHORITY_VERSION='g51-personal-recipe-authority-2026-09-26-b';
export const PLAYER_RECIPE_SOURCE='player_manual';

const text=value=>String(value??'').trim();
const integer=(value,label,{min=0,nullable=false}={})=>{
  if(nullable&&(value===null||value===undefined||value===''))return null;
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<min)throw new Error(`${label} must be an integer >= ${min}`);
  return parsed;
};

export function normalizePersonalRecipeIngredients(input=[]){
  if(!Array.isArray(input))throw new Error('ingredients must be an array');
  const merged=new Map();
  for(const row of input){
    const ingredient_name=text(row?.ingredient_name);
    if(!ingredient_name)throw new Error('ingredient_name is required');
    const quantity=integer(row?.quantity,'ingredient quantity',{min:1});
    merged.set(ingredient_name,(merged.get(ingredient_name)||0)+quantity);
  }
  return Object.freeze([...merged.entries()]
    .sort(([a],[b])=>a.localeCompare(b,'zh-Hant'))
    .map(([ingredient_name,quantity])=>Object.freeze({ingredient_name,quantity})));
}

export function totalPersonalRecipeIngredients(ingredients=[]){
  return normalizePersonalRecipeIngredients(ingredients).reduce((sum,row)=>sum+row.quantity,0);
}

export function normalizePersonalRecipeDraft(input={}){
  const recipe_id=text(input.recipe_id);
  const category=text(input.category);
  const recipe_name=text(input.recipe_name);
  if(!recipe_id)throw new Error('recipe_id is required');
  if(!recipe_id.startsWith('player:'))throw new Error('personal recipe_id must use player: namespace');
  if(!category)throw new Error('category is required');
  if(!recipe_name)throw new Error('recipe_name is required');
  const ingredients=normalizePersonalRecipeIngredients(input.ingredients||[]);
  return Object.freeze({
    recipe_id,
    category,
    recipe_name,
    unlocked:input.unlocked?1:0,
    recipe_level:integer(input.recipe_level,'recipe_level',{min:1,nullable:true}),
    current_energy:integer(input.current_energy,'current_energy',{min:0,nullable:true}),
    notes:String(input.notes??''),
    ingredients,
    total_ingredients:ingredients.reduce((sum,row)=>sum+row.quantity,0),
    source:PLAYER_RECIPE_SOURCE,
  });
}

export function assertPlayerOwnedRecipe(row,{publicRecipeIds=[],publicRecipeNames=[]}={}){
  const recipeId=text(row?.recipe_id);
  const recipeName=text(row?.recipe_name);
  if(!recipeId)throw new Error('recipe_id is required');
  if(!recipeId.startsWith('player:'))throw new Error('personal recipe_id must use player: namespace');
  const publicIds=new Set((publicRecipeIds||[]).map(value=>text(value)));
  const publicNames=new Set((publicRecipeNames||[]).map(value=>text(value)));
  if(publicIds.has(recipeId)||publicNames.has(recipeName))throw new Error('public recipe authority identity is read-only from personal recipe CRUD');
  if(row?.source&&text(row.source)!==PLAYER_RECIPE_SOURCE)throw new Error('recipe is not player-owned');
  return true;
}

export function buildPersonalRecipeMutationPlan({action,draft,before=null,publicRecipeIds=[],publicRecipeNames=[]}={}){
  const normalizedAction=text(action).toLowerCase();
  if(!['create','update','delete'].includes(normalizedAction))throw new Error('unsupported personal recipe action');
  const candidate=normalizedAction==='delete'?before:draft;
  assertPlayerOwnedRecipe(candidate,{publicRecipeIds,publicRecipeNames});
  const normalized=normalizedAction==='delete'?null:normalizePersonalRecipeDraft(draft);
  return Object.freeze({
    authority_version:PERSONAL_RECIPE_AUTHORITY_VERSION,
    action:normalizedAction,
    recipe_id:text(candidate.recipe_id),
    before:before?Object.freeze({...before}):null,
    after:normalized,
    requires_snapshot:true,
    requires_single_transaction:true,
    requires_import_audit:true,
    requires_persist_after_commit:true,
    public_master_write_allowed:false,
  });
}
