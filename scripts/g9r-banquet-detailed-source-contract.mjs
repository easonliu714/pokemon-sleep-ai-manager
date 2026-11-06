// G9R: new 2026-11-04 zh-TW banquet DETAIL announcement, independent of 10/20 preview.
// Source-only candidate: never turn nut-conditional energy into a global multiplier.
// No Public Event Master/manifest mutation, player DB access, or app-version change.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {assertOfficialArticleHeading,decodeOfficialVisibleEntities} from './g9r-official-article-heading-guard.mjs';
import {summarizeOfficialLiveResponse} from './g9r-official-live-source-provenance.mjs';
import {visibleOfficialHtml} from './g9r-official-event-source-refresh.mjs';
import {auditBanquetPreview,BANQUET_PREVIEW_FIXTURE,BANQUET_PREVIEW_URL} from './g9r-banquet-preview-source-contract.mjs';

export const BANQUET_DETAIL_URL='https://www.pokemonsleep.net/zh/news/343537333535313639333033313031343531/';
const TITLE='〖企畫〗「來什麼都吃光光！大餐週vol.1」';
const fail=reason=>{throw new Error('G9R_BANQUET_DETAIL_REVIEW_REQUIRED:'+reason);};
const compact=value=>String(value).normalize('NFKC').replace(/\s+/g,'').trim();
function linesOf(html){
  // Non-rendered ancestor facts are not current official publication authority.
  // Reuse the existing conservative G9R visibility guard before text extraction.
  const raw=visibleOfficialHtml(html).replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(?:noscript|textarea|template|script|style)\b[^>]*>[\s\S]*?<\/(?:noscript|textarea|template|script|style)>/gi,' ')
    .replace(/<\/(?:h[1-6]|p|li|div|section)>/gi,'\n')
    .replace(/<[^>]+>/g,' ');
  return decodeOfficialVisibleEntities(raw)
    .normalize('NFKC').split('\n').map(s=>s.trim()).filter(Boolean);
}
const BONUS=Object.freeze([
  '企畫期間，卡比獸想吃的料理會是「所有料理！」，研究者可製作所有的料理。',
  '專長為食材的幫手寶可夢在幫忙時撿來的食材數量會增加1個，並且會額外獲得1個「一口堅果」。',
  '專長為食材的幫手寶可夢，其樹果、食材的持有上限會增加10個。',
  '製作食譜裡含有「一口堅果」的料理時，從食譜指定的食材份量獲得的能量會變成1.5倍。',
  '作為額外食材使用的每1個「一口堅果」可獲得的能量會變成1.5倍。',
  '鍋子容量（可放的食材數量上限）增加30。',
  '睡眠研究時，特定寶可夢的出現機率提升。',
  '不論研究者當天的睡眠類型為何，都也能遇見其他睡眠類型的寶可夢。',
]);
// Published 2026-11-04 banquet Notice: six distinct scope authorities.
const NOTICE_RULES=Object.freeze([
  '・〖重要〗活動、企畫舉辦日期的切換時間為每日4:00。',
  '・獎勵僅適用於活動／企畫期間內開始測量的睡眠資料。',
  '・若將「活動／企畫開始前測量的睡眠資料」留到活動／企畫期間內進行「稍後再報告」，則不適用獎勵。',
  '・若將「活動／企畫期間內測量的睡眠資料」留到活動／企畫結束後進行「稍後再報告」，則會適用獎勵。',
  '・獎勵不適用於新手教學中的睡眠測量。',
  '・相同的獎勵在不同的活動、企畫中同時登場時，僅適用倍率最大的獎勵。',
]);
const RECIPES=Object.freeze([
  {heading:'新「咖哩、濃湯」料理會用到的食材',ingredients:'萌綠玉米、 沉甸甸南瓜、 一口堅果',total:39},
  {heading:'新「沙拉」料理會用到的食材',ingredients:'暖暖薑、 好眠番茄、 嫩亮酪梨、 一口堅果',total:121},
  {heading:'新「點心、飲料」料理會用到的食材',ingredients:'特選蛋、 美味尾巴、 萌綠大豆、 一口堅果',total:91},
]);
export function auditBanquetDetail(html,url=BANQUET_DETAIL_URL){
  if(url!==BANQUET_DETAIL_URL)fail('OFFICIAL_URL_IDENTITY');
  assertOfficialArticleHeading(html,TITLE);
  const lines=linesOf(html),flat=lines.map(compact);
  function once(value,label){
    const positions=flat.flatMap((v,i)=>v===compact(value)?[i]:[]);
    if(positions.length!==1)fail(label+'_MISSING_OR_DUPLICATE');
    return positions[0];
  }
  const title=once(TITLE,'VISIBLE_TITLE'),pub=once('2026/11/4','PUBLICATION_DATE');
  const period=once('〖舉辦期間〗','PERIOD_HEADING');
  const camp=once('〖活動營地〗','CAMP_HEADING');
  const mission=once('〖任務期間〗','MISSION_HEADING');
  const bonus=once('〖所有日子〗','BONUS_HEADING');
  const detail=once('關於含有「一口堅果」的料理的獎勵','CONDITIONAL_ENERGY_HEADING');
  const boost=once('機率提升','BOOST_HEADING');
  const recipesHeading=once('新食譜','RECIPES_HEADING');
  // The 11/04 detail states 11/16 04:00 for recipe availability; the 10/20
  // preview instead groups all three recipes with 11/15 19:00. Bind the
  // published detail line independently, never infer it from event start.
  const recipeRelease=once('自11/16 (週一) 4:00起將追加新食譜。','RECIPE_RELEASE');
  if(recipeRelease!==recipesHeading+1)fail('RECIPE_RELEASE_SECTION_SCOPE');
  if(!(title<pub&&pub<period&&period<camp&&camp<mission&&mission<bonus&&bonus<detail&&detail<boost&&boost<recipesHeading))
    fail('ARTICLE_SECTION_ORDER');
  const time='11/16 (週一) 4:00～11/23 (週一) 3:59';
  if(flat[period+1]!==compact('・'+time)||flat[mission+1]!==compact('・'+time))
    fail('EVENT_AND_MISSION_0400_END_EXCLUSIVE');
  if(flat[camp+1]!==compact('・所有營地'))fail('ALL_CAMPS_SCOPE');
  const actual=lines.slice(bonus+1,detail).map(s=>compact(s.replace(/^[・•]\s*/,'')));
  if(actual.length!==BONUS.length||actual.some((s,i)=>s!==compact(BONUS[i])))
    fail('EIGHT_TYPED_BONUSES_SOURCE_DRIFT');
  const conditional=flat.slice(detail+1,boost).join('');
  for(const claim of [
    '例1：料理的所需食材包含「一口堅果」',
    '例2：料理的所需食材包含「一口堅果」',
    '例3：料理的所需食材不包含「一口堅果」',
    '顯示於食譜一覽的料理能量倍率不變。',
    '額外使用的「一口堅果」能量變成1.5倍。',
  ])if(!conditional.includes(compact(claim)))fail('CONDITIONAL_RECIPE_VS_EXTRA_NUT_SCOPE');
  // Each published cooking example has its own energy rule. Merely finding
  // example headings plus example 3 cannot certify example 1/2 multipliers.
  // Require the exact visible example body and its adjacent, ordered rules.
  const exampleSection=flat.slice(detail+1,boost);
  const examples=[
    {heading:'例1：料理的所需食材包含「一口堅果」，且只使用了和所需食材量同數量的「一口堅果」。',
      rules:['・顯示於食譜一覽的料理能量變成1.5倍。']},
    {heading:'例2：料理的所需食材包含「一口堅果」，且使用了比所需食材量還多的「一口堅果」。',
      rules:['・顯示於食譜一覽的料理能量變成1.5倍。',
        '・超過料理所需數量而額外加入的「一口堅果」能量變成1.5倍。']},
    {heading:'例3：料理的所需食材不包含「一口堅果」，並且使用了「一口堅果」。',
      rules:['・顯示於食譜一覽的料理能量倍率不變。',
        '・額外使用的「一口堅果」能量變成1.5倍。']},
  ];
  const positions=examples.map((example,i)=>{
    const found=exampleSection.flatMap((line,j)=>line===compact(example.heading)?[j]:[]);
    if(found.length!==1)fail('CONDITIONAL_EXAMPLE_'+(i+1)+'_HEADING');
    return found[0];
  });
  if(!(positions[0]<positions[1]&&positions[1]<positions[2]))
    fail('CONDITIONAL_EXAMPLE_ORDER');
  for(let i=0;i<examples.length;i++){
    const next=i+1<positions.length?positions[i+1]:exampleSection.length;
    const observed=exampleSection.slice(positions[i]+1,next);
    const expected=examples[i].rules.map(compact);
    if(observed.length!==expected.length||observed.some((line,j)=>line!==expected[j]))
      fail('CONDITIONAL_EXAMPLE_'+(i+1)+'_ENERGY_SCOPE');
  }
  const boostKind=once('〖機率中幅提升〗','BOOST_KIND');
  const species=once('木棉球、 風妖精','BOOST_SPECIES');
  const habitat=once('〖木棉球、 風妖精〗','SPECIES_HABITAT');
  if(!(boost<boostKind&&boostKind<species&&species<habitat&&habitat<recipesHeading))
    fail('BOOST_SECTION_ORDER');
  if(flat[habitat+1]!==compact('萌綠之島、 天青沙灘、 琥褐溪谷、 萌綠之島EX、 天青沙灘EX'))
    fail('BOOST_SPECIES_CAMPS');
  // The published banquet Notice is independent authority for event-day,
  // sleep-start, late-report and same-key overlap semantics. Never infer
  // these rules from the eight bonus lines or stale historical body quotes.
  // A missing/duplicate Notice, contradictory current rule or unknown scope
  // must fail closed before any candidate can be admitted to Public Master.
  const notice=once('注意事項','NOTICE_HEADING');
  if(notice<=recipesHeading)fail('NOTICE_SECTION_ORDER');
  const noticeLines=lines.slice(notice+1);
  const noticeAnchors=[
    '活動、企畫舉辦日期的切換時間',
    '獎勵僅適用於',
    '若將「活動／企畫開始前測量的睡眠資料」',
    '若將「活動／企畫期間內測量的睡眠資料」',
    '新手教學中的睡眠測量',
    '相同的獎勵在不同的活動、企畫中同時登場時',
  ];
  for(let i=0;i<NOTICE_RULES.length;i++){
    const matching=noticeLines.filter(line=>
      compact(line).includes(compact(noticeAnchors[i])));
    if(matching.length!==1||compact(matching[0])!==compact(NOTICE_RULES[i]))
      fail('NOTICE_RULE_CHANGED_OR_AMBIGUOUS:'+i);
  }
  const recipes=RECIPES.map((r,i)=>{
    const at=once(r.heading,'RECIPE_'+i);
    if(at<=recipesHeading||flat[at+1]!==compact(r.ingredients)||
      flat[at+2]!==compact('所需食材的總數量：'+r.total+'個'))fail('RECIPE_SOURCE_FACTS_'+i);
    if(i&&at<=once(RECIPES[i-1].heading,'PREVIOUS_RECIPE_'+i))fail('RECIPE_ORDER_'+i);
    return Object.freeze({category:r.heading,ingredients:r.ingredients.split('、').map(s=>s.trim()),
      total_ingredient_count:r.total,recipe_name:null,per_ingredient_quantities:null});
  });
  return Object.freeze({
    source_url:url,source_published:'2026/11/4',
    new_recipe_release_at:'2026-11-16T04:00:00+08:00',
    source_status:'NEW_OFFICIAL_DETAIL_CANDIDATE_REQUIRES_SEPARATE_MASTER_ADMISSION',
    start_at:'2026-11-16T04:00:00+08:00',end_at:'2026-11-23T04:00:00+08:00',
    mission_start_at:'2026-11-16T04:00:00+08:00',mission_end_at:'2026-11-23T04:00:00+08:00',
    camp_scope:Object.freeze(['*']),boosted_species:Object.freeze(['木棉球','風妖精']),
    conditional_facts:Object.freeze({
      all_dishes_available:true,ingredient_specialty_extra_nut:1,
      ingredient_specialty_normal_ingredient_bonus:1,ingredient_specialty_carry_capacity_bonus:10,
      nut_recipe_base_energy_multiplier:1.5,extra_nut_energy_multiplier:1.5,
      non_nut_recipe_base_energy_multiplier:1,pot_capacity_additive:30,
      cross_sleep_type_encounters:true,
    }),
    effects:Object.freeze({}),recipes:Object.freeze(recipes),
    deterministic_strategy_admission:false,public_master_write:false,
    player_write:false,app_version_bump:false,android_owner_uat:'NOT_READY',
  });
}
// Two individually verified official publications disagree on the new recipe
// release instant. Do not choose one automatically or treat event start as
// recipe unlock authority. Even matching notices remain source-only candidates.
export function reconcileBanquetRecipeRelease(preview,detail){
  if(preview?.source_url!==BANQUET_PREVIEW_URL||preview?.source_status!=='PREVIEW_ONLY'
    ||detail?.source_url!==BANQUET_DETAIL_URL
    ||detail?.source_status!=='NEW_OFFICIAL_DETAIL_CANDIDATE_REQUIRES_SEPARATE_MASTER_ADMISSION')
    fail('CROSS_NOTICE_SOURCE_IDENTITY');
  const previewAt=preview.new_recipe_release_at,detailAt=detail.new_recipe_release_at;
  if(!/^2026-11-\d\dT\d\d:\d\d:\d\d\+08:00$/.test(previewAt||'')
    ||!/^2026-11-\d\dT\d\d:\d\d:\d\d\+08:00$/.test(detailAt||''))
    fail('CROSS_NOTICE_RELEASE_TIMESTAMP_NOT_VERIFIED');
  return Object.freeze({
    status:previewAt===detailAt?'SOURCE_CONSISTENT_CANDIDATE_ONLY':'HOLD_OFFICIAL_RECIPE_RELEASE_CONFLICT',
    preview_recipe_release_at:previewAt,detail_recipe_release_at:detailAt,
    public_master_write:false,player_write:false,deterministic_recipe_admission:false,
    android_owner_uat:'NOT_READY',
  });
}
const fixture=[
  '<html><body><h1>'+TITLE+'</h1><p>2026/11/4</p>',
  '<h2>〖舉辦期間〗</h2><p>・11/16 (週一) 4:00～11/23 (週一) 3:59</p>',
  '<h2>〖活動營地〗</h2><p>・所有營地</p>',
  '<h2>〖任務期間〗</h2><p>・11/16 (週一) 4:00～11/23 (週一) 3:59</p>',
  '<h2>獎勵</h2><h3>〖所有日子〗</h3>',
  ...BONUS.map(x=>'<p>・'+x+'</p>'),
  '<h2>關於含有「一口堅果」的料理的獎勵</h2>',
  '<p>例1：料理的所需食材包含「一口堅果」，且只使用了和所需食材量同數量的「一口堅果」。</p>',
  '<p>・顯示於食譜一覽的料理能量變成1.5倍。</p>',
  '<p>例2：料理的所需食材包含「一口堅果」，且使用了比所需食材量還多的「一口堅果」。</p>',
  '<p>・顯示於食譜一覽的料理能量變成1.5倍。</p>',
  '<p>・超過料理所需數量而額外加入的「一口堅果」能量變成1.5倍。</p>',
  '<p>例3：料理的所需食材不包含「一口堅果」，並且使用了「一口堅果」。</p>',
  '<p>顯示於食譜一覽的料理能量倍率不變。</p>',
  '<p>額外使用的「一口堅果」能量變成1.5倍。</p>',
  '<h2>機率提升</h2><h3>〖機率中幅提升〗</h3><p>木棉球、 風妖精</p>',
  '<h3>〖木棉球、 風妖精〗</h3><p>萌綠之島、 天青沙灘、 琥褐溪谷、 萌綠之島EX、 天青沙灘EX</p>',
  '<h2>新食譜</h2><p>自11/16 (週一) 4:00起將追加新食譜。</p>',
  ...RECIPES.map(x=>'<h3>'+x.heading+'</h3><p>'+x.ingredients+'</p><p>所需食材的總數量：'+x.total+'個</p>'),
  '<h2>各項目詳情</h2><h2>注意事項</h2>',
  ...NOTICE_RULES.map(rule=>'<p>'+rule+'</p>'),
  '</body></html>',
].join('');
export function offlineBanquetDetailRegression(){
  const baseline=auditBanquetDetail(fixture);
  // Negative-first: both official notices independently pass today, yet their
  // published recipe-release times disagree (10/20 19:00 vs 11/16 04:00).
  // Do not silently certify a recipe unlock date from the banquet event start.
  const preview=auditBanquetPreview(BANQUET_PREVIEW_FIXTURE);
  assert.equal(preview.new_ingredient_release,'2026-11-15T19:00:00+08:00');
  assert.equal(preview.new_recipe_release_at,'2026-11-15T19:00:00+08:00');
  assert.equal(baseline.new_recipe_release_at,'2026-11-16T04:00:00+08:00',
    'published detail recipe-release time must be independently source-bound');
  const crossNotice=reconcileBanquetRecipeRelease(preview,baseline);
  assert.equal(crossNotice.status,'HOLD_OFFICIAL_RECIPE_RELEASE_CONFLICT');
  assert.equal(crossNotice.public_master_write,false);
  assert.equal(crossNotice.deterministic_recipe_admission,false);
  assert.equal(reconcileBanquetRecipeRelease(preview,
    {...baseline,new_recipe_release_at:preview.new_recipe_release_at}).status,
    'SOURCE_CONSISTENT_CANDIDATE_ONLY');
  const releaseLine='<p>自11/16 (週一) 4:00起將追加新食譜。</p>';
  for(const [replacement,label] of [
    ['<p>自11/15 (週日) 19:00起將追加新食譜。</p>','changed detail release'],
    ['','missing detail release'],
    [releaseLine+releaseLine,'duplicated detail release'],
  ])assert.throws(()=>auditBanquetDetail(fixture.replace(releaseLine,replacement)),
    /G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,'release authority HOLD: '+label);
  console.log('PASS G9R_BANQUET_CROSS_NOTICE_RECIPE_RELEASE_CONFLICT_HOLD');
  assert.equal(baseline.end_at,'2026-11-23T04:00:00+08:00');
  assert.equal(baseline.camp_scope[0],'*');
  assert.equal(baseline.conditional_facts.pot_capacity_additive,30);
  assert.equal(baseline.conditional_facts.non_nut_recipe_base_energy_multiplier,1);
  assert.deepEqual(baseline.effects,{});
  assert.deepEqual(baseline.recipes.map(r=>r.total_ingredient_count),[39,121,91]);
  assert.ok(baseline.recipes.every(r=>r.per_ingredient_quantities===null));
  assert.equal(baseline.public_master_write,false);
  // Independent negative-first source-bound regression: the banquet audit
  // currently checks bonuses but does NOT inspect the official Notice at all.
  // A changed 04:00, sleep-start, delayed-report or same-key MAX rule must HOLD
  // before any verified event candidate can be considered for Master admission.
  const noticeP=index=>'<p>'+NOTICE_RULES[index]+'</p>';
  for(const [index,changed,label] of [
    [0,noticeP(0).replace('4:00','5:00'),'daily 04:00 boundary'],
    [1,noticeP(1).replace('開始測量','完成報告'),'sleep start vs report time'],
    [2,noticeP(2).replace('不適用獎勵','適用獎勵'),'pre-start late report'],
    [3,noticeP(3).replace('會適用獎勵','不適用獎勵'),'post-end late report'],
    [4,noticeP(4).replace('不適用','適用'),'tutorial sleep exclusion'],
    [5,noticeP(5).replace('僅適用倍率最大的獎勵','將倍率相乘'),'same-key MAX not multiply'],
    [5,noticeP(5)+noticeP(5),'duplicate MAX authority'],
  ]){
    assert.ok(fixture.includes(noticeP(index)),'notice fixture: '+label);
    assert.throws(()=>auditBanquetDetail(fixture.replace(noticeP(index),changed)),
      /G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,'banquet Notice must HOLD: '+label);
  }
  assert.throws(()=>auditBanquetDetail(fixture.replace('<h2>注意事項</h2>','')),
    /G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,'missing Notice heading');
  assert.throws(()=>auditBanquetDetail(fixture.replace('<h2>注意事項</h2>',
    '<h2>注意事項</h2><h2>注意事項</h2>')),
    /G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,'duplicate Notice heading');
  const staleMax=fixture.replace(noticeP(5),
      noticeP(5).replace('僅適用倍率最大的獎勵','將倍率相乘'))
    .replace('<h2>注意事項</h2>',
      '<p>歷史公告引用：'+NOTICE_RULES[5]+'</p><h2>注意事項</h2>');
  assert.throws(()=>auditBanquetDetail(staleMax),
    /G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,
    'stale historical MAX quote must not certify changed current Notice');
  console.log('PASS G9R_BANQUET_NOTICE_SCOPE_UNIQUE_SOURCE_BOUND_FAIL_CLOSED');
  for(const [before,after,label] of [
    ['2026/11/4','2026/11/3','publication'],
    ['11/23 (週一) 3:59','11/24 (週二) 3:59','end-exclusive'],
    ['・所有營地','・萌綠之島','camp'],
    ['食材數量會增加1個','食材數量會增加2個','ingredient-specialty'],
    ['持有上限會增加10個','持有上限會增加20個','carry-capacity'],
    ['鍋子容量（可放的食材數量上限）增加30','鍋子容量（可放的食材數量上限）增加40','pot-additive'],
    ['從食譜指定的食材份量獲得的能量會變成1.5倍','從食譜指定的食材份量獲得的能量會變成2倍','nut-recipe-only'],
    ['額外食材使用的每1個「一口堅果」可獲得的能量會變成1.5倍','額外食材使用的每1個「一口堅果」可獲得的能量會變成2倍','extra-nut-only'],
    ['顯示於食譜一覽的料理能量倍率不變','顯示於食譜一覽的料理能量變成1.5倍','non-nut-recipe'],
    ['木棉球、 風妖精','木棉球、 皮卡丘','boosted-species'],
    ['總數量：121個','總數量：120個','recipe-total'],
  ])assert.throws(()=>auditBanquetDetail(fixture.replace(before,after)),/G9R_/,label);
  // A fact inside a hidden ancestor is not an official *visible* published bonus.
  // The pre-fix linesOf() removed tags but retained hidden text, silently
  // certifying a hidden pot-capacity +30 as the currently published effect.
  const potBonus='<p>・'+BONUS[5]+'</p>';
  assert.ok(fixture.includes(potBonus),'source-bound pot bonus fixture');
  for(const [attribute,label] of [
    ['hidden','HTML hidden ancestor'],
    ['inert','inert ancestor'],
    ['aria-hidden="true"','ARIA hidden ancestor'],
    ['style="display:none"','inline display none ancestor'],
    ['style="visibility:hidden"','inline visibility hidden ancestor'],
  ]){
    const hidden=fixture.replace(potBonus,'<section '+attribute+'>'+potBonus+'</section>');
    assert.throws(()=>auditBanquetDetail(hidden),/G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,
      'must reject non-visible official pot bonus: '+label);
  }
  assert.throws(()=>auditBanquetDetail(fixture,'https://example.com/'),/OFFICIAL_URL_IDENTITY/);
  const entityTitle=TITLE.replace('〖','&#x3016;').replace('〗','&#12311;');
  assert.equal(auditBanquetDetail(fixture.replace('<h1>'+TITLE+'</h1>',
    '<h1>'+entityTitle+'</h1>')).source_status,
    'NEW_OFFICIAL_DETAIL_CANDIDATE_REQUIRES_SEPARATE_MASTER_ADMISSION');
  assert.throws(()=>auditBanquetDetail(fixture.replace('<h1>'+TITLE+'</h1>',
    '<h1>'+entityTitle+'</h1><h1>'+TITLE+'</h1>')),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/);
  assert.throws(()=>auditBanquetDetail(fixture.replace('<h1>'+TITLE+'</h1>',
    '<h1>〖企畫〗另一項活動</h1><p>'+TITLE+'</p>')),/G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/);
  assert.throws(()=>auditBanquetDetail(fixture.replace('<h1>'+TITLE+'</h1>',
    '<h1>〖企畫〗另一項活動</h1><noscript><h1>'+TITLE+'</h1></noscript>')),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/);
  // Published examples 1 and 2 are separate conditional energy authorities.
  // The prior audit checked only their headings and example 3, so a changed
  // 1.5x recipe-base or extra-nut value could be silently accepted.
  const recipeEnergyLine='<p>・顯示於食譜一覽的料理能量變成1.5倍。</p>';
  const extraNutLine='<p>・超過料理所需數量而額外加入的「一口堅果」能量變成1.5倍。</p>';
  assert.equal(fixture.split(recipeEnergyLine).length-1,2,'published example 1 and 2 fixtures');
  for(const [mutated,label] of [
    [fixture.replace(recipeEnergyLine,recipeEnergyLine.replace('1.5倍','2倍')),'example 1 recipe energy'],
    [fixture.replace(extraNutLine,extraNutLine.replace('1.5倍','2倍')),'example 2 extra nut energy'],
    [fixture.replace(extraNutLine,''),'example 2 missing extra nut'],
    [fixture.replace(recipeEnergyLine,recipeEnergyLine+recipeEnergyLine),'example 1 duplicated recipe energy'],
  ])assert.throws(()=>auditBanquetDetail(mutated),/G9R_BANQUET_DETAIL_REVIEW_REQUIRED/,
    'each current official example must independently fail closed: '+label);
  console.log('PASS G9R_BANQUET_CONDITIONAL_EXAMPLE_1_2_ENERGY_SCOPE_FAIL_CLOSED');
  console.log('PASS G9R_BANQUET_NEW_20261104_OFFICIAL_DETAIL_SOURCE_BOUNDARY');
  console.log('PASS G9R_BANQUET_CONDITIONAL_NUT_ENERGY_NOT_GLOBAL_0400_HALF_OPEN');
  console.log('PASS G9R_BANQUET_NEGATIVE_SOURCE_DRIFT_AND_NO_MASTER_PLAYER_WRITES');
  console.log('HOLD G9R_BANQUET_MASTER_ADMISSION_AND_ANDROID_OWNER_UAT');
}
async function live(){
  let response,html='';
  try{
    response=await fetch(BANQUET_DETAIL_URL,{redirect:'error',headers:{accept:'text/html'},
      signal:AbortSignal.timeout(12000)});
    if(response.status!==200||response.url!==BANQUET_DETAIL_URL||
      !/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))
      fail('LIVE_HTTP_URL_OR_CONTENT_TYPE');
    html=await response.text();
    if(html.length<100||html.length>512000||!/<html\b/i.test(html))fail('LIVE_HTML_DOCUMENT');
    const result=auditBanquetDetail(html);
    console.log('PASS G9R_BANQUET_NEW_OFFICIAL_DETAIL_LIVE='+JSON.stringify(result));
  }catch(error){
    if(response&&html){
      console.error('G9R_BANQUET_DETAIL_LIVE_PROVENANCE='+JSON.stringify(
        summarizeOfficialLiveResponse({key:'banquet_detail',expectedUrl:BANQUET_DETAIL_URL,
          response,html,markers:{title:TITLE,bonus:'〖所有日子〗'}})));
    }
    console.error('HOLD G9R_BANQUET_DETAIL_LIVE_SOURCE',error?.message||String(error));
    process.exitCode=1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--live'))await live();
  else offlineBanquetDetailRegression();
}
