// G14 RATE: actual Chromium UI event wiring, synthetic-only data and zero writes.
// Runs on loopback static server with service workers blocked; never opens player DB.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g14-rate-choice-blank',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><section id="pokemon"><div class="section-head"><h2>寶可夢</h2></div><div class="filter-bar"></div></section></body></html>',
  }));
  const page=await context.newPage();
  await page.goto(new URL('g14-rate-choice-blank',base).href);
  await page.evaluate(async()=>{
    const module=await import('/assets/js/pokemon-roster-rating-preview.js');
    const base={pokemon_id:'p-A',pokemon_instance_id:'instance-A',species:'同物種',
      nickname:'alpha',level:20,specialty:'樹果',nature:'固執',
      nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-'};
    const held={...base,pokemon_id:'p-B',pokemon_instance_id:'instance-B',
      nickname:'held',nature:null,rating:'A'};
    const skills=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
    const slots=id=>skills.map((subskill_name,index)=>({
      pokemon_id:id,unlock_level:[10,25,50,70,80][index],subskill_name
    }));
    globalThis.ratingFixture={pokemon:[base,held],ingredients:[],
      subskills:[...slots('p-A'),...slots('p-B')]};
    globalThis.ratingUi=module;
    module.setupPokemonRosterRatingPreview({
      readRoster:()=>structuredClone(globalThis.ratingFixture.pokemon),
      readIngredients:()=>structuredClone(globalThis.ratingFixture.ingredients),
      readSubskills:()=>structuredClone(globalThis.ratingFixture.subskills),
    });
  });
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／1 隻/);
  assert.equal(await page.locator('[data-rate-choice-row]').count(),1);
  assert.equal(await page.locator('input[type=checkbox][disabled]').count(),1);
  await page.locator('[data-rate-choice-action="all"]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 1／1 隻/);
  await page.locator('[data-rate-choice-action="review"]').click();
  assert.match(await page.locator('[data-rate-choice-review-result]').innerText(),/已審閱 1 隻非持久選擇意向/);
  await page.locator('[data-rate-choice-action="none"]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／1 隻/);
  await page.locator('[data-rate-choice-filter]').selectOption('S+');
  assert.equal(await page.locator('tr[data-rate3-state]').count(),1);
  await page.locator('[data-rate-choice-target]').selectOption('old');
  assert.equal(await page.locator('tr[data-rate3-state]').count(),0);
  await page.locator('[data-rate-choice-filter]').selectOption('D-');
  assert.equal(await page.locator('tr[data-rate3-state]').count(),1);
  await page.locator('[data-rate-choice-filter]').selectOption('');
  await page.locator('[data-rate-choice-action="all"]').click();
  await page.evaluate(()=>{globalThis.ratingFixture.pokemon[0].nickname='changed but same grade';});
  await page.locator('[data-rate-choice-action="review"]').click();
  assert.equal(await page.locator('[data-rate3-stale]').count(),1);
  assert.match(await page.locator('[data-rate3-stale]').innerText(),/FULL_SOURCE_STALE_RECALCULATE/);
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／1 隻/);
  await page.evaluate(()=>{globalThis.ratingFixture.pokemon[0].rating='UNKNOWN';});
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／0 隻/);
  await page.locator('[data-rate-choice-action="all"]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／0 隻/);
  await page.evaluate(()=>{globalThis.ratingFixture.pokemon[0].rating='D-';globalThis.ratingFixture.pokemon[1].pokemon_instance_id='instance-A';});
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate-choice-count]').innerText(),/擬採用 0／0 隻/);
  await page.evaluate(()=>globalThis.ratingUi.invalidatePokemonRosterRatingPreview());
  assert.equal(await page.locator('[data-rate3-stale]').count(),1);
  console.log('PASS G14_RATE_CHROMIUM_READONLY_KEEP_PROPOSE_REVIEW_FILTER_STALE_HOLD');
}finally{await context.close();await browser.close();}
