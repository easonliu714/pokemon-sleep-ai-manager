import {PUBLIC_SPECIES_FORM_ROSTER_ROWS} from './public-pokemon-species-form-roster.js';
import {expectedUnlockedIngredientSlotCount,resolveIngredientSlotDistribution} from './ingredient-slot-distribution-contract.js';

export const INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID='ingredient-probability-first-party-observation-2026-08-18-b';
export const INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION='ingredient-probability-first-party-observation-v2';

export const FIRST_PARTY_OBSERVATION_STATUS=Object.freeze({
  ACCEPTED_RAW_OBSERVATION:'ACCEPTED_RAW_OBSERVATION',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
});

export const FIRST_PARTY_OBSERVATION_MODES=Object.freeze({
  SINGLE_SLOT:'DIRECT_MANUAL_COLLECTION_SINGLE_SLOT_WINDOW',
  MULTI_SLOT_UNIQUE_EVENT_COUNT:'DIRECT_MANUAL_COLLECTION_MULTI_SLOT_UNIQUE_EVENT_COUNT_WINDOW',
});
// Backward-compatible alias used by E3C-6/E3C-6B and the existing mobile UI.
export const FIRST_PARTY_OBSERVATION_MODE=FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT;
export const FIRST_PARTY_OBSERVATION_SOURCE='PLAYER_FIRST_PARTY_CAPTURE';

export const INGREDIENT_EVENT_RECONSTRUCTION_STATUS=Object.freeze({
  UNIQUE_EVENT_COUNT:'UNIQUE_EVENT_COUNT',
  AMBIGUOUS_EVENT_COUNT:'AMBIGUOUS_EVENT_COUNT',
  NO_INTEGER_COMBINATION:'NO_INTEGER_COMBINATION',
  INVALID_INPUT:'INVALID_INPUT',
});

const ROSTER_BY_KEY=new Map(PUBLIC_SPECIES_FORM_ROSTER_ROWS.map(row=>[row.source_key,row]));
const freeze=value=>Object.freeze(value);
const text=value=>String(value??'').normalize('NFKC').trim();
const integer=value=>{const n=Number(value);return Number.isInteger(n)?n:null;};
const nonNegativeInteger=value=>{const n=integer(value);return n!==null&&n>=0?n:null;};
const positiveInteger=value=>{const n=integer(value);return n!==null&&n>0?n:null;};
const nonEmptyRefs=value=>Array.isArray(value)&&value.map(text).filter(Boolean).length>0;

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
  INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED:'INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED',
  INGREDIENT_SLOT_QUANTITY_MISSING:'INGREDIENT_SLOT_QUANTITY_MISSING',
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
  INGREDIENT_EVENT_COUNT_NOT_RECONSTRUCTABLE:'INGREDIENT_EVENT_COUNT_NOT_RECONSTRUCTABLE',
  MULTI_SLOT_INGREDIENT_EVENT_COUNT_AMBIGUOUS:'MULTI_SLOT_INGREDIENT_EVENT_COUNT_AMBIGUOUS',
  ZERO_HELP_EVENTS:'ZERO_HELP_EVENTS',
});

