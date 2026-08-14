import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_MAIN_SKILL_MASTER} from './public-pokemon-knowledge-master.js';
import {PUBLIC_BERRY_STRENGTH_VERSION,resolveBerryStrengthForTypeAtLevel} from './public-berry-strength-master.js';
import {FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,resolveFavoriteBerryMultiplier} from './favorite-berry-multiplier-contract.js';
import {HELP_EVENT_SPLIT_CONTRACT_ID,HELP_EVENT_SPLIT_AUTHORITY_STATUS,currentHelpEventSplitContract} from './help-event-split-contract.js';
import {BASE_BERRY_OUTPUT_CONTRACT_ID,resolveCandidateBaseBerryOutput,hasUnlockedBerryFindingS} from './base-berry-output-contract.js';
import {currentProductionAuthorityRegistry} from './production-authority-registry.js';
import {
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  ingredientProductionEvidenceBoundary,
} from './ingredient-production-evidence-contract.js';

export const PRODUCTION_EVIDENCE_REGISTRY_VERSION='production-evidence-registry-2026-08-14-e-ingredient-evidence-boundary';
export const EVIDENCE_STATUS=Object.freeze({
  OBSERVED_INPUT_READY:'OBSERVED_INPUT_READY',LOCAL_PUBLIC_MASTER:'LOCAL_PUBLIC_MASTER',
  ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER:'ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER',
  ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT:'ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT',
  ACTIVE_VERIFIED_LOCAL_STRUCTURAL_CONTRACT:'ACTIVE_VERIFIED_LOCAL_STRUCTURAL_CONTRACT',
  REFERENCE_EVIDENCE_IDENTIFIED:'REFERENCE_EVIDENCE_IDENTIFIED',REFERENCE_EFFECT_TEXT_ONLY:'REFERENCE_EFFECT_TEXT_ONLY',
  BLOCKED_MISSING_NUMERIC_MASTER:'BLOCKED_MISSING_NUMERIC_MASTER',BLOCKED_DYNAMIC_RULE:'BLOCKED_DYNAMIC_RULE',
});

const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const coverage=(count,total)=>Object.freeze({observed_count:count,total_count:total,ratio:total?count/total:null});
const freezeRow=row=>Object.freeze({...row,source_refs:Object.freeze([...(row.source_refs||[])]),blocking_reasons:Object.freeze([...(row.blocking_reasons||[])])});

const HELP_SPLIT=currentHelpEventSplitContract();
const INGREDIENT_BOUNDARY=ingredientProductionEvidenceBoundary();
const ingredientSourceIds=dimension=>(INGREDIENT_BOUNDARY.dimensions?.[dimension]?.source_refs||[]).map(row=>row.source_id);
const SOURCE_REFS=Object.freeze({
  berry_strength:[PUBLIC_BERRY_STRENGTH_VERSION,'Pokémon Sleep verified berry base energy/formula (Lv.1–70)'],
  favorite_multiplier:[FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,'RaenonX Snorlax Favorite: regular/EX base favorite multiplier ×2','Pokémon Sleep official Expert Mode: main favorite may receive separate helping-frequency bonuses'],
  help_event_split:[HELP_EVENT_SPLIT_CONTRACT_ID,...HELP_SPLIT.source_refs],
  base_berry_output:[BASE_BERRY_OUTPUT_CONTRACT_ID,'Serebii Pokémon Sleep berry producer tables: Berries specialty Quantity 2; other specialties Quantity 1','Serebii Pokémon Sleep Skills: Berry Finding S increases Berries found at one time by 1','Pokémon Sleep official Buncha Berries Week Part 2: event +1 Berry remains a separate modifier'],
  ingredient_probability:[INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,...ingredientSourceIds('ingredient_probability_per_help')],
  ingredient_slot_distribution:[INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,...ingredientSourceIds('ingredient_slot_distribution')],
  ingredient_combination_assignment:[INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,...ingredientSourceIds('ingredient_combination_assignment_probability')],
  skill_dynamic:['Pokémon Sleep official update v3.3.0: main skill trigger chance changes with daily trigger count','Pokémon Sleep official event notices: main skill trigger chance can receive event multipliers'],
  skill_effect:['Pokémon Sleep official notices + local PUBLIC_MAIN_SKILL_MASTER effect text'],
});

