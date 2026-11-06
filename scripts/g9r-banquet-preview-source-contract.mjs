// G9R: independent official zh-TW November banquet PREVIEW source audit.
// PREVIEW_ONLY: no verified event end, recipe name, per-ingredient quantities,
// numeric event bonuses, Public Master promotion, or player-data writes.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {summarizeOfficialLiveResponse} from './g9r-official-live-source-provenance.mjs';
import {assertOfficialArticleHeading,decodeOfficialVisibleEntities} from './g9r-official-article-heading-guard.mjs';
export const BANQUET_PREVIEW_URL='https://www.pokemonsleep.net/zh/news/343535303736323034303630333434333236/';
const hold=reason=>{throw new Error('G9R_BANQUET_PREVIEW_REVIEW_REQUIRED:'+reason);};
const compact=s=>String(s).normalize('NFKC').replace(/\s+/g,'');
function visibleText(html){
  // Hidden fallback/input markup cannot supply a preview title or source fact.
  const raw=String(html).replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ')
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,' ')
    .replace(/<\/?(?:h[1-6]|p|li|div|section|br)\b[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ');
  return decodeOfficialVisibleEntities(raw)
    .normalize('NFKC').split('\n').map(x=>x.trim()).filter(Boolean);
}
const RECIPE_GROUPS=Object.freeze([
  {heading:'新「咖哩、濃湯」料理會用到的食材',category:'咖哩、濃湯',ingredients:['萌綠玉米','沉甸甸南瓜','一口堅果'],total:39},
  {heading:'新「沙拉」料理會用到的食材',category:'沙拉',ingredients:['暖暖薑','好眠番茄','嫩亮酪梨','一口堅果'],total:121},
  {heading:'新「點心、飲料」料理會用到的食材',category:'點心、飲料',ingredients:['特選蛋','美味尾巴','萌綠大豆','一口堅果'],total:91},
]);
export function auditBanquetPreview(html,url=BANQUET_PREVIEW_URL){
  if(url!==BANQUET_PREVIEW_URL)hold('UNSUPPORTED_OFFICIAL_URL');
  // The preview article title must be the official visible H1, not a body quote.
  assertOfficialArticleHeading(html,'〖預告〗新食材、新食譜、睡姿圖鑑目標和新企畫確定登場！');
  const lines=visibleText(html), all=lines.map(x=>compact(x.replace(/^[・•]\s*/,'')));
  function uniqueLine(value,label){
    const key=compact(value),matches=all.flatMap((line,i)=>line===key?[i]:[]);
    if(matches.length!==1)hold(label+'_MISSING_OR_DUPLICATED');
    return matches[0];
  }
  uniqueLine('〖預告〗新食材、新食譜、睡姿圖鑑目標和新企畫確定登場！','TITLE');
  uniqueLine('2026/10/20','PUBLISHED_DATE');
  const sleepGoal=uniqueLine('2026/11/8 19:00','SLEEP_GOAL_RELEASE');
  const ingredientRelease=uniqueLine('2026/11/15 19:00','INGREDIENT_RELEASE');
  if(sleepGoal>=ingredientRelease||
     !all.slice(sleepGoal+1,ingredientRelease).includes(compact('新的睡姿圖鑑目標（570種）')))
    hold('SLEEP_GOAL_570_SOURCE_SCOPE');
  const firstWeek=uniqueLine('第1週：備料週vol.1','WEEK_ONE');
  const secondWeek=uniqueLine('第2週：來什麼都吃光光！大餐週vol.1','WEEK_TWO');
  const recipeHeading=uniqueLine('新食譜','RECIPE_HEADING');
  if(!(ingredientRelease<firstWeek&&firstWeek<secondWeek&&secondWeek<recipeHeading))
    hold('PREVIEW_SOURCE_SECTION_ORDER');
  const releaseDetails=all.slice(ingredientRelease+1,firstWeek);
  if(!releaseDetails.includes(compact('食材「一口堅果」'))||
     !releaseDetails.includes(compact('會用到一口堅果的3種食譜')))
    hold('INGREDIENT_AND_THREE_RECIPES_SCOPE');
  if(!all.slice(firstWeek+1,secondWeek).includes(compact('預定自11/9 (週一)起舉辦！'))||
     !all.slice(secondWeek+1,recipeHeading).includes(compact('預定自11/16 (週一)起舉辦！')))
    hold('PREVIEW_ONLY_WEEK_STARTS_CHANGED');
  // The official preview describes three distinct future mechanics without
  // publishing a numeric multiplier, eligible species list or dish rotation.
  // Verify the claims inside WEEK TWO, not from unrelated visible page copy.
  // This audit never promotes a preview into deterministic Public Master effects.
  const weekTwoPreview=all.slice(secondWeek+1,recipeHeading).join('');
  for(const [label,claim] of [
    ['EXTRA_NUT_COLLECTION','擅長收集食材的寶可夢會額外撿來「一口堅果」'],
    ['POT_CAPACITY_BONUS','鍋子容量增加的獎勵也會生效'],
    ['SNORLAX_DISH_PREFERENCE','卡比獸想吃的料理好像也會和平時有所不同'],
  ]){
    if(!weekTwoPreview.includes(compact(claim)))
      hold('BANQUET_PREVIEW_MECHANIC_SCOPE_DRIFT:'+label);
  }
  const recipes=RECIPE_GROUPS.map((group,i)=>{
    const pos=uniqueLine(group.heading,'RECIPE_CATEGORY_'+i);
    const next=RECIPE_GROUPS[i+1]&&uniqueLine(RECIPE_GROUPS[i+1].heading,'NEXT_CATEGORY_'+i);
    if(pos<=recipeHeading||(next!==undefined&&pos+2>=next))hold('RECIPE_SECTION_ORDER_'+i);
    const ingredientLine=compact(group.ingredients.join('、'));
    if(all[pos+1]!==ingredientLine||all[pos+2]!==compact('所需食材的總數量：'+group.total+'個'))
      hold('RECIPE_INGREDIENT_SET_OR_TOTAL_CHANGED_'+i);
    if(next!==undefined&&pos+3!==next)hold('UNMODELED_RECIPE_FACT_'+i);
    return Object.freeze({category:group.category,ingredients:Object.freeze([...group.ingredients]),
      total_ingredient_count:group.total,recipe_name:null,ingredient_quantities:null});
  });
  if(!all.slice(all.indexOf(compact(RECIPE_GROUPS[2].heading))+3).includes(
      compact('關於各個企畫的詳情，敬請期待日後的通知！')))
    hold('DETAILS_STILL_PENDING_CLAIM_CHANGED');
  return Object.freeze({source_url:url,source_status:'PREVIEW_ONLY',
    preview_published:'2026/10/20',sleep_goal_release:'2026-11-08T19:00:00+08:00',
    new_ingredient_release:'2026-11-15T19:00:00+08:00',
    // The preview explicitly groups the three new recipes under this release.
    // Keep separate typed authority from the later banquet detail announcement.
    new_recipe_release_at:'2026-11-15T19:00:00+08:00',
    meal_prep_week_start:'2026-11-09',banquet_week_start:'2026-11-16',
    banquet_end:null,event_effects:Object.freeze({}),recipes:Object.freeze(recipes),
    deterministic_recipe_admission:false,player_write:false,public_master_write:false});
}
const fixture=[
'<html><body><h1>〖預告〗新食材、新食譜、睡姿圖鑑目標和新企畫確定登場！</h1>',
'<p>2026/10/20</p><p>2026/11/8 19:00</p><p>・新的睡姿圖鑑目標（570種）</p>',
'<p>2026/11/15 19:00</p><p>・食材「一口堅果」</p><p>・會用到一口堅果的3種食譜</p>',
'<h2>第1週：備料週vol.1</h2><p>預定自11/9 (週一)起舉辦！</p>',
'<h2>第2週：來什麼都吃光光！大餐週vol.1</h2><p>預定自11/16 (週一)起舉辦！</p>',
'<p>企畫期間，除了擅長收集食材的寶可夢會額外撿來「一口堅果」之外，鍋子容量增加的獎勵也會生效。此外，卡比獸想吃的料理好像也會和平時有所不同！</p>',
'<h2>新食譜</h2>',
'<h3>新「咖哩、濃湯」料理會用到的食材</h3><p>萌綠玉米、 沉甸甸南瓜、 一口堅果</p><p>所需食材的總數量：39個</p>',
'<h3>新「沙拉」料理會用到的食材</h3><p>暖暖薑、 好眠番茄、 嫩亮酪梨、 一口堅果</p><p>所需食材的總數量：121個</p>',
'<h3>新「點心、飲料」料理會用到的食材</h3><p>特選蛋、 美味尾巴、 萌綠大豆、 一口堅果</p><p>所需食材的總數量：91個</p>',
'<p>關於各個企畫的詳情，敬請期待日後的通知！</p></body></html>'
].join('');
// Export only synthetic published-source fixture for independent cross-notice regression.
export const BANQUET_PREVIEW_FIXTURE=fixture;
export function offlinePreviewRegression(){
  const base=auditBanquetPreview(fixture);
  assert.equal(base.source_status,'PREVIEW_ONLY');
  assert.equal(base.banquet_end,null);
  assert.deepEqual(base.event_effects,{});
  assert.equal(base.recipes.length,3);
  assert.deepEqual(base.recipes.map(r=>r.total_ingredient_count),[39,121,91]);
  assert.ok(base.recipes.every(r=>r.recipe_name===null&&r.ingredient_quantities===null));
  assert.equal(base.deterministic_recipe_admission,false);
  for(const [from,to,label] of [
    ['2026/11/15 19:00','2026/11/16 19:00','ingredient-release'],
    ['預定自11/16 (週一)起舉辦！','預定自11/17 (週二)起舉辦！','banquet-start'],
    ['3種食譜','4種食譜','recipe-count'],
    ['一口堅果</p>','萌綠大豆</p>','new-ingredient'],
    ['總數量：39個','總數量：40個','curry-total'],
    ['好眠番茄、 嫩亮酪梨','好眠番茄、 萌綠玉米','salad-ingredients'],
    ['總數量：91個','總數量：90個','dessert-total'],
    ['關於各個企畫的詳情，敬請期待日後的通知！','全部細節已公開！','candidate-only'],
    ['擅長收集食材的寶可夢會額外撿來「一口堅果」','擅長收集食材的寶可夢會額外撿來其他未核定食材','extra-nut-scope'],
    ['鍋子容量增加的獎勵也會生效','鍋子容量增加的獎勵已取消','pot-bonus-scope'],
    ['卡比獸想吃的料理好像也會和平時有所不同','卡比獸想吃的料理保持不變','dish-preference-scope'],
  ])assert.throws(()=>auditBanquetPreview(fixture.replace(from,to)),/G9R_BANQUET_PREVIEW_REVIEW_REQUIRED/,label);
  // An old quote elsewhere in the rendered body cannot certify a changed
  // WEEK TWO mechanic. The source guard must remain section-local.
  const oldPotClaim='鍋子容量增加的獎勵也會生效';
  assert.throws(()=>auditBanquetPreview(
    fixture.replace(oldPotClaim,'鍋子容量增加的獎勵已取消')
      .replace('</body>','<p>'+oldPotClaim+'</p></body>')),
    /BANQUET_PREVIEW_MECHANIC_SCOPE_DRIFT:POT_CAPACITY_BONUS/,
    'visible stale quote outside week two must not mask changed mechanic');
  assert.throws(()=>auditBanquetPreview(fixture,'https://example.com/'),/UNSUPPORTED_OFFICIAL_URL/);
  assert.throws(()=>auditBanquetPreview(fixture.replace('總數量：39個','總數量：40個')+
    '<template>所需食材的總數量：39個</template>'),/RECIPE_INGREDIENT_SET_OR_TOTAL_CHANGED/);
  // The whole-page title line could be preserved as stale body copy while
  // the actual article H1 changed. Such a response must remain PREVIEW HOLD.
  const title='〖預告〗新食材、新食譜、睡姿圖鑑目標和新企畫確定登場！';
  assert.throws(()=>auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
    '<h1>〖預告〗另一項未核定企畫</h1><p>'+title+'</p>')),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/,
    'changed banquet H1 masked by exact stale body line');
  assert.throws(()=>auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
    '<h1>'+title+'</h1><h1>〖預告〗另一項未核定企畫</h1>')),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/,
    'duplicate official article H1 must HOLD');
  assert.equal(auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
    '<h1>Pokémon Sleep</h1><h1><span>'+title+'</span></h1>')).source_status,
    'PREVIEW_ONLY','unrelated site H1 and inline title span accepted');
  // Decimal/hex HTML entities are equivalent to visible bracket characters.
  // The same guard must still reject a changed or duplicated article H1.
  const encodedTitle=title.replace('〖','&#x3016;').replace('〗','&#12311;');
  assert.equal(auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
    '<h1>'+encodedTitle+'</h1>')).source_status,'PREVIEW_ONLY');
  assert.throws(()=>auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
    '<h1>'+encodedTitle+'</h1><h1>'+title+'</h1>')),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/);
  // Non-rendered H1 spoof: the old shared heading regex saw <noscript>/<textarea>
  // and the preview text stripper also admitted the hidden title as a real line.
  for(const tag of ['noscript','textarea']){
    const hidden='<'+tag+'><h1>'+title+'</h1></'+tag+'>';
    assert.throws(()=>auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
      '<h1>Pokémon Sleep</h1>'+hidden)),
      /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/,
      'hidden '+tag+' heading must not certify a changed preview article');
    assert.equal(auditBanquetPreview(fixture.replace('<h1>'+title+'</h1>',
      '<h1>'+title+'</h1>'+hidden)).source_status,'PREVIEW_ONLY',
      'hidden '+tag+' duplicate must not cause a false source HOLD');
  }
  console.log('PASS G9R_BANQUET_NONRENDERED_ARTICLE_H1_SPOOF_AND_FALSE_HOLD_REGRESSION');
  console.log('PASS G9R_BANQUET_VISIBLE_ARTICLE_H1_IDENTITY_BODY_SPOOF_FAIL_CLOSED');
  console.log('PASS G9R_BANQUET_PREVIEW_OFFICIAL_SOURCE_BOUND_3_RECIPES_39_121_91');
  console.log('PASS G9R_BANQUET_PREVIEW_NEGATIVE_DRIFT_AND_NO_DETERMINISTIC_PROMOTION');
  console.log('HOLD G9R_BANQUET_DETAILED_EVENT_END_RECIPE_QUANTITIES_AND_ANDROID_OWNER_UAT');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--live')){
    try{
      const response=await fetch(BANQUET_PREVIEW_URL,{redirect:'error',signal:AbortSignal.timeout(12000)});
      if(response.status!==200||response.url!==BANQUET_PREVIEW_URL||
         !/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))hold('LIVE_FETCH_SOURCE_OR_CONTENT_TYPE');
      const html=await response.text();
      if(html.length<100||html.length>512000||!/<html\b/i.test(html))hold('LIVE_HTML_DOCUMENT');
      let result;
      try{
        result=auditBanquetPreview(html);
      }catch(error){
        // Source facts remain fail-closed; diagnostic output is public-only.
        const evidence=summarizeOfficialLiveResponse({
          key:'banquet',expectedUrl:BANQUET_PREVIEW_URL,response,html,
          markers:{title:'〖預告〗新食材、新食譜',recipes:'新食譜'},
        });
        console.error('G9R_BANQUET_LIVE_SOURCE_PROVENANCE='+JSON.stringify(evidence));
        throw error;
      }
      console.log('PASS G9R_BANQUET_LIVE_OFFICIAL_PREVIEW='+JSON.stringify(result));
    }catch(error){console.error('HOLD G9R_BANQUET_LIVE_SOURCE',error.message);process.exitCode=1;}
  }else offlinePreviewRegression();
}
