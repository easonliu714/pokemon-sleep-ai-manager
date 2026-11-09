// Owner-approved preliminary role-fit advice. This is an app heuristic, NOT an
// official Pokémon Sleep stat, production forecast, or admitted SQLite writer.
// Never infer unknown inputs as zero or overwrite a player's existing rating.
import {NATURES, SUBSKILLS, INGREDIENTS, MAIN_SKILLS} from './pokemon-master-options.js';

export const POKEMON_PROVISIONAL_RATING_RULE_VERSION='pokemon-role-fit-15-band-2026-11-09-b';
export const POKEMON_PROVISIONAL_RATING_LABELS=Object.freeze([
  'S+','S','S-','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-',
]);

// Explicit PRODUCT HEURISTIC weights, not empirical production multipliers.
// Intrinsic/weekly/roster/ROI numeric scoring remains unadmitted in the
// canonical pokemon-scoring-rule-registry.js.
const SUBSKILL_WEIGHTS=Object.freeze({
  '樹果':Object.freeze({'樹果數量S':30,'幫手獎勵':14,'幫忙速度M':12,'幫忙速度S':7}),
  '食材':Object.freeze({'食材機率提升M':22,'食材機率提升S':12,'幫手獎勵':13,'幫忙速度M':11,'幫忙速度S':6}),
  '技能':Object.freeze({'技能機率提升M':22,'技能機率提升S':12,'幫手獎勵':13,'幫忙速度M':11,'幫忙速度S':6,'技能等級提升M':8,'技能等級提升S':4}),
});
const NATURE_WEIGHTS=Object.freeze({
  '樹果':Object.freeze({'幫忙速度':10}),
  '食材':Object.freeze({'食材機率':12,'食材發現率':12,'幫忙速度':6}),
  '技能':Object.freeze({'主技能發動機率':12,'幫忙速度':6}),
});
const LEVELS=Object.freeze([10,25,50,70,80]);
const GRADE_LOWER_BOUNDS=Object.freeze([93,86,79,72,65,58,51,44,37,30,23,16,9,3,0]);
// RATE.4 documentation: expose the exact existing scoring constants so the
// user guide cannot silently drift from the actual provisional evaluator.
export const MAIN_SKILL_LEVEL_ROLE_POINTS=Object.freeze({'樹果':1,'食材':1,'技能':2});
const MAX_REVIEWED_MAIN_SKILL_LEVEL=8;
export const POKEMON_PROVISIONAL_RATING_GUIDE=Object.freeze({
  base_points:40,lower_bounds:GRADE_LOWER_BOUNDS,levels:LEVELS,
  subskill_weights:SUBSKILL_WEIGHTS,nature_weights:NATURE_WEIGHTS,
  main_skill_level_role_points:MAIN_SKILL_LEVEL_ROLE_POINTS,
});
// The existing rule's long-term grade is unchanged. This projection version
// adds two explicit interpretations of the SAME verified evidence and weights.
export const POKEMON_CURRENT_FUTURE_RATING_VIEW_VERSION='pokemon-role-fit-current-future-2026-11-09-b';
// Product heuristic only: additional verified main-skill levels have small,
// explicitly bounded role-dependent points; not an official trigger/damage formula.
// No main-skill-level observation means NO bonus is evaluated (not level 1).


const text=value=>String(value??'').normalize('NFKC').trim();
const nonempty=value=>value!==null&&value!==undefined&&text(value)!=='';
// RATE.1: an OCR/AI or imported coercible value is not verified numeric evidence.
// Do not turn true, "10" or boxed numbers into a Pokémon level or slot.
const number=value=>{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=1?value:null;
};
const normalizedEffect=value=>text(value)==='食材發現率'?'食材機率':text(value);
const ratingFromScore=score=>POKEMON_PROVISIONAL_RATING_LABELS[GRADE_LOWER_BOUNDS.findIndex(min=>score>=min)];

function hold(required,reason){
  return {
    schema:'pokemon-role-fit-provisional/1.0',rule_version:POKEMON_PROVISIONAL_RATING_RULE_VERSION,
    status:'REVIEW_REQUIRED',proposed_rating:null,heuristic_score:null,
    current_rating:null,future_rating:null,current_heuristic_score:null,future_heuristic_score:null,
    current_contribution:null,future_contribution:null,
    missing_inputs:[...new Set(required)].sort(),reason_codes:[...new Set(reason)].sort(),
    score_breakdown:[],player_data_write:false,overwrite_allowed:false,
  };
}
// The same named subskill cannot occupy two distinct verified slots on one
// Pokémon. An imported duplicate would otherwise earn its role weight twice.
// Keep the source intact and HOLD for review; never repair player observations.
function slotRows(subskills){
  const slots=new Map(),seenNames=new Set(),invalid=[];
  for(const row of Array.isArray(subskills)?subskills:[]){
    const level=number(row?.unlock_level??row?.level);
    const name=text(row?.subskill_name??row?.name);
    if(!LEVELS.includes(level)||!name||!SUBSKILLS.includes(name)){
      invalid.push('invalid_or_unverified_subskill');continue;
    }
    if(seenNames.has(name))invalid.push('duplicate_subskill_name');
    else seenNames.add(name);
    if(slots.has(level))invalid.push('duplicate_subskill_level');
    else slots.set(level,name);
  }
  for(const level of LEVELS)if(!slots.has(level))invalid.push('subskill_level_'+level);
  return {slots,invalid};
}

