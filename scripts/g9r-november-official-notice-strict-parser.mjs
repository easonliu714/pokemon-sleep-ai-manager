// G9R November 2026: explicit, source-bound, READ-ONLY candidate parser.
// NOT wired to scheduled discovery or production Master. No guessed probabilities,
// no global candy/shard multiplier for specialty-only research, no player writes.
import {validatePublicEventPayload,PUBLIC_EVENT_MASTER_SCHEMA} from '../assets/js/public-event-master-contract.js';

export const NOVEMBER_OFFICIAL_NOTICE_URLS=Object.freeze({
  new_moon:'https://www.pokemonsleep.net/zh/news/343537333337383034343630393136373338/',
  meal_prep:'https://www.pokemonsleep.net/zh/news/343537333139333632303937383430313332/',
});
const fail=(reason)=>{throw new Error('G9R_NOVEMBER_OFFICIAL_REVIEW_REQUIRED:'+reason);};
const compact=value=>String(value).normalize('NFKC').replace(/\s+/g,'');
function htmlText(html){
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<\/?(?:h[1-6]|p|li|div|section|br)\b[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v)))
    .normalize('NFKC').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n');
}
function section(text,start,end){
  const a=text.indexOf(start);
  if(a<0||text.indexOf(start,a+start.length)>=0)fail('MISSING_OR_DUPLICATE_SECTION:'+start);
  const b=text.indexOf(end,a+start.length);
  if(b<0)fail('MISSING_SECTION_END:'+end);
  return text.slice(a+start.length,b);
}
function requireLines(actual,expected,label){
  const cleaned=actual.split('\n').map(x=>compact(x.replace(/^[・•]\s*/,''))).filter(Boolean);
  const reference=expected.map(compact);
  if(cleaned.length!==reference.length||cleaned.some((x,i)=>x!==reference[i]))
    fail(label+'_EXACT_BONUS_LINES_CHANGED');
}
function commonEvidence(text,{title,published,start,end}){
  if(!text.includes(title))fail('TITLE_CHANGED');
  if(!text.includes(published))fail('PUBLICATION_DATE_CHANGED');
  const period=compact(section(text,'〖舉辦期間〗','〖活動營地〗'));
  if(period!==compact('・'+start+'～'+end))fail('PERIOD_0400_BOUNDARY_CHANGED');
  const camps=compact(section(text,'〖活動營地〗','獎勵'));
  if(camps!=='・所有營地')fail('ALL_CAMPS_NOT_EXACTLY_VERIFIED');
  if(!compact(text).includes(compact('活動、企畫舉辦日期的切換時間為每日4:00')))fail('GAME_DAY_BOUNDARY_MISSING');
  if(!compact(text).includes(compact('相同的獎勵在不同的活動、企畫中同時登場時，僅適用倍率最大的獎勵')))
    fail('OFFICIAL_OVERLAP_MAX_RULE_MISSING');
}
const NEW_MOON_LINES=[
  '在當天第1次的點心時間，寶可夢會變得不容易吃飽。',
  '幸運的話，也許還能遇見異色的寶可夢。',
  '幻之寶可夢的特別機率提升。',
  '每次在睡眠研究遇見特別機率提升的寶可夢時，該寶可夢的友情點數皆會提升3。',
];
const PREP_LINES=[
  '睡眠研究時，特定寶可夢的出現機率提升。',
  '不論研究者當天的睡眠類型為何，都也能遇見其他睡眠類型的寶可夢。',
  '可以使用期間限定的「迷你糖果增強」。',
  '透過料理可獲得的能量會變成1.25倍。',
  '研究專長為食材的寶可夢時，糖果獲得量變成1.5倍。',
  '研究專長為食材的寶可夢時，夢之碎片獲得量變成1.5倍。',
  '※糖果與夢之碎片獲得量的獎勵若遇到重複的情況，僅適用倍率最大的獎勵。',
  '研究主技能是「食材精選S」的寶可夢時，糖果獲得量變成1.5倍。',
  '研究主技能是「食材精選S」的寶可夢時，夢之碎片獲得量變成1.5倍。',
  '※「怪力鉗（食材精選S）」等名稱中包含「食材精選S」的主技能也同樣適用。',
];
function event({id,title,url,start,end,effects,mechanics,verifiedAt,verifiedKeys,unmodeled}){
  const source={source_type:'OFFICIAL_ANNOUNCEMENT',
    source_name:'Pokémon Sleep 官方繁體中文公告：'+title,
    source_ref:url,verified_at:verifiedAt,
    note:'Strict official notice source-bound candidate; no automatic publication or player write.'};
  const result={
    event_id:id,title,locale:'zh-TW',region:'GLOBAL',start_at:start,end_at:end,
    camp_scope:['*'],effects,phases:[],missions:[],rewards:[],
    limited_mechanics:mechanics,authority_status:'PARTIAL_VERIFIED',source,
    field_provenance:{
      identity:{status:'VERIFIED',source_ref:url},
      period:{status:'VERIFIED',time_zone:'Asia/Taipei',end_exclusive:true,source_ref:url},
      camp_scope:{status:'VERIFIED',source_ref:url,scope_matches_canonical_public_camp_names:true},
      event_effects:{status:'PARTIAL_VERIFIED',source_ref:url,verified_keys:verifiedKeys,
        unmodeled,deterministic_model_status:'FEATURE_ONLY_EXCEPT_EXISTING_VERIFIED_RECIPE_CONSUMER',
        conditional_research_rewards_not_global:true,same_key_overlaps:'MAX_IF_SOURCE_PROVEN_ELSE_REVIEW',
        verification_method:'EXACT_OFFICIAL_ZH_TW_NOVEMBER_2026_NOTICE_CONTRACT'},
    },
  };
  validatePublicEventPayload({schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'isolated-november-source-candidate',
    locale:'zh-TW',region:'TW',events:[result]});
  return Object.freeze(result);
}
export function parseVerifiedNovemberOfficialNotice(html,url,{verifiedAt=new Date().toISOString()}={}){
  if(!Object.values(NOVEMBER_OFFICIAL_NOTICE_URLS).includes(url))fail('UNSUPPORTED_OFFICIAL_NOTICE_URL');
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(verifiedAt))fail('VERIFIED_AT_NOT_UTC');
  const text=htmlText(html);
  const bonus=section(text,'〖所有日子〗','\n機率提升');
  if(url===NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon){
    commonEvidence(text,{title:'第19次「新月日」',published:'2026/10/30',
      start:'11/8 (週日) 4:00',end:'11/11 (週三) 3:59'});
    requireLines(bonus,NEW_MOON_LINES,'NEW_MOON');
    if(!compact(text).includes(compact('特別機率提升\n・達克萊伊'))||
       !compact(text).includes(compact('特別機率提升的寶可夢只有可能會在當天第1次的睡眠研究中出現')))
      fail('DARKRAI_FIRST_RESEARCH_SCOPE_NOT_VERIFIED');
    return event({id:'new_moon_day_19_2026_11',title:'第19次「新月日」',url,
      start:'2026-11-08T04:00:00+08:00',end:'2026-11-11T04:00:00+08:00',
      effects:{shiny_encounter_possible:true,unknown_effects:[
        {source_text:'首次點心時間不容易吃飽；沒有可用的機率數值'},
        {source_text:'達克萊伊特別機率提升，首次研究限定；每次遇見提升對象友情點數+3，非全域研究數值'},
      ]},
      mechanics:['所有營地；睡眠研究以活動期間開始測量為準','相同獎勵重疊僅採官方證明的最高倍率；未知碰撞保持 REVIEW_REQUIRED'],
      verifiedAt,verifiedKeys:['shiny_encounter_possible'],
      unmodeled:['DARKRAI_ENCOUNTER_CHANCE','FIRST_SNACK_SATIETY','DARKRAI_SCOPED_FRIENDSHIP_POINTS_PLUS_3']});
  }
  commonEvidence(text,{title:'備料週vol.1',published:'2026/10/28',
    start:'11/9 (週一) 4:00',end:'11/16 (週一) 3:59'});
  requireLines(bonus,PREP_LINES,'MEAL_PREP');
  if(!compact(text).includes(compact('使用「迷你糖果增強」後，幫手寶可夢在使用糖果時可獲得的EXP會變成2倍，但使用1個糖果所需的夢之碎片消耗量會是平時的4倍。每天最多可使用50個糖果。')))
    fail('MINI_CANDY_USE_EXP_SHARD_SCOPE_CHANGED');
  return event({id:'meal_prep_week_vol1_2026_11',title:'備料週vol.1',url,
    start:'2026-11-09T04:00:00+08:00',end:'2026-11-16T04:00:00+08:00',
    effects:{recipe_final_energy_multiplier:1.25,cross_sleep_type_encounters:true,
      limited_feature:'迷你糖果增強',unknown_effects:[
        {source_text:'研究食材專長或主技能含食材精選S的寶可夢時，糖果×1.5與夢之碎片×1.5；不可提升為全域研究倍率'},
        {source_text:'特定寶可夢機率小幅提升，未提供可供計算的定量機率'},
      ]},
    mechanics:['所有營地，與第19次新月日於11/09 04:00至11/11 04:00重疊',
      '迷你糖果增強為使用糖果時 EXP×2、夢之碎片消耗×4、每天最多50顆，與睡眠研究糖果獎勵不同',
      '研究糖果／碎片重疊僅在相同且已驗證的條件下取最高倍率；不作全域加乘'],
    verifiedAt,verifiedKeys:['recipe_final_energy_multiplier','cross_sleep_type_encounters','limited_feature'],
    unmodeled:['INGREDIENT_SPECIALTY_RESEARCH_CANDY_AND_SHARDS_X1_5',
      'INGREDIENT_FINDER_S_RESEARCH_CANDY_AND_SHARDS_X1_5','MINI_CANDY_USE_EXP_AND_SHARD_COST','ENCOUNTER_PROBABILITY']});
}
