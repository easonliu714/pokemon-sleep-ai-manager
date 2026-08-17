import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from './public-ingredient-identity.js';

export const SPECIALTIES=['技能','樹果','食材'];
export const TYPES=['一般','火','水','電','草','冰','格鬥','毒','地面','飛行','超能力','蟲','岩石','幽靈','龍','惡','鋼','妖精'];
export const BERRY_BY_TYPE={一般:'柿仔果',火:'蘋野果',水:'橙橙果',電:'萄葡果',草:'金枕果',冰:'莓莓果',格鬥:'櫻子果',毒:'零餘果',地面:'勿花果',飛行:'椰木果',超能力:'芒芒果',蟲:'木子果',岩石:'文柚果',幽靈:'墨莓果',龍:'番荔果',惡:'異奇果',鋼:'靛莓果',妖精:'桃桃果'};
export const BERRIES=Object.values(BERRY_BY_TYPE);
export const INGREDIENTS=[...PUBLIC_INGREDIENT_CANONICAL_NAMES];
export const NATURE_EFFECTS=['無','幫忙速度','食材機率','食材發現率','主技能發動機率','活力回復量','EXP獲得量'];
export const NATURES={
  '勤奮':['無','無'],'怕寂寞':['幫忙速度','活力回復量'],'固執':['幫忙速度','食材機率'],'頑皮':['幫忙速度','主技能發動機率'],'勇敢':['幫忙速度','EXP獲得量'],
  '大膽':['活力回復量','幫忙速度'],'坦率':['無','無'],'淘氣':['活力回復量','食材機率'],'樂天':['活力回復量','主技能發動機率'],'悠閒':['活力回復量','EXP獲得量'],
  '內斂':['食材機率','幫忙速度'],'慢吞吞':['食材機率','活力回復量'],'害羞':['無','無'],'馬虎':['食材機率','主技能發動機率'],'冷靜':['食材機率','EXP獲得量'],
  '溫和':['主技能發動機率','幫忙速度'],'溫順':['主技能發動機率','活力回復量'],'慎重':['主技能發動機率','食材機率'],'浮躁':['無','無'],'自大':['主技能發動機率','EXP獲得量'],
  '膽小':['EXP獲得量','幫忙速度'],'急躁':['EXP獲得量','活力回復量'],'爽朗':['EXP獲得量','食材機率'],'天真':['EXP獲得量','主技能發動機率'],'認真':['無','無']
};
export const MAIN_SKILLS=[
  '活力全體療癒S','活力療癒S','活力填充S','能量填充S','能量填充M','料理成功率提升S','食材獲取S','幫手支援S','樹果數量S','夢之碎片獲取S','夢之碎片獲取M','揮指','流星群（樹果速增）','樹果速增','治癒波動','夢魘',
  '樹果遞增','料理強化S','料理成功S','夢魘（能量填充M）','食材精選S','十項全能（揮指）','治癒波動（活力療癒S）','禮物（食材獲取S）','蓄力（能量填充S）'
];
export const SUBSKILLS=['樹果數量S','幫手獎勵','睡眠EXP獎勵','研究EXP獎勵','夢之碎片獎勵','技能等級提升S','技能等級提升M','幫忙速度S','幫忙速度M','食材機率提升S','食材機率提升M','技能機率提升S','技能機率提升M','持有上限提升S','持有上限提升M','持有上限提升L','活力回復獎勵'];
export const RATINGS=['S+','S','A','B','C','未評級'];
export const STATUSES=['active','archived','sent_to_professor'];
export function mergedOptions(base,currentValues=[]){return [...new Set([...base,...currentValues.filter(Boolean).map(String)])].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}