// E3C-6C: reconstruct only the NUMBER of ingredient-result help events from an
// observed aggregate item total and observed unlocked-slot quantities. No slot
// probability or hidden Ingredient Probability value is used. We retain at most
// two distinct reachable event counts because the gate only needs to prove
// uniqueness vs ambiguity.
export function resolveIngredientHelpEventCountFromAggregateItems({ingredient_items_collected,slot_quantities}={}){
  const target=nonNegativeInteger(ingredient_items_collected);
  const quantities=Array.isArray(slot_quantities)?[...new Set(slot_quantities.map(positiveInteger).filter(value=>value!==null))]:[];
  if(target===null||!Array.isArray(slot_quantities)||!slot_quantities.length||slot_quantities.some(value=>positiveInteger(value)===null)){
    return freeze({status:INGREDIENT_EVENT_RECONSTRUCTION_STATUS.INVALID_INPUT,event_count:null,possible_event_counts:freeze([]),slot_quantities:freeze(quantities)});
  }
  const reachable=Array.from({length:target+1},()=>new Set());
  reachable[0].add(0);
  for(let amount=0;amount<=target;amount+=1){
    if(!reachable[amount].size)continue;
    for(const quantity of quantities){
      const next=amount+quantity;
      if(next>target)continue;
      for(const count of reachable[amount]){
        reachable[next].add(count+1);
        if(reachable[next].size>2){
          const firstTwo=[...reachable[next]].sort((a,b)=>a-b).slice(0,2);
          reachable[next]=new Set(firstTwo);
        }
      }
    }
  }
  const possible=[...reachable[target]].sort((a,b)=>a-b);
  if(!possible.length)return freeze({status:INGREDIENT_EVENT_RECONSTRUCTION_STATUS.NO_INTEGER_COMBINATION,event_count:null,possible_event_counts:freeze([]),slot_quantities:freeze(quantities)});
  if(possible.length!==1)return freeze({status:INGREDIENT_EVENT_RECONSTRUCTION_STATUS.AMBIGUOUS_EVENT_COUNT,event_count:null,possible_event_counts:freeze(possible),slot_quantities:freeze(quantities)});
  return freeze({status:INGREDIENT_EVENT_RECONSTRUCTION_STATUS.UNIQUE_EVENT_COUNT,event_count:possible[0],possible_event_counts:freeze(possible),slot_quantities:freeze(quantities)});
}

