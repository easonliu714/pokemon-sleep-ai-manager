export const POKEMON_CANDIDATE_FEATURE_VERSION='pokemon-candidate-features-2026-08-10-c';

const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function list(value){return [...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}
function bool(value){return Number(value||0)===1||value===true;}

function detailMap(details=[]){return new Map(details.map(row=>[text(row.pokemon_id),row]));}
function collectionBySpecies(targets=[]){
  const map=new Map();
  for(const target of targets){const species=text(target.species);if(!species)continue;if(!map.has(species))map.set(species,[]);map.get(species).push(target);}
  return map;
}
function speciesFrequency(pokemon=[]){
  const counts=new Map();
  for(const row of pokemon){const species=text(row.current_species||row.species);if(species)counts.set(species,(counts.get(species)||0)+1);}
  return counts;
}
function controlledMemberMatch(tokens,pokemonId,species,frequency){
  if(tokens.has(pokemonId))return {matched:true,ambiguous:false,source:'STABLE_ID'};
  if(!tokens.has(species))return {matched:false,ambiguous:false,source:null};
  const count=Number(frequency.get(species)||0);
  return count===1?{matched:true,ambiguous:false,source:'UNIQUE_LEGACY_SPECIES'}:{matched:false,ambiguous:true,source:'AMBIGUOUS_LEGACY_SPECIES'};
}
function ingredientDemand(recipeProjection){
  const demand={};
  for(const recipe of recipeProjection?.candidates||[]){
    for(const row of recipe.requirements||[]){
      const missing=Math.max(0,Number(row.strategy_shortage||0));
      if(missing>0)demand[text(row.ingredient_name)]=(demand[text(row.ingredient_name)]||0)+missing;
    }
  }
  return demand;
}
function unlockedIngredients(detail,level,currentUnlocksOnly){
  return (detail?.ingredients||[]).filter(row=>{
    if(!currentUnlocksOnly)return true;
    const threshold=num(row.unlock_level);return threshold!==null&&level!==null&&threshold<=level;
  }).map(row=>({unlock_level:num(row.unlock_level),ingredient_name:text(row.ingredient_name),quantity:num(row.quantity)}));
}
function unlockedSubskills(detail,level,currentUnlocksOnly){
  return (detail?.subskills||[]).filter(row=>{
    if(!currentUnlocksOnly)return true;
    if(bool(row.is_unlocked))return true;
    const threshold=num(row.unlock_level);return threshold!==null&&level!==null&&threshold<=level;
  }).map(row=>({unlock_level:num(row.unlock_level),subskill_name:text(row.subskill_name)}));
}
function currentUnlockSlotCounts(detail,level){
  // Readiness is deliberately independent from the strategy's current_unlocks_only
  // switch. It measures only the slots that are confirmed in the player's local
  // observation and are actually unlocked at the Pokémon's current level.
  // When the current level is unknown, the scoring bridge exposes zero known
  // unlock slots so the evidence-gated scoring engine returns NULL rather than
  // guessing a readiness percentage.
  if(level===null)return {
    known_ingredient_slot_count:0,known_subskill_slot_count:0,
    unlocked_ingredient_slot_count:0,unlocked_subskill_slot_count:0,
    known_unlock_slot_count:0,unlocked_known_slot_count:0,
  };
  const ingredientSlots=(detail?.ingredients||[]).filter(row=>text(row.ingredient_name)&&num(row.unlock_level)!==null);
  const subskillSlots=(detail?.subskills||[]).filter(row=>text(row.subskill_name)&&(num(row.unlock_level)!==null||bool(row.is_unlocked)));
  const unlockedIngredientSlots=ingredientSlots.filter(row=>num(row.unlock_level)<=level);
  const unlockedSubskillSlots=subskillSlots.filter(row=>bool(row.is_unlocked)||(num(row.unlock_level)!==null&&num(row.unlock_level)<=level));
  const knownIngredient=ingredientSlots.length,knownSubskill=subskillSlots.length;
  const unlockedIngredient=unlockedIngredientSlots.length,unlockedSubskill=unlockedSubskillSlots.length;
  return {
    known_ingredient_slot_count:knownIngredient,known_subskill_slot_count:knownSubskill,
    unlocked_ingredient_slot_count:unlockedIngredient,unlocked_subskill_slot_count:unlockedSubskill,
    known_unlock_slot_count:knownIngredient+knownSubskill,unlocked_known_slot_count:unlockedIngredient+unlockedSubskill,
  };
}
function profileCompleteness(pokemon){
  const fields=['species','level','specialty','type','nature','main_skill','main_skill_level','helper_seconds','carry_limit','favorite_berry'];
  const present=fields.filter(field=>pokemon[field]!==null&&pokemon[field]!==undefined&&text(pokemon[field])!=='');
  return {required_fields:fields,present_fields:present,missing_fields:fields.filter(field=>!present.includes(field)),ratio:present.length/fields.length};
}
function hardConstraintResult({pokemon,constraints,completeness}){
  const failed=[],review=[];
  const id=text(pokemon.pokemon_id),species=text(pokemon.current_species||pokemon.species),level=num(pokemon.level);
  const excluded=new Set(list(constraints.exclude_pokemon));
  if(excluded.has(id)||excluded.has(species))failed.push('exclude_pokemon');
  if(constraints.no_untrained_candidates){
    if(level===null)review.push('minimum_candidate_level');
    else if(constraints.minimum_candidate_level!==null&&constraints.minimum_candidate_level!==undefined&&level<Number(constraints.minimum_candidate_level))failed.push('minimum_candidate_level');
  }
  if(constraints.require_complete_profile_fields&&completeness.missing_fields.length)review.push('require_complete_profile_fields');
  if(Number(pokemon.identity_review_required||0)===1)review.push('identity_review_required');
  return {status:failed.length?'FAIL':review.length?'REVIEW':'PASS',failed_constraints:failed.sort(),review_constraints:review.sort()};
}

export function projectPokemonCandidateFeatures({
  pokemon=[],pokemonDetails=[],weeklyContext={},goalProfile=null,recipeStrategyProjection=null,collectionTargets=[],masterVersions={},
}={}){
  const details=detailMap(pokemonDetails),targets=collectionBySpecies(collectionTargets),constraints=goalProfile?.hard_constraints||{};
  const currentUnlocksOnly=constraints.current_unlocks_only!==false;
  const demand=ingredientDemand(recipeStrategyProjection),totalDemand=Object.values(demand).reduce((sum,value)=>sum+value,0);
  const favoriteBerries=new Set([weeklyContext.favorite_berry_1,weeklyContext.favorite_berry_2,weeklyContext.favorite_berry_3].map(text).filter(Boolean));
  const mustInclude=new Set(list(constraints.must_include_pokemon)),requiredRoles=new Set(list(constraints.must_include_role)),nightTargets=new Set(list(constraints.sleep_evolution_member_at_night));
  const frequencies=speciesFrequency(pokemon),rows=[];
  for(const raw of [...pokemon].sort((a,b)=>text(a.pokemon_id).localeCompare(text(b.pokemon_id)))){
    const pokemonId=text(raw.pokemon_id);if(!pokemonId)continue;
    const species=text(raw.current_species||raw.species),level=num(raw.level),detail=details.get(pokemonId)||{};
    const ingredients=unlockedIngredients(detail,level,currentUnlocksOnly),subskills=unlockedSubskills(detail,level,currentUnlocksOnly),slotCounts=currentUnlockSlotCounts(detail,level);
    const ingredientNames=[...new Set(ingredients.map(row=>row.ingredient_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    const overlap=ingredientNames.filter(name=>Number(demand[name]||0)>0),coveredDemand=overlap.reduce((sum,name)=>sum+Number(demand[name]||0),0);
    const completeness=profileCompleteness(raw),hard=hardConstraintResult({pokemon:raw,constraints,completeness});
    const mustMatch=controlledMemberMatch(mustInclude,pokemonId,species,frequencies),nightMatch=controlledMemberMatch(nightTargets,pokemonId,species,frequencies);
    const extraReview=[...hard.review_constraints];
    if(mustMatch.ambiguous)extraReview.push('ambiguous_legacy_must_include_species');
    if(nightMatch.ambiguous)extraReview.push('ambiguous_legacy_night_target_species');
    const hardStatus=hard.failed_constraints.length?'FAIL':extraReview.length?'REVIEW':'PASS';
    const speciesTargets=targets.get(species)||[];
    const feature={
      pokemon_id:pokemonId,pokemon_instance_id:text(raw.pokemon_instance_id)||null,species,level,sp:num(raw.sp),specialty:text(raw.specialty)||null,type:text(raw.type)||null,
      nature:text(raw.nature)||null,nature_bonus:text(raw.nature_bonus)||null,nature_penalty:text(raw.nature_penalty)||null,main_skill:text(raw.main_skill)||null,main_skill_level:num(raw.main_skill_level),
      helper_seconds:num(raw.helper_seconds),carry_limit:num(raw.carry_limit),favorite_berry:text(raw.favorite_berry)||null,
      favorite_berry_match:raw.favorite_berry?favoriteBerries.has(text(raw.favorite_berry)):null,
      unlocked_ingredients:ingredients,unlocked_subskills:subskills,...slotCounts,weekly_ingredient_overlap:overlap,
      weekly_ingredient_demand_covered:coveredDemand,weekly_ingredient_demand_total:totalDemand,weekly_ingredient_demand_coverage:totalDemand?coveredDemand/totalDemand:null,
      profile_completeness:completeness,identity_confidence:num(raw.identity_confidence),identity_review_required:Number(raw.identity_review_required||0)===1,
      mandatory_candidate:mustMatch.matched,must_include_match_source:mustMatch.source,matches_required_role:requiredRoles.size?requiredRoles.has(text(raw.specialty)):null,
      night_evolution_target:nightMatch.matched,night_target_match_source:nightMatch.source,collection_target_types:list(speciesTargets.map(row=>row.target_type)),
      hard_constraint_status:hardStatus,failed_constraints:hard.failed_constraints,review_constraints:[...new Set(extraReview)].sort(),
      rank_eligible:hardStatus!=='FAIL',
    };
    rows.push(feature);
  }
  const fingerprintPayload=stable({
    feature_version:POKEMON_CANDIDATE_FEATURE_VERSION,weekly_context:weeklyContext,goal_profile:goalProfile,master_versions:masterVersions,
    recipe_fingerprint:recipeStrategyProjection?.input_fingerprint||null,pokemon:rows,
  });
  const counts={PASS:0,FAIL:0,REVIEW:0};for(const row of rows)counts[row.hard_constraint_status]=(counts[row.hard_constraint_status]||0)+1;
  return {
    schema:'pokemon-sleep-candidate-feature-projection/1.0',feature_version:POKEMON_CANDIDATE_FEATURE_VERSION,
    input_fingerprint:`pokemon_features:${hash(JSON.stringify(fingerprintPayload))}`,goal_profile_id:goalProfile?.goal_profile_id||null,
    weekly_context_id:weeklyContext.context_id||null,recipe_strategy_fingerprint:recipeStrategyProjection?.input_fingerprint||null,
    summary:{candidate_count:rows.length,rank_eligible_count:rows.filter(row=>row.rank_eligible).length,hard_constraint_counts:counts,weekly_ingredient_demand_total:totalDemand},
    candidates:rows,score_activation_status:'FEATURE_ONLY',numeric_scores_generated:false,player_data_write:false,
  };
}
