import {applyRecipeAttemptFeedback,recipeAttemptFeedbackFingerprintRows} from './recipe-attempt-feedback.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from './public-ingredient-identity.js';

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

// Goal-profile JSON may contain fractional/negative safe reserves. Do not
// silently truncate a policy protecting the player's ingredients into zero.
// A null marker is a read-side HOLD; only required ingredients are affected.
function normalizeSafeReserve(input){
  const entries=Array.isArray(input)
    ?input.map(row=>[String(row?.ingredient_name||''),row?.safe_reserve])
    :stableEntries(input||{});
  return new Map(entries.map(([name,value])=>[String(name),verifiedInventoryQuantity(value)]));
}
// SQLite INTEGER affinity is not a guarantee: a corrupted/legacy row can be
// REAL or TEXT. Never truncate a fractional observed stock into cookable units.
// Null is a private read-side invalid marker, not an inferred zero.
function verifiedInventoryQuantity(value){
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
  if(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)){
    const parsed=Number(value);
    return Number.isSafeInteger(parsed)?parsed:null;
  }
  return null;
}
function normalizeInventory(input){
  return new Map((input||[]).map(row=>[String(row.ingredient_name||''),verifiedInventoryQuantity(row.quantity)]));
}
// A present SQLite player unlock flag must be canonical 0/1. Numeric coercion
// of malformed legacy values must not authorize actionable recipe advice.
function normalizeStates(input){
  const states=new Map((input||[]).map(row=>{
    const flag=row.unlocked;
    const unlockedVerified=flag===0||flag===1||flag==='0'||flag==='1';
    return [String(row.recipe_id||''),{
      unlocked:flag===1||flag==='1',
      unlocked_verified:unlockedVerified,
      player_record_exists:Number(row.player_record_exists||0)===1,
      player_recipe_id:row.player_recipe_id||null,
      player_identity_verified:true,
    }];
  }));
  // The public recipe catalog view ranks matches per public recipe, not per
  // player-owned row. Exact/name/legacy alias paths can reuse one player
  // recipe ID for different public dishes. Never treat both as unlocked.
  const playerOwners=new Map();
  for(const [recipeId,state] of states){
    if(!state.player_record_exists||!state.player_recipe_id)continue;
    const playerId=String(state.player_recipe_id);
    const prior=playerOwners.get(playerId);
    if(prior&&prior!==recipeId){
      states.get(prior).player_identity_verified=false;
      state.player_identity_verified=false;
    }else playerOwners.set(playerId,recipeId);
  }
  return states;
}
function normalizeProvenance(input){return new Map((input||[]).map(row=>[String(row.recipe_id||''),row]));}
// Immutable public formula parity is required before local SQLite can yield
// actionable advice. Matching totals alone do not certify ingredient identity.
function matchesCanonicalFormula(recipe,observed,canonical){
  if(!canonical||!Array.isArray(canonical.ingredients)||
    recipe.total_ingredients!==canonical.total_ingredients||
    normalizeCategory(recipe.category)!==normalizeCategory(canonical.category)||
    // A stale local display name can identify the wrong dish despite matching
    // recipe ID, ingredient quantities, total and energy. Keep read-side HOLD.
    String(recipe.recipe_name??'').normalize('NFKC').trim()!==
      String(canonical.recipe_name??'').normalize('NFKC').trim()||
    // Base energy breaks otherwise equal recommendation ties. A stale local
    // energy value cannot inherit immutable public recipe authority.
    recipe.base_energy!==canonical.base_energy)return false;
  const canonicalRows=canonical.ingredients.map(item=>[
    String(item.ingredient_name||''),item.quantity,
  ]).sort(([a],[b])=>a.localeCompare(b,'zh-Hant'));
  const localRows=observed.map(item=>[item.ingredient_name,item.quantity])
    .sort(([a],[b])=>a.localeCompare(b,'zh-Hant'));
  return canonicalRows.length===localRows.length&&canonicalRows.every(([name,quantity],i)=>
    name===localRows[i][0]&&Number.isSafeInteger(quantity)&&quantity>0&&quantity===localRows[i][1]);
}
function groupRecipeIngredients(input){
  const map=new Map();
  for(const row of input||[]){
    const id=String(row.recipe_id||'');
    if(!map.has(id))map.set(id,[]);
    // Preserve validity before normalizing. Truncating a REAL or decimal TEXT
    // recipe requirement could turn an invalid formula into a READY candidate.
    const verifiedQuantity=verifiedInventoryQuantity(row.quantity);
    map.get(id).push({
      ingredient_name:String(row.ingredient_name||''),
      quantity:verifiedQuantity??0,
      quantity_verified:verifiedQuantity!==null&&verifiedQuantity>0,
    });
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

function candidateStatus({ingredientStatus,potFit,provenanceVerified,requireVerifiedMaster,requirementsVerified,inventoryVerified,reserveVerified,stateVerified}){
  if(requireVerifiedMaster&&!provenanceVerified)return 'REVIEW_PROVENANCE';
  // G6.2: neither a partial formula nor malformed observed stock can certify
  // an actionable recipe. An absent stock row retains existing zero-stock UX.
  if(!requirementsVerified||!inventoryVerified||!reserveVerified||!stateVerified)return 'REVIEW_MISSING_INPUT';
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
    const pausedA=a?.recommendation_paused===true?1:0;
    const pausedB=b?.recommendation_paused===true?1:0;
    if(pausedA!==pausedB)return pausedA-pausedB;
    // G6.2: a formula/provenance REVIEW has no trusted ingredient shortage.
    // In stockpile mode its synthetic zero must not outrank verified advice;
    // preserve the player's explicit pause priority above this safety rank.
    const reviewA=a?.hard_constraint_status==='REVIEW'?1:0;
    const reviewB=b?.hard_constraint_status==='REVIEW'?1:0;
    if(reviewA!==reviewB)return reviewA-reviewB;
    // G6.2: player-flagged references are a fallback, not a first choice, when
    // an unflagged PASS recipe exists, even across READY and COOK_NOW statuses.
    // Pause, REVIEW and hard constraints still take precedence.
    if(a?.hard_constraint_status==='PASS'&&b?.hard_constraint_status==='PASS'){
      const suspectA=a?.reference_maybe_wrong===true?1:0,suspectB=b?.reference_maybe_wrong===true?1:0;
      if(suspectA!==suspectB)return suspectA-suspectB;
    }
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
  authoritativeRecipes=null,
  recipeStates=[],
  inventory=[],
  provenance=[],
  recipeFeedback=[],
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
  const authoritativeMap=Array.isArray(authoritativeRecipes)
    ?new Map(authoritativeRecipes.map(row=>[String(row.recipe_id||''),row])):null;
  const normalizedDish=normalizeCategory(dishCategory);
  // G6.2: weekly/player pot capacity is a hard cooking constraint. A REAL,
  // malformed TEXT or negative value must not be truncated/clamped into a
  // cookable integer; withhold strategy advice until authority is reviewed.
  const verifiedPot=verifiedInventoryQuantity(potSize);
  const normalizedPot=verifiedPot!==null&&verifiedPot>0?verifiedPot:null;
  const excluded={non_active_provenance:[],missing_provenance:[],category:[]};
  const candidates=[];

  const sortedRecipes=[...recipes].sort((a,b)=>String(a.recipe_id).localeCompare(String(b.recipe_id)));
  // Preserve the exact SQLite master total for fingerprinting. The display
  // pot_required is truncated for legacy output compatibility and cannot
  // distinguish a malformed REAL 7.5 from a verified INTEGER 7.
  const rawRecipeTotals=new Map(sortedRecipes.map(recipe=>[String(recipe.recipe_id||''),recipe.total_ingredients]));
  for(const recipe of sortedRecipes){
    const id=String(recipe.recipe_id||'');
    const evidence=provenanceMap.get(id);
    if(!evidence){excluded.missing_provenance.push(id);continue;}
    if(evidence.lifecycle!=='ACTIVE'){excluded.non_active_provenance.push(id);continue;}
    if(normalizedDish&&normalizeCategory(recipe.category)!==normalizedDish){excluded.category.push(id);continue;}

    const state=stateMap.get(id)||{unlocked:false,unlocked_verified:true,player_record_exists:false,player_recipe_id:null};
    const requirements=(ingredientsByRecipe.get(id)||[]).map(item=>{
      const required=item.quantity;
      const quantityVerified=item.quantity_verified===true;
      const owned=Math.max(0,integer(inventoryMap.get(item.ingredient_name),0));
      const safeReserve=Math.max(0,integer(reserveMap.get(item.ingredient_name),0));
      const usable=Math.max(0,owned-safeReserve);
      const rawShortage=Math.max(0,required-owned);
      const strategyShortage=Math.max(0,required-usable);
      const reserveBlocked=Math.max(0,strategyShortage-rawShortage);
      return {
        ingredient_name:item.ingredient_name,
        required,
        quantity_verified:quantityVerified,
        owned,
        safe_reserve:safeReserve,
        usable,
        raw_shortage:rawShortage,
        strategy_shortage:strategyShortage,
        reserve_blocked:reserveBlocked,
      };
    });
    // An observed but invalid SQLite quantity is not verified inventory.
    // Scope this HOLD to ingredients required by this recipe; unrelated rows
    // cannot suppress an otherwise verified candidate.
    const inventoryVerified=requirements.every(row=>!inventoryMap.has(row.ingredient_name)
      ||inventoryMap.get(row.ingredient_name)!==null);
    // Persisted goal policies are not guaranteed valid just because a write
    // form normally validates them. A required invalid reserve must HOLD.
    const reserveVerified=requirements.every(row=>!reserveMap.has(row.ingredient_name)
      ||reserveMap.get(row.ingredient_name)!==null);
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
    // The trusted per-recipe total is independent of the joined ingredient rows.
    // A missing join row previously understated shortages and returned READY.
    const observedTotal=requirements.reduce((sum,row)=>sum+row.required,0);
    const expectedTotal=recipe.total_ingredients;
    const authorityFormulaVerified=authoritativeMap===null||matchesCanonicalFormula(
      recipe,ingredientsByRecipe.get(id)||[],authoritativeMap.get(id));
    const requirementsVerified=Number.isSafeInteger(expectedTotal)&&expectedTotal>0
      &&requirements.length>0
      // G6.2: a matching ingredient sum cannot verify an unknown/legacy-alias
      // ingredient identity; unlike a canonical name, it may not be cookable.
      &&requirements.every(row=>row.ingredient_name
        &&PUBLIC_INGREDIENT_CANONICAL_NAMES.includes(row.ingredient_name)
        &&row.quantity_verified===true
        &&Number.isSafeInteger(row.required)&&row.required>0)
      &&Number.isSafeInteger(observedTotal)&&observedTotal===expectedTotal
      &&authorityFormulaVerified;
    const potRequired=Math.max(0,integer(expectedTotal,observedTotal));
    const potFit=normalizedPot===null?null:normalizedPot>=potRequired;
    const provenanceVerified=VERIFIED_FORMULA_EVIDENCE.has(evidence.formula_evidence);
    const status=candidateStatus({ingredientStatus,potFit,provenanceVerified,requireVerifiedMaster:Boolean(requireVerifiedMaster),requirementsVerified,inventoryVerified,reserveVerified,stateVerified:state.unlocked_verified&&state.player_identity_verified});
    const failedConstraints=[];
    const missingInputs=[];
    if(normalizedPot===null)missingInputs.push('pot_size');
    if(!requirementsVerified)missingInputs.push('recipe_ingredient_requirements');
    if(!authorityFormulaVerified)missingInputs.push('recipe_master_authority');
    if(!inventoryVerified)missingInputs.push('ingredient_inventory');
    if(!reserveVerified)missingInputs.push('ingredient_safe_reserve');
    if(!state.unlocked_verified)missingInputs.push('recipe_unlock_state');
    if(!state.player_identity_verified)missingInputs.push('recipe_player_identity');
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
    // The ranking mode changes candidate ordering independently of source rows.
    // Evidence fingerprints must not alias two different recommendation orders.
    sort_mode:String(sortMode),
    // Ranking policy changes must invalidate cached strategy evidence even
    // when the same recipe, inventory, goal and sort-mode inputs are reused.
    ranking_policy:'review-and-cross-status-suspect-fallback-v1',
    pot_size:normalizedPot,
    require_verified_master:Boolean(requireVerifiedMaster),
    near_shortage_max:Math.max(0,integer(nearShortageMax,10)),
    near_missing_kinds_max:Math.max(0,integer(nearMissingKindsMax,2)),
    safe_reserve:stableEntries(Object.fromEntries(reserveMap)),
    inventory:[...inventoryMap.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant')),
    states:[...stateMap.entries()].map(([id,state])=>[id,state.unlocked,state.unlocked_verified,state.player_record_exists,state.player_recipe_id,state.player_identity_verified]).sort(([a],[b])=>a.localeCompare(b)),
    active_recipe_ids:candidates.map(row=>row.recipe_id).sort(),
    // G6.2: a stale/corrupt local recipe formula or provenance row can change
    // the actionable candidate while declared master versions remain unchanged.
    // Bind actual sorted source evidence, not only the active recipe IDs.
    recipe_authority:candidates.map(row=>[
      row.recipe_id,row.recipe_name??null,row.category??null,row.base_energy,
      row.total_ingredients,rawRecipeTotals.get(row.recipe_id)??null,
      row.requirements.map(item=>[item.ingredient_name,item.required,item.quantity_verified]),
      row.provenance_status,row.formula_evidence,row.lifecycle,
    ]),
    // Canonical authority drift invalidates cached evidence even if local
    // SQLite rows and the declared public master version remain unchanged.
    canonical_recipe_authority:authoritativeMap===null?null:candidates.map(row=>{
      const canonical=authoritativeMap.get(row.recipe_id);
      return [row.recipe_id,canonical?.recipe_name??null,canonical?.category??null,canonical?.total_ingredients??null,
        // #824: the immutable energy is an actionable tie-breaker and #823
        // rejects local/canonical drift. Bind the canonical value too so a
        // source-only change cannot reuse READY evidence for a REVIEW result.
        canonical?.base_energy??null,
        Array.isArray(canonical?.ingredients)?canonical.ingredients.map(item=>[
          item.ingredient_name,item.quantity,
        ]).sort(([a],[b])=>String(a).localeCompare(String(b),'zh-Hant')):null];
    }),
    recipe_feedback:recipeAttemptFeedbackFingerprintRows(recipeFeedback),
  };
  const candidatesWithFeedback=applyRecipeAttemptFeedback(candidates,recipeFeedback);
  const sorted=sortRecipeStrategyCandidates(candidatesWithFeedback,sortMode);
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
