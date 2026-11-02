import assert from 'node:assert/strict';
import {
  NOVEMBER_OFFICIAL_NOTICE_URLS,parseVerifiedNovemberOfficialNotice,MEAL_PREP_OFFICIAL_CAMP_SPECIES,
  MEAL_PREP_POST_EVENT_INCENSE_SPECIES,
} from './g9r-november-official-notice-strict-parser.mjs';
import {
  PUBLIC_EVENT_MASTER_SCHEMA,validatePublicEventPayload,resolvePublicEventProjection,
} from '../assets/js/public-event-master-contract.js';

// These are explicitly OFFLINE official-text excerpts transcribed from the
// separately verified 2026-10-30/28 zh-TW notices, NOT live network fetches.
// Source changes must fail closed until a human reviews the new official text.
const newMoonLines=[
  '在當天第1次的點心時間，寶可夢會變得不容易吃飽。',
  '幸運的話，也許還能遇見異色的寶可夢。',
  '幻之寶可夢的特別機率提升。',
  '每次在睡眠研究遇見特別機率提升的寶可夢時，該寶可夢的友情點數皆會提升3。',
];
const prepLines=[
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
function fixture({title,published,period,lines,details}){
  return '<html><body><h1>'+title+'</h1><p>'+published+'</p>'
    +'<h2>〖舉辦期間〗</h2><p>・'+period+'</p>'
    +'<h2>〖活動營地〗</h2><p>・所有營地</p>'
    +'<h2>獎勵</h2><h3>〖所有日子〗</h3>'
    +lines.map(line=>'<p>・'+line+'</p>').join('')
    +'<h2>機率提升</h2>'+details
    +'<h2>注意事項</h2><p>・〖重要〗活動、企畫舉辦日期的切換時間為每日4:00。</p>'
    +'<p>・相同的獎勵在不同的活動、企畫中同時登場時，僅適用倍率最大的獎勵。</p>'
    +'<p>・獎勵僅適用於活動／企畫期間內開始測量的睡眠資料。</p>'
    +'<p>・若將「活動／企畫開始前測量的睡眠資料」留到活動／企畫期間內進行「稍後再報告」，則不適用獎勵。</p>'
    +'<p>・若將「活動／企畫期間內測量的睡眠資料」留到活動／企畫結束後進行「稍後再報告」，則會適用獎勵。</p>'
    +'<p>・活動獎勵不適用於新手教學中的睡眠測量。</p>'
    +'</body></html>';
}
const moonHtml=fixture({
  title:'〖活動〗第19次「新月日」',published:'2026/10/30',
  period:'11/8 (週日) 4:00～11/11 (週三) 3:59',lines:newMoonLines,
  details:'<h3>特別機率提升</h3><p>・達克萊伊</p>'
    +'<p>特別機率提升的寶可夢只有可能會在當天第1次的睡眠研究中出現。</p>'
    +'<p>此外，若未能在睡眠研究中遇見特別機率提升的寶可夢，在新月日的睡眠研究中能遇見牠們的機率將會漸漸提升，直到遇見特別機率提升的寶可夢為止。</p>'
    +'<p>當特別機率提升的寶可夢出現時，在睡眠研究中能遇見的寶可夢會增加1隻。</p>'
    +'<p>若同時使用「寶可夢的薰香」和「好露營券」，則最多可遇見11隻寶可夢。</p>'
    +'<p>・〖重要〗活動結束後，在所有活動營地皆無法遇見特別機率提升的寶可夢。</p>',
});
const prepHtml=fixture({
  title:'〖企畫〗「備料週vol.1」',published:'2026/10/28',
  period:'11/9 (週一) 4:00～11/16 (週一) 3:59',lines:prepLines,
  details:'<h2>各營地能遇見的寶可夢</h2>'
    +Object.entries(MEAL_PREP_OFFICIAL_CAMP_SPECIES).map(([camp,roster])=>
      '<h3>〖'+camp+'〗</h3><p>'+roster+'</p>').join('')
    +'<h2>各項目詳情</h2><p>期間限定「迷你糖果增強」</p>'
    +'<p>使用「迷你糖果增強」後，幫手寶可夢在使用糖果時可獲得的EXP會變成2倍，但使用1個糖果所需的夢之碎片消耗量會是平時的4倍。每天最多可使用50個糖果。</p>'
    +'<p>※此功能在企畫期間的預設為ON。</p>'
    +'<p>・〖重要〗企畫結束後，就無法在萌綠之島的睡眠研究中遇見下列寶可夢，但仍可以透過在2026/11/23 3:59前使用寶可夢的薰香，在萌綠之島與牠們相遇。</p>'
    +'<p>'+MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島']+'</p>'
    +'<p>・〖重要〗企畫結束後，就無法在萌綠之島EX的睡眠研究中遇見下列寶可夢，但仍可以透過在2026/11/23 3:59前使用寶可夢的薰香，在萌綠之島EX與牠們相遇。</p>'
    +'<p>'+MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島EX']+'</p>'
    +'<p>・企畫結束後，將無法使用期間限定「迷你糖果增強」。</p>',
});
const parse=(html,url)=>parseVerifiedNovemberOfficialNotice(html,url,{verifiedAt:'2026-11-02T02:58:00.000Z'});
const moon=parse(moonHtml,NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon);
const prep=parse(prepHtml,NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep);
assert.equal(moon.event_id,'new_moon_day_19_2026_11');
assert.equal(prep.event_id,'meal_prep_week_vol1_2026_11');
assert.deepEqual(moon.camp_scope,['*']);
assert.deepEqual(prep.camp_scope,['*']);
assert.notEqual(moon.source.source_ref,prep.source.source_ref);
assert.equal(moon.source.source_ref,NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon);
assert.equal(prep.source.source_ref,NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep);
assert.equal(moon.start_at,'2026-11-08T04:00:00+08:00');
assert.equal(moon.end_at,'2026-11-11T04:00:00+08:00');
assert.equal(prep.start_at,'2026-11-09T04:00:00+08:00');
assert.equal(prep.end_at,'2026-11-16T04:00:00+08:00');
assert.equal(prep.effects.recipe_final_energy_multiplier,1.25);
assert.equal(prep.effects.cross_sleep_type_encounters,true);
assert.equal(moon.effects.shiny_encounter_possible,true);
for(const e of [moon,prep]){
  assert.equal(e.authority_status,'PARTIAL_VERIFIED');
  assert.equal(e.field_provenance.period.end_exclusive,true);
  assert.equal(e.field_provenance.event_effects.conditional_research_rewards_not_global,true);
  assert.equal(e.field_provenance.event_effects.verification_method,
    'EXACT_OFFICIAL_ZH_TW_NOVEMBER_2026_NOTICE_CONTRACT');
  for(const forbidden of ['pokemon_candy_multiplier','dream_shards_multiplier','research_exp_multiplier',
    'drowsy_power_multiplier','main_skill_trigger_multiplier'])
    assert.equal(e.effects[forbidden],undefined,'Conditional/unknown reward MUST NOT be global: '+forbidden);
}
console.log('PASS G9R_NOVEMBER_STRICT_TWO_DISTINCT_OFFICIAL_SOURCES_0400_SCOPE_AND_CONDITIONAL_EFFECTS');

const payload=validatePublicEventPayload({
  schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'synthetic-november-strict-parser',
  locale:'zh-TW',region:'TW',events:[moon,prep],
});
const at=(iso,camp)=>resolvePublicEventProjection(payload,{date:new Date(iso),camp});
for(const camp of ['黃金舊發電廠','萌綠之島','萌綠之島EX']){
  assert.equal(at('2026-11-08T03:59:59+08:00',camp).active_event_count,0);
  assert.equal(at('2026-11-08T04:00:00+08:00',camp).active_event_count,1);
  const both=at('2026-11-09T04:00:00+08:00',camp);
  assert.equal(both.active_event_count,2);
  assert.equal(both.camp,camp,'Event overlay MUST NOT mutate player camp authority');
  assert.equal(both.strategy_event_effects.recipe_final_energy_multiplier,1.25);
  assert.equal(both.feature_only_event_effects.cross_sleep_type_encounters,true);
  assert.equal(both.event_effects.pokemon_candy_multiplier,undefined);
  assert.equal(both.event_effects.dream_shards_multiplier,undefined);
  assert.equal(both.review_event_effects.length,4);
  assert.deepEqual(both.effect_conflicts,[]);
  assert.equal(at('2026-11-11T03:59:59+08:00',camp).active_event_count,2);
  assert.equal(at('2026-11-11T04:00:00+08:00',camp).active_event_count,1);
  assert.equal(at('2026-11-16T04:00:00+08:00',camp).active_event_count,0);
}
console.log('PASS G9R_NOVEMBER_STRICT_PARSED_SCHEMA_CAMP_INDEPENDENT_OVERLAP_AND_HALF_OPEN');

const rejects=(html,url,marker)=>assert.throws(()=>parse(html,url),
  error=>error?.message?.startsWith('G9R_NOVEMBER_OFFICIAL_REVIEW_REQUIRED:'),
  'Must fail closed: '+marker);
rejects(moonHtml.replace('11/11 (週三) 3:59','11/12 (週四) 3:59'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'end-exclusive drift');
rejects(prepHtml.replace('・所有營地','・萌綠之島'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'camp narrowed');
rejects(prepHtml.replace('1.25倍','1.50倍'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'cooking numeric drift');
rejects(prepHtml.replace('1.5倍','2倍'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'conditional candy numeric drift');
rejects(moonHtml.replace('友情點數皆會提升3','友情點數皆會提升4'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'friendship scoped amount drift');
rejects(prepHtml.replace('<h2>機率提升</h2>','<p>・所有研究糖果都加倍。</p><h2>機率提升</h2>'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'unknown bonus');
rejects(prepHtml.replace('每天最多可使用50個糖果','每天最多可使用60個糖果'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'mini candy consumption contract');
rejects(moonHtml,NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'cross-source identity');
rejects(moonHtml,'https://www.pokemonsleep.net/zh/news/343535303736323034303630333434333236/',
  'banquet preview is NOT a verified full event');
rejects(moonHtml.replace('2026/10/30','2026/10/29'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'publication drift');
rejects(moonHtml.replace('僅適用倍率最大的獎勵','將倍率相乘'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'overlap authority drift');
// Official notice reward eligibility is determined by sleep-tracking START,
// including reports submitted after the event ends. Never infer entitlement
// from the report-submission time or treat tutorial sleep as eligible.
rejects(moonHtml.replace('獎勵僅適用於活動／企畫期間內開始測量的睡眠資料。',
  '獎勵僅適用於報告提交時位於活動期間的睡眠資料。'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'sleep-measurement start vs submission');
rejects(prepHtml.replace('則不適用獎勵。','則適用獎勵。'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'pre-start measurement reported during event');
rejects(moonHtml.replace('則會適用獎勵。','則不適用獎勵。'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'in-event measurement reported after end');
rejects(prepHtml.replace('活動獎勵不適用於新手教學中的睡眠測量。',
  '活動獎勵適用於新手教學中的睡眠測量。'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'tutorial measurement exclusion');
// Official Darkrai pity/extra encounter and mini-candy post-event exceptions
// must not silently change, become global numeric multipliers, or extend bonuses.
rejects(moonHtml.replace('機率將會漸漸提升','機率將會固定不變'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'Darkrai pity source drift');
rejects(moonHtml.replace('會增加1隻','會增加2隻'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'Darkrai extra encounter count');
rejects(moonHtml.replace('最多可遇見11隻','最多可遇見12隻'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'Darkrai incense/camp cap');
rejects(moonHtml.replace('皆無法遇見特別機率提升的寶可夢','仍可遇見特別機率提升的寶可夢'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,'Darkrai event end exclusion');
rejects(prepHtml.replace('預設為ON','預設為OFF'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'mini-candy default ON');
rejects(prepHtml.replace('將無法使用期間限定','仍可使用期間限定'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'mini-candy event end');
rejects(prepHtml.replaceAll('2026/11/23 3:59','2026/11/24 3:59'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'incense exception deadline');
rejects(prepHtml.replace('萌綠之島EX的睡眠研究','萌綠之島的睡眠研究'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'incense two camp independence');
assert.equal(Object.keys(MEAL_PREP_OFFICIAL_CAMP_SPECIES).length,9);
assert.ok(MEAL_PREP_OFFICIAL_CAMP_SPECIES['萌綠之島'].includes('童偶熊'));
assert.ok(!MEAL_PREP_OFFICIAL_CAMP_SPECIES['天青沙灘'].includes('童偶熊'));
rejects(prepHtml.replace('穿山鼠、穿山王、地鼠、三地鼠','穿山鼠、穿山王、地鼠、百變怪'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'Greengrass roster changed');
rejects(prepHtml.replace('〖黃金舊發電廠〗','〖天青沙灘〗'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'duplicate camp');
rejects(prepHtml.replace('〖天青沙灘EX〗','〖天青沙灘〗'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'EX camp lost');
// Independently source-bound post-event incense lists: no general boosted
// encounter roster, player camp switch, or extended event bonus is implied.
assert.equal(Object.keys(MEAL_PREP_POST_EVENT_INCENSE_SPECIES).length,2);
assert.equal(MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島'].split('、').length,6);
assert.equal(MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島EX'].split('、').length,8);
rejects(prepHtml.replace(MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島'],
  '大顎蟻、 小貓怪、 魔尼尼、 雪笠怪、 石居蟹、 百變怪'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'Greengrass incense-only roster drift');
rejects(prepHtml.replace(MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島EX'],
  '地鼠、 喇叭芽、 小拳石、 大顎蟻、 小貓怪、 魔尼尼、 石居蟹、 百變怪'),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'Greengrass EX incense-only roster drift');
rejects(prepHtml.replace(MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島'],
  MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島EX']),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'EX incense roster wrongly copied to ordinary camp');
rejects(prepHtml.replace('<p>'+MEAL_PREP_POST_EVENT_INCENSE_SPECIES['萌綠之島EX']+'</p>',''),
  NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,'missing EX incense exception list');
console.log('PASS G9R_MEAL_PREP_TWO_POST_EVENT_INCENSE_ONLY_CAMP_ROSTERS_FAIL_CLOSED');
console.log('PASS G9R_MEAL_PREP_NINE_OFFICIAL_CAMP_ROSTERS_SOURCE_SCOPE_FAIL_CLOSED');
console.log('PASS G9R_NOVEMBER_DARKRAI_PITY_EXTRA_ENCOUNTER_AND_MINI_CANDY_END_SOURCE_FAIL_CLOSED');
console.log('PASS G9R_NOVEMBER_OFFICIAL_SLEEP_START_LATE_REPORT_TUTORIAL_FAIL_CLOSED');
console.log('PASS G9R_NOVEMBER_STRICT_NEGATIVE_MUTATIONS_FAIL_CLOSED_NO_BANQUET_PROMOTION');
console.log('HOLD G9R_NOVEMBER_LIVE_HTML_REPLAY_DATA_ONLY_MASTER_MANIFEST_AND_ANDROID_OWNER_UAT');

// Explicit offline official excerpts reused by the independent append-only release guard.
export {moonHtml,prepHtml};
