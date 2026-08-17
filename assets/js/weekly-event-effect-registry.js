export const WEEKLY_EVENT_EFFECT_REGISTRY_VERSION='weekly-event-effect-registry-2026-08-17-b-public-event-master';

export const WEEKLY_EVENT_RULE_STATUS=Object.freeze({
  ACTIVE_VERIFIED:'ACTIVE_VERIFIED',
  FEATURE_ONLY:'FEATURE_ONLY',
  UNSUPPORTED:'UNSUPPORTED',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
});

const def=(effect_key,value_type,scope,unit,rule_status,effective_semantics,consumer=null,extra={})=>Object.freeze({
  effect_key,value_type,scope,unit,rule_status,effective_semantics,consumer,...extra,
  registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
});

export const WEEKLY_EVENT_EFFECT_REGISTRY=Object.freeze([
  def('event_schema','string','global','text','FEATURE_ONLY','活動效果資料結構版本；僅供稽核，不參與策略數值。'),
  def('event_start','datetime','global','datetime','FEATURE_ONLY','活動開始時間；目前僅供本週環境與來源稽核。'),
  def('event_end','datetime','global','datetime','FEATURE_ONLY','活動結束時間；目前僅供本週環境與來源稽核。'),
  def('mission_start','datetime','global','datetime','FEATURE_ONLY','活動任務開始時間；目前僅供資訊顯示。'),
  def('mission_end','datetime','global','datetime','FEATURE_ONLY','活動任務結束時間；目前僅供資訊顯示。'),
  def('event_camp_scope','string','camp','text','FEATURE_ONLY','活動適用營地範圍；目前保留為結構化事實。'),
  def('meal_category_forced','boolean','cooking','flag','ACTIVE_VERIFIED','活動是否強制本週料理類型；料理名稱仍由 weekly_context.dish_category 提供。','weekly_recipe_context'),
  def('recipe_final_energy_multiplier','number','cooking','multiplier','ACTIVE_VERIFIED','料理最終能量活動倍率；只在來源明確提供時使用。','recipe_energy_context',{exclusive_minimum:0}),
  def('extra_tasty_multiplier','number','cooking','multiplier','FEATURE_ONLY','漂亮成功倍率；已可保存與顯示，但尚未接入完整料理能量模型。','display_only',{exclusive_minimum:0}),
  def('sunday_extra_tasty_multiplier','number','cooking','multiplier','FEATURE_ONLY','週日漂亮成功倍率；已可保存與顯示，但尚未接入完整料理能量模型。','display_only',{exclusive_minimum:0}),
  def('sunday_pot_multiplier','number','cooking','multiplier','ACTIVE_VERIFIED','週日鍋子容量倍率；供 Recipe Discovery Sunday feasibility 使用。','recipe_discovery_sunday_pot',{exclusive_minimum:0}),
  def('new_recipe_count','integer','cooking','count','FEATURE_ONLY','活動新增料理數量；供活動資訊與探索提示使用。','display_only',{minimum:0}),
  def('drowsy_power_multiplier','number','research','multiplier','FEATURE_ONLY','活動睡意之力倍率；Public Event Master 可保存與顯示，但在建立專用 deterministic contract 前不得直接改寫策略數值。','display_only',{exclusive_minimum:0}),
  def('sleep_exp_multiplier','number','research','multiplier','FEATURE_ONLY','活動睡眠 EXP 倍率；目前只做公版活動結構化事實。','display_only',{exclusive_minimum:0}),
  def('research_exp_multiplier','number','research','multiplier','FEATURE_ONLY','活動研究 EXP 倍率；目前只做公版活動結構化事實。','display_only',{exclusive_minimum:0}),
  def('dream_shards_multiplier','number','research','multiplier','FEATURE_ONLY','活動夢之碎片倍率；目前只做公版活動結構化事實。','display_only',{exclusive_minimum:0}),
  def('pokemon_candy_multiplier','number','research','multiplier','FEATURE_ONLY','活動睡眠研究寶可夢糖果倍率；目前只做公版活動結構化事實。','display_only',{exclusive_minimum:0}),
  def('main_skill_trigger_multiplier','number','pokemon','multiplier','FEATURE_ONLY','活動主技能發動率倍率；尚未建立完整技能觸發 numeric contract，禁止直接進 Production 計算。','display_only',{exclusive_minimum:0}),
  def('main_skill_level_bonus','integer','pokemon','level','FEATURE_ONLY','活動主技能等級加成；目前只供資訊與後續 contract 使用。','display_only',{minimum:0}),
  def('ingredient_help_quantity_bonus','integer','pokemon','count','FEATURE_ONLY','活動每次食材幫忙數量加成；尚未建立完整產出模型前只供資訊。','display_only',{minimum:0}),
  def('cross_sleep_type_encounters','boolean','research','flag','FEATURE_ONLY','活動期間可跨睡眠類型遇見寶可夢；目前不轉換成捕捉機率。','display_only'),
  def('encounter_type_boosts','string_array','research','list','FEATURE_ONLY','活動提升遇見機率的分類描述；目前不轉換成精確機率。','display_only'),
  def('boosted_pokemon_types','string_array','pokemon','list','FEATURE_ONLY','活動提升出現機率的寶可夢屬性；目前作候選資訊，不轉換成精確機率。','display_only'),
  def('shiny_encounter_possible','boolean','research','flag','FEATURE_ONLY','活動是否明確提及異色相遇可能；目前僅資訊顯示。','display_only'),
  def('limited_feature','string','global','text','FEATURE_ONLY','活動限定功能名稱；逐字保留來源名稱，不推導規則。','display_only'),
  def('sunday_pot_multiplier_source','string','cooking','text','FEATURE_ONLY','週日鍋子倍率的來源註記；僅供稽核。','display_only'),
  def('unknown_effects','unknown_effect_array','other','evidence','REVIEW_REQUIRED','目前 Registry 尚未理解的活動效果，只保留來源文字／觀測值作 Evidence，禁止進入 deterministic 計算。','review_queue'),
]);

