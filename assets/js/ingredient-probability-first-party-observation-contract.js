import {PUBLIC_SPECIES_FORM_ROSTER_ROWS} from './public-pokemon-species-form-roster.js';
import {expectedUnlockedIngredientSlotCount,resolveIngredientSlotDistribution} from './ingredient-slot-distribution-contract.js';

export const INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID='ingredient-probability-first-party-observation-2026-08-14-a';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION='ingredient-probability-first-party-observation-v1';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_MULTI_SLOT_EXTENSION_ID='ingredient-probability-first-party-multi-slot-extension-2026-08-18-a';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_MULTI_SLOT_EXTENSION_VERSION='ingredient-probability-first-party-multi-slot-extension-v1';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_DISTINCT_SLOT_EXTENSION_ID='ingredient-probability-first-party-distinct-slot-extension-2026-08-21-a';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_DISTINCT_SLOT_EXTENSION_VERSION='ingredient-probability-first-party-distinct-slot-extension-v1';

export const FIRST_PARTY_OBSERVATION_STATUS=Object.freeze({
  ACCEPTED_RAW_OBSERVATION:'ACCEPTED_RAW_OBSERVATION',
  ACCEPTED_PARTIAL_OBSERVATION:'ACCEPTED_PARTIAL_OBSERVATION',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
});

export const FIRST_PARTY_OBSERVATION_MODES=Object.freeze({
  SINGLE_SLOT:'DIRECT_MANUAL_COLLECTION_SINGLE_SLOT_WINDOW',
  MULTI_SLOT_EQUAL_QUANTITY:'DIRECT_MANUAL_COLLECTION_MULTI_SLOT_EQUAL_QUANTITY_WINDOW',
  MULTI_SLOT_DISTINCT_QUANTITY:'DIRECT_MANUAL_COLLECTION_MULTI_SLOT_DISTINCT_QUANTITY_WINDOW',
});
export const FIRST_PARTY_OBSERVATION_MODE=FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT;
export const FIRST_PARTY_OBSERVATION_SOURCE='PLAYER_FIRST_PARTY_CAPTURE';

export const BERRY_COUNT_COMPLETENESS=Object.freeze({
  COMPLETE_CONFIRMED:'COMPLETE_CONFIRMED',
  POSSIBLY_CENSORED_BY_SNORLAX:'POSSIBLY_CENSORED_BY_SNORLAX',
});

const ROSTER_BY_KEY=new Map(PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>[row.source_key,row]));
const freeze=value=>Object.freeze(value);
const text=value=>String(value??'').normalize('NFKC').trim();
const integer=value=>{const n=Number(value);return Number.isInteger(n)?n:null;};
const nonNegativeInteger=value=>{const n=integer(value);return n!==null&&n>=0?n:null;};
const positiveInteger=value=>{const n=integer(value);return n!==null&&n>0?n:null;};
const nonEmptyRefs=value=>Array.isArray(value)&&value.map(text).filter(Boolean).length>0;
const unique=value=>[...new Set(value)];

