export const STRATEGY_GOAL_PROFILE_VERSION='strategy-goal-profile-2026-08-09-a';

export const STRATEGY_GOALS=Object.freeze([
  'max_snorlax_energy','unlock_recipes','ingredient_stockpile','dream_shard_farming',
  'research_unlock','evolution_progress','training_roi','event_objective','balanced',
]);

const GOAL_SET=new Set(STRATEGY_GOALS);
const text=value=>String(value??'').normalize('NFKC').trim();
const bool=(value,fallback=false)=>value===true||value===1||value==='1'||value==='true'?true:value===false||value===0||value==='0'||value==='false'?false:fallback;
function numeric(value,{min=0,max=null,integer=false}={}){
  if(value===null||value===undefined||value==='')return null;
  let n=Number(value);if(!Number.isFinite(n))return null;if(integer)n=Math.trunc(n);n=Math.max(min,n);if(max!==null)n=Math.min(max,n);return n;
}
function list(value){
  const source=Array.isArray(value)?value:(text(value)?String(value).split(/[,，\n]/):[]);
  return [...new Set(source.map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}
function numberMap(value){
  const output={};if(!value||typeof value!=='object'||Array.isArray(value))return output;
  for(const key of Object.keys(value).sort((a,b)=>a.localeCompare(b,'zh-Hant'))){const n=numeric(value[key]);if(n!==null&&text(key))output[text(key)]=n;}
  return output;
}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}

export function defaultHardConstraints(){return {
  must_include_pokemon:[],exclude_pokemon:[],must_include_role:[],max_same_species:null,
  current_unlocks_only:true,no_untrained_candidates:false,minimum_candidate_level:null,
  training_budget:{candy:null,dream_shard:null,seed:null,evolution_item:null},
  ingredient_safe_reserve:{},item_safe_reserve:true,pot_capacity_limit:true,
  recipe_unlock_policy:'allow_unlock_target',sleep_evolution_member_at_night:[],
  preserve_current_team_slots:[],minimum_goal_progress:{},require_verified_master:true,
  require_complete_profile_fields:false,
};}

export function normalizeHardConstraints(input={}){
  const base=defaultHardConstraints(),source=input&&typeof input==='object'&&!Array.isArray(input)?input:{},training=source.training_budget||{};
  const slots=(Array.isArray(source.preserve_current_team_slots)?source.preserve_current_team_slots:[]).map(value=>numeric(value,{min:1,max:5,integer:true})).filter(value=>value!==null);
  return stable({
    must_include_pokemon:list(source.must_include_pokemon),exclude_pokemon:list(source.exclude_pokemon),must_include_role:list(source.must_include_role),
    max_same_species:numeric(source.max_same_species,{min:1,max:5,integer:true}),current_unlocks_only:bool(source.current_unlocks_only,base.current_unlocks_only),
    no_untrained_candidates:bool(source.no_untrained_candidates,base.no_untrained_candidates),minimum_candidate_level:numeric(source.minimum_candidate_level,{min:1,integer:true}),
    training_budget:{candy:numeric(training.candy,{integer:true}),dream_shard:numeric(training.dream_shard,{integer:true}),seed:numeric(training.seed,{integer:true}),evolution_item:numeric(training.evolution_item,{integer:true})},
    ingredient_safe_reserve:numberMap(source.ingredient_safe_reserve),item_safe_reserve:bool(source.item_safe_reserve,base.item_safe_reserve),pot_capacity_limit:bool(source.pot_capacity_limit,base.pot_capacity_limit),
    recipe_unlock_policy:['only_unlocked','allow_unlock_target'].includes(text(source.recipe_unlock_policy))?text(source.recipe_unlock_policy):base.recipe_unlock_policy,
    sleep_evolution_member_at_night:list(source.sleep_evolution_member_at_night),preserve_current_team_slots:[...new Set(slots)].sort((a,b)=>a-b),minimum_goal_progress:numberMap(source.minimum_goal_progress),
    require_verified_master:bool(source.require_verified_master,base.require_verified_master),require_complete_profile_fields:bool(source.require_complete_profile_fields,base.require_complete_profile_fields),
  });
}

export function normalizeStrategyGoalProfile(input={}){
  const primary=GOAL_SET.has(text(input.primary_goal))?text(input.primary_goal):'balanced';
  const secondary=[...new Set((Array.isArray(input.secondary_goals)?input.secondary_goals:[]).map(text).filter(goal=>GOAL_SET.has(goal)&&goal!==primary))].sort();
  const raw=input.weights&&typeof input.weights==='object'?input.weights:{},weights={};
  for(const goal of STRATEGY_GOALS){if(goal===primary)weights[goal]=numeric(raw[goal],{max:1})??1;else if(secondary.includes(goal))weights[goal]=numeric(raw[goal],{max:1})??0.5;}
  return stable({profile_name:text(input.profile_name)||'目前策略',primary_goal:primary,secondary_goals:secondary,weights,hard_constraints:normalizeHardConstraints(input.hard_constraints),profile_version:STRATEGY_GOAL_PROFILE_VERSION});
}

export function strategyGoalProfileFingerprint(profile){return `strategy_goal:${hash(JSON.stringify(normalizeStrategyGoalProfile(profile)))}`;}
export function strategyGoalProfileValidation(profile){
  const normalized=normalizeStrategyGoalProfile(profile),errors=[],included=new Set(normalized.hard_constraints.must_include_pokemon);
  for(const value of normalized.hard_constraints.exclude_pokemon)if(included.has(value))errors.push(`include_exclude_conflict:${value}`);
  if(normalized.hard_constraints.no_untrained_candidates&&normalized.hard_constraints.minimum_candidate_level===null)errors.push('minimum_candidate_level_required');
  return {valid:errors.length===0,errors,normalized,fingerprint:strategyGoalProfileFingerprint(normalized)};
}
