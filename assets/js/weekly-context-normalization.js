export const WEEKLY_CONTEXT_EVENT_SCHEMA='pokemon-sleep-weekly-event-context/1.1';

const numberOrNull=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const text=value=>String(value??'').normalize('NFKC').trim();

export function normalizeDishCategory(value){
  let normalized=text(value);
  if(!normalized)return null;
  normalized=normalized
    .replace(/\s+/g,'')
    .replaceAll('/','／')
    .replaceAll('、','／')
    .replaceAll('・','／')
    .replaceAll('﹑','／')
    .replaceAll('，','／')
    .replaceAll(',','／')
    .replace(/／+/g,'／');
  if(normalized==='點心／飲料')return '甜點／飲料';
  if(normalized==='甜點／飲料')return '甜點／飲料';
  if(normalized==='咖哩／濃湯')return '咖哩／濃湯';
  if(normalized==='沙拉')return '沙拉';
  return normalized;
}

export function parseWeeklyEventEffects(value){
  if(value===null||value===undefined||value==='')return {};
  if(value&&typeof value==='object'&&!Array.isArray(value))return {...value};
  if(typeof value!=='string')return {};
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {legacy_text:value};}
}

export function serializeWeeklyEventEffects(value){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value==='string'){
    const parsed=parseWeeklyEventEffects(value);
    return Object.keys(parsed).length?JSON.stringify(parsed):value;
  }
  if(value&&typeof value==='object'&&!Array.isArray(value))return JSON.stringify(value);
  return null;
}

export function normalizeWeeklyContext(row={}){
  const effects=parseWeeklyEventEffects(row.event_effects);
  const multiplier=numberOrNull(effects.recipe_final_energy_multiplier);
  const tasty=numberOrNull(effects.extra_tasty_multiplier);
  const sundayTasty=numberOrNull(effects.sunday_extra_tasty_multiplier);
  const sundayPot=numberOrNull(effects.sunday_pot_multiplier);
  return Object.freeze({
    ...row,
    context_id:text(row.context_id)||null,
    week_start:text(row.week_start)||null,
    camp:text(row.camp)||null,
    dish_category:normalizeDishCategory(row.dish_category),
    event_name:text(row.event_name)||null,
    pot_size:numberOrNull(row.pot_size),
    event_effects_parsed:Object.freeze(effects),
    recipe_final_energy_multiplier:multiplier,
    extra_tasty_multiplier:tasty,
    sunday_extra_tasty_multiplier:sundayTasty,
    sunday_pot_multiplier:sundayPot,
  });
}

export function validateWeeklyEventEffects(value){
  const effects=parseWeeklyEventEffects(value);
  for(const key of ['recipe_final_energy_multiplier','extra_tasty_multiplier','sunday_extra_tasty_multiplier','sunday_pot_multiplier']){
    if(!(key in effects)||effects[key]===null||effects[key]==='')continue;
    const numeric=Number(effects[key]);
    if(!Number.isFinite(numeric)||numeric<=0)throw new Error(`weekly_context event_effects.${key} 必須為大於 0 的數字`);
  }
  if('new_recipe_count' in effects&&effects.new_recipe_count!==null&&effects.new_recipe_count!==''){
    const count=Number(effects.new_recipe_count);
    if(!Number.isInteger(count)||count<0)throw new Error('weekly_context event_effects.new_recipe_count 必須為 0 以上整數');
  }
  for(const key of ['meal_category_forced','cross_sleep_type_encounters','shiny_encounter_possible']){
    if(key in effects&&effects[key]!==null&&effects[key]!==''&&typeof effects[key]!=='boolean')throw new Error(`weekly_context event_effects.${key} 必須為 true/false`);
  }
  for(const key of ['encounter_type_boosts','boosted_pokemon_types']){
    if(key in effects&&effects[key]!==null&&!Array.isArray(effects[key]))throw new Error(`weekly_context event_effects.${key} 必須為陣列`);
  }
  return effects;
}