export const FIRST_PARTY_OBSERVATION_BLOCKERS=Object.freeze({
  OBSERVATION_ID_MISSING:'OBSERVATION_ID_MISSING',
  UNKNOWN_SPECIES_FORM:'UNKNOWN_SPECIES_FORM',
  CANONICAL_SPECIES_FORM_ID_MISMATCH:'CANONICAL_SPECIES_FORM_ID_MISMATCH',
  SPECIES_FORM_IDENTITY_NOT_CONFIRMED:'SPECIES_FORM_IDENTITY_NOT_CONFIRMED',
  WRONG_OBSERVATION_SOURCE:'WRONG_OBSERVATION_SOURCE',
  PRIVATE_PLAYER_IDENTITY_INCLUDED:'PRIVATE_PLAYER_IDENTITY_INCLUDED',
  EVIDENCE_REFS_MISSING:'EVIDENCE_REFS_MISSING',
  WRONG_OBSERVATION_MODE:'WRONG_OBSERVATION_MODE',
  INVALID_LEVEL:'INVALID_LEVEL',
  MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED:'MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED',
  MULTI_SLOT_MODE_REQUIRES_MULTIPLE_UNLOCKED_SLOTS:'MULTI_SLOT_MODE_REQUIRES_MULTIPLE_UNLOCKED_SLOTS',
  MULTI_SLOT_QUANTITIES_NOT_EQUAL:'MULTI_SLOT_QUANTITIES_NOT_EQUAL',
  MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT:'MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT',
  INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED:'INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED',
  INGREDIENT_SLOT_QUANTITY_MISSING:'INGREDIENT_SLOT_QUANTITY_MISSING',
  INGREDIENT_SLOT_OBSERVED_COUNT_MISSING:'INGREDIENT_SLOT_OBSERVED_COUNT_MISSING',
  INGREDIENT_SLOT_OBSERVED_COUNT_NOT_INTEGER:'INGREDIENT_SLOT_OBSERVED_COUNT_NOT_INTEGER',
  INGREDIENT_SLOT_ITEM_TOTAL_MISMATCH:'INGREDIENT_SLOT_ITEM_TOTAL_MISMATCH',
  INDIVIDUAL_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED:'INDIVIDUAL_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED',
  ENVIRONMENT_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED:'ENVIRONMENT_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED',
  WINDOW_DID_NOT_START_EMPTY:'WINDOW_DID_NOT_START_EMPTY',
  COLLECTION_NOT_CONFIRMED_BEFORE_OVERFLOW:'COLLECTION_NOT_CONFIRMED_BEFORE_OVERFLOW',
  SNEAKY_SNACKING_OR_OVERFLOW_OBSERVED:'SNEAKY_SNACKING_OR_OVERFLOW_OBSERVED',
  HELPER_WHISTLE_USED:'HELPER_WHISTLE_USED',
  EXTERNAL_EXTRA_HELP_EFFECT_USED:'EXTERNAL_EXTRA_HELP_EFFECT_USED',
  NON_HELP_ITEM_CONTAMINATION:'NON_HELP_ITEM_CONTAMINATION',
  COLLECTION_COUNTS_INCOMPLETE:'COLLECTION_COUNTS_INCOMPLETE',
  RATE_VALUE_USED_TO_RECONSTRUCT_EVENTS:'RATE_VALUE_USED_TO_RECONSTRUCT_EVENTS',
  INVALID_ITEM_COUNTS:'INVALID_ITEM_COUNTS',
  INVALID_BERRY_ITEMS_PER_HELP:'INVALID_BERRY_ITEMS_PER_HELP',
  BERRY_OUTPUT_AUTHORITY_NOT_VERIFIED:'BERRY_OUTPUT_AUTHORITY_NOT_VERIFIED',
  INVENTORY_COUNT_MISMATCH:'INVENTORY_COUNT_MISMATCH',
  INVENTORY_CAPACITY_NOT_PROVABLY_SAFE:'INVENTORY_CAPACITY_NOT_PROVABLY_SAFE',
  BERRY_EVENT_COUNT_NOT_INTEGER:'BERRY_EVENT_COUNT_NOT_INTEGER',
  INGREDIENT_EVENT_COUNT_NOT_INTEGER:'INGREDIENT_EVENT_COUNT_NOT_INTEGER',
  ZERO_HELP_EVENTS:'ZERO_HELP_EVENTS',
});

export const FIRST_PARTY_OBSERVATION_PARTIAL_REASONS=Object.freeze({
  BERRY_COUNT_POSSIBLY_CENSORED_BY_SNORLAX:'BERRY_COUNT_POSSIBLY_CENSORED_BY_SNORLAX',
});