export const PRODUCTION_MODIFIER_STRUCTURAL_VERSION='pokemon-production-modifiers-2026-08-13-a';
export const PRODUCTION_MODIFIER_STRUCTURAL_STATUS='ACTIVE_VERIFIED_STRUCTURAL';
export const NATURE_NUMERIC_MODIFIER_VERSION='pokemon-nature-numeric-modifiers-2026-08-14-a';
export const NATURE_NUMERIC_MODIFIER_SOURCE_REFS=Object.freeze([
  'pokemon-sleep-official-v2.6.0-nature-speed-down-balance-adjustment-2025-03-26',
  'raenonx-helping-frequency-formula-current-reference-2025-11-14',
  'verified-community-nature-multiplier-crosscheck-2026-08-14',
]);
export const SUBSKILL_NUMERIC_MODIFIER_VERSION='pokemon-subskill-numeric-modifiers-2026-08-14-a';
export const SUBSKILL_NUMERIC_MODIFIER_SOURCE_REFS=Object.freeze([
  'serebii-pokemon-sleep-subskills-current-2026-08-14',
  'raenonx-helping-frequency-formula-current-reference-2025-11-14',
  'raenonx-production-rates-current-reference-2025-11-14',
]);
export const SUBSKILL_HELP_SPEED_REDUCTION_CAP=0.35;
export const NATURE_PRODUCTION_DIMENSION_BY_EFFECT=Object.freeze({'無':null,'幫忙速度':'helper_interval_seconds','食材機率':'ingredient_probability_per_help','食材發現率':'ingredient_probability_per_help','主技能發動機率':'main_skill_trigger_probability','活力回復量':'energy_recovery','EXP獲得量':'pokemon_exp_gain'});
export const NATURE_NUMERIC_MODIFIERS=Object.freeze({
  '幫忙速度':Object.freeze({UP:Object.freeze({operator:'HELP_INTERVAL_MULTIPLIER',multiplier:0.9}),DOWN:Object.freeze({operator:'HELP_INTERVAL_MULTIPLIER',multiplier:1.075})}),
  '食材機率':Object.freeze({UP:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.2}),DOWN:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:0.8})}),
  '食材發現率':Object.freeze({UP:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.2}),DOWN:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:0.8})}),
  '主技能發動機率':Object.freeze({UP:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.2}),DOWN:Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:0.8})}),
  '活力回復量':Object.freeze({UP:Object.freeze({operator:'RECOVERY_MULTIPLIER',multiplier:1.2}),DOWN:Object.freeze({operator:'RECOVERY_MULTIPLIER',multiplier:0.88})}),
  'EXP獲得量':Object.freeze({UP:Object.freeze({operator:'EXP_MULTIPLIER',multiplier:1.18}),DOWN:Object.freeze({operator:'EXP_MULTIPLIER',multiplier:0.82})}),
});
export const SUBSKILL_NUMERIC_MODIFIERS=Object.freeze({
  '幫手獎勵':Object.freeze({operator:'HELP_INTERVAL_REDUCTION_COMPONENT',reduction:0.05,stack_group:'SUBSKILL_HELP_SPEED_REDUCTION',stack_cap:SUBSKILL_HELP_SPEED_REDUCTION_CAP}),
  '幫忙速度S':Object.freeze({operator:'HELP_INTERVAL_REDUCTION_COMPONENT',reduction:0.07,stack_group:'SUBSKILL_HELP_SPEED_REDUCTION',stack_cap:SUBSKILL_HELP_SPEED_REDUCTION_CAP}),
  '幫忙速度M':Object.freeze({operator:'HELP_INTERVAL_REDUCTION_COMPONENT',reduction:0.14,stack_group:'SUBSKILL_HELP_SPEED_REDUCTION',stack_cap:SUBSKILL_HELP_SPEED_REDUCTION_CAP}),
  '食材機率提升S':Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.18}),
  '食材機率提升M':Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.36}),
  '技能機率提升S':Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.18}),
  '技能機率提升M':Object.freeze({operator:'PROBABILITY_MULTIPLIER',multiplier:1.36}),
  '活力回復獎勵':Object.freeze({operator:'RECOVERY_MULTIPLIER',multiplier:1.12}),
});
const modifier=(dimension,scope='INDIVIDUAL',numeric_status='NOT_YET_VERIFIED')=>Object.freeze({dimension,scope,numeric_status});
export const SUBSKILL_PRODUCTION_MODIFIERS=Object.freeze({
  '樹果數量S':modifier('berry_output_per_help','INDIVIDUAL','ACTIVE_VERIFIED_DELEGATED'),
  '幫手獎勵':modifier('helper_interval_seconds','TEAM'),'幫忙速度S':modifier('helper_interval_seconds'),'幫忙速度M':modifier('helper_interval_seconds'),
  '食材機率提升S':modifier('ingredient_probability_per_help'),'食材機率提升M':modifier('ingredient_probability_per_help'),
  '技能機率提升S':modifier('main_skill_trigger_probability'),'技能機率提升M':modifier('main_skill_trigger_probability'),
  '技能等級提升S':modifier('main_skill_level'),'技能等級提升M':modifier('main_skill_level'),
  '持有上限提升S':modifier('carry_limit'),'持有上限提升M':modifier('carry_limit'),'持有上限提升L':modifier('carry_limit'),
  '活力回復獎勵':modifier('energy_recovery','TEAM'),
  '睡眠EXP獎勵':modifier('sleep_exp_gain','TEAM','NOT_NUMERIC_PRODUCTION'),'研究EXP獎勵':modifier('research_exp_gain','TEAM','NOT_NUMERIC_PRODUCTION'),'夢之碎片獎勵':modifier('dream_shard_gain','TEAM','NOT_NUMERIC_PRODUCTION'),
});
const normalized=value=>String(value??'').normalize('NFKC').trim();
const semanticNatureEffect=value=>{
  const effect=normalized(value);
  return effect==='食材發現率'?'食材機率':effect;
};
function natureModifier(source_name,direction,dimension){
  const numeric=NATURE_NUMERIC_MODIFIERS[source_name]?.[direction]||null;
  return Object.freeze({
    source_type:'NATURE',source_name,direction,dimension,scope:'INDIVIDUAL',
    numeric_status:numeric?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED',
    numeric_rule_version:numeric?NATURE_NUMERIC_MODIFIER_VERSION:null,
    numeric_operator:numeric?.operator||null,
    multiplier:numeric?.multiplier??null,
    source_refs:numeric?[...NATURE_NUMERIC_MODIFIER_SOURCE_REFS]:[],
  });
}
function subskillModifier(source_name,row,rule){
  const numeric=SUBSKILL_NUMERIC_MODIFIERS[source_name]||null;
  return Object.freeze({
    source_type:'SUBSKILL',source_name,unlock_level:Number(row?.unlock_level)||null,...rule,
    numeric_status:numeric?'ACTIVE_VERIFIED':rule.numeric_status,
    numeric_rule_version:numeric?SUBSKILL_NUMERIC_MODIFIER_VERSION:null,
    numeric_operator:numeric?.operator||null,
    multiplier:numeric?.multiplier??null,
    reduction:numeric?.reduction??null,
    stack_group:numeric?.stack_group||null,
    stack_cap:numeric?.stack_cap??null,
    source_refs:numeric?[...SUBSKILL_NUMERIC_MODIFIER_SOURCE_REFS]:[],
  });
}
export function resolvePokemonProductionModifierProfile(candidate={}){
  const modifiers=[],conflicts=[],nature=normalized(candidate.nature),effects=NATURES[nature];
  if(!nature)conflicts.push('NATURE_MISSING');
  else if(!effects)conflicts.push('UNKNOWN_NATURE');
  else {
    const bonus=semanticNatureEffect(effects[0]),penalty=semanticNatureEffect(effects[1]);
    if(normalized(candidate.nature_bonus)&&semanticNatureEffect(candidate.nature_bonus)!==bonus)conflicts.push('NATURE_BONUS_MISMATCH');
    if(normalized(candidate.nature_penalty)&&semanticNatureEffect(candidate.nature_penalty)!==penalty)conflicts.push('NATURE_PENALTY_MISMATCH');
    for(const [source_name,direction] of [[bonus,'UP'],[penalty,'DOWN']]){const dimension=NATURE_PRODUCTION_DIMENSION_BY_EFFECT[source_name];if(dimension)modifiers.push(natureModifier(source_name,direction,dimension));}
  }
  for(const row of candidate.unlocked_subskills||[]){const source_name=normalized(row?.subskill_name??row),rule=SUBSKILL_PRODUCTION_MODIFIERS[source_name];if(!source_name)continue;if(!rule){conflicts.push(`UNKNOWN_SUBSKILL:${source_name}`);continue;}modifiers.push(subskillModifier(source_name,row,rule));}
  const verifiedNumericModifierCount=modifiers.filter(row=>row.numeric_status==='ACTIVE_VERIFIED'&&(
    Number.isFinite(row.multiplier)||Number.isFinite(row.reduction)
  )).length;
  const natureConflicts=conflicts.filter(value=>value.startsWith('NATURE_'));
  return Object.freeze({
    schema:'pokemon-sleep-production-modifier-profile/1.2',registry_version:PRODUCTION_MODIFIER_STRUCTURAL_VERSION,
    nature_numeric_registry_version:NATURE_NUMERIC_MODIFIER_VERSION,subskill_numeric_registry_version:SUBSKILL_NUMERIC_MODIFIER_VERSION,
    status:conflicts.length?'REVIEW_REQUIRED':PRODUCTION_MODIFIER_STRUCTURAL_STATUS,
    modifiers:Object.freeze(modifiers),conflicts:Object.freeze(conflicts),numeric_activation:false,
    verified_numeric_modifier_count:verifiedNumericModifierCount,modifier_numeric_authority_active:verifiedNumericModifierCount>0,missing_is_zero:false,
    nature_reconciliation:Object.freeze({status:natureConflicts.length?'REVIEW_REQUIRED':'CONSISTENT',conflicts:Object.freeze(natureConflicts),auto_rewrite_player_observation:false}),
  });
}