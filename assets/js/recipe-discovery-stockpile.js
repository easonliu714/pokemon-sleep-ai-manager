import {PUBLIC_RECIPE_DISCOVERY,PUBLIC_RECIPE_DISCOVERY_VERSION} from './public-recipe-discovery-master.js';
import {normalizeWeeklyContext} from './weekly-context-normalization.js';
import {optimizeTeam,TEAM_OPTIMIZER_VERSION} from './team-optimizer.js';

export const RECIPE_DISCOVERY_STOCKPILE_VERSION='recipe-discovery-stockpile-2026-08-10-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}

function planningRows(discoveryRows){
  return (discoveryRows||[]).filter(row=>row.active_canonical!==true&&Array.isArray(row.planning_formula)&&row.planning_formula.length>0);
}
function targetMap(rows){
  const map=new Map();
  for(const recipe of rows)for(const item of recipe.planning_formula||[]){
    const name=text(item.ingredient_name),quantity=Math.max(0,Number(item.quantity)||0);
    if(name&&quantity)map.set(name,(map.get(name)||0)+quantity);
  }
  return map;
}
function inventoryMap(inventory){return new Map((inventory||[]).map(row=>[text(row.ingredient_name),Math.max(0,Number(row.quantity)||0)]));}
function ingredientNames(candidate){return [...new Set((candidate?.unlocked_ingredients||[]).map(row=>text(row.ingredient_name)).filter(Boolean))];}
function completeness(candidate){return Number(candidate?.profile_completeness?.ratio||0);}

function discoveryScoringProjection(scoringProjection,deficits){
  const deficitMap=new Map(deficits.map(row=>[row.ingredient_name,row.deficit]));
  const total=deficits.reduce((sum,row)=>sum+row.deficit,0);
  const candidates=(scoringProjection?.candidates||[]).map(candidate=>{
    const overlap=ingredientNames(candidate).filter(name=>Number(deficitMap.get(name)||0)>0).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    const covered=overlap.reduce((sum,name)=>sum+Number(deficitMap.get(name)||0),0);
    return {
      ...candidate,
      weekly_ingredient_overlap:overlap,
      weekly_ingredient_demand_covered:covered,
      weekly_ingredient_demand_total:total,
      weekly_ingredient_demand_coverage:total?covered/total:null,
      discovery_ingredient_overlap:overlap,
      discovery_deficit_weight_covered:covered,
    };
  });
  return {...scoringProjection,candidates,feature_fingerprint:`${scoringProjection?.feature_fingerprint||'pokemon_features'}:discovery`};
}

export function projectRecipeDiscoveryStockpile({
  discoveryRows=PUBLIC_RECIPE_DISCOVERY,
  inventory=[],
  scoringProjection={candidates:[]},
  goalProfile=null,
  weeklyContext={},
  maxAlternatives=2,
}={}){
  const week=normalizeWeeklyContext(weeklyContext);
  const discoveries=planningRows(discoveryRows);
  const targets=targetMap(discoveries),owned=inventoryMap(inventory);
  const stockpile=[...targets.entries()].map(([ingredient_name,target])=>{
    const current=Number(owned.get(ingredient_name)||0),deficit=Math.max(0,target-current);
    return Object.freeze({ingredient_name,target,current,deficit,covered:deficit===0});
  }).sort((a,b)=>b.deficit-a.deficit||a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
  const totalTarget=stockpile.reduce((sum,row)=>sum+row.target,0),totalCurrent=stockpile.reduce((sum,row)=>sum+Math.min(row.current,row.target),0),totalDeficit=stockpile.reduce((sum,row)=>sum+row.deficit,0);
  const sundayMultiplier=num(week.sunday_pot_multiplier),basePot=num(week.pot_size),sundayPot=basePot!==null&&sundayMultiplier!==null?basePot*sundayMultiplier:null;
  const recipePlans=discoveries.map((row,index)=>Object.freeze({
    discovery_id:row.discovery_id,
    display_name:`新料理候選 ${String.fromCharCode(65+index)}`,
    canonical_name_zh_tw:null,
    lifecycle:row.lifecycle,
    ingredient_count:row.observed_ingredient_count,
    total_ingredients:row.observed_total_ingredients,
    quantity_signature:Object.freeze([...(row.observed_quantity_signature||[])]),
    planning_formula:Object.freeze((row.planning_formula||[]).map(item=>Object.freeze({...item}))),
    sunday_pot_capacity:sundayPot,
    sunday_pot_fit:sundayPot===null?null:sundayPot>=Number(row.observed_total_ingredients||0),
    sunday_pot_buffer:sundayPot===null?null:sundayPot-Number(row.observed_total_ingredients||0),
    canonical_active:false,
  }));
  const deficitRows=stockpile.filter(row=>row.deficit>0);
  const discoveryProjection=discoveryScoringProjection(scoringProjection,deficitRows);
  const team=optimizeTeam({scoringProjection:discoveryProjection,goalProfile,maxAlternatives});
  const fingerprintPayload=stable({
    version:RECIPE_DISCOVERY_STOCKPILE_VERSION,discovery_version:PUBLIC_RECIPE_DISCOVERY_VERSION,
    weekly_context:{context_id:week.context_id,week_start:week.week_start,camp:week.camp,dish_category:week.dish_category,pot_size:week.pot_size,event_name:week.event_name,event_effects:week.event_effects_parsed},
    discoveries:recipePlans,stockpile,goal_profile_id:goalProfile?.goal_profile_id||null,team_input:team.input_fingerprint,
  });
  return Object.freeze({
    schema:'pokemon-sleep-recipe-discovery-stockpile/1.0',planner_version:RECIPE_DISCOVERY_STOCKPILE_VERSION,discovery_version:PUBLIC_RECIPE_DISCOVERY_VERSION,
    projection_status:'READY',input_fingerprint:`recipe_discovery:${hash(JSON.stringify(fingerprintPayload))}`,
    weekly_context:Object.freeze({context_id:week.context_id,week_start:week.week_start,camp:week.camp,dish_category:week.dish_category,event_name:week.event_name,pot_size:week.pot_size,recipe_final_energy_multiplier:week.recipe_final_energy_multiplier,sunday_pot_multiplier:week.sunday_pot_multiplier}),
    discovery_candidates:Object.freeze(recipePlans),
    stockpile:Object.freeze(stockpile),
    summary:Object.freeze({recipe_candidate_count:recipePlans.length,ingredient_kind_count:stockpile.length,total_target:totalTarget,total_current_capped:totalCurrent,total_deficit:totalDeficit,fully_stockpiled:totalDeficit===0}),
    team,
    production_rate_model:'NOT_YET_VERIFIED',estimated_ingredient_per_hour:null,estimated_weekly_energy:null,
    player_data_write:false,gemini_used:false,canonical_recipe_state_write:false,
  });
}