function normalizedBerryCompleteness(input={}){
  const value=text(input.berry_count_completeness_status);
  if(!value)return BERRY_COUNT_COMPLETENESS.COMPLETE_CONFIRMED; // predecessor compatibility
  return Object.values(BERRY_COUNT_COMPLETENESS).includes(value)?value:null;
}

export function evaluateFirstPartyIngredientHelpObservation(input={}){
  const blockers=[];
  const partialReasons=[];
  const observationId=text(input.observation_id);
  if(!observationId)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.OBSERVATION_ID_MISSING);
  const sourceKey=text(input.source_key).toUpperCase();
  const rosterRow=ROSTER_BY_KEY.get(sourceKey)||null;
  if(!rosterRow)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.UNKNOWN_SPECIES_FORM);
  if(rosterRow&&text(input.canonical_species_form_id)!==rosterRow.canonical_species_form_id)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.CANONICAL_SPECIES_FORM_ID_MISMATCH);
  if(input.species_form_identity_confirmed!==true)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.SPECIES_FORM_IDENTITY_NOT_CONFIRMED);
  if(text(input.observation_source)!==FIRST_PARTY_OBSERVATION_SOURCE)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.WRONG_OBSERVATION_SOURCE);
  if(input.player_private_identity_included!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.PRIVATE_PLAYER_IDENTITY_INCLUDED);
  if(!nonEmptyRefs(input.observation_evidence_refs))blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.EVIDENCE_REFS_MISSING);
  const observationMode=text(input.observation_mode);
  if(!Object.values(FIRST_PARTY_OBSERVATION_MODES).includes(observationMode))blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.WRONG_OBSERVATION_MODE);

  const level=integer(input.level);
  const slotCount=expectedUnlockedIngredientSlotCount(level);
  if(level===null||level<1)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_LEVEL);
  else if(observationMode===FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT&&slotCount!==1)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED);
  else if([FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY].includes(observationMode)&&slotCount!==null&&slotCount<2)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_MODE_REQUIRES_MULTIPLE_UNLOCKED_SLOTS);

  const rawSlots=Array.isArray(input.ingredient_slots)?input.ingredient_slots:[];
  const rawSlotByLevel=new Map(rawSlots.map(row=>[Number(row?.unlock_level),row]));
  const slotResolution=level!==null?resolveIngredientSlotDistribution({level,slots:rawSlots}):null;
  if(slotResolution?.status!=='ACTIVE_VERIFIED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED);
  const resolvedSlots=slotResolution?.status==='ACTIVE_VERIFIED'?slotResolution.slots:[];
  const slotQuantities=resolvedSlots.map(row=>positiveInteger(row.quantity));
  if(slotResolution?.status==='ACTIVE_VERIFIED'&&slotQuantities.some(value=>value===null))blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_QUANTITY_MISSING);
  const validSlotQuantities=slotQuantities.filter(value=>value!==null);
  const equalMultiSlotQuantities=validSlotQuantities.length>=2&&new Set(validSlotQuantities).size===1;
  const resolvedNames=resolvedSlots.map(row=>text(row.ingredient_name)).filter(Boolean);
  const distinctIngredientNames=resolvedNames.length===resolvedSlots.length&&new Set(resolvedNames).size===resolvedNames.length;

  if(observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY&&slotResolution?.status==='ACTIVE_VERIFIED'&&validSlotQuantities.length===slotQuantities.length&&!equalMultiSlotQuantities){
    blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_QUANTITIES_NOT_EQUAL);
  }
  if(observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY&&slotResolution?.status==='ACTIVE_VERIFIED'&&!distinctIngredientNames){
    blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT);
  }

  const ingredientItemsPerHelp=validSlotQuantities.length&&(
    observationMode===FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT||equalMultiSlotQuantities
  )?validSlotQuantities[0]:null;

  if(text(input.individual_ingredient_rate_modifier_state)!=='NONE_ACTIVE_CONFIRMED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INDIVIDUAL_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED);
  if(text(input.environment_ingredient_rate_modifier_state)!=='NONE_ACTIVE_CONFIRMED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.ENVIRONMENT_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED);
  if(input.inventory_empty_at_window_start!==true)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.WINDOW_DID_NOT_START_EMPTY);
  if(input.collection_before_inventory_overflow_confirmed!==true)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.COLLECTION_NOT_CONFIRMED_BEFORE_OVERFLOW);
  if(input.sneaky_snacking_or_overflow_observed!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.SNEAKY_SNACKING_OR_OVERFLOW_OBSERVED);
  if(input.helper_whistle_used!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.HELPER_WHISTLE_USED);
  if(input.external_extra_help_effect_used!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.EXTERNAL_EXTRA_HELP_EFFECT_USED);
  if(input.non_help_item_contamination!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.NON_HELP_ITEM_CONTAMINATION);
  if(input.collection_counts_complete!==true)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.COLLECTION_COUNTS_INCOMPLETE);
  if(input.external_rate_value_used_to_reconstruct_events!==false)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.RATE_VALUE_USED_TO_RECONSTRUCT_EVENTS);

  const berryCompleteness=normalizedBerryCompleteness(input);
  if(berryCompleteness===BERRY_COUNT_COMPLETENESS.POSSIBLY_CENSORED_BY_SNORLAX){
    partialReasons.push(FIRST_PARTY_OBSERVATION_PARTIAL_REASONS.BERRY_COUNT_POSSIBLY_CENSORED_BY_SNORLAX);
  }

  const berryItems=nonNegativeInteger(input.berry_items_collected);
  const ingredientItems=nonNegativeInteger(input.ingredient_items_collected);
  if(ingredientItems===null||berryItems===null)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_ITEM_COUNTS);
  const berryItemsPerHelp=positiveInteger(input.berry_items_per_help);
  if(berryItemsPerHelp===null)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_BERRY_ITEMS_PER_HELP);
  if(text(input.berry_items_per_help_authority)!=='DETERMINISTIC_PLATFORM_VERIFIED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.BERRY_OUTPUT_AUTHORITY_NOT_VERIFIED);

  const inventoryCount=nonNegativeInteger(input.inventory_items_before_collection);
  const inventoryCapacity=positiveInteger(input.inventory_capacity);
  if(berryCompleteness===BERRY_COUNT_COMPLETENESS.COMPLETE_CONFIRMED){
    if(inventoryCount===null||berryItems===null||ingredientItems===null||inventoryCount!==berryItems+ingredientItems)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVENTORY_COUNT_MISMATCH);
    if(inventoryCount===null||inventoryCapacity===null||inventoryCount>=inventoryCapacity)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVENTORY_CAPACITY_NOT_PROVABLY_SAFE);
  }

  let ingredientHelpEvents=null;
  if(observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY&&resolvedSlots.length){
    let totalObservedItems=0,totalEvents=0,slotCountsValid=true;
    for(const slot of resolvedSlots){
      const raw=rawSlotByLevel.get(Number(slot.unlock_level))||{};
      const observed=nonNegativeInteger(raw.observed_item_count);
      const quantity=positiveInteger(slot.quantity);
      if(observed===null){blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_OBSERVED_COUNT_MISSING);slotCountsValid=false;continue;}
      totalObservedItems+=observed;
      if(quantity===null||observed%quantity!==0){blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_OBSERVED_COUNT_NOT_INTEGER);slotCountsValid=false;continue;}
      totalEvents+=observed/quantity;
    }
    if(ingredientItems!==null&&totalObservedItems!==ingredientItems)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_ITEM_TOTAL_MISMATCH);
    if(slotCountsValid&&distinctIngredientNames)ingredientHelpEvents=totalEvents;
  }else if(ingredientItems!==null&&ingredientItemsPerHelp!==null){
    if(ingredientItems%ingredientItemsPerHelp!==0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_EVENT_COUNT_NOT_INTEGER);
    else ingredientHelpEvents=ingredientItems/ingredientItemsPerHelp;
  }

  let berryHelpEvents=null,totalHelpEvents=null,ingredientEventFraction=null;
  if(berryCompleteness===BERRY_COUNT_COMPLETENESS.COMPLETE_CONFIRMED&&berryItems!==null&&berryItemsPerHelp!==null){
    if(berryItems%berryItemsPerHelp!==0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.BERRY_EVENT_COUNT_NOT_INTEGER);
    else berryHelpEvents=berryItems/berryItemsPerHelp;
  }
  if(berryHelpEvents!==null&&ingredientHelpEvents!==null){
    totalHelpEvents=berryHelpEvents+ingredientHelpEvents;
    if(totalHelpEvents<=0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.ZERO_HELP_EVENTS);
    else ingredientEventFraction=ingredientHelpEvents/totalHelpEvents;
  }

  const hardBlockers=unique(blockers);
  const partial=hardBlockers.length===0&&partialReasons.length>0&&ingredientHelpEvents!==null;
  const accepted=hardBlockers.length===0&&!partial&&berryHelpEvents!==null&&ingredientHelpEvents!==null&&totalHelpEvents>0;
  const status=accepted?FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION:partial?FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_PARTIAL_OBSERVATION:FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED;
  const seriesId=text(input.observation_series_id)||null;
  const windowSequence=positiveInteger(input.window_sequence);

  const commonSafety={
    rate_value_used_to_reconstruct_events:false,
    invalid_batch_contributes_to_estimate:false,
    sample_sufficiency_threshold_invented:false,
    runtime_network_fetch:false,
    player_data_write:false,
    sqlite_write:false,
    ai_numeric_authority:false,
    outcome_dependent_window_selection:false,
    slot_selection_probability_used:false,
    berry_count_completeness_status:berryCompleteness,
    berry_denominator_complete:berryCompleteness===BERRY_COUNT_COMPLETENESS.COMPLETE_CONFIRMED,
    censored_partial_observation:partial,
    partial_reasons:freeze(unique(partialReasons)),
    observation_series_id:seriesId,
    window_sequence:windowSequence,
    repeated_windows_supported:true,
    repeated_windows_do_not_rescue_censored_denominator:true,
  };
  const modeSafety=observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY?{
    only_single_unlocked_ingredient_slot:false,
    multi_slot_extension_id:INGREDIENT_PROBABILITY_FIRST_PARTY_MULTI_SLOT_EXTENSION_ID,
    multi_slot_extension_version:INGREDIENT_PROBABILITY_FIRST_PARTY_MULTI_SLOT_EXTENSION_VERSION,
    multi_slot_equal_quantity_mode:true,
    multi_slot_eligibility_preobservable:equalMultiSlotQuantities,
  }:observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY?{
    only_single_unlocked_ingredient_slot:false,
    distinct_slot_extension_id:INGREDIENT_PROBABILITY_FIRST_PARTY_DISTINCT_SLOT_EXTENSION_ID,
    distinct_slot_extension_version:INGREDIENT_PROBABILITY_FIRST_PARTY_DISTINCT_SLOT_EXTENSION_VERSION,
    multi_slot_distinct_quantity_mode:true,
    distinct_ingredient_names_preobservable:distinctIngredientNames,
    per_slot_observed_item_counts_required:true,
  }:{only_single_unlocked_ingredient_slot:true};

  return freeze({
    schema:'pokemon-sleep-first-party-ingredient-help-observation-result/1.2',
    contract_id:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
    contract_version:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION,
    observation_id:observationId||null,
    source_key:sourceKey||null,
    canonical_species_form_id:rosterRow?.canonical_species_form_id||null,
    status,
    blockers:freeze(hardBlockers),
    partial_reasons:freeze(unique(partialReasons)),
    eligible_for_statistical_aggregation:accepted,
    berry_help_event_count:accepted?berryHelpEvents:null,
    ingredient_help_event_count:(accepted||partial)?ingredientHelpEvents:null,
    total_help_event_count:accepted?totalHelpEvents:null,
    ingredient_event_fraction:accepted?ingredientEventFraction:null,
    statistical_semantics:accepted?'BERNOULLI_HELP_EVENT_SPLIT_OBSERVATION':partial?'INGREDIENT_EVENT_NUMERATOR_ONLY_CENSORED_BERRY_DENOMINATOR':'NOT_STATISTICALLY_ADMISSIBLE',
    base_rate_normalization_applied:false,
    activation_authority_granted:false,
    independent_source_admission_granted:false,
    safety:freeze({...commonSafety,...modeSafety}),
  });
}

