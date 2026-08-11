export const RECIPE_PORTFOLIO_CONTENTION_VERSION='recipe-portfolio-contention-2026-08-11-a';
export const RECIPE_PORTFOLIO_OBJECTIVES=Object.freeze(['unlock_recipes','preserve_resources','continuous_meals']);

const READY_STATUS=new Set(['COOK_NOW_UNLOCKED','UNLOCK_CANDIDATE_READY']);
const text=value=>String(value??'').normalize('NFKC').trim();
const integer=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):fallback;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function mapFromRows(rows){return new Map((rows||[]).map(row=>[text(row.ingredient_name),integer(row.quantity,0)]).filter(([name])=>name));}
function reserveMap(input){
  if(Array.isArray(input))return new Map(input.map(row=>[text(row.ingredient_name),integer(row.safe_reserve,0)]).filter(([name])=>name));
  return new Map(Object.entries(input||{}).map(([name,value])=>[text(name),integer(value,0)]).filter(([name])=>name));
}
function requirementMap(candidate){return new Map((candidate?.requirements||[]).map(row=>[text(row.ingredient_name),integer(row.required,0)]).filter(([name,qty])=>name&&qty>0));}
function cloneMap(map){return new Map(map);}
function mapObject(map){return Object.fromEntries([...map.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant')));}
function usableTotal(remaining,reserves){let total=0;for(const [name,qty] of remaining)total+=Math.max(0,qty-integer(reserves.get(name),0));return total;}

function canExecute(candidate,remaining,reserves,observedNames){
  const missing=[];
  for(const [name,required] of requirementMap(candidate)){
    if(!observedNames.has(name)){missing.push(name);continue;}
    if(integer(remaining.get(name),0)-required<integer(reserves.get(name),0))return {ok:false,missing_observation:missing,blocked_ingredient:name};
  }
  return {ok:missing.length===0,missing_observation:missing,blocked_ingredient:null};
}
function executableCandidates(candidates,remaining,reserves,observedNames,usedIds,objective){
  return candidates.filter(candidate=>{
    if(objective==='unlock_recipes'&&usedIds.has(candidate.recipe_id))return false;
    return canExecute(candidate,remaining,reserves,observedNames).ok;
  });
}
function requirementIngredientMinimum(candidates,name){
  const values=[];
  for(const candidate of candidates){const qty=requirementMap(candidate).get(name);if(qty>0)values.push(qty);}
  return values.length?Math.min(...values):null;
}
function stepBufferState({name,remaining,reserve,candidates}){
  const usable=Math.max(0,remaining-reserve);
  if(usable===0)return 'EXHAUSTED_USABLE';
  const minimum=requirementIngredientMinimum(candidates,name);
  if(minimum!==null&&usable<minimum)return 'LOW_BUFFER';
  return 'OK';
}
function aggregateConsumed(steps){
  const map=new Map();
  for(const step of steps)for(const row of step.ingredients)map.set(row.ingredient_name,(map.get(row.ingredient_name)||0)+row.consumed);
  return mapObject(map);
}

export function buildRecipeContentionGraph({candidates=[],inventory=[],ingredientSafeReserve={}}={}){
  const physical=mapFromRows(inventory),reserves=reserveMap(ingredientSafeReserve),observed=new Set(physical.keys());
  const eligible=(candidates||[]).filter(row=>row?.hard_constraint_status==='PASS'&&READY_STATUS.has(row?.candidate_status));
  const demanders=new Map();
  for(const candidate of eligible){
    for(const [name,required] of requirementMap(candidate)){
      if(!demanders.has(name))demanders.set(name,[]);
      demanders.get(name).push({recipe_id:candidate.recipe_id,recipe_name:candidate.recipe_name,required,unlocked:Boolean(candidate.unlocked)});
    }
  }
  const ingredients=[...demanders.entries()].map(([ingredient_name,rows])=>{
    rows.sort((a,b)=>String(a.recipe_id).localeCompare(String(b.recipe_id)));
    const owned=physical.get(ingredient_name);
    const observed_here=observed.has(ingredient_name);
    const safe_reserve=integer(reserves.get(ingredient_name),0);
    const usable=observed_here?Math.max(0,integer(owned,0)-safe_reserve):null;
    const aggregate_demand=rows.reduce((sum,row)=>sum+row.required,0);
    return Object.freeze({
      ingredient_name,observed:observed_here,owned:observed_here?integer(owned,0):null,safe_reserve,usable,
      demander_count:rows.length,demanders:Object.freeze(rows),aggregate_demand,
      aggregate_over_subscription:usable===null?null:Math.max(0,aggregate_demand-usable),
      all_demanders_fit_simultaneously:usable===null?null:aggregate_demand<=usable,
    });
  }).sort((a,b)=>(b.demander_count-a.demander_count)||(Number(b.aggregate_over_subscription||0)-Number(a.aggregate_over_subscription||0))||a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
  const edges=[];
  for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++){
    const a=eligible[i],b=eligible[j],aReq=requirementMap(a),bReq=requirementMap(b),shared=[];
    for(const [name,aQty] of aReq){const bQty=bReq.get(name);if(bQty>0)shared.push({ingredient_name:name,a_required:aQty,b_required:bQty});}
    if(shared.length)edges.push(Object.freeze({recipe_a_id:a.recipe_id,recipe_b_id:b.recipe_id,shared_ingredients:Object.freeze(shared.sort((x,y)=>x.ingredient_name.localeCompare(y.ingredient_name,'zh-Hant')))}));
  }
  edges.sort((a,b)=>String(a.recipe_a_id).localeCompare(String(b.recipe_a_id))||String(a.recipe_b_id).localeCompare(String(b.recipe_b_id)));
  const observedIngredients=ingredients.filter(row=>row.observed);
  const allSimultaneous=ingredients.length>0&&ingredients.every(row=>row.observed&&row.all_demanders_fit_simultaneously===true);
  return Object.freeze({
    eligible_recipe_count:eligible.length,
    observed_ingredient_count:observedIngredients.length,
    missing_observation_ingredients:Object.freeze(ingredients.filter(row=>!row.observed).map(row=>row.ingredient_name)),
    ingredients:Object.freeze(ingredients),edges:Object.freeze(edges),
    contention_edge_count:edges.length,
    oversubscribed_ingredient_count:ingredients.filter(row=>Number(row.aggregate_over_subscription||0)>0).length,
    all_individually_ready_simultaneously_executable:allSimultaneous,
  });
}

function applyRecipeStep({candidate,remaining,reserves,observedNames,eligibleCandidates,usedIds,objective,stepIndex}){
  const beforeExecutable=executableCandidates(eligibleCandidates,remaining,reserves,observedNames,usedIds,objective);
  const next=cloneMap(remaining),ingredients=[];
  for(const [name,required] of [...requirementMap(candidate).entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant'))){
    const before=integer(next.get(name),0),after=before-required,reserve=integer(reserves.get(name),0);
    next.set(name,after);
    ingredients.push({ingredient_name:name,before,consumed:required,remaining:after,safe_reserve:reserve,usable_after:Math.max(0,after-reserve)});
  }
  const nextUsed=new Set(usedIds);nextUsed.add(candidate.recipe_id);
  const afterExecutable=executableCandidates(eligibleCandidates,next,reserves,observedNames,nextUsed,objective);
  const afterIds=new Set(afterExecutable.map(row=>row.recipe_id));
  const newlyBlocked=beforeExecutable.filter(row=>row.recipe_id!==candidate.recipe_id&&!afterIds.has(row.recipe_id)).map(row=>row.recipe_id).sort();
  const candidateById=new Map(eligibleCandidates.map(row=>[row.recipe_id,row]));
  for(const row of ingredients)row.buffer_state=stepBufferState({name:row.ingredient_name,remaining:row.remaining,reserve:row.safe_reserve,candidates:eligibleCandidates.filter(item=>item.recipe_id!==candidate.recipe_id)});
  return {
    remaining:next,usedIds:nextUsed,
    step:Object.freeze({
      step:stepIndex,recipe_id:candidate.recipe_id,recipe_name:candidate.recipe_name,unlocked_before:Boolean(candidate.unlocked),
      unlock_opportunity:!candidate.unlocked&&!usedIds.has(candidate.recipe_id),base_energy:candidate.base_energy??null,
      ingredients:Object.freeze(ingredients.map(Object.freeze)),
      newly_blocked_recipe_ids:Object.freeze(newlyBlocked),
      newly_blocked_recipes:Object.freeze(newlyBlocked.map(id=>({recipe_id:id,recipe_name:candidateById.get(id)?.recipe_name||id}))),
      executable_after_count:afterExecutable.length,
    }),
  };
}

function planMetrics(state,{eligibleCandidates,reserves,observedNames,objective,maxMeals}){
  const nextExecutable=executableCandidates(eligibleCandidates,state.remaining,reserves,observedNames,state.usedIds,objective);
  const unlockCount=new Set(state.steps.filter(step=>step.unlock_opportunity).map(step=>step.recipe_id)).size;
  const uniqueCount=new Set(state.steps.map(step=>step.recipe_id)).size;
  const exhausted=new Set(),low=new Set();
  for(const step of state.steps)for(const row of step.ingredients){if(row.buffer_state==='EXHAUSTED_USABLE')exhausted.add(row.ingredient_name);else if(row.buffer_state==='LOW_BUFFER')low.add(row.ingredient_name);}
  const baseEnergy=state.steps.reduce((sum,step)=>sum+(Number(step.base_energy)||0),0);
  return {
    completed_meals:state.steps.length,target_meals:maxMeals,target_reached:state.steps.length>=maxMeals,
    unlock_count:unlockCount,unique_recipe_count:uniqueCount,next_executable_count:nextExecutable.length,
    next_executable_recipe_ids:nextExecutable.map(row=>row.recipe_id).sort(),
    remaining_usable_total:usableTotal(state.remaining,reserves),
    exhausted_ingredient_count:exhausted.size,exhausted_ingredients:[...exhausted].sort((a,b)=>a.localeCompare(b,'zh-Hant')),
    low_buffer_ingredient_count:low.size,low_buffer_ingredients:[...low].sort((a,b)=>a.localeCompare(b,'zh-Hant')),
    base_energy_sum:baseEnergy,
  };
}
function comparePlans(a,b,objective){
  const A=a.metrics,B=b.metrics;
  const desc=(x,y)=>y-x,asc=(x,y)=>x-y;
  let c=0;
  if(objective==='unlock_recipes'){
    c=desc(A.unlock_count,B.unlock_count)||desc(A.unique_recipe_count,B.unique_recipe_count)||desc(A.completed_meals,B.completed_meals)||asc(A.exhausted_ingredient_count,B.exhausted_ingredient_count)||desc(A.remaining_usable_total,B.remaining_usable_total)||desc(A.base_energy_sum,B.base_energy_sum);
  }else if(objective==='preserve_resources'){
    c=desc(A.completed_meals,B.completed_meals)||asc(A.exhausted_ingredient_count,B.exhausted_ingredient_count)||asc(A.low_buffer_ingredient_count,B.low_buffer_ingredient_count)||desc(A.remaining_usable_total,B.remaining_usable_total)||desc(A.next_executable_count,B.next_executable_count)||desc(A.base_energy_sum,B.base_energy_sum);
  }else{
    c=desc(A.completed_meals,B.completed_meals)||desc(A.next_executable_count,B.next_executable_count)||asc(A.exhausted_ingredient_count,B.exhausted_ingredient_count)||asc(A.low_buffer_ingredient_count,B.low_buffer_ingredient_count)||desc(A.remaining_usable_total,B.remaining_usable_total)||desc(A.base_energy_sum,B.base_energy_sum);
  }
  return c||a.sequence_key.localeCompare(b.sequence_key);
}
function decorateState(state,options){
  const sequence_key=state.steps.map(step=>step.recipe_id).join('>');
  return {...state,sequence_key,metrics:planMetrics(state,options)};
}

export function projectRecipePortfolioContention({
  recipeStrategy={candidates:[]},inventory=[],ingredientSafeReserve={},objective='unlock_recipes',maxMeals=3,maxAlternatives=3,beamWidth=64,
}={}){
  const mode=RECIPE_PORTFOLIO_OBJECTIVES.includes(objective)?objective:'unlock_recipes';
  const mealLimit=Math.max(1,Math.min(7,integer(maxMeals,3)||3));
  const alternativeLimit=Math.max(1,Math.min(5,integer(maxAlternatives,3)||3));
  const width=Math.max(alternativeLimit,Math.min(256,integer(beamWidth,64)||64));
  const physical=mapFromRows(inventory),reserves=reserveMap(ingredientSafeReserve),observedNames=new Set(physical.keys());
  const candidates=(recipeStrategy?.candidates||[]).filter(row=>row?.hard_constraint_status==='PASS'&&READY_STATUS.has(row?.candidate_status)).sort((a,b)=>String(a.recipe_id).localeCompare(String(b.recipe_id)));
  const missingByRecipe=candidates.map(candidate=>({recipe_id:candidate.recipe_id,ingredients:[...requirementMap(candidate).keys()].filter(name=>!observedNames.has(name)).sort((a,b)=>a.localeCompare(b,'zh-Hant'))})).filter(row=>row.ingredients.length);
  const safeCandidates=candidates.filter(candidate=>!missingByRecipe.some(row=>row.recipe_id===candidate.recipe_id));
  const contention=buildRecipeContentionGraph({candidates:safeCandidates,inventory,ingredientSafeReserve});
  const inputFingerprint=`recipe_portfolio:${hash(JSON.stringify(stable({version:RECIPE_PORTFOLIO_CONTENTION_VERSION,recipe_strategy_fingerprint:recipeStrategy?.input_fingerprint||null,inventory:[...physical.entries()].sort(),safe_reserve:[...reserves.entries()].sort(),objective:mode,max_meals:mealLimit,max_alternatives:alternativeLimit,beam_width:width,candidate_ids:safeCandidates.map(row=>row.recipe_id)})))}`;
  if(!inventory.length)return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.0',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,projection_status:'INVENTORY_NOT_OBSERVED',input_fingerprint:inputFingerprint,objective:mode,
    context:Object.freeze({max_meals:mealLimit,max_alternatives:alternativeLimit,beam_width:width,inventory_semantics:'NO_ROWS_EXPORTED_NOT_ZERO_CONFIRMED'}),
    summary:Object.freeze({individually_ready_count:candidates.length,simulation_candidate_count:0,alternative_count:0}),contention,alternatives:Object.freeze([]),missing_inventory_observations:Object.freeze(missingByRecipe),
    player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false,
  });
  const options={eligibleCandidates:safeCandidates,reserves,observedNames,objective:mode,maxMeals:mealLimit};
  let frontier=[decorateState({remaining:cloneMap(physical),usedIds:new Set(),steps:[]},options)],all=[];
  for(let depth=0;depth<mealLimit;depth++){
    const expanded=[];
    for(const state of frontier){
      const executable=executableCandidates(safeCandidates,state.remaining,reserves,observedNames,state.usedIds,mode);
      for(const candidate of executable){
        const applied=applyRecipeStep({candidate,remaining:state.remaining,reserves,observedNames,eligibleCandidates:safeCandidates,usedIds:state.usedIds,objective:mode,stepIndex:state.steps.length+1});
        expanded.push(decorateState({remaining:applied.remaining,usedIds:applied.usedIds,steps:[...state.steps,applied.step]},options));
      }
    }
    if(!expanded.length)break;
    expanded.sort((a,b)=>comparePlans(a,b,mode));
    const dedup=[],seen=new Set();
    for(const state of expanded){if(seen.has(state.sequence_key))continue;seen.add(state.sequence_key);dedup.push(state);if(dedup.length>=width)break;}
    frontier=dedup;all.push(...dedup);
  }
  all.sort((a,b)=>comparePlans(a,b,mode));
  const alternatives=[],seenSequences=new Set();
  for(const state of all){
    if(!state.steps.length||seenSequences.has(state.sequence_key))continue;seenSequences.add(state.sequence_key);
    const m=state.metrics;
    alternatives.push(Object.freeze({
      plan_id:`g7:${hash(`${inputFingerprint}:${state.sequence_key}`)}`,sequence_key:state.sequence_key,objective:mode,
      steps:Object.freeze(state.steps),completed_meals:m.completed_meals,target_meals:m.target_meals,target_reached:m.target_reached,
      unlock_count:m.unlock_count,unique_recipe_count:m.unique_recipe_count,next_executable_count:m.next_executable_count,
      next_executable_recipe_ids:Object.freeze(m.next_executable_recipe_ids),remaining_inventory:Object.freeze(mapObject(state.remaining)),aggregate_consumed:Object.freeze(aggregateConsumed(state.steps)),
      remaining_usable_total:m.remaining_usable_total,exhausted_ingredients:Object.freeze(m.exhausted_ingredients),low_buffer_ingredients:Object.freeze(m.low_buffer_ingredients),base_energy_sum:m.base_energy_sum,
      compatible_recipe_ids:Object.freeze([...new Set(state.steps.map(step=>step.recipe_id))]),
      warnings:Object.freeze([...(m.target_reached?[]:['TARGET_MEALS_NOT_REACHED']),...(contention.contention_edge_count?['SHARED_INVENTORY_CONTENTION']:[]),...(m.exhausted_ingredient_count?['USABLE_INVENTORY_EXHAUSTED']:[]),...(m.low_buffer_ingredient_count?['LOW_BUFFER_AFTER_PLAN']:[])]),
    }));
    if(alternatives.length>=alternativeLimit)break;
  }
  return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.0',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,projection_status:'READY',input_fingerprint:inputFingerprint,objective:mode,
    context:Object.freeze({max_meals:mealLimit,max_alternatives:alternativeLimit,beam_width:width,inventory_semantics:'OBSERVED_ROWS_ONLY_COLLECTION_COMPLETENESS_NOT_ASSERTED',safe_reserve:Object.freeze(mapObject(reserves))}),
    summary:Object.freeze({
      individually_ready_count:candidates.length,simulation_candidate_count:safeCandidates.length,
      unlocked_ready_count:safeCandidates.filter(row=>row.unlocked).length,unlock_candidate_ready_count:safeCandidates.filter(row=>!row.unlocked).length,
      missing_inventory_observation_recipe_count:missingByRecipe.length,contention_edge_count:contention.contention_edge_count,oversubscribed_ingredient_count:contention.oversubscribed_ingredient_count,
      all_individually_ready_simultaneously_executable:contention.all_individually_ready_simultaneously_executable,alternative_count:alternatives.length,
    }),
    contention,missing_inventory_observations:Object.freeze(missingByRecipe.map(Object.freeze)),alternatives:Object.freeze(alternatives),
    player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false,
  });
}
