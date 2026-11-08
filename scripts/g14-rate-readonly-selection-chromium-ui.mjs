import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(name==='/'){res.writeHead(200,{'Content-Type':'text/html'});
    res.end('<section id="pokemon"><div class="section-head"></div><div class="filter-bar"></div></section>');return;}
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)||!file.endsWith('.js')){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
const levels=[10,25,50,70,80],names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const skills=id=>levels.map((unlock_level,i)=>({pokemon_id:id,unlock_level,subskill_name:names[i]}));
const p=(id,instance,extra={})=>({pokemon_id:id,pokemon_instance_id:instance,species:'同物種',
  level:20,specialty:'樹果',nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-',...extra});
try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(async data=>{
    window.__rateSource=data;
    const mod=await import('/assets/js/pokemon-roster-rating-preview.js');
    mod.setupPokemonRosterRatingPreview({readRoster:()=>window.__rateSource.pokemon,
      readIngredients:()=>window.__rateSource.ingredients,readSubskills:()=>window.__rateSource.subskills});
  },{pokemon:[p('p1','one'),p('p2','two',{nature:null})],
    ingredients:[],subskills:[...skills('p1'),...skills('p2')]});
  await page.locator('[data-rate3-preview-button]').click();
  assert.equal(await page.locator('[data-rate4-choice]').count(),1);
  assert.equal(await page.locator('[data-rate4-filter] option').count(),16);
  assert.equal(await page.locator('[data-rate4-state="HOLD"]').count(),1);
  await page.locator('[data-rate4-choice]').check();
  assert.match(await page.locator('[data-rate4-count]').innerText(),/擬採用 1/);
  await page.locator('[data-rate4-review]').click();
  assert.match(await page.locator('[data-rate4-review-panel]').innerText(),/D- → S\+/);
  await page.locator('[data-rate4-keep-all]').click();
  assert.match(await page.locator('[data-rate4-count]').innerText(),/擬採用 0/);
  await page.locator('[data-rate4-select-all]').click();
  assert.match(await page.locator('[data-rate4-count]').innerText(),/擬採用 1/);
  await page.locator('[data-rate4-filter]').selectOption('S+');
  assert.equal(await page.locator('[data-rate4-state="ELIGIBLE"]').count(),1);
  await page.locator('[data-rate4-sort]').selectOption('grade-low');
  // Negative-first: unknown/HOLD is not a 15-band grade and must sort AFTER
  // eligible recommendations in either direction, never ahead of S+ in ascending order.
  await page.locator('[data-rate4-filter]').selectOption('');
  assert.equal(await page.locator('[data-rate4-state]').first().getAttribute('data-rate4-state'),'ELIGIBLE',
    'ascending grade order must not elevate an unknown HOLD ahead of a known rating');
  assert.equal(await page.locator('[data-rate4-state]').last().getAttribute('data-rate4-state'),'HOLD');
  await page.locator('[data-rate4-sort]').selectOption('grade-high');
  assert.equal(await page.locator('[data-rate4-state]').first().getAttribute('data-rate4-state'),'ELIGIBLE',
    'descending grade order must also keep unknown HOLD after rated Pokémon');
  assert.equal(await page.locator('[data-rate4-state]').last().getAttribute('data-rate4-state'),'HOLD');
  await page.evaluate(()=>{window.__rateSource.pokemon[0].level=21;});
  await page.locator('[data-rate4-review]').click();
  assert.equal(await page.locator('[data-rate4-stale]').count(),1);
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate4-count]').innerText(),/擬採用 0/);
  // Negative-first real Chromium: JSON.stringify aliases null and NaN. A changed
  // full-source fact must clear pending adopt intent before review, even when
  // the displayed heuristic grade would otherwise remain unchanged.
  await page.evaluate(()=>{window.__rateSource.pokemon[0].freshness_probe=null;});
  await page.locator('[data-rate3-preview-button]').click();
  await page.locator('[data-rate4-choice]').check();
  await page.evaluate(()=>{window.__rateSource.pokemon[0].freshness_probe=Number.NaN;});
  await page.locator('[data-rate4-review]').click();
  assert.equal(await page.locator('[data-rate4-stale]').count(),1,
    'nonfinite source change must revoke nonpersistent selection before review');
  // RATE.5 isolated read-only guard in genuine Chromium; no production Apply.
  const rate5=await page.evaluate(async()=>{
    const {capturePokemonRatingRefreshAuthority:capture,
      reviewPokemonRatingRefreshAuthority:review}=await import('/assets/js/pokemon-rating-refresh-authority.js');
    const {POKEMON_PROVISIONAL_RATING_RULE_VERSION:rule}=await import('/assets/js/pokemon-provisional-rating.js');
    const baseline={rule_version:rule,sqlite_generation:1,sqlite_sha256:'a'.repeat(64),
      import_revision:'i1',restore_revision:'r1',observation_revision:'o1',
      pokemon:[{pokemon_id:'A',pokemon_instance_id:'instance-A',level:20}],
      ingredients:[],subskills:[]};
    const captured=capture(baseline);
    const row={...baseline.pokemon[0]};
    Object.defineProperty(row,'level',{enumerable:true,get(){return 20;}});
    const altered={...baseline,pokemon:[row]};
    const symbolRow={...baseline.pokemon[0]};
    symbolRow[Symbol('untracked')]='changed';
    const extraIngredients=[...baseline.ingredients];
    extraIngredients.unverified_revision='changed';
    return {baseline:captured.status,noncanonical:capture(altered).status,
      review:review({captured,latest:altered}).status,
      symbol:capture({...baseline,pokemon:[symbolRow]}).status,
      arrayMetadata:capture({...baseline,ingredients:extraIngredients}).status};
  });
  assert.equal(rate5.baseline,'CAPTURED_READ_ONLY');
  assert.equal(rate5.noncanonical,'HOLD_SOURCE_UNVERIFIED',
    'Chromium getter-backed fact must not certify the same source token');
  assert.equal(rate5.review,'HOLD_SOURCE_UNVERIFIED');
  assert.equal(rate5.symbol,'HOLD_SOURCE_UNVERIFIED');
  assert.equal(rate5.arrayMetadata,'HOLD_SOURCE_UNVERIFIED');
  console.log('PASS G14_RATE_CHROMIUM_KEEP_ADOPT_REVIEW_15_LEVEL_STALE_CLEAR_ZERO_WRITE');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