const BY_KEY=new Map(WEEKLY_EVENT_EFFECT_REGISTRY.map(item=>[item.effect_key,item]));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const stableJson=value=>JSON.stringify(stable(value));
const hash=value=>{let h=2166136261;for(const byte of new TextEncoder().encode(String(value))){h^=byte;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');};
const nonEmptyText=value=>typeof value==='string'&&value.trim().length>0;
const isDateOrIso=value=>{if(!nonEmptyText(value))return false;if(/^\d{4}-\d{2}-\d{2}$/.test(value.trim()))return true;const parsed=new Date(value);return Number.isFinite(parsed.getTime());};

export const WEEKLY_EVENT_EFFECT_KEYS=Object.freeze(WEEKLY_EVENT_EFFECT_REGISTRY.map(item=>item.effect_key));

export function weeklyEventEffectDefinition(effectKey){return BY_KEY.get(String(effectKey||''))||null;}
export function isWeeklyEventEffectKey(effectKey){return BY_KEY.has(String(effectKey||''));}

function scalarObservedValue(value){
  if(value===null||value===undefined)return true;
  if(['string','number','boolean'].includes(typeof value))return true;
  if(Array.isArray(value))return value.every(item=>['string','number','boolean'].includes(typeof item));
  return false;
}

export function normalizeUnknownWeeklyEffects(value){
  if(value===null||value===undefined)return [];
  if(!Array.isArray(value))throw new Error('weekly_context event_effects.unknown_effects 必須為陣列');
  return value.map((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`weekly_context event_effects.unknown_effects[${index}] 必須為物件`);
    const sourceText=String(item.source_text??'').normalize('NFKC').trim();
    if(!sourceText)throw new Error(`weekly_context event_effects.unknown_effects[${index}].source_text 必須保留活動原文`);
    if(item.source_image_ref!=null&&!nonEmptyText(item.source_image_ref))throw new Error(`weekly_context event_effects.unknown_effects[${index}].source_image_ref 必須為非空字串`);
    if(Object.hasOwn(item,'observed_value')&&!scalarObservedValue(item.observed_value))throw new Error(`weekly_context event_effects.unknown_effects[${index}].observed_value 只能是 scalar 或 scalar array，不可為巢狀物件`);
    return Object.freeze({
      source_text:sourceText,
      ...(Object.hasOwn(item,'observed_value')?{observed_value:item.observed_value}:{}),
      ...(item.source_image_ref?{source_image_ref:String(item.source_image_ref).trim()}:{}),
      rule_status:WEEKLY_EVENT_RULE_STATUS.REVIEW_REQUIRED,
      registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
    });
  });
}

function validateValue(definition,value){
  if(value===null||value===undefined||value==='')return;
  switch(definition.value_type){
    case 'string':
      if(!nonEmptyText(value))throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為非空字串`);
      break;
    case 'datetime':
      if(!isDateOrIso(value))throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為 YYYY-MM-DD 或有效 ISO 日期時間`);
      break;
    case 'boolean':
      if(typeof value!=='boolean')throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為 true/false`);
      break;
    case 'number':{
      if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為數字`);
      if(definition.exclusive_minimum!=null&&value<=definition.exclusive_minimum)throw new Error(`weekly_context event_effects.${definition.effect_key} 必須大於 ${definition.exclusive_minimum}`);
      break;
    }
    case 'integer':
      if(!Number.isInteger(value)||(definition.minimum!=null&&value<definition.minimum))throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為 ${definition.minimum??0} 以上整數`);
      break;
    case 'string_array':
      if(!Array.isArray(value)||value.some(item=>!nonEmptyText(item)))throw new Error(`weekly_context event_effects.${definition.effect_key} 必須為非空字串陣列`);
      break;
    case 'unknown_effect_array':
      normalizeUnknownWeeklyEffects(value);
      break;
    default:
      throw new Error(`weekly_context event effect registry 不支援 value_type=${definition.value_type}`);
  }
}

export function validateWeeklyEventEffectsByRegistry(effects={}){
  if(!effects||typeof effects!=='object'||Array.isArray(effects))throw new Error('weekly_context event_effects 必須為物件');
  const issues=[];
  for(const [key,value] of Object.entries(effects)){
    const definition=weeklyEventEffectDefinition(key);
    if(!definition){issues.push(`event_effects 不支援欄位：${key}；未知活動效果請放入 unknown_effects[] 保留原文`);continue;}
    try{validateValue(definition,value);}catch(error){issues.push(error?.message||String(error));}
  }
  return Object.freeze([...new Set(issues)]);
}

export function projectWeeklyEventEffects(effects={}){
  const validationIssues=validateWeeklyEventEffectsByRegistry(effects);
  if(validationIssues.length)throw new Error(validationIssues[0]);
  const states=[],deterministicEffects={},featureOnlyEffects={};
  const reviewEffects=normalizeUnknownWeeklyEffects(effects.unknown_effects);
  for(const definition of WEEKLY_EVENT_EFFECT_REGISTRY){
    const key=definition.effect_key;if(key==='unknown_effects'||!Object.hasOwn(effects,key)||effects[key]===null||effects[key]===undefined||effects[key]==='')continue;
    const value=effects[key];
    states.push(Object.freeze({
      effect_key:key,value,rule_status:definition.rule_status,value_type:definition.value_type,scope:definition.scope,unit:definition.unit,
      effective_semantics:definition.effective_semantics,consumer:definition.consumer,registry_version:definition.registry_version,
    }));
    if(definition.rule_status===WEEKLY_EVENT_RULE_STATUS.ACTIVE_VERIFIED)deterministicEffects[key]=value;
    else featureOnlyEffects[key]=value;
  }
  for(let index=0;index<reviewEffects.length;index+=1)states.push(Object.freeze({
    effect_key:`unknown_effect_${index+1}`,value:reviewEffects[index].observed_value??reviewEffects[index].source_text,
    source_text:reviewEffects[index].source_text,source_image_ref:reviewEffects[index].source_image_ref||null,
    rule_status:WEEKLY_EVENT_RULE_STATUS.REVIEW_REQUIRED,value_type:'unknown',scope:'other',unit:'evidence',
    effective_semantics:'Evidence only; deterministic consumers must ignore this effect.',consumer:'review_queue',registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  }));
  const strategyFingerprintPayload={registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,effects:deterministicEffects};
  return Object.freeze({
    registry_version:WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
    states:Object.freeze(states),
    deterministic_effects:Object.freeze(stable(deterministicEffects)),
    feature_only_effects:Object.freeze(stable(featureOnlyEffects)),
    review_effects:Object.freeze(reviewEffects),
    strategy_effect_fingerprint:`weekly_event_strategy:${hash(stableJson(strategyFingerprintPayload))}`,
    has_review_required:reviewEffects.length>0,
  });
}
