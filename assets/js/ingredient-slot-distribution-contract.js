export const INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID='ingredient-slot-distribution-2026-08-14-a';
export const INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION='ingredient-slot-distribution-v1';
export const INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS='ACTIVE_VERIFIED';

export const INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE=Object.freeze({
  evidence_basis:'COMMUNITY_MECHANICS_REFERENCE_PLUS_PINNED_OPEN_SOURCE_IMPLEMENTATION_CROSSCHECK',
  sources:Object.freeze([
    Object.freeze({
      source_id:'pokemon-sleep-verification-wiki-ingredient-slot-selection-2026-08-14',
      source_name:'ポケモンスリープ攻略・検証 Wiki - 食材',
      source_ref:'https://wikiwiki.jp/poke_sleep/%E9%A3%9F%E6%9D%90',
      observed_at:'2026-08-14',
      supports:'Lv.30 unlocked slots are selected equally; Lv.60 expected slot contribution is one third each.',
    }),
    Object.freeze({
      source_id:'neroli-ingredient-utils-fc36317-2026-08-14',
      source_name:"Neroli's Lab pinned ingredient-utils implementation",
      source_ref:'https://github.com/nerolis-lab/nerolis-lab/blob/fc36317b195125c63bf56d3777fa3ed1a9548831/common/src/utils/ingredient-utils/ingredient-utils.ts#L151-L170',
      source_commit:'fc36317b195125c63bf56d3777fa3ed1a9548831',
      observed_at:'2026-08-14',
      supports:'calculateAveragePokemonIngredientSet uses multiplier = 1 / ingredientsUnlocked and applies it to each unlocked slot amount.',
    }),
  ]),
  official_exact_probability_publication:false,
  catch_assignment_probability_out_of_scope:true,
  ingredient_quantity_is_selection_weight:false,
  duplicate_ingredient_names_are_distinct_slots_before_name_aggregation:true,
});

const STANDARD_UNLOCK_LEVELS=Object.freeze([1,30,60]);
const text=value=>String(value??'').normalize('NFKC').trim();
const integer=value=>{const n=Number(value);return Number.isInteger(n)?n:null;};

export function expectedUnlockedIngredientSlotCount(level){
  const parsed=integer(level);
  if(parsed===null||parsed<1)return null;
  if(parsed<30)return 1;
  if(parsed<60)return 2;
  return 3;
}

export function ingredientSlotWeightsForLevel(level){
  const count=expectedUnlockedIngredientSlotCount(level);
  if(count===null)return null;
  const weight=1/count;
  return Object.freeze(Array.from({length:count},(_,index)=>Object.freeze({slot_index:index+1,unlock_level:STANDARD_UNLOCK_LEVELS[index],weight})));
}

function normalizedSlots(slots){
  if(!Array.isArray(slots))return [];
  return slots.map((row,index)=>Object.freeze({
    slot_index:index+1,
    unlock_level:integer(row?.unlock_level),
    ingredient_name:text(row?.ingredient_name),
    quantity:row?.quantity===null||row?.quantity===undefined||row?.quantity===''?null:integer(row.quantity),
  }));
}

export function resolveIngredientSlotDistribution({level,slots}={}){
  const expectedCount=expectedUnlockedIngredientSlotCount(level);
  if(expectedCount===null)return Object.freeze({status:'INVALID_LEVEL',rule_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,slot_count:null,slots:null});
  const normalized=normalizedSlots(slots);
  if(normalized.length<expectedCount)return Object.freeze({status:'MISSING_UNLOCKED_SLOT_IDENTITY',rule_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,slot_count:expectedCount,slots:null});
  const selected=normalized.slice(0,expectedCount);
  for(let index=0;index<expectedCount;index+=1){
    const row=selected[index];
    if(row.unlock_level!==STANDARD_UNLOCK_LEVELS[index]||!row.ingredient_name){
      return Object.freeze({status:'INVALID_OR_AMBIGUOUS_SLOT_STRUCTURE',rule_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,slot_count:expectedCount,slots:null});
    }
  }
  const weight=1/expectedCount;
  return Object.freeze({
    status:'ACTIVE_VERIFIED',
    rule_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,
    slot_count:expectedCount,
    slots:Object.freeze(selected.map(row=>Object.freeze({...row,weight}))),
    catch_assignment_probability_used:false,
  });
}

export function expectedIngredientQuantityPerIngredientResult({level,slots}={}){
  const resolved=resolveIngredientSlotDistribution({level,slots});
  if(resolved.status!=='ACTIVE_VERIFIED')return Object.freeze({status:resolved.status,rule_version:resolved.rule_version,by_ingredient_name:null});
  if(resolved.slots.some(row=>row.quantity===null||row.quantity<=0))return Object.freeze({status:'MISSING_SLOT_QUANTITY',rule_version:resolved.rule_version,by_ingredient_name:null});
  const byName={};
  for(const row of resolved.slots)byName[row.ingredient_name]=(byName[row.ingredient_name]||0)+(row.quantity*row.weight);
  return Object.freeze({status:'ACTIVE_VERIFIED',rule_version:resolved.rule_version,by_ingredient_name:Object.freeze(byName)});
}
