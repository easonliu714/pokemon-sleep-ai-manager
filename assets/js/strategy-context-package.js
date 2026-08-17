export const STRATEGY_CONTEXT_PACKAGE_VERSION='strategy-context-2026-08-17-b-public-event-provenance';

const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function uniq(values){return [...new Set((values||[]).map(text).filter(Boolean))];}
function boundedString(value,max=600){const out=text(value);return out.length>max?out.slice(0,max):out;}
function cleanArray(value,max=20){return uniq(Array.isArray(value)?value:[]).slice(0,max);}

function candidateRows(scoring,limit){
  const ranked=scoring?.ranked_candidates?.length?scoring.ranked_candidates:(scoring?.candidates||[]).filter(row=>row.hard_constraint_status!=='FAIL');
  return ranked.slice(0,Math.max(1,Math.min(50,Number(limit)||20)));
}
function buildCandidateRefs(candidates){
  const resolver={},byIdentity=new Map(),rows=[];
  candidates.forEach((row,index)=>{
    const candidate_ref=`cand_${String(index+1).padStart(3,'0')}`;
    const identities=uniq([row.pokemon_id,row.pokemon_instance_id,row.species]);
    for(const value of identities)if(value)byIdentity.set(value,candidate_ref);
    resolver[candidate_ref]={pokemon_id:row.pokemon_id||null,pokemon_instance_id:row.pokemon_instance_id||null,species:row.species||null};
    rows.push({candidate_ref,row});
  });
  return {resolver,byIdentity,rows};
}
function refList(values,byIdentity){
  const refs=[],species=[];let unresolved=0;
  for(const raw of cleanArray(values,30)){
    const ref=byIdentity.get(raw);
    if(ref){refs.push(ref);continue;}
    if(/^[\p{L}\p{N}・．\-（）() ]+$/u.test(raw)&&raw.length<=40)species.push(raw);
    else unresolved+=1;
  }
  return {candidate_refs:uniq(refs),species:uniq(species),unresolved};
}
function minimizeConstraints(profile,byIdentity){
  const source=profile?.hard_constraints||{};
  const must=refList(source.must_include_pokemon,byIdentity),exclude=refList(source.exclude_pokemon,byIdentity),night=refList(source.sleep_evolution_member_at_night,byIdentity);
  return {
    value:stable({
      must_include:{candidate_refs:must.candidate_refs,species:must.species},
      exclude:{candidate_refs:exclude.candidate_refs,species:exclude.species},
      must_include_role:cleanArray(source.must_include_role,10),max_same_species:num(source.max_same_species),
      current_unlocks_only:source.current_unlocks_only!==false,no_untrained_candidates:Boolean(source.no_untrained_candidates),minimum_candidate_level:num(source.minimum_candidate_level),
      training_budget:stable(source.training_budget||{}),ingredient_safe_reserve:stable(source.ingredient_safe_reserve||{}),item_safe_reserve:source.item_safe_reserve!==false,
      pot_capacity_limit:source.pot_capacity_limit!==false,recipe_unlock_policy:text(source.recipe_unlock_policy)||'allow_unlock_target',
      sleep_evolution_member_at_night:{candidate_refs:night.candidate_refs,species:night.species},preserve_current_team_slots:(source.preserve_current_team_slots||[]).map(Number).filter(Number.isFinite),
      minimum_goal_progress:stable(source.minimum_goal_progress||{}),require_verified_master:source.require_verified_master!==false,require_complete_profile_fields:Boolean(source.require_complete_profile_fields),
    }),
    unresolved_private_constraint_count:must.unresolved+exclude.unresolved+night.unresolved,
  };
}
function candidatePayload(candidate_ref,row){
  return stable({
    candidate_ref,species:text(row.species),level:num(row.level),specialty:text(row.specialty)||null,type:text(row.type)||null,main_skill:text(row.main_skill)||null,main_skill_level:num(row.main_skill_level),
    current_readiness_score:num(row.current_readiness_score),hard_constraint_status:text(row.hard_constraint_status)||'REVIEW',mandatory_candidate:Boolean(row.mandatory_candidate),
    favorite_berry_match:row.favorite_berry_match===null||row.favorite_berry_match===undefined?null:Boolean(row.favorite_berry_match),weekly_ingredient_overlap:cleanArray(row.weekly_ingredient_overlap,10),
    weekly_ingredient_demand_coverage:num(row.weekly_ingredient_demand_coverage),profile_completeness_ratio:num(row.profile_completeness?.ratio),collection_target_types:cleanArray(row.collection_target_types,10),
    failed_constraints:cleanArray(row.failed_constraints,10),review_constraints:cleanArray(row.review_constraints,10),score_reasons:cleanArray(row.score_reasons,10),
  });
}
function recipePayload(recipe){
  return stable({
    recipe_id:text(recipe.recipe_id),recipe_name:text(recipe.recipe_name),unlocked:Boolean(recipe.unlocked),candidate_status:text(recipe.candidate_status),
    total_strategy_shortage:num(recipe.total_strategy_shortage),missing_kinds:num(recipe.missing_kinds),pot_fit:recipe.pot_fit===null||recipe.pot_fit===undefined?null:Boolean(recipe.pot_fit),
    requirements:(recipe.requirements||[]).filter(row=>Number(row.strategy_shortage||0)>0).slice(0,8).map(row=>({ingredient_name:text(row.ingredient_name),required:num(row.required),owned:num(row.owned),safe_reserve:num(row.safe_reserve),usable:num(row.usable),strategy_shortage:num(row.strategy_shortage)})),
  });
}
function inventorySummary(recipes){
  const map=new Map();
  for(const recipe of recipes)for(const row of recipe.requirements||[]){
    const name=text(row.ingredient_name);if(!name)continue;
    const current=map.get(name)||{ingredient_name:name,quantity:0,safe_reserve:0,usable:0};
    current.quantity=Math.max(current.quantity,Number(row.owned||0));current.safe_reserve=Math.max(current.safe_reserve,Number(row.safe_reserve||0));current.usable=Math.max(current.usable,Number(row.usable||0));map.set(name,current);
  }
  return [...map.values()].sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
}
function publicEventAuthorityPayload(weeklyContext={}){
  const deterministicEffects=stable(weeklyContext.strategy_event_effects||{});
  return stable({
    source:text(weeklyContext.event_authority_source)||'PUBLIC_EVENT_MASTER',
    master_version:text(weeklyContext.public_event_master_version)||null,
    authority_version:text(weeklyContext.public_event_authority_version)||null,
    authority_status:text(weeklyContext.public_event_authority_status)||'PUBLIC_EVENT_MASTER_UNAVAILABLE',
    active_event_count:num(weeklyContext.public_event_active_count)??0,
    event_name:text(weeklyContext.event_name)||null,
    deterministic_effects:deterministicEffects,
    deterministic_effect_count:Object.keys(deterministicEffects).length,
    review_required:Boolean(weeklyContext.event_effect_review_required),
    review_effect_count:Array.isArray(weeklyContext.review_event_effects)?weeklyContext.review_event_effects.length:0,
    conflict_count:Array.isArray(weeklyContext.public_event_effect_conflicts)?weeklyContext.public_event_effect_conflicts.length:0,
    event_name_is_numeric_authority:false,
    legacy_player_event_deterministic_authority:false,
  });
}