export function buildProductionEvidenceSnapshot({candidateFeatures={},weeklyContext={},productionRegistry=currentProductionAuthorityRegistry()}={}){
  const candidates=Array.isArray(candidateFeatures?.candidates)?candidateFeatures.candidates:[],total=candidates.length;
  const berryMap=new Map(PUBLIC_BERRY_TYPES.map(row=>[text(row.type_name),text(row.berry_name)]).filter(([type,berry])=>type&&berry));
  const skillNames=new Set(PUBLIC_MAIN_SKILL_MASTER.map(row=>text(row.main_skill_name)).filter(Boolean));
  const helperObserved=candidates.filter(row=>num(row?.helper_seconds)!==null&&num(row.helper_seconds)>0).length;
  const typeMapped=candidates.filter(row=>berryMap.has(text(row?.type))).length;
  const berryStrengthResolved=candidates.filter(row=>resolveBerryStrengthForTypeAtLevel(row?.type,row?.level).status==='ACTIVE_VERIFIED').length;
  const baseBerryOutputResults=candidates.map(row=>resolveCandidateBaseBerryOutput(row));
  const baseBerryOutputResolved=baseBerryOutputResults.filter(row=>row.status==='ACTIVE_VERIFIED').length;
  const berryFindingSCandidates=candidates.filter(row=>hasUnlockedBerryFindingS(row?.unlocked_subskills||[])).length;
  const ingredientSlotsObserved=candidates.filter(row=>Array.isArray(row?.unlocked_ingredients)&&row.unlocked_ingredients.some(item=>text(item?.ingredient_name)&&num(item?.quantity)!==null)).length;
  const skillNamesMatched=candidates.filter(row=>text(row?.main_skill)&&skillNames.has(text(row.main_skill))).length;
  const weeklyFavorites=[weeklyContext?.favorite_berry_1,weeklyContext?.favorite_berry_2,weeklyContext?.favorite_berry_3].map(text).filter(Boolean);
  const favoriteMultiplierResolved=candidates.filter(row=>{
    const berryName=berryMap.get(text(row?.type))||'';
    return resolveFavoriteBerryMultiplier({berry_name:berryName,weekly_favorite_berries:weeklyFavorites}).status==='ACTIVE_VERIFIED';
  }).length;
  const status=dimension=>productionRegistry?.rules?.[dimension]?.status||'NOT_YET_VERIFIED';
  const blockers=dimension=>[...(productionRegistry?.rules?.[dimension]?.missing_inputs||[])];
  const berryStrengthActive=status('berry_energy_per_berry')==='ACTIVE_VERIFIED';
  const favoriteMultiplierActive=status('favorite_berry_multiplier')==='ACTIVE_VERIFIED';
  const baseBerryOutputActive=status('berry_output_per_help')==='ACTIVE_VERIFIED';
  const helpSplitActive=status('help_event_split')===HELP_EVENT_SPLIT_AUTHORITY_STATUS;
  const rules=Object.freeze([
    freezeRow({dimension:'helper_interval_seconds',authority_status:status('helper_interval_seconds'),evidence_status:EVIDENCE_STATUS.OBSERVED_INPUT_READY,coverage:coverage(helperObserved,total),runtime_numeric_activation:false,source_refs:['player pokemon.helper_seconds'],blocking_reasons:helperObserved===total&&total?[]:['INCOMPLETE_PLAYER_HELPER_SECONDS']}),
    freezeRow({dimension:'help_event_split',authority_status:status('help_event_split'),evidence_status:helpSplitActive?EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_STRUCTURAL_CONTRACT:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(helpSplitActive?1:0,1),runtime_numeric_activation:false,source_refs:SOURCE_REFS.help_event_split,blocking_reasons:helpSplitActive?[]:['HELP_EVENT_SPLIT_NOT_YET_GOVERNED']}),
    freezeRow({dimension:'berry_identity_by_type',authority_status:'LOCAL_PUBLIC_MASTER',evidence_status:EVIDENCE_STATUS.LOCAL_PUBLIC_MASTER,coverage:coverage(typeMapped,total),runtime_numeric_activation:false,source_refs:['shared-master-data.PUBLIC_BERRY_TYPES'],blocking_reasons:typeMapped===total&&total?[]:['INCOMPLETE_TYPE_TO_BERRY_MAPPING']}),
    freezeRow({dimension:'weekly_favorite_berry_identity',authority_status:'PLAYER_WEEK_OBSERVATION_OR_PUBLIC_CAMP_MASTER',evidence_status:weeklyFavorites.length===3?EVIDENCE_STATUS.OBSERVED_INPUT_READY:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(weeklyFavorites.length,3),runtime_numeric_activation:false,source_refs:['weekly_context.favorite_berry_1..3','public-camp-berry-master'],blocking_reasons:weeklyFavorites.length===3?[]:['WEEKLY_FAVORITE_BERRIES_INCOMPLETE']}),
    freezeRow({dimension:'berry_energy_per_berry',authority_status:status('berry_energy_per_berry'),evidence_status:berryStrengthActive?EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(berryStrengthActive?berryStrengthResolved:0,total),runtime_numeric_activation:berryStrengthActive,source_refs:SOURCE_REFS.berry_strength,blocking_reasons:berryStrengthActive?(berryStrengthResolved===total&&total?[]:['INCOMPLETE_BERRY_STRENGTH_INPUT_COVERAGE']):['LOCAL_BERRY_STRENGTH_BY_LEVEL_MASTER_MISSING']}),
    freezeRow({dimension:'favorite_berry_multiplier',authority_status:status('favorite_berry_multiplier'),evidence_status:favoriteMultiplierActive?EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(favoriteMultiplierActive?favoriteMultiplierResolved:0,total),runtime_numeric_activation:favoriteMultiplierActive,source_refs:SOURCE_REFS.favorite_multiplier,blocking_reasons:favoriteMultiplierActive?(favoriteMultiplierResolved===total&&total?[]:['INCOMPLETE_FAVORITE_BERRY_MULTIPLIER_INPUT_COVERAGE']):['LOCAL_FAVORITE_BERRY_MULTIPLIER_CONTRACT_MISSING']}),
    freezeRow({dimension:'berry_output_per_help',authority_status:status('berry_output_per_help'),evidence_status:baseBerryOutputActive?EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(baseBerryOutputActive?baseBerryOutputResolved:0,total),runtime_numeric_activation:baseBerryOutputActive,source_refs:[...SOURCE_REFS.base_berry_output,...SOURCE_REFS.help_event_split],blocking_reasons:baseBerryOutputActive?(baseBerryOutputResolved===total&&total?[]:['INCOMPLETE_BASE_BERRY_OUTPUT_INPUT_COVERAGE']):['BASE_BERRY_OUTPUT_PER_BERRY_RESULT_HELP_NUMERIC_CONTRACT_MISSING']}),
    freezeRow({
      dimension:'ingredient_probability_per_help',authority_status:status('ingredient_probability_per_help'),
      evidence_status:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(0,total),runtime_numeric_activation:false,
      source_refs:SOURCE_REFS.ingredient_probability,blocking_reasons:blockers('ingredient_probability_per_help'),
      semantic_lifecycle:'PRODUCTION_TIME',evidence_contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
    }),
    freezeRow({
      dimension:'ingredient_slot_distribution',authority_status:status('ingredient_slot_distribution'),
      evidence_status:ingredientSlotsObserved?EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,
      coverage:coverage(ingredientSlotsObserved,total),runtime_numeric_activation:false,
      source_refs:SOURCE_REFS.ingredient_slot_distribution,blocking_reasons:blockers('ingredient_slot_distribution'),
      semantic_lifecycle:'PRODUCTION_TIME',evidence_contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
      forbidden_evidence_substitution:'ingredient_combination_assignment_probability',
    }),
    freezeRow({dimension:'main_skill_trigger_probability',authority_status:status('main_skill_trigger_probability'),evidence_status:EVIDENCE_STATUS.BLOCKED_DYNAMIC_RULE,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.skill_dynamic,blocking_reasons:['SPECIES_BASE_SKILL_TRIGGER_RATE_LOCAL_MASTER_MISSING','DAILY_TRIGGER_COUNT_DYNAMIC_RULE','WEEKLY_EVENT_TRIGGER_MULTIPLIER_MUST_BE_APPLIED']}),
    freezeRow({dimension:'main_skill_effect_value',authority_status:status('main_skill_effect_value'),evidence_status:skillNamesMatched?EVIDENCE_STATUS.REFERENCE_EFFECT_TEXT_ONLY:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(skillNamesMatched,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.skill_effect,blocking_reasons:['LOCAL_QUANTITATIVE_SKILL_LEVEL_EFFECT_MASTER_MISSING']}),
  ]);
  const numericNames=new Set(['berry_energy_per_berry','favorite_berry_multiplier','berry_output_per_help','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value']);
  const numericDimensions=rules.filter(row=>numericNames.has(row.dimension)),activeNumeric=numericDimensions.filter(row=>row.runtime_numeric_activation).length;
  const payload=stable({
    schema:'pokemon-sleep-production-evidence-snapshot/1.4',registry_version:PRODUCTION_EVIDENCE_REGISTRY_VERSION,
    production_authority_registry_version:productionRegistry?.registry_version||null,
    ingredient_production_evidence_contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
    numeric_rate_model_status:productionRegistry?.numeric_rate_model_status||'NOT_YET_VERIFIED',candidate_count:total,weekly_favorite_berry_count:weeklyFavorites.length,rules,
    summary:{rule_count:rules.length,numeric_dimension_count:numericDimensions.length,active_numeric_dimension_count:activeNumeric,blocked_numeric_dimension_count:numericDimensions.length-activeNumeric,structural_verified_dimension_count:helpSplitActive?1:0,helper_seconds_observed_count:helperObserved,type_to_berry_mapped_count:typeMapped,berry_strength_resolved_candidate_count:berryStrengthResolved,favorite_berry_multiplier_resolved_candidate_count:favoriteMultiplierResolved,base_berry_output_resolved_candidate_count:baseBerryOutputResolved,berry_finding_s_candidate_count:berryFindingSCandidates,ingredient_slot_observed_candidate_count:ingredientSlotsObserved,skill_effect_text_matched_candidate_count:skillNamesMatched},
    activation_decision:activeNumeric===numericDimensions.length&&numericDimensions.length?'READY_FOR_NUMERIC_MODEL':'HOLD_NUMERIC_MODEL_NOT_ACTIVE',
    safety:{missing_is_zero:false,player_data_write:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false,catch_assignment_may_substitute_production_distribution:false},
  });
  return Object.freeze({...payload,evidence_fingerprint:`production_evidence:${hash(JSON.stringify(payload))}`,privacy_manifest:Object.freeze({stable_pokemon_ids_in_payload:false,raw_sqlite_in_payload:false,api_key_in_payload:false,source_images_in_payload:false})});
}