export function evaluateFirstPartyIngredientHelpObservation(input={}){
  const blockers=[];
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
  const supportedMode=Object.values(FIRST_PARTY_OBSERVATION_MODES).includes(observationMode);
  if(!supportedMode)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.WRONG_OBSERVATION_MODE);

  const level=integer(input.level);
  const slotCount=expectedUnlockedIngredientSlotCount(level);
  if(level===null||level<1)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_LEVEL);
  else if(observationMode===FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT&&slotCount!==1)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED);
  else if(observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_UNIQUE_EVENT_COUNT&&slotCount!==null&&slotCount<2)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_MODE_REQUIRES_MULTIPLE_UNLOCKED_SLOTS);

  const slotResolution=level!==null?resolveIngredientSlotDistribution({level,slots:input.ingredient_slots}):null;
  if(slotResolution?.status!=='ACTIVE_VERIFIED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED);
  const slotQuantities=slotResolution?.status==='ACTIVE_VERIFIED'?slotResolution.slots.map(row=>positiveInteger(row.quantity)):[];
  if(slotResolution?.status==='ACTIVE_VERIFIED'&&slotQuantities.some(value=>value===null))blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_QUANTITY_MISSING);

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

  const berryItems=nonNegativeInteger(input.berry_items_collected);
  const ingredientItems=nonNegativeInteger(input.ingredient_items_collected);
  if(berryItems===null||ingredientItems===null)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_ITEM_COUNTS);
  const berryItemsPerHelp=positiveInteger(input.berry_items_per_help);
  if(berryItemsPerHelp===null)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVALID_BERRY_ITEMS_PER_HELP);
  if(text(input.berry_items_per_help_authority)!=='DETERMINISTIC_PLATFORM_VERIFIED')blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.BERRY_OUTPUT_AUTHORITY_NOT_VERIFIED);

  const inventoryCount=nonNegativeInteger(input.inventory_items_before_collection);
  const inventoryCapacity=positiveInteger(input.inventory_capacity);
  if(inventoryCount===null||berryItems===null||ingredientItems===null||inventoryCount!==berryItems+ingredientItems)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVENTORY_COUNT_MISMATCH);
  if(inventoryCount===null||inventoryCapacity===null||inventoryCount>=inventoryCapacity)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INVENTORY_CAPACITY_NOT_PROVABLY_SAFE);

  let berryHelpEvents=null,ingredientHelpEvents=null,totalHelpEvents=null,ingredientEventFraction=null;
  if(berryItems!==null&&berryItemsPerHelp!==null){
    if(berryItems%berryItemsPerHelp!==0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.BERRY_EVENT_COUNT_NOT_INTEGER);
    else berryHelpEvents=berryItems/berryItemsPerHelp;
  }
  let ingredientReconstruction=null;
  if(ingredientItems!==null&&slotQuantities.length&&slotQuantities.every(value=>value!==null)){
    if(observationMode===FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT){
      const ingredientItemsPerHelp=slotQuantities[0];
      if(ingredientItems%ingredientItemsPerHelp!==0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_EVENT_COUNT_NOT_INTEGER);
      else ingredientHelpEvents=ingredientItems/ingredientItemsPerHelp;
    }else if(observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_UNIQUE_EVENT_COUNT){
      ingredientReconstruction=resolveIngredientHelpEventCountFromAggregateItems({ingredient_items_collected:ingredientItems,slot_quantities:slotQuantities});
      if(ingredientReconstruction.status===INGREDIENT_EVENT_RECONSTRUCTION_STATUS.UNIQUE_EVENT_COUNT)ingredientHelpEvents=ingredientReconstruction.event_count;
      else if(ingredientReconstruction.status===INGREDIENT_EVENT_RECONSTRUCTION_STATUS.AMBIGUOUS_EVENT_COUNT)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_INGREDIENT_EVENT_COUNT_AMBIGUOUS);
      else blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_EVENT_COUNT_NOT_RECONSTRUCTABLE);
    }
  }
  if(berryHelpEvents!==null&&ingredientHelpEvents!==null){
    totalHelpEvents=berryHelpEvents+ingredientHelpEvents;
    if(totalHelpEvents<=0)blockers.push(FIRST_PARTY_OBSERVATION_BLOCKERS.ZERO_HELP_EVENTS);
    else ingredientEventFraction=ingredientHelpEvents/totalHelpEvents;
  }

  const accepted=blockers.length===0;
  return freeze({
    schema:'pokemon-sleep-first-party-ingredient-help-observation-result/1.1',
    contract_id:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
    contract_version:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION,
    observation_id:observationId||null,
    source_key:sourceKey||null,
    canonical_species_form_id:rosterRow?.canonical_species_form_id||null,
    status:accepted?FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION:FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED,
    blockers:freeze([...new Set(blockers)]),
    eligible_for_statistical_aggregation:accepted,
    berry_help_event_count:accepted?berryHelpEvents:null,
    ingredient_help_event_count:accepted?ingredientHelpEvents:null,
    total_help_event_count:accepted?totalHelpEvents:null,
    ingredient_event_fraction:accepted?ingredientEventFraction:null,
    statistical_semantics:'BERNOULLI_HELP_EVENT_SPLIT_OBSERVATION',
    base_rate_normalization_applied:false,
    activation_authority_granted:false,
    independent_source_admission_granted:false,
    safety:freeze({
      only_single_unlocked_ingredient_slot:observationMode===FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT,
      multi_slot_unique_integer_reconstruction:observationMode===FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_UNIQUE_EVENT_COUNT,
      multi_slot_reconstruction_status:ingredientReconstruction?.status??null,
      slot_selection_probability_used:false,
      rate_value_used_to_reconstruct_events:false,
      invalid_batch_contributes_to_estimate:false,
      sample_sufficiency_threshold_invented:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
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
  const rejected=evaluations.filter(row=>row.status!==FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
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
    schema:'pokemon-sleep-first-party-ingredient-help-observation-aggregate/1.0',
    contract_id:INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
    accepted_observation_count:accepted.length,
    rejected_observation_count:rejected.length,
    rejected_observations:freeze(rejected.map(row=>freeze({observation_id:row.observation_id,blockers:row.blockers}))),
    groups:freeze(groups),
    status:accepted.length?'OBSERVATIONAL_ESTIMATE_AVAILABLE':'NO_ACCEPTED_OBSERVATIONS',
    statistical_method:'BERNOULLI_POINT_ESTIMATE_WITH_WILSON_95_INTERVAL',
    sample_sufficiency_for_activation:'NOT_DEFINED',
    external_rate_comparison_performed:false,
    independent_source_admission_granted:false,
    activation_authority_granted:false,
  });
}