export function buildStrategyContextPackage({
  weeklyContext={},goalProfile=null,candidateScoring={},recipeStrategy={},masterVersions={},currentTeamPokemonIds=[],includeEventText=false,candidateLimit=20,recipeLimit=10,
}={}){
  const candidates=candidateRows(candidateScoring,candidateLimit),refs=buildCandidateRefs(candidates),constraints=minimizeConstraints(goalProfile,refs.byIdentity);
  const recipes=(recipeStrategy?.candidates||[]).slice(0,Math.max(1,Math.min(30,Number(recipeLimit)||10))).map(recipePayload);
  const teamRefs=uniq((currentTeamPokemonIds||[]).map(value=>refs.byIdentity.get(text(value))).filter(Boolean));
  const publicEventAuthority=publicEventAuthorityPayload(weeklyContext);
  const publicVersionRefs=stable({
    ...(masterVersions||{}),
    public_event_master_version:publicEventAuthority.master_version,
    public_event_authority_version:publicEventAuthority.authority_version,
  });
  const payload=stable({
    schema:'pokemon-sleep-strategy-context/1.0',package_version:STRATEGY_CONTEXT_PACKAGE_VERSION,
    weekly_context:{week_start:text(weeklyContext.week_start)||null,camp:text(weeklyContext.camp)||null,dish_category:text(weeklyContext.dish_category)||null,favorite_berries:uniq([weeklyContext.favorite_berry_1,weeklyContext.favorite_berry_2,weeklyContext.favorite_berry_3]),pot_size:num(weeklyContext.pot_size),event_name:text(weeklyContext.event_name)||null,event_effects:includeEventText?boundedString(weeklyContext.event_effects,1200):null},
    public_event_authority:publicEventAuthority,
    goal_profile:goalProfile?{primary_goal:text(goalProfile.primary_goal),secondary_goals:cleanArray(goalProfile.secondary_goals,8),weights:stable(goalProfile.weights||{}),hard_constraints:constraints.value}:null,
    current_team:teamRefs,candidate_pokemon:refs.rows.map(({candidate_ref,row})=>candidatePayload(candidate_ref,row)),recipe_gap_summary:recipes,inventory_summary:inventorySummary(recipes),
    deterministic_candidates:{feature_fingerprint:candidateScoring?.feature_fingerprint||candidateScoring?.feature_projection?.input_fingerprint||null,scoring_engine_version:candidateScoring?.scoring_engine_version||null,scoring_rule_registry_version:candidateScoring?.scoring_rule_registry_version||null,recipe_strategy_fingerprint:recipeStrategy?.input_fingerprint||null},
    public_version_refs:publicVersionRefs,
  });
  const context_fingerprint=`strategy_context:${hash(JSON.stringify(payload))}`;
  return {
    payload:{...payload,context_fingerprint},
    resolver:refs.resolver,
    privacy_manifest:{
      stable_pokemon_ids_in_payload:false,nicknames_in_payload:false,notes_in_payload:false,source_images_in_payload:false,raw_ocr_in_payload:false,api_key_in_payload:false,raw_sqlite_in_payload:false,
      event_text_included:Boolean(includeEventText),candidate_count:payload.candidate_pokemon.length,current_team_ref_count:teamRefs.length,recipe_count:recipes.length,inventory_ingredient_count:payload.inventory_summary.length,
      unresolved_private_constraint_count:constraints.unresolved_private_constraint_count,
    },
  };
}
