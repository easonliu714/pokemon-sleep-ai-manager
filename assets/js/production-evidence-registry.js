import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_MAIN_SKILL_MASTER} from './public-pokemon-knowledge-master.js';
import {currentProductionAuthorityRegistry} from './production-authority-registry.js';

export const PRODUCTION_EVIDENCE_REGISTRY_VERSION='production-evidence-registry-2026-08-12-a';

export const EVIDENCE_STATUS=Object.freeze({
  OBSERVED_INPUT_READY:'OBSERVED_INPUT_READY',
  LOCAL_PUBLIC_MASTER:'LOCAL_PUBLIC_MASTER',
  REFERENCE_EVIDENCE_IDENTIFIED:'REFERENCE_EVIDENCE_IDENTIFIED',
  REFERENCE_EFFECT_TEXT_ONLY:'REFERENCE_EFFECT_TEXT_ONLY',
  BLOCKED_MISSING_NUMERIC_MASTER:'BLOCKED_MISSING_NUMERIC_MASTER',
  BLOCKED_DYNAMIC_RULE:'BLOCKED_DYNAMIC_RULE',
});

const text=value=>String(value??'').normalize('NFKC').trim();
const num=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function hash(value){let h=2166136261;for(const byte of new TextEncoder().encode(value)){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const freezeRow=row=>Object.freeze({...row,source_refs:Object.freeze([...(row.source_refs||[])]),blocking_reasons:Object.freeze([...(row.blocking_reasons||[])])});

const SOURCE_REFS=Object.freeze({
  berry_strength_table:Object.freeze(['Serebii Pokémon Sleep berry strength level tables']),
  helping_frequency:Object.freeze(['RaenonX Pokémon Sleep Wiki: Helping Frequency Formula']),
  production_rates:Object.freeze(['RaenonX Pokémon Sleep Wiki: Production Rates']),
  skill_dynamic:Object.freeze([
    'Pokémon Sleep official update v3.3.0: main skill trigger chance changes with daily trigger count',
    'Pokémon Sleep official event notices: main skill trigger chance can receive event multipliers',
  ]),
  skill_effect:Object.freeze(['Pokémon Sleep official notices + local PUBLIC_MAIN_SKILL_MASTER effect text']),
});

function berryTypeMap(){return new Map(PUBLIC_BERRY_TYPES.map(row=>[text(row.type_name),text(row.berry_name)]).filter(([type,berry])=>type&&berry));}
function skillNameSet(){return new Set(PUBLIC_MAIN_SKILL_MASTER.map(row=>text(row.main_skill_name)).filter(Boolean));}

function coverage(count,total){return Object.freeze({observed_count:count,total_count:total,ratio:total?count/total:null});}

export function buildProductionEvidenceSnapshot({candidateFeatures={},weeklyContext={},productionRegistry=currentProductionAuthorityRegistry()}={}){
  const candidates=Array.isArray(candidateFeatures?.candidates)?candidateFeatures.candidates:[];
  const total=candidates.length,berryMap=berryTypeMap(),skillNames=skillNameSet();
  const helperObserved=candidates.filter(row=>num(row?.helper_seconds)!==null&&num(row.helper_seconds)>0).length;
  const typeMapped=candidates.filter(row=>berryMap.has(text(row?.type))).length;
  const ingredientSlotsObserved=candidates.filter(row=>Array.isArray(row?.unlocked_ingredients)&&row.unlocked_ingredients.some(item=>text(item?.ingredient_name)&&num(item?.quantity)!==null)).length;
  const skillNamesMatched=candidates.filter(row=>text(row?.main_skill)&&skillNames.has(text(row.main_skill))).length;
  const weeklyFavorites=[weeklyContext?.favorite_berry_1,weeklyContext?.favorite_berry_2,weeklyContext?.favorite_berry_3].map(text).filter(Boolean);
  const rules=Object.freeze([
    freezeRow({dimension:'helper_interval_seconds',authority_status:productionRegistry?.rules?.helper_interval_seconds?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.OBSERVED_INPUT_READY,coverage:coverage(helperObserved,total),runtime_numeric_activation:false,source_refs:['player pokemon.helper_seconds'],blocking_reasons:helperObserved===total&&total?'NONE':['INCOMPLETE_PLAYER_HELPER_SECONDS']}),
    freezeRow({dimension:'berry_identity_by_type',authority_status:'LOCAL_PUBLIC_MASTER',evidence_status:EVIDENCE_STATUS.LOCAL_PUBLIC_MASTER,coverage:coverage(typeMapped,total),runtime_numeric_activation:false,source_refs:['shared-master-data.PUBLIC_BERRY_TYPES'],blocking_reasons:typeMapped===total&&total?'NONE':['INCOMPLETE_TYPE_TO_BERRY_MAPPING']}),
    freezeRow({dimension:'weekly_favorite_berry_identity',authority_status:'PLAYER_WEEK_OBSERVATION_OR_PUBLIC_CAMP_MASTER',evidence_status:weeklyFavorites.length===3?EVIDENCE_STATUS.OBSERVED_INPUT_READY:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(weeklyFavorites.length,3),runtime_numeric_activation:false,source_refs:['weekly_context.favorite_berry_1..3','public-camp-berry-master'],blocking_reasons:weeklyFavorites.length===3?'NONE':['WEEKLY_FAVORITE_BERRIES_INCOMPLETE']}),
    freezeRow({dimension:'berry_energy_per_berry',authority_status:productionRegistry?.rules?.berry_energy_per_berry?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.berry_strength_table,blocking_reasons:['LOCAL_BERRY_STRENGTH_BY_LEVEL_MASTER_MISSING']}),
    freezeRow({dimension:'favorite_berry_multiplier',authority_status:productionRegistry?.rules?.favorite_berry_multiplier?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.production_rates,blocking_reasons:['LOCAL_FAVORITE_BERRY_MULTIPLIER_CONTRACT_MISSING']}),
    freezeRow({dimension:'berry_output_per_help',authority_status:productionRegistry?.rules?.berry_output_per_help?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.production_rates,blocking_reasons:['LOCAL_BERRY_OUTPUT_PER_HELP_CONTRACT_MISSING','HELP_EVENT_SPLIT_NOT_YET_GOVERNED']}),
    freezeRow({dimension:'ingredient_probability_per_help',authority_status:productionRegistry?.rules?.ingredient_probability_per_help?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.production_rates,blocking_reasons:['SPECIES_BASE_INGREDIENT_RATE_LOCAL_MASTER_MISSING']}),
    freezeRow({dimension:'ingredient_slot_distribution',authority_status:productionRegistry?.rules?.ingredient_slot_distribution?.status||'NOT_YET_VERIFIED',evidence_status:ingredientSlotsObserved?EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(ingredientSlotsObserved,total),runtime_numeric_activation:false,source_refs:['player observed unlocked ingredient slots',...SOURCE_REFS.production_rates],blocking_reasons:['PLAYER_SLOT_IDENTITY_OBSERVED_BUT_PRODUCTION_WEIGHT_MISSING']}),
    freezeRow({dimension:'main_skill_trigger_probability',authority_status:productionRegistry?.rules?.main_skill_trigger_probability?.status||'NOT_YET_VERIFIED',evidence_status:EVIDENCE_STATUS.BLOCKED_DYNAMIC_RULE,coverage:coverage(0,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.skill_dynamic,blocking_reasons:['SPECIES_BASE_SKILL_TRIGGER_RATE_LOCAL_MASTER_MISSING','DAILY_TRIGGER_COUNT_DYNAMIC_RULE','WEEKLY_EVENT_TRIGGER_MULTIPLIER_MUST_BE_APPLIED']}),
    freezeRow({dimension:'main_skill_effect_value',authority_status:productionRegistry?.rules?.main_skill_effect_value?.status||'NOT_YET_VERIFIED',evidence_status:skillNamesMatched?EVIDENCE_STATUS.REFERENCE_EFFECT_TEXT_ONLY:EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,coverage:coverage(skillNamesMatched,total),runtime_numeric_activation:false,source_refs:SOURCE_REFS.skill_effect,blocking_reasons:['LOCAL_QUANTITATIVE_SKILL_LEVEL_EFFECT_MASTER_MISSING']}),
  ]);
  const numericDimensions=rules.filter(row=>['berry_energy_per_berry','favorite_berry_multiplier','berry_output_per_help','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'].includes(row.dimension));
  const activeNumeric=numericDimensions.filter(row=>row.runtime_numeric_activation).length;
  const payload=stable({
    schema:'pokemon-sleep-production-evidence-snapshot/1.0',registry_version:PRODUCTION_EVIDENCE_REGISTRY_VERSION,
    production_authority_registry_version:productionRegistry?.registry_version||null,numeric_rate_model_status:productionRegistry?.numeric_rate_model_status||'NOT_YET_VERIFIED',
    candidate_count:total,weekly_favorite_berry_count:weeklyFavorites.length,rules,
    summary:{rule_count:rules.length,numeric_dimension_count:numericDimensions.length,active_numeric_dimension_count:activeNumeric,blocked_numeric_dimension_count:numericDimensions.length-activeNumeric,helper_seconds_observed_count:helperObserved,type_to_berry_mapped_count:typeMapped,ingredient_slot_observed_candidate_count:ingredientSlotsObserved,skill_effect_text_matched_candidate_count:skillNamesMatched},
    activation_decision:activeNumeric===numericDimensions.length&&numericDimensions.length?'READY_FOR_NUMERIC_MODEL':'HOLD_NUMERIC_MODEL_NOT_ACTIVE',
    safety:{missing_is_zero:false,player_data_write:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false},
  });
  return Object.freeze({...payload,evidence_fingerprint:`production_evidence:${hash(JSON.stringify(payload))}`,privacy_manifest:Object.freeze({stable_pokemon_ids_in_payload:false,raw_sqlite_in_payload:false,api_key_in_payload:false,source_images_in_payload:false})});
}