/**
 * Pure role-fit PREVIEW used identically for reviewed screenshot drafts and
 * existing Pokémon box records. Only complete, corroborated ability profiles
 * receive a 15-band heuristic recommendation. It is NOT current performance.
 * A future Lv.50 skill contributes to future potential but never CURRENT.
 */
export function scorePokemonProvisionalRating({pokemon={},ingredients=[],subskills=[],evidenceConflicts=[]}={}){
  const missing=[],reasons=[],specialty=text(pokemon.specialty),species=text(pokemon.current_species||pokemon.species||pokemon.original_label);
  const nature=text(pokemon.nature),knownNature=NATURES[nature],level=number(pokemon.level);
  if(!species)missing.push('species');
  if(!SUBSKILL_WEIGHTS[specialty])missing.push('verified_specialty');
  if(!knownNature)missing.push('verified_nature');
  if(level===null)missing.push('valid_level');
  // Imported identity-review flags are provenance gates, not generic JS
  // truthiness. A coercible/unknown flag must HOLD, never silently certify
  // a 15-band grade. Preserve legacy SQLite 0/1 and exact string 0/1.
  const reviewFlag=pokemon.identity_review_required;
  const reviewed=reviewFlag===true||reviewFlag===1||reviewFlag==='1';
  const clear=reviewFlag===undefined||reviewFlag===null||reviewFlag===false
    ||reviewFlag===0||reviewFlag==='0';
  if(reviewed)reasons.push('identity_review_required');
  else if(!clear)reasons.push('noncanonical_identity_review_flag');
  // G14.RATE.1: conflict carriers are provenance, never coercible evidence.
  // An unexpected scalar/array cannot silently mean "no conflict".
  if(!Array.isArray(evidenceConflicts))reasons.push('noncanonical_evidence_conflicts');
  else if(evidenceConflicts.length)reasons.push('observation_field_conflict');
  const fieldConflicts=pokemon.field_conflicts;
  if(fieldConflicts!==undefined&&fieldConflicts!==null){
    if(typeof fieldConflicts!=='object'||Array.isArray(fieldConflicts))
      reasons.push('noncanonical_observation_field_conflicts');
    else if(Object.keys(fieldConflicts).length)reasons.push('observation_field_conflict');
  }

  const {slots,invalid}=slotRows(subskills);
  missing.push(...invalid);
  const rawSkillLevel=pokemon.main_skill_level;
  const knownSkillLevel=number(rawSkillLevel);
  if(rawSkillLevel!==null&&rawSkillLevel!==undefined&&rawSkillLevel!==''&&
    (knownSkillLevel===null||knownSkillLevel>MAX_REVIEWED_MAIN_SKILL_LEVEL))
    missing.push('invalid_main_skill_level');
  if(specialty==='食材'){
    const ingredientRows=Array.isArray(ingredients)?ingredients:[];
    // Nonempty text is not source verification: only canonical public identity is eligible.
    if(!ingredientRows.some(row=>number(row?.unlock_level??row?.level)===1&&INGREDIENTS.includes(text(row?.ingredient_name??row?.name))))missing.push('level_1_ingredient');
  }
  // An unknown main-skill label must not silently receive a confident grade.
  if(specialty==='技能'&&!MAIN_SKILLS.includes(text(pokemon.main_skill)))missing.push('main_skill');
  if(knownNature){
    if(nonempty(pokemon.nature_bonus)&&normalizedEffect(pokemon.nature_bonus)!==normalizedEffect(knownNature[0]))reasons.push('nature_bonus_evidence_conflict');
    if(nonempty(pokemon.nature_penalty)&&normalizedEffect(pokemon.nature_penalty)!==normalizedEffect(knownNature[1]))reasons.push('nature_penalty_evidence_conflict');
  }
  if(missing.length||reasons.length)return hold(missing,reasons.length?reasons:['missing_verified_inputs']);

  let score=40,current=0,future=0,naturePoints=0;
  const skillLevelPoints=knownSkillLevel===null?null:
    (knownSkillLevel-1)*(MAIN_SKILL_LEVEL_ROLE_POINTS[specialty]||0);
  if(skillLevelPoints!==null)score+=skillLevelPoints;
  const breakdown=[{source:'heuristic_base',delta:40,scope:'LONG_TERM',reason:'fixed_product_baseline'}];
  if(skillLevelPoints!==null&&skillLevelPoints!==0)breakdown.push({
    source:'main_skill_level',name:pokemon.main_skill||'主技能',level:knownSkillLevel,
    delta:skillLevelPoints,scope:'CURRENT',reason:'verified_main_skill_level_role_heuristic',
  });
  const natureWeights=NATURE_WEIGHTS[specialty],subskillWeights=SUBSKILL_WEIGHTS[specialty];
  const [positive,negative]=knownNature;
  for(const [direction,effect,sign] of [['UP',positive,1],['DOWN',negative,-1]]){
    const weight=natureWeights[normalizedEffect(effect)]||0;
    if(weight){
      const delta=weight*sign;score+=delta;naturePoints+=delta;
      breakdown.push({source:'nature',name:effect,direction,delta,scope:'LONG_TERM',reason:'role_nature_fit_heuristic'});
    }
  }
  for(const [unlockLevel,name] of slots){
    const delta=subskillWeights[name]||0;
    if(!delta)continue; // Verified non-target skills are neutral, not missing.
    score+=delta;
    if(unlockLevel<=level)current+=delta;else future+=delta;
    breakdown.push({source:'subskill',name,unlock_level:unlockLevel,delta,scope:unlockLevel<=level?'CURRENT':'FUTURE',reason:'role_subskill_fit_heuristic'});
  }
  const bounded=Math.max(0,Math.min(100,score));
  // CURRENT is a role-fit *heuristic* at the observed level, not energy or
  // current production. Known future subskill values never enter CURRENT.
  // FUTURE is the original full-profile long-term rule, NOT a guaranteed ROI.
  const currentScore=Math.max(0,Math.min(100,40+naturePoints+current+(skillLevelPoints??0)));
  return {
    schema:'pokemon-role-fit-provisional/1.0',rule_version:POKEMON_PROVISIONAL_RATING_RULE_VERSION,
    projection_version:POKEMON_CURRENT_FUTURE_RATING_VIEW_VERSION,
    status:'PROVISIONAL_HEURISTIC',proposed_rating:ratingFromScore(bounded),heuristic_score:bounded,
    current_rating:ratingFromScore(currentScore),future_rating:ratingFromScore(bounded),
    current_heuristic_score:currentScore,future_heuristic_score:bounded,
    current_contribution:current,future_contribution:future,
    main_skill_level_contribution:skillLevelPoints,
    main_skill_level_scored:skillLevelPoints!==null,
    missing_inputs:[],reason_codes:['PRODUCT_HEURISTIC_NOT_OFFICIAL','NOT_A_PRODUCTION_OR_ROI_ESTIMATE','FUTURE_SLOTS_EXCLUDED_FROM_CURRENT'],
    score_breakdown:breakdown,player_data_write:false,overwrite_allowed:false,
  };
}

