// G9R November 2026: explicit, source-bound, READ-ONLY candidate parser.
// NOT wired to scheduled discovery or production Master. No guessed probabilities,
// no global candy/shard multiplier for specialty-only research, no player writes.
import {validatePublicEventPayload,PUBLIC_EVENT_MASTER_SCHEMA} from '../assets/js/public-event-master-contract.js';
import {assertOfficialArticleHeading,decodeOfficialVisibleEntities} from './g9r-official-article-heading-guard.mjs';
import {visibleOfficialHtml} from './g9r-official-event-source-refresh.mjs';

export const NOVEMBER_OFFICIAL_NOTICE_URLS=Object.freeze({
  new_moon:'https://www.pokemonsleep.net/zh/news/343537333337383034343630393136373338/',
  meal_prep:'https://www.pokemonsleep.net/zh/news/343537333139333632303937383430313332/',
});
const fail=(reason)=>{throw new Error('G9R_NOVEMBER_OFFICIAL_REVIEW_REQUIRED:'+reason);};
const compact=value=>String(value).normalize('NFKC').replace(/\s+/g,'');
function htmlText(html){
  // Non-rendered fallback/input text is not current article evidence: a stale
  // 04:00 or overlap rule inside it must not certify changed visible rules.
  const raw=String(html).replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<\/?(?:h[1-6]|p|li|div|section|br)\b[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ');
  return decodeOfficialVisibleEntities(raw)
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
// The published date is article-header authority, not an arbitrary visible body quote.
// Both supported official pages place it immediately beside the article H1;
// a changed date masked by a stale quote elsewhere must fail closed.
function assertOfficialPublicationHeader(text,title,published){
  const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  const titleKey=compact(title);
  const indices=lines.flatMap((line,index)=>
    /^〖(?:活動|企畫)〗/.test(compact(line))&&compact(line).includes(titleKey)?[index]:[]);
  if(indices.length!==1)fail('PUBLICATION_HEADER_TITLE_AMBIGUOUS');
  const i=indices[0];
  const nearby=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).map(compact);
  const dates=nearby.filter(line=>/^202[0-9]\/\d{1,2}\/\d{1,2}$/.test(line));
  if(dates.length!==1||dates[0]!==compact(published))
    fail('PUBLICATION_HEADER_DATE_CHANGED_OR_AMBIGUOUS');
}
function commonEvidence(text,{title,published,start,end}){
  if(!text.includes(title))fail('TITLE_CHANGED');
  assertOfficialPublicationHeader(text,title,published);
  const period=compact(section(text,'〖舉辦期間〗','〖活動營地〗'));
  if(period!==compact('・'+start+'～'+end))fail('PERIOD_0400_BOUNDARY_CHANGED');
  const camps=compact(section(text,'〖活動營地〗','獎勵'));
  if(camps!=='・所有營地')fail('ALL_CAMPS_NOT_EXACTLY_VERIFIED');
  // G9R: 04:00 and same-key MAX must belong to THIS article's Notice section.
  // A visible historical rule quoted in the body cannot certify changed current rules.
  // The published Notice is a unique section. A duplicated historical
  // "注意事項" section or a second contradictory bullet must not certify
  // a changed current 04:00 boundary or same-key MAX rule by substring.
  const allLines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  const noticeHeadings=allLines.flatMap((line,index)=>line==='注意事項'?[index]:[]);
  if(noticeHeadings.length!==1)fail('OFFICIAL_NOTICE_SECTION_MISSING_OR_DUPLICATED');
  const noticeLines=allLines.slice(noticeHeadings[0]+1);
  const notice=noticeLines.join('\n');
  const requireUniqueRule=(fragment,expected,label)=>{
    const matches=noticeLines.filter(line=>compact(line).includes(compact(fragment)));
    if(matches.length!==1||compact(matches[0])!==compact(expected))fail(label);
  };
  requireUniqueRule('活動、企畫舉辦日期的切換時間為每日',
    '・〖重要〗活動、企畫舉辦日期的切換時間為每日4:00。',
    'GAME_DAY_BOUNDARY_CHANGED_OR_AMBIGUOUS');
  requireUniqueRule('相同的獎勵在不同的活動、企畫中同時登場時',
    '・相同的獎勵在不同的活動、企畫中同時登場時，僅適用倍率最大的獎勵。',
    'OFFICIAL_OVERLAP_MAX_CHANGED_OR_AMBIGUOUS');
  // Official rewards are keyed to the sleep-measurement START, not the report
  // submission time. Delayed reports across either boundary must not be
  // interpreted as a new event entitlement or a player-data mutation.
  // G9R: four independent sleep-measurement eligibility rules must each be
  // a UNIQUE exact published Notice bullet. The former substring check could
  // certify a changed sleep-start/late-report rule from a stale valid bullet
  // while a contradictory second bullet remained visible in the same Notice.
  // New Moon and Meal Prep have different official tutorial bullet prefixes.
  const sleepWindowAuthority=[
    ['獎勵僅適用於','獎勵僅適用於活動／企畫期間內開始測量的睡眠資料。'],
    ['若將「活動／企畫開始前測量的睡眠資料」',
      '若將「活動／企畫開始前測量的睡眠資料」留到活動／企畫期間內進行「稍後再報告」，則不適用獎勵。'],
    ['若將「活動／企畫期間內測量的睡眠資料」',
      '若將「活動／企畫期間內測量的睡眠資料」留到活動／企畫結束後進行「稍後再報告」，則會適用獎勵。'],
    ['新手教學中的睡眠測量',
      (title.startsWith('第19次')?'活動獎勵':'獎勵')+'不適用於新手教學中的睡眠測量。'],
  ];
  sleepWindowAuthority.forEach(([fragment,expected],index)=>{
    const matches=noticeLines.filter(line=>compact(line).includes(compact(fragment)));
    if(matches.length!==1||compact(matches[0].replace(/^[・•] */, ''))!==compact(expected))
      fail('SLEEP_MEASUREMENT_START_OR_LATE_REPORT_SCOPE_CHANGED_OR_AMBIGUOUS:'+index);
  });
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
// Source-bound encounter scopes: the event bonus applies to ALL camps, but
// the listed boosted species do NOT. Never infer a global spawn roster or rates.
// Exact zh-TW 2026-10-28 notice roster, read-only audit only (not a consumer).
export const MEAL_PREP_OFFICIAL_CAMP_SPECIES=Object.freeze({
  "萌綠之島": "穿山鼠、穿山王、地鼠、三地鼠、喇叭芽、口呆花、大食花、小拳石、隆隆石、吉利蛋、袋獸、百變怪、黑暗鴉、信使鳥、幸福蛋、幼基拉斯、大嘴娃、大顎蟻、小貓怪、烏鴉頭頭、魔尼尼、小福蛋、雪笠怪、石居蟹、摔角鷹人、南瓜精、南瓜怪人、萌虻、蝶結萌虻、童偶熊、花療環環、老翁龍、潤水鴨",
  "天青沙灘": "喇叭芽、袋獸、魔牆人偶、百變怪、魔尼尼、摔角鷹人、萌虻、蝶結萌虻、花療環環",
  "灰褐洞窟": "穿山鼠、穿山王、地鼠、三地鼠、小拳石、隆隆石、隆隆岩、百變怪、幼基拉斯、沙基拉斯、班基拉斯、大顎蟻、超音波幼蟲、沙漠蜻蜓",
  "白花雪原": "吉利蛋、百變怪、黑暗鴉、信使鳥、幸福蛋、烏鴉頭頭、小福蛋、雪笠怪、暴雪王",
  "寶藍湖畔": "喇叭芽、口呆花、大食花、百變怪、摔角鷹人、童偶熊、穿著熊、老翁龍、潤水鴨、湧躍鴨、狂歡浪舞鴨",
  "黃金舊發電廠": "百變怪、黑暗鴉、大嘴娃、小貓怪、勒克貓、倫琴貓、烏鴉頭頭、南瓜精、南瓜怪人",
  "琥褐溪谷": "穿山鼠、穿山王、吉利蛋、百變怪、幸福蛋、幼基拉斯、大嘴娃、大顎蟻、超音波幼蟲、沙漠蜻蜓、小福蛋、石居蟹、岩殿居蟹、老翁龍",
  "萌綠之島EX": "穿山鼠、穿山王、地鼠、喇叭芽、小拳石、吉利蛋、袋獸、百變怪、黑暗鴉、信使鳥、幸福蛋、幼基拉斯、沙基拉斯、班基拉斯、大嘴娃、大顎蟻、小貓怪、烏鴉頭頭、魔尼尼、小福蛋、雪笠怪、暴雪王、石居蟹、摔角鷹人、南瓜精、南瓜怪人、萌虻、蝶結萌虻、童偶熊、花療環環、老翁龍、潤水鴨、湧躍鴨、狂歡浪舞鴨",
  "天青沙灘EX": "吉利蛋、百變怪、幸福蛋、小福蛋、摔角鷹人、萌虻、蝶結萌虻、花療環環、老翁龍"
});
// Exact post-event incense-only exceptions are two separate camp rosters.
// These are SOURCE AUDIT facts, not a continuation of event bonuses or spawn probabilities.
export const MEAL_PREP_POST_EVENT_INCENSE_SPECIES=Object.freeze({
  '萌綠之島':'大顎蟻、 小貓怪、 魔尼尼、 雪笠怪、 石居蟹、 童偶熊',
  '萌綠之島EX':'地鼠、 喇叭芽、 小拳石、 大顎蟻、 小貓怪、 魔尼尼、 石居蟹、 童偶熊',
});
// The official 2026-10-28 Meal Prep notice lists eight target ingredients and
// 46 globally boosted species; neither list grants a global encounter rate.
export const MEAL_PREP_BOOSTED_TARGET_INGREDIENTS='特選蛋、 暖暖薑、 好眠番茄、 美味尾巴、 萌綠大豆、 萌綠玉米、 沉甸甸南瓜、 嫩亮酪梨';
export const MEAL_PREP_BOOSTED_GLOBAL_SPECIES='穿山鼠、 穿山王、 地鼠、 三地鼠、 喇叭芽、 口呆花、 大食花、 小拳石、 隆隆石、 隆隆岩、 吉利蛋、 袋獸、 魔牆人偶、 百變怪、 黑暗鴉、 信使鳥、 幸福蛋、 幼基拉斯、 沙基拉斯、 班基拉斯、 大嘴娃、 大顎蟻、 超音波幼蟲、 沙漠蜻蜓、 小貓怪、 勒克貓、 倫琴貓、 烏鴉頭頭、 魔尼尼、 小福蛋、 雪笠怪、 暴雪王、 石居蟹、 岩殿居蟹、 摔角鷹人、 南瓜精、 南瓜怪人、 萌虻、 蝶結萌虻、 童偶熊、 穿著熊、 花療環環、 老翁龍、 潤水鴨、 湧躍鴨、 狂歡浪舞鴨';
function assertMealPrepGlobalBoostSource(text){
  // Validate the independently published global source list AND its qualifier.
  // Nine camp-specific rosters alone cannot prove that the global source stayed fixed.
  const source=section(text,'\n機率提升\n','\n各營地能遇見的寶可夢');
  requireLines(source,[
    '把握能比平時更常遇見下列寶可夢的好機會吧！',
    '※適用於會撿來許多下列食材的寶可夢。',
    MEAL_PREP_BOOSTED_TARGET_INGREDIENTS,
    '〖機率小幅提升〗',
    MEAL_PREP_BOOSTED_GLOBAL_SPECIES,
  ],'MEAL_PREP_GLOBAL_BOOST_SOURCE');
  const union=new Set(Object.values(MEAL_PREP_OFFICIAL_CAMP_SPECIES)
    .flatMap(value=>value.split('、').map(compact)));
  const boosted=new Set(MEAL_PREP_BOOSTED_GLOBAL_SPECIES.split('、').map(compact));
  if(union.size!==boosted.size||[...union].some(species=>!boosted.has(species)))
    fail('MEAL_PREP_GLOBAL_AND_CAMP_SPECIES_INCONSISTENT');
}
function assertMealPrepPostEventIncenseSource(text){
  const notice=text.slice(text.indexOf('注意事項'));
  const lines=notice.split('\n').map(line=>line.trim()).filter(Boolean);
  const scoped=lines.filter(line=>compact(line).includes(compact('企畫結束後，就無法在'))
    &&compact(line).includes(compact('睡眠研究中遇見下列寶可夢')));
  if(scoped.length!==2)fail('INCENSE_EXCEPTION_CAMP_COUNT_CHANGED');
  for(const [camp,roster] of Object.entries(MEAL_PREP_POST_EVENT_INCENSE_SPECIES)){
    const authority='・〖重要〗企畫結束後，就無法在'+camp
      +'的睡眠研究中遇見下列寶可夢，但仍可以透過在2026/11/23 3:59前使用寶可夢的薰香，在'
      +camp+'與牠們相遇。';
    const index=lines.findIndex(line=>compact(line)===compact(authority));
    if(index<0)fail('INCENSE_EXCEPTION_CAMP_OR_CUTOFF_DRIFT:'+camp);
    if(compact(lines[index+1]||'')!==compact(roster))
      fail('INCENSE_EXCEPTION_SPECIES_SOURCE_DRIFT:'+camp);
  }
}
function assertMealPrepCampSpeciesSource(text){
  const source=section(text,'各營地能遇見的寶可夢','各項目詳情');
  const lines=source.split('\n').map(line=>line.trim()).filter(Boolean);
  const observed=new Map();
  if(lines.length!==Object.keys(MEAL_PREP_OFFICIAL_CAMP_SPECIES).length*2)
    fail('MEAL_PREP_CAMP_ROSTER_LAYOUT_OR_COUNT_CHANGED');
  for(let index=0;index<lines.length;index+=2){
    const header=lines[index].match(/^〖([^〗]+)〗$/);
    if(!header||observed.has(header[1]))fail('MEAL_PREP_CAMP_ROSTER_HEADER_CHANGED');
    observed.set(header[1],compact(lines[index+1]));
  }
  for(const [camp,roster] of Object.entries(MEAL_PREP_OFFICIAL_CAMP_SPECIES)){
    if(observed.get(camp)!==compact(roster))fail('MEAL_PREP_CAMP_ROSTER_SOURCE_DRIFT:'+camp);
  }
  if(observed.size!==Object.keys(MEAL_PREP_OFFICIAL_CAMP_SPECIES).length)
    fail('MEAL_PREP_CAMP_ROSTER_EXTRA_CAMP');
}
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
  // A matching historical title in body copy cannot certify a changed article H1.
  // November notices share the Growth Week hidden-ancestor source guard.
  // An invisible parent cannot certify the article H1 or any reward evidence.
  const visibleHtml=visibleOfficialHtml(html);
  try{
    assertOfficialArticleHeading(visibleHtml,url===NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon
      ?'〖活動〗第19次「新月日」':'〖企畫〗「備料週vol.1」');
  }catch{
    fail('ARTICLE_H1_SOURCE_IDENTITY_CHANGED');
  }
  const text=htmlText(visibleHtml);
  const bonus=section(text,'〖所有日子〗','\n機率提升');
  if(url===NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon){
    commonEvidence(text,{title:'第19次「新月日」',published:'2026/10/30',
      start:'11/8 (週日) 4:00',end:'11/11 (週三) 3:59'});
    requireLines(bonus,NEW_MOON_LINES,'NEW_MOON');
    // The official 2026/10/30 notice lists Darkrai alone. A substring
    // check would incorrectly accept an appended Mew or a second species.
    // Treat the standalone boosted-species roster as exact source evidence.
    const boostedSpecies=section(text,'\n特別機率提升\n',
      '\n※機率提升的寶可夢會出現在所有的活動營地。');
    requireLines(boostedSpecies,['達克萊伊'],'NEW_MOON_DARKRAI_ONLY');
    if(!compact(text).includes(compact('特別機率提升的寶可夢只有可能會在當天第1次的睡眠研究中出現')))
      fail('DARKRAI_FIRST_RESEARCH_SCOPE_NOT_VERIFIED');
    // The official notice also explicitly EXCLUDES the second daily study.
    // A first-study-only substring is insufficient source evidence if that
    // independent exclusion is removed or changed by a future announcement.
    if(!compact(text).includes(compact('並不會在當天第2次的睡眠研究中出現')))
      fail('DARKRAI_SECOND_RESEARCH_EXCLUSION_SOURCE_DRIFT');
    // G9R: the conditional research-reward threshold is a published Notice
    // entitlement, not a whole-page substring. A valid historical quote or
    // duplicate conflicting threshold cannot certify today's Notice.
    const thresholdStatement='在平時，1天進行2次睡眠研究，且1天一共研究了11隻以上的寶可夢時，自第11隻寶可夢起研究的報酬量會減少；但若特別機率提升的寶可夢出現，則自第12隻寶可夢起研究的報酬量會減少';
    const noticeLines=text.split('\n').map(line=>line.trim()).filter(Boolean);
    const noticeIndex=noticeLines.indexOf('注意事項');
    if(noticeIndex<0||noticeLines.lastIndexOf('注意事項')!==noticeIndex)
      fail('DARKRAI_THRESHOLD_NOTICE_SECTION_AMBIGUOUS');
    const thresholdMatches=noticeLines.slice(noticeIndex+1).filter(line=>
      compact(line).includes(compact('在平時，1天進行2次睡眠研究，且1天一共研究了11隻以上的寶可夢時')));
    if(thresholdMatches.length!==1||compact(thresholdMatches[0])!==compact('・'+thresholdStatement))
      fail('DARKRAI_RESEARCH_REWARD_REDUCTION_THRESHOLD_SOURCE_DRIFT_OR_AMBIGUOUS');
    // Source-proven Darkrai pity and extra encounter are NOT numeric probabilities
    // or player-owned effects; a changed official eligibility rule must fail closed.
    for(const [label,statement] of [
      ['DARKRAI_PITY_NON_NUMERIC','若未能在睡眠研究中遇見特別機率提升的寶可夢，在新月日的睡眠研究中能遇見牠們的機率將會漸漸提升，直到遇見特別機率提升的寶可夢為止'],
      ['DARKRAI_EXTRA_ENCOUNTER','當特別機率提升的寶可夢出現時，在睡眠研究中能遇見的寶可夢會增加1隻'],
      ['DARKRAI_INCENSE_CAMP_MAX_11','若同時使用「寶可夢的薰香」和「好露營券」，則最多可遇見11隻寶可夢'],
      ['DARKRAI_END_EXCLUSIVE','活動結束後，在所有活動營地皆無法遇見特別機率提升的寶可夢'],
    ])if(!compact(text).includes(compact(statement)))fail(label+'_SOURCE_DRIFT');
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
  assertMealPrepGlobalBoostSource(text);
  assertMealPrepCampSpeciesSource(text);
  assertMealPrepPostEventIncenseSource(text);
  if(!compact(text).includes(compact('使用「迷你糖果增強」後，幫手寶可夢在使用糖果時可獲得的EXP會變成2倍，但使用1個糖果所需的夢之碎片消耗量會是平時的4倍。每天最多可使用50個糖果。')))
    fail('MINI_CANDY_USE_EXP_SHARD_SCOPE_CHANGED');
  // Official Meal Prep mini-candy is ON by default but remains a PLAYER
  // TOGGLE at the level-up screen. A changed source claiming forced use or
  // relocating this control must HOLD before any consumer interprets it.
  // This is read-only source evidence, NOT a player Writer admission.
  const miniCandyDetails=section(text,'各項目詳情','注意事項');
  if(!compact(miniCandyDetails).includes(compact(
    '此功能可透過點擊「等級提升」畫面右上角的按鈕來自由切換ON/OFF。')))
    fail('MINI_CANDY_PLAYER_TOGGLE_SOURCE_DRIFT');
  // The post-event incense exception is NOT an extension of Meal Prep bonuses.
  // Mini-candy ON-by-default is a game UI rule, not a player-data writer grant.
  for(const [label,statement] of [
    ['MINI_CANDY_DEFAULT_ON','此功能在企畫期間的預設為ON'],
    ['MINI_CANDY_END_EXCLUSIVE','企畫結束後，將無法使用期間限定「迷你糖果增強」'],
    ['INCENSE_EXCEPTION_GREENGRASS','企畫結束後，就無法在萌綠之島的睡眠研究中遇見下列寶可夢'],
    ['INCENSE_EXCEPTION_GREENGRASS_EX','企畫結束後，就無法在萌綠之島EX的睡眠研究中遇見下列寶可夢'],
  ])if(!compact(text).includes(compact(statement)))fail(label+'_SOURCE_DRIFT');
  if(compact(text).split(compact('2026/11/23 3:59前使用寶可夢的薰香')).length!==3)
    fail('INCENSE_EXCEPTION_TWO_CAMPS_CUTOFF_SOURCE_DRIFT');
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
