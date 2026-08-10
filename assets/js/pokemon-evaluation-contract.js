import {weeklyContextStrategyFingerprintInput} from './weekly-context-normalization.js';

export const POKEMON_EVALUATION_RULE_VERSION='pokemon-evaluation-snapshot-2026-08-09-a';
export const EVALUATION_DIMENSIONS=Object.freeze([
  'intrinsic_score','current_readiness_score','weekly_fit_score','roster_marginal_value_score','training_roi_score',
]);

function text(value){return String(value??'').normalize('NFKC').trim();}
function numberOrNull(value){const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function boolOrNull(value){return value===null||value===undefined?null:Boolean(value);}

export function canonicalPokemonEvaluationInput({pokemon={},ingredients=[],subskills=[]}={}){
  return stable({
    pokemon_id:text(pokemon.pokemon_id),pokemon_instance_id:text(pokemon.pokemon_instance_id),species:text(pokemon.current_species||pokemon.species),
    level:numberOrNull(pokemon.level),sp:numberOrNull(pokemon.sp),specialty:text(pokemon.specialty),type:text(pokemon.type),nature:text(pokemon.nature),
    nature_bonus:text(pokemon.nature_bonus),nature_penalty:text(pokemon.nature_penalty),main_skill:text(pokemon.main_skill),main_skill_level:numberOrNull(pokemon.main_skill_level),
    helper_seconds:numberOrNull(pokemon.helper_seconds),carry_limit:numberOrNull(pokemon.carry_limit),favorite_berry:text(pokemon.favorite_berry),status:text(pokemon.status),
    ingredients:[...ingredients].map(row=>({unlock_level:numberOrNull(row.unlock_level),ingredient_name:text(row.ingredient_name),quantity:numberOrNull(row.quantity)})).sort((a,b)=>(a.unlock_level??999)-(b.unlock_level??999)||a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant')),
    subskills:[...subskills].map(row=>({unlock_level:numberOrNull(row.unlock_level),subskill_name:text(row.subskill_name),is_unlocked:Number(row.is_unlocked||0)===1})).sort((a,b)=>(a.unlock_level??999)-(b.unlock_level??999)||a.subskill_name.localeCompare(b.subskill_name,'zh-Hant')),
  });
}

export function canonicalEvaluationContext({weeklyContext={},goalProfile=null,masterVersions={},ruleVersion=POKEMON_EVALUATION_RULE_VERSION}={}){
  return stable({
    weekly_context:weeklyContextStrategyFingerprintInput(weeklyContext),
    goal_profile:goalProfile?stable({goal_profile_id:text(goalProfile.goal_profile_id),profile_version:text(goalProfile.profile_version),primary_goal:text(goalProfile.primary_goal),secondary_goals:goalProfile.secondary_goals||[],weights:goalProfile.weights||{},hard_constraints:goalProfile.hard_constraints||{}}):null,
    master_versions:stable(masterVersions||{}),rule_version:text(ruleVersion)||POKEMON_EVALUATION_RULE_VERSION,
  });
}

export function pokemonEvaluationFingerprint(input){
  const payload=stable({pokemon:canonicalPokemonEvaluationInput(input),context:canonicalEvaluationContext(input)});
  return `pokemon_eval:${hash(JSON.stringify(payload))}`;
}

function score(value){const n=numberOrNull(value);return n===null?null:Math.max(0,Math.min(100,n));}
export function normalizePokemonEvaluationResult(input={}){
  const result={};for(const dimension of EVALUATION_DIMENSIONS)result[dimension]=score(input[dimension]);
  const reasons=[...new Set((Array.isArray(input.reasons)?input.reasons:[]).map(text).filter(Boolean))].sort();
  const missing=[...new Set((Array.isArray(input.missing_inputs)?input.missing_inputs:[]).map(text).filter(Boolean))].sort();
  const failed=[...new Set((Array.isArray(input.failed_constraints)?input.failed_constraints:[]).map(text).filter(Boolean))].sort();
  const hard=['PASS','FAIL','REVIEW'].includes(input.hard_constraint_status)?input.hard_constraint_status:'REVIEW';
  const hasScore=EVALUATION_DIMENSIONS.some(dimension=>result[dimension]!==null);
  return stable({...result,score_breakdown:input.score_breakdown&&typeof input.score_breakdown==='object'?input.score_breakdown:{},reasons,missing_inputs:missing,hard_constraint_status:hard,failed_constraints:failed,evaluation_status:text(input.evaluation_status)||(hasScore?'PARTIAL_SCORED':'FACT_SNAPSHOT_ONLY')});
}

export function buildFactOnlyPokemonEvaluation(input={}){
  const pokemon=canonicalPokemonEvaluationInput(input),context=canonicalEvaluationContext(input);
  const favorites=[context.weekly_context.favorite_berry_1,context.weekly_context.favorite_berry_2,context.weekly_context.favorite_berry_3].filter(Boolean);
  const favoriteBerryMatch=pokemon.favorite_berry?favorites.includes(pokemon.favorite_berry):null;
  const currentLevel=numberOrNull(pokemon.level);
  const unlockedIngredients=pokemon.ingredients.filter(row=>currentLevel!==null&&row.unlock_level!==null&&row.unlock_level<=currentLevel).map(row=>row.ingredient_name);
  const unlockedSubskills=pokemon.subskills.filter(row=>row.is_unlocked||(currentLevel!==null&&row.unlock_level!==null&&row.unlock_level<=currentLevel)).map(row=>row.subskill_name);
  return normalizePokemonEvaluationResult({
    intrinsic_score:null,current_readiness_score:null,weekly_fit_score:null,roster_marginal_value_score:null,training_roi_score:null,
    score_breakdown:{fact_snapshot:{species:pokemon.species,level:pokemon.level,specialty:pokemon.specialty,type:pokemon.type,favorite_berry:pokemon.favorite_berry,favorite_berry_match:boolOrNull(favoriteBerryMatch),unlocked_ingredients:unlockedIngredients,unlocked_subskills:unlockedSubskills,primary_goal:context.goal_profile?.primary_goal||null}},
    reasons:['SCORING_RULES_NOT_YET_ACTIVATED','FACTS_CAPTURED_WITHOUT_GUESSED_SCORE'],
    missing_inputs:['intrinsic_scoring_rule','current_readiness_scoring_rule','weekly_fit_scoring_rule','roster_marginal_value_scoring_rule','training_roi_scoring_rule'],
    hard_constraint_status:'REVIEW',failed_constraints:[],evaluation_status:'FACT_SNAPSHOT_ONLY',
  });
}
