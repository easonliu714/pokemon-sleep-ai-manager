import {
  NATURES,
  SUBSKILL_PRODUCTION_MODIFIERS,
} from './pokemon-master-options.js';
import {canonicalBerryName} from './public-berry-strength-master.js';

export const POKEMON_ROSTER_FILTER_CONTRACT_VERSION='pokemon-roster-unlocked-filters-2026-08-17-b-berry-canonical-projection';

const text=value=>String(value??'').normalize('NFKC').trim();
const uniqueSorted=values=>[...new Set(values.map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const levelOf=pokemon=>Math.max(0,Number(pokemon?.level)||0);
const unlockLevel=row=>Math.max(0,Number(row?.unlock_level)||0);
const ratingRank=rating=>({'S+':0,'S':1,'A':2,'B':3,'C':4,'未評級':8}[text(rating)]??9);

export function ingredientSlotUnlocked(pokemon,row){
  const required=unlockLevel(row);
  return Boolean(text(row?.ingredient_name))&&required>0&&levelOf(pokemon)>=required;
}

export function subskillSlotUnlocked(pokemon,row){
  const required=unlockLevel(row);
  if(!text(row?.subskill_name)||required<=0)return false;
  return Boolean(Number(row?.is_unlocked))||levelOf(pokemon)>=required;
}

export function buildPokemonRosterFilterProfiles({pokemonRows=[],ingredientRows=[],subskillRows=[],resolveMainSkillName=value=>value}={}){
  const ingredientsByPokemon=new Map(),subskillsByPokemon=new Map();
  for(const row of ingredientRows){
    const id=text(row?.pokemon_id);
    if(!id)continue;
    if(!ingredientsByPokemon.has(id))ingredientsByPokemon.set(id,[]);
    ingredientsByPokemon.get(id).push(row);
  }
  for(const row of subskillRows){
    const id=text(row?.pokemon_id);
    if(!id)continue;
    if(!subskillsByPokemon.has(id))subskillsByPokemon.set(id,[]);
    subskillsByPokemon.get(id).push(row);
  }

  return pokemonRows.filter(row=>text(row?.status)==='active').map(pokemon=>{
    const id=text(pokemon.pokemon_id);
    const unlockedIngredients=(ingredientsByPokemon.get(id)||[]).filter(row=>ingredientSlotUnlocked(pokemon,row));
    const unlockedSubskills=(subskillsByPokemon.get(id)||[]).filter(row=>subskillSlotUnlocked(pokemon,row));
    const resolvedMainSkill=text(resolveMainSkillName(pokemon.main_skill)||pokemon.main_skill);
    return Object.freeze({
      pokemon,
      pokemon_id:id,
      berry:canonicalBerryName(pokemon.favorite_berry),
      main_skill:resolvedMainSkill,
      ingredients:Object.freeze(uniqueSorted(unlockedIngredients.map(row=>row.ingredient_name))),
      subskills:Object.freeze(uniqueSorted(unlockedSubskills.map(row=>row.subskill_name))),
      unlocked_ingredient_rows:Object.freeze(unlockedIngredients.map(row=>Object.freeze({...row}))),
      unlocked_subskill_rows:Object.freeze(unlockedSubskills.map(row=>Object.freeze({...row}))),
    });
  });
}

export function buildPokemonRosterFacetOptions(profiles=[]){
  return Object.freeze({
    berries:Object.freeze(uniqueSorted(profiles.map(row=>canonicalBerryName(row.berry)))),
    ingredients:Object.freeze(uniqueSorted(profiles.flatMap(row=>row.ingredients))),
    main_skills:Object.freeze(uniqueSorted(profiles.map(row=>row.main_skill))),
    subskills:Object.freeze(uniqueSorted(profiles.flatMap(row=>row.subskills))),
  });
}

export function profileMatchesRosterFilters(profile,filters={}){
  const berry=canonicalBerryName(filters.berry),ingredient=text(filters.ingredient),mainSkill=text(filters.main_skill),subskill=text(filters.subskill);
  return (!berry||canonicalBerryName(profile.berry)===berry)
    &&(!ingredient||profile.ingredients.includes(ingredient))
    &&(!mainSkill||profile.main_skill===mainSkill)
    &&(!subskill||profile.subskills.includes(subskill));
}

function filterContext(filters={}){
  const dimensions=new Set(),contexts=[];
  if(text(filters.ingredient)){dimensions.add('ingredient_probability_per_help');dimensions.add('helper_interval_seconds');contexts.push('INGREDIENT');}
  if(canonicalBerryName(filters.berry)){dimensions.add('berry_output_per_help');dimensions.add('helper_interval_seconds');contexts.push('BERRY');}
  if(text(filters.main_skill)){dimensions.add('main_skill_trigger_probability');dimensions.add('main_skill_level');dimensions.add('helper_interval_seconds');contexts.push('MAIN_SKILL');}
  const selectedSubskill=text(filters.subskill);
  if(selectedSubskill){
    const dimension=SUBSKILL_PRODUCTION_MODIFIERS[selectedSubskill]?.dimension;
    if(dimension)dimensions.add(dimension);
    contexts.push('SUBSKILL');
  }
  return {dimensions,contexts};
}

function natureEvidence(profile,dimensions){
  const pokemon=profile.pokemon,nature=text(pokemon.nature),effects=NATURES[nature];
  if(!effects)return [];
  const canonicalBonus=text(effects[0]),canonicalPenalty=text(effects[1]);
  const observedBonus=text(pokemon.nature_bonus),observedPenalty=text(pokemon.nature_penalty);
  if((observedBonus&&observedBonus!==canonicalBonus)||(observedPenalty&&observedPenalty!==canonicalPenalty)){
    return [{kind:'review',label:'性格資料待核對',weight:0}];
  }
  const dimensionByEffect={幫忙速度:'helper_interval_seconds',食材機率:'ingredient_probability_per_help',主技能發動機率:'main_skill_trigger_probability'};
  const result=[];
  const bonusDimension=dimensionByEffect[canonicalBonus];
  if(bonusDimension&&dimensions.has(bonusDimension))result.push({kind:'nature',label:`性格加成：${canonicalBonus}↑`,dimension:bonusDimension,weight:bonusDimension==='helper_interval_seconds'?2:4});
  const penaltyDimension=dimensionByEffect[canonicalPenalty];
  if(penaltyDimension&&dimensions.has(penaltyDimension))result.push({kind:'penalty',label:`性格降低：${canonicalPenalty}↓`,dimension:penaltyDimension,weight:penaltyDimension==='helper_interval_seconds'?-2:-4});
  return result;
}

function subskillEvidence(profile,dimensions){
  const result=[];
  for(const row of profile.unlocked_subskill_rows){
    const name=text(row.subskill_name),rule=SUBSKILL_PRODUCTION_MODIFIERS[name];
    if(!rule||!dimensions.has(rule.dimension))continue;
    if(rule.numeric_status==='NOT_NUMERIC_PRODUCTION')continue;
    result.push({
      kind:'subskill',
      label:`副技能加成：${name}`,
      dimension:rule.dimension,
      weight:rule.dimension==='helper_interval_seconds'?2:4,
    });
  }
  return result;
}

function specialtyEvidence(profile,contexts){
  const specialty=text(profile.pokemon.specialty);
  if(contexts.includes('INGREDIENT')&&specialty==='食材')return [{kind:'specialty',label:'食材專長',weight:1}];
  if(contexts.includes('BERRY')&&specialty==='樹果')return [{kind:'specialty',label:'樹果專長',weight:1}];
  if(contexts.includes('MAIN_SKILL')&&specialty==='技能')return [{kind:'specialty',label:'技能專長',weight:1}];
  return [];
}

export function recommendationEvidenceForProfile(profile,filters={}){
  const {dimensions,contexts}=filterContext(filters);
  if(!contexts.length)return Object.freeze({score:0,badges:Object.freeze([]),has_recommendation_context:false});
  const badges=[...natureEvidence(profile,dimensions),...subskillEvidence(profile,dimensions),...specialtyEvidence(profile,contexts)];
  const score=badges.reduce((sum,row)=>sum+Number(row.weight||0),0);
  return Object.freeze({score,badges:Object.freeze(badges.map(row=>Object.freeze(row))),has_recommendation_context:true});
}

export function rankRosterFilterMatches(profiles=[],filters={}){
  return profiles.filter(profile=>profileMatchesRosterFilters(profile,filters)).map(profile=>({
    profile,
    evidence:recommendationEvidenceForProfile(profile,filters),
  })).sort((a,b)=>{
    if(b.evidence.score!==a.evidence.score)return b.evidence.score-a.evidence.score;
    const ratingDiff=ratingRank(a.profile.pokemon.rating)-ratingRank(b.profile.pokemon.rating);
    if(ratingDiff)return ratingDiff;
    const levelDiff=levelOf(b.profile.pokemon)-levelOf(a.profile.pokemon);
    if(levelDiff)return levelDiff;
    return a.profile.pokemon_id.localeCompare(b.profile.pokemon_id);
  });
}

export function rosterFilterHasRecommendationContext(filters={}){
  return Boolean(canonicalBerryName(filters.berry)||text(filters.ingredient)||text(filters.main_skill)||text(filters.subskill));
}
