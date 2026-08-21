import {FIRST_PARTY_OBSERVATION_MODES} from './ingredient-probability-first-party-observation-contract.js';
import {expectedUnlockedIngredientSlotCount,resolveIngredientSlotDistribution} from './ingredient-slot-distribution-contract.js';

export const E3C6D_FIRST_PARTY_OBSERVATION_UI_ELIGIBILITY_VERSION='e3c6d-first-party-observation-ui-eligibility-2026-08-18-a';
export const E3C6F_FIRST_PARTY_OBSERVATION_UI_ELIGIBILITY_VERSION='e3c6f-first-party-observation-ui-eligibility-2026-08-21-a';

export const FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS=Object.freeze({
  INVALID_LEVEL:'INVALID_LEVEL',
  INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED:'INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED',
  INGREDIENT_SLOT_QUANTITY_MISSING:'INGREDIENT_SLOT_QUANTITY_MISSING',
  MULTI_SLOT_QUANTITIES_NOT_EQUAL:'MULTI_SLOT_QUANTITIES_NOT_EQUAL',
  MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT:'MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT',
  INDIVIDUAL_INGREDIENT_RATE_MODIFIER_PRESENT:'INDIVIDUAL_INGREDIENT_RATE_MODIFIER_PRESENT',
});

const integer=value=>{const n=Number(value);return Number.isInteger(n)?n:null;};
const positiveInteger=value=>{const n=integer(value);return n!==null&&n>0?n:null;};
const text=value=>String(value??'').normalize('NFKC').trim();
const freeze=value=>Object.freeze(value);

export function resolveFirstPartyObservationUiCandidate({level,ingredient_slots,individual_ingredient_rate_modifier_present=false}={}){
  const blockers=[];
  const parsedLevel=integer(level);
  const expectedSlotCount=expectedUnlockedIngredientSlotCount(parsedLevel);
  if(parsedLevel===null||parsedLevel<1||expectedSlotCount===null){
    blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INVALID_LEVEL);
    return freeze({visible:false,observation_mode:null,expected_slot_count:null,slot_quantities:null,multi_slot_preeligible:false,legacy_single_slot_visibility_preserved:false,blockers:freeze(blockers)});
  }

  const slotResolution=resolveIngredientSlotDistribution({level:parsedLevel,slots:ingredient_slots});
  const slotQuantities=slotResolution.status==='ACTIVE_VERIFIED'?slotResolution.slots.map(row=>positiveInteger(row.quantity)):[];
  const slotNames=slotResolution.status==='ACTIVE_VERIFIED'?slotResolution.slots.map(row=>text(row.ingredient_name)):[];
  if(slotResolution.status!=='ACTIVE_VERIFIED')blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED);
  if(slotResolution.status==='ACTIVE_VERIFIED'&&slotQuantities.some(value=>value===null))blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INGREDIENT_SLOT_QUANTITY_MISSING);

  if(expectedSlotCount===1){
    return freeze({
      visible:true,
      observation_mode:FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT,
      expected_slot_count:1,
      slot_quantities:freeze(slotQuantities),
      slot_names:freeze(slotNames),
      multi_slot_preeligible:false,
      legacy_single_slot_visibility_preserved:true,
      individual_rate_modifier_present:individual_ingredient_rate_modifier_present===true,
      blockers:freeze(blockers),
    });
  }

  const structureReady=slotResolution.status==='ACTIVE_VERIFIED'&&slotQuantities.length===expectedSlotCount&&slotQuantities.every(value=>value!==null);
  const equalQuantities=structureReady&&new Set(slotQuantities).size===1;
  const distinctNames=structureReady&&slotNames.length===expectedSlotCount&&slotNames.every(Boolean)&&new Set(slotNames).size===slotNames.length;
  if(individual_ingredient_rate_modifier_present===true)blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INDIVIDUAL_INGREDIENT_RATE_MODIFIER_PRESENT);

  if(equalQuantities&&blockers.length===0){
    return freeze({
      visible:true,
      observation_mode:FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY,
      expected_slot_count:expectedSlotCount,
      slot_quantities:freeze(slotQuantities),
      slot_names:freeze(slotNames),
      multi_slot_preeligible:true,
      distinct_slot_preeligible:distinctNames,
      legacy_single_slot_visibility_preserved:false,
      individual_rate_modifier_present:false,
      outcome_dependent_window_selection:false,
      blockers:freeze([]),
    });
  }

  if(structureReady&&distinctNames&&blockers.length===0){
    return freeze({
      visible:true,
      observation_mode:FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY,
      expected_slot_count:expectedSlotCount,
      slot_quantities:freeze(slotQuantities),
      slot_names:freeze(slotNames),
      multi_slot_preeligible:true,
      distinct_slot_preeligible:true,
      legacy_single_slot_visibility_preserved:false,
      individual_rate_modifier_present:false,
      outcome_dependent_window_selection:false,
      blockers:freeze([]),
    });
  }

  if(!equalQuantities)blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.MULTI_SLOT_QUANTITIES_NOT_EQUAL);
  if(!distinctNames)blockers.push(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT);
  return freeze({
    visible:false,
    observation_mode:null,
    expected_slot_count:expectedSlotCount,
    slot_quantities:freeze(slotQuantities),
    slot_names:freeze(slotNames),
    multi_slot_preeligible:false,
    distinct_slot_preeligible:false,
    legacy_single_slot_visibility_preserved:false,
    individual_rate_modifier_present:individual_ingredient_rate_modifier_present===true,
    outcome_dependent_window_selection:false,
    blockers:freeze([...new Set(blockers)]),
  });
}
