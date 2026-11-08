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
  await page.evaluate(()=>{window.__rateSource.pokemon[0].level=21;});
  await page.locator('[data-rate4-review]').click();
  assert.equal(await page.locator('[data-rate4-stale]').count(),1);
  await page.locator('[data-rate3-preview-button]').click();
  assert.match(await page.locator('[data-rate4-count]').innerText(),/擬採用 0/);
  console.log('PASS G14_RATE_CHROMIUM_KEEP_ADOPT_REVIEW_15_LEVEL_STALE_CLEAR_ZERO_WRITE');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
