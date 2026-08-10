import {
  WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  projectWeeklyEventEffects,
  validateWeeklyEventEffectsByRegistry,
} from './weekly-event-effect-registry.js';

export const WEEKLY_CONTEXT_EVENT_SCHEMA='pokemon-sleep-weekly-event-context/1.1';

const numberOrNull=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
const text=value=>String(value??'').normalize('NFKC').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

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
  let projection;
  try{projection=projectWeeklyEventEffects(effects);}catch{
    projection=Object.freeze({
      registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,states:Object.freeze([]),deterministic_effects:Object.freeze({}),feature_only_effects:Object.freeze({}),review_effects:Object.freeze([]),
      strategy_effect_fingerprint:null,has_review_required:false,
    });
  }
  const deterministic=projection.deterministic_effects||{};
  const multiplier=numberOrNull(deterministic.recipe_final_energy_multiplier);
  const tasty=numberOrNull(effects.extra_tasty_multiplier);
  const sundayTasty=numberOrNull(effects.sunday_extra_tasty_multiplier);
  const sundayPot=numberOrNull(deterministic.sunday_pot_multiplier);
  return Object.freeze({
    ...row,
    context_id:text(row.context_id)||null,
    week_start:text(row.week_start)||null,
    camp:text(row.camp)||null,
    dish_category:normalizeDishCategory(row.dish_category),
    event_name:text(row.event_name)||null,
    pot_size:numberOrNull(row.pot_size),
    event_effects_parsed:Object.freeze(effects),
    event_effect_registry_version:projection.registry_version,
    event_effect_states:projection.states,
    strategy_event_effects:projection.deterministic_effects,
    feature_only_event_effects:projection.feature_only_effects,
    review_event_effects:projection.review_effects,
    event_effect_strategy_fingerprint:projection.strategy_effect_fingerprint,
    event_effect_review_required:Boolean(projection.has_review_required),
    recipe_final_energy_multiplier:multiplier,
    extra_tasty_multiplier:tasty,
    sunday_extra_tasty_multiplier:sundayTasty,
    sunday_pot_multiplier:sundayPot,
  });
}

export function weeklyContextStrategyFingerprintInput(row={}){
  const normalized=row?.strategy_event_effects&&row?.event_effect_registry_version?row:normalizeWeeklyContext(row);
  return stable({
    week_start:text(normalized.week_start)||null,
    camp:text(normalized.camp)||null,
    dish_category:normalizeDishCategory(normalized.dish_category),
    favorite_berry_1:text(normalized.favorite_berry_1)||null,
    favorite_berry_2:text(normalized.favorite_berry_2)||null,
    favorite_berry_3:text(normalized.favorite_berry_3)||null,
    pot_size:numberOrNull(normalized.pot_size),
    strategy_event_effects:normalized.strategy_event_effects||{},
    event_effect_registry_version:normalized.event_effect_registry_version||WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  });
}

export function validateWeeklyEventEffects(value){
  const effects=parseWeeklyEventEffects(value);
  const issues=validateWeeklyEventEffectsByRegistry(effects);
  if(issues.length)throw new Error(issues[0]);
  return effects;
}
