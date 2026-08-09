export const RECIPE_STRATEGY_ENGINE_VERSION='recipe-strategy-2026-08-09-a';

const VERIFIED_FORMULA_EVIDENCE=new Set([
  'OFFICIAL_VERIFIED',
  'GAME_SCREENSHOT_VERIFIED',
  'REFERENCE_VERIFIED',
]);

function number(value,fallback=0){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
}
function integer(value,fallback=0){
  const parsed=number(value,fallback);
  return Number.isInteger(parsed)?parsed:Math.trunc(parsed);
}
function normalizeCategory(value){
  const normalized=String(value??'').normalize('NFKC').trim().replaceAll('/','／');
  return normalized==='點心／飲料'?'甜點／飲料':normalized;
}
function stableEntries(value={}){return Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'zh-Hant'));}
function fnv1a(value){
  let hash=2166136261;
  for(const byte of new TextEncoder().encode(value)){
    hash^=byte;
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
}
function deterministicFingerprint(payload){return `recipe_strategy:${fnv1a(JSON.stringify(payload))}`;}

function normalizeSafeReserve(input){
  if(Array.isArray(input)){
    return new Map(input.map(row=>[String(row.ingredient_name||''),Math.max(0,integer(row.safe_reserve,0))]));
  }
  return new Map(stableEntries(input||{}).map(([name,value])=>[String(name),Math.max(0,integer(value,0))]));
}
function normalizeInventory(input){
  return new Map((input||[]).map(row=>[String(row.ingredient_name||''),Math.max(0,integer(row.quantity,0))]));
}
function normalizeStates(input){
  return new Map((input||[]).map(row=>[String(row.recipe_id||''),{
    unlocked:Number(row.unlocked||0)===1,
    player_record_exists:Number(row.player_record_exists||0)===1,
    player_recipe_id:row.player_recipe_id||null,
  }]));
}
function normalizeProvenance(input){return new Map((input||[]).map(row=>[String(row.recipe_id||''),row]));}
function groupRecipeIngredients(input){
  const map=new Map();
  for(const row of input||[]){
    const id=String(row.recipe_id||'');
    if(!map.has(id))map.set(id,[]);
    map.get(id).push({ingredient_name:String(row.ingredient_name||''),quantity:Math.max(0,integer(row.quantity,0))});
  }
  for(const rows of map.values())rows.sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
  return map;
}

function ingredientReadiness({unlocked,rawShortage,strategyShortage,missingKinds,nearShortageMax,nearMissingKindsMax}){
  if(rawShortage===0&&strategyShortage===0)return unlocked?'COOK_NOW_UNLOCKED':'UNLOCK_CANDIDATE_READY';
  if(rawShortage===0&&strategyShortage>0)return 'BLOCKED_SAFE_RESERVE';
  if(rawShortage<=nearShortageMax&&missingKinds<=nearMissingKindsMax){
    return unlocked?'NEAR_COOK_UNLOCKED':'UNLOCK_CANDIDATE_NEAR';
  }
  return 'BLOCKED_INGREDIENT_SHORTAGE';
}

function candidateStatus({ingredientStatus,potFit,provenanceVerified,requireVerifiedMaster}){
  if(requireVerifiedMaster&&!provenanceVerified)return 'REVIEW_PROVENANCE';
  if(potFit===null)return 'REVIEW_MISSING_INPUT';
  if(potFit===false)return 'BLOCKED_POT_CAPACITY';
  return ingredientStatus;
}
function hardConstraintStatus(status){
  if(status.startsWith('REVIEW_'))return 'REVIEW';
  if(status==='COOK_NOW_UNLOCKED'||status==='UNLOCK_CANDIDATE_READY')return 'PASS';
  return 'FAIL';
}

const STATUS_RANK=Object.freeze({
  UNLOCK_CANDIDATE_READY:0,
  COOK_NOW_UNLOCKED:1,
  UNLOCK_CANDIDATE_NEAR:2,
  NEAR_COOK_UNLOCKED:3,
  BLOCKED_SAFE_RESERVE:4,
  BLOCKED_INGREDIENT_SHORTAGE:5,
  BLOCKED_POT_CAPACITY:6,
  REVIEW_PROVENANCE:7,
  REVIEW_MISSING_INPUT:8,
});

export function sortRecipeStrategyCandidates(candidates,mode='unlock_recipes'){
  const data=[...(candidates||[])];
  return data.sort((a,b)=>{
    if(mode==='cook_now'){
      const readyA=a.candidate_status==='COOK_NOW_UNLOCKED'?0:1;
      const readyB=b.candidate_status==='COOK_NOW_UNLOCKED'?0:1;
      if(readyA!==readyB)return readyA-readyB;
    }else if(mode==='ingredient_stockpile'){
      if(a.total_strategy_shortage!==b.total_strategy_shortage)return a.total_strategy_shortage-b.total_strategy_shortage;
      if(a.missing_kinds!==b.missing_kinds)return a.missing_kinds-b.missing_kinds;
    }
    const rankA=STATUS_RANK[a.candidate_status]??99;
    const rankB=STATUS_RANK[b.candidate_status]??99;
    if(rankA!==rankB)return rankA-rankB;
    if(a.total_strategy_shortage!==b.total_strategy_shortage)return a.total_strategy_shortage-b.total_strategy_shortage;
    if(a.missing_kinds!==b.missing_kinds)return a.missing_kinds-b.missing_kinds;
    if(Number(b.base_energy||0)!==Number(a.base_energy||0))return Number(b.base_energy||0)-Number(a.base_energy||0);
    return String(a.recipe_name).localeCompare(String(b.recipe_name),'zh-Hant');
  });
}

export function projectRecipeStrategy({
  recipes=[],
  recipeIngredients=[],
  recipeStates=[],
  inventory=[],
  provenance=[],
  ingredientSafeReserve={},
  potSize=null,
  dishCategory='',
  requireVerifiedMaster=false,
  nearShortageMax=10,
  nearMissingKindsMax=2,
  sortMode='unlock_recipes',
  masterVersion='',
  provenanceVersion='',
}={}){
  const inventoryMap=normalizeInventory(inventory);
  const reserveMap=normalizeSafeReserve(ingredientSafeReserve);
  const stateMap=normalizeStates(recipeStates);
  const provenanceMap=normalizeProvenance(provenance);
  const ingredientsByRecipe=groupRecipeIngredients(recipeIngredients);
  const normalizedDish=normalizeCategory(dishCategory);
  const normalizedPot=potSize===null||potSize===undefined||potSize===''?null:Math.max(0,integer(potSize,0));
  const excluded={non_active_provenance:[],missing_provenance:[],category:[]};
  const candidates=[];

  const sortedRecipes=[...recipes].sort((a,b)=>String(a.recipe_id).localeCompare(String(b.recipe_id)));
  for(const recipe of sortedRecipes){
    const id=String(recipe.recipe_id||'');
    const evidence=provenanceMap.get(id);
    if(!evidence){excluded.missing_provenance.push(id);continue;}
    if(evidence.lifecycle!=='ACTIVE'){excluded.non_active_provenance.push(id);continue;}
    if(normalizedDish&&normalizeCategory(recipe.category)!==normalizedDish){excluded.category.push(id);continue;}

    const state=stateMap.get(id)||{unlocked:false,player_record_exists:false,player_recipe_id:null};
    const requirements=(ingredientsByRecipe.get(id)||[]).map(item=>{
      const required=Math.max(0,integer(item.quantity,0));
      const owned=Math.max(0,integer(inventoryMap.get(item.ingredient_name),0));
      const safeReserve=Math.max(0,integer(reserveMap.get(item.ingredient_name),0));
      const usable=Math.max(0,owned-safeReserve);
      const rawShortage=Math.max(0,required-owned);
      const strategyShortage=Math.max(0,required-usable);
      const reserveBlocked=Math.max(0,strategyShortage-rawShortage);
      return {
        ingredient_name:item.ingredient_name,
        required,
        owned,
        safe_reserve:safeReserve,
        usable,
        raw_shortage:rawShortage,
        strategy_shortage:strategyShortage,
        reserve_blocked:reserveBlocked,
      };
    });
    const totalRawShortage=requirements.reduce((sum,row)=>sum+row.raw_shortage,0);
    const totalStrategyShortage=requirements.reduce((sum,row)=>sum+row.strategy_shortage,0);
    const missingKinds=requirements.filter(row=>row.raw_shortage>0).length;
    const reserveBlockedKinds=requirements.filter(row=>row.reserve_blocked>0).length;
    const ingredientStatus=ingredientReadiness({
      unlocked:state.unlocked,
      rawShortage:totalRawShortage,
      strategyShortage:totalStrategyShortage,
      missingKinds,
      nearShortageMax:Math.max(0,integer(nearShortageMax,10)),
      nearMissingKindsMax:Math.max(0,integer(nearMissingKindsMax,2)),
    });
    const potRequired=Math.max(0,integer(recipe.total_ingredients,requirements.reduce((sum,row)=>sum+row.required,0)));
    const potFit=normalizedPot===null?null:normalizedPot>=potRequired;
    const provenanceVerified=VERIFIED_FORMULA_EVIDENCE.has(evidence.formula_evidence);
    const status=candidateStatus({ingredientStatus,potFit,provenanceVerified,requireVerifiedMaster:Boolean(requireVerifiedMaster)});
    const failedConstraints=[];
    const missingInputs=[];
    if(normalizedPot===null)missingInputs.push('pot_size');
    if(requireVerifiedMaster&&!provenanceVerified)failedConstraints.push('require_verified_master');
    if(potFit===false)failedConstraints.push('pot_capacity_limit');
    if(totalRawShortage>0)failedConstraints.push('ingredient_availability');
    else if(totalStrategyShortage>0)failedConstraints.push('ingredient_safe_reserve');

    candidates.push({
      recipe_id:id,
      recipe_name:recipe.recipe_name,
      category:recipe.category,
      base_energy:recipe.base_energy??null,
      total_ingredients:potRequired,
      unlocked:state.unlocked,
      player_record_exists:state.player_record_exists,
      player_recipe_id:state.player_recipe_id,
      requirements,
      total_raw_shortage:totalRawShortage,
      total_strategy_shortage:totalStrategyShortage,
      missing_kinds:missingKinds,
      reserve_blocked_kinds:reserveBlockedKinds,
      ingredient_status:ingredientStatus,
      pot_capacity:normalizedPot,
      pot_required:potRequired,
      pot_fit:potFit,
      provenance_status:evidence.overall_status||null,
      formula_evidence:evidence.formula_evidence||null,
      lifecycle:evidence.lifecycle,
      candidate_status:status,
      hard_constraint_status:hardConstraintStatus(status),
      failed_constraints:[...new Set(failedConstraints)].sort(),
      missing_inputs:[...new Set(missingInputs)].sort(),
    });
  }

  const fingerprintPayload={
    engine_version:RECIPE_STRATEGY_ENGINE_VERSION,
    master_version:String(masterVersion||''),
    provenance_version:String(provenanceVersion||''),
    dish_category:normalizedDish,
    pot_size:normalizedPot,
    require_verified_master:Boolean(requireVerifiedMaster),
    near_shortage_max:Math.max(0,integer(nearShortageMax,10)),
    near_missing_kinds_max:Math.max(0,integer(nearMissingKindsMax,2)),
    safe_reserve:stableEntries(Object.fromEntries(reserveMap)),
    inventory:[...inventoryMap.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant')),
    states:[...stateMap.entries()].map(([id,state])=>[id,state.unlocked,state.player_record_exists,state.player_recipe_id]).sort(([a],[b])=>a.localeCompare(b)),
    active_recipe_ids:candidates.map(row=>row.recipe_id).sort(),
  };
  const sorted=sortRecipeStrategyCandidates(candidates,sortMode);
  const statusCounts={};
  const hardCounts={};
  for(const row of sorted){
    statusCounts[row.candidate_status]=(statusCounts[row.candidate_status]||0)+1;
    hardCounts[row.hard_constraint_status]=(hardCounts[row.hard_constraint_status]||0)+1;
  }
  return {
    schema:'pokemon-sleep-recipe-strategy-projection/1.0',
    engine_version:RECIPE_STRATEGY_ENGINE_VERSION,
    master_version:String(masterVersion||''),
    provenance_version:String(provenanceVersion||''),
    input_fingerprint:deterministicFingerprint(fingerprintPayload),
    context:{
      dish_category:normalizedDish||null,
      pot_size:normalizedPot,
      require_verified_master:Boolean(requireVerifiedMaster),
      near_shortage_max:Math.max(0,integer(nearShortageMax,10)),
      near_missing_kinds_max:Math.max(0,integer(nearMissingKindsMax,2)),
    },
    summary:{
      candidate_count:sorted.length,
      status_counts:statusCounts,
      hard_constraint_counts:hardCounts,
      excluded_counts:{
        missing_provenance:excluded.missing_provenance.length,
        non_active_provenance:excluded.non_active_provenance.length,
        category:excluded.category.length,
      },
    },
    excluded,
    candidates:sorted,
    player_data_write:false,
  };
}