/**
 * Read-only replacement plan. No attempt is made to UPDATE pokemon.rating:
 * a separate snapshot+diff+explicit-consent+admitted-writer Gate is required.
 */
export function planPokemonRosterProvisionalRegrade({pokemon=[],details=[]}={}){
  const byId=new Map((Array.isArray(details)?details:[]).map(row=>[text(row.pokemon_id),row]));
  const seen=new Set(),proposals=[],held=[];
  for(const row of Array.isArray(pokemon)?pokemon:[]){
    const id=text(row?.pokemon_id);
    if(!id||seen.has(id)){
      held.push({pokemon_id:id||null,reason_codes:['missing_or_duplicate_pokemon_id']});continue;
    }
    seen.add(id);
    const detail=byId.get(id)||{},result=scorePokemonProvisionalRating({
      pokemon:row,ingredients:detail.ingredients||[],subskills:detail.subskills||[],
      evidenceConflicts:detail.evidenceConflicts||[],
    });
    const item={pokemon_id:id,pokemon_instance_id:row.pokemon_instance_id||null,
      previous_rating:row.rating??null,proposed_rating:result.proposed_rating,
      current_rating:result.current_rating,future_rating:result.future_rating,
      current_heuristic_score:result.current_heuristic_score,
      future_heuristic_score:result.future_heuristic_score,
      status:result.status,rule_version:result.rule_version,missing_inputs:result.missing_inputs,
      reason_codes:result.reason_codes,score_breakdown:result.score_breakdown,
      changed:result.proposed_rating!==null&&result.proposed_rating!==row.rating};
    if(result.proposed_rating===null)held.push(item);else proposals.push(item);
  }
  return {schema:'pokemon-role-fit-roster-regrade-preview/1.0',
    rule_version:POKEMON_PROVISIONAL_RATING_RULE_VERSION,
    proposals,held,summary:{total:proposals.length+held.length,eligible:proposals.length,
      changed:proposals.filter(row=>row.changed).length,held:held.length},
    player_data_write:false,overwrite_allowed:false,
    next_gate:'SNAPSHOT_DIFF_USER_CONFIRMATION_DURABLE_WRITER_READBACK_ROLLBACK',
  };
}
