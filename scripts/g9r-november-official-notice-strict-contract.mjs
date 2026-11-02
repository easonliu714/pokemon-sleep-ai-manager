import assert from 'node:assert/strict';
import {
  NOVEMBER_OFFICIAL_NOTICE_URLS,parseVerifiedNovemberOfficialNotice,
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
    +'</body></html>';
}
const moonHtml=fixture({
  title:'〖活動〗第19次「新月日」',published:'2026/10/30',
  period:'11/8 (週日) 4:00～11/11 (週三) 3:59',lines:newMoonLines,
  details:'<h3>特別機率提升</h3><p>・達克萊伊</p>'
    +'<p>特別機率提升的寶可夢只有可能會在當天第1次的睡眠研究中出現。</p>',
});
const prepHtml=fixture({
  title:'〖企畫〗「備料週vol.1」',published:'2026/10/28',
  period:'11/9 (週一) 4:00～11/16 (週一) 3:59',lines:prepLines,
  details:'<p>期間限定「迷你糖果增強」</p>'
    +'<p>使用「迷你糖果增強」後，幫手寶可夢在使用糖果時可獲得的EXP會變成2倍，但使用1個糖果所需的夢之碎片消耗量會是平時的4倍。每天最多可使用50個糖果。</p>',
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
console.log('PASS G9R_NOVEMBER_STRICT_NEGATIVE_MUTATIONS_FAIL_CLOSED_NO_BANQUET_PROMOTION');
console.log('HOLD G9R_NOVEMBER_LIVE_HTML_REPLAY_DATA_ONLY_MASTER_MANIFEST_AND_ANDROID_OWNER_UAT');