export function wilsonBinomialInterval(successes,total,z=1.959963984540054){
  const k=nonNegativeInteger(successes),n=positiveInteger(total),zValue=Number(z);
  if(k===null||n===null||k>n||!Number.isFinite(zValue)||zValue<=0)return null;
  const p=k/n,z2=zValue*zValue,denom=1+z2/n;
  const center=(p+z2/(2*n))/denom;
  const half=(zValue*Math.sqrt((p*(1-p)/n)+(z2/(4*n*n))))/denom;
  return freeze({estimate:p,lower:Math.max(0,center-half),upper:Math.min(1,center+half),confidence_level_approx:0.95,z:zValue});
}

export function aggregateFirstPartyIngredientHelpObservations(inputs=[]){
  const evaluations=(Array.isArray(inputs)?inputs:[]).map(evaluateFirstPartyIngredientHelpObservation);
  const accepted=evaluations.filter(row=>row.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
  const partial=evaluations.filter(row=>row.status===FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_PARTIAL_OBSERVATION);
  const rejected=evaluations.filter(row=>row.status===FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
  const grouped=new Map();
  for(const row of accepted){
    const current=grouped.get(row.source_key)||{source_key:row.source_key,canonical_species_form_id:row.canonical_species_form_id,observation_count:0,berry_help_event_count:0,ingredient_help_event_count:0,total_help_event_count:0};
    current.observation_count+=1;
    current.berry_help_event_count+=row.berry_help_event_count;
    current.ingredient_help_event_count+=row.ingredient_help_event_count;
    current.total_help_event_count+=row.total_help_event_count;
    grouped.set(row.source_key,current);
  }
  const groups=[...grouped.values()].map(row=>freeze({...row,wilson_95:wilsonBinomialInterval(row.ingredient_help_event_count,row.total_help_event_count),activation_authority_granted:false}));
  return freeze({
    schema:'pokemon-sleep-first-party-ingredient-help-observation-aggregate/1.1',
    contract_id:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
    accepted_observation_count:accepted.length,
    partial_observation_count:partial.length,
    rejected_observation_count:rejected.length,
    partial_observations:freeze(partial.map(row=>freeze({observation_id:row.observation_id,source_key:row.source_key,ingredient_help_event_count:row.ingredient_help_event_count,partial_reasons:row.partial_reasons}))),
    rejected_observations:freeze(rejected.map(row=>freeze({observation_id:row.observation_id,blockers:row.blockers}))),
    groups:freeze(groups),
    status:accepted.length?'OBSERVATIONAL_ESTIMATE_AVAILABLE':partial.length?'PARTIAL_NUMERATOR_ONLY_OBSERVATIONS_AVAILABLE':'NO_ACCEPTED_OBSERVATIONS',
    statistical_method:'BERNOULLI_POINT_ESTIMATE_WITH_WILSON_95_INTERVAL_ACCEPTED_WINDOWS_ONLY',
    censored_windows_excluded_from_probability_estimate:true,
    sample_sufficiency_for_activation:'NOT_DEFINED',
    external_rate_comparison_performed:false,
    independent_source_admission_granted:false,
    activation_authority_granted:false,
  });
}
