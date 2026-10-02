import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const text=document.getElementById('dbStatus')?.textContent||'';
    return text.includes('App 已就緒')||text.includes('救援／唯讀模式')||text.includes('初始化失敗');
  },null,{timeout:30000});
  const startup=(await page.locator('#dbStatus').textContent())||'';
  assert.equal(startup,'App 已就緒',`retirement browser gate requires normal App Ready; observed=${startup}`);

  await page.evaluate(()=>{
    const section=document.getElementById('recipes');
    const stale=document.createElement('section');
    stale.id='g51PersonalRecipeRoot';
    stale.innerHTML='<h3>我的食譜</h3><button>新增個人食譜</button>';
    section?.prepend(stale);
  });
  await page.waitForFunction(()=>!document.getElementById('g51PersonalRecipeRoot'),null,{timeout:3000});

  await page.locator('nav[aria-label="主要功能"] button[data-view="recipes"]').click();
  await page.waitForFunction(()=>Boolean(document.getElementById('recipeUnlockedWorkbenchHeading'))&&Boolean(document.getElementById('recipeLockedWorkbenchHeading')),null,{timeout:10000});

  const result=await page.evaluate(()=>{
    const recipes=document.getElementById('recipes');
    const text=recipes?.textContent||'';
    return {
      root_present:Boolean(document.getElementById('g51PersonalRecipeRoot')),
      has_my_recipes:text.includes('我的食譜'),
      has_new_personal_recipe:text.includes('新增個人食譜'),
      unlocked_heading:document.getElementById('recipeUnlockedWorkbenchHeading')?.textContent?.trim()||'',
      locked_heading:document.getElementById('recipeLockedWorkbenchHeading')?.textContent?.trim()||'',
      unlocked_controls:recipes?.querySelectorAll('.canonical-recipe-unlocked').length||0,
      level_controls:recipes?.querySelectorAll('.canonical-recipe-level').length||0,
      energy_controls:recipes?.querySelectorAll('.canonical-recipe-energy').length||0,
    };
  });

  assert.equal(result.root_present,false);
  assert.equal(result.has_my_recipes,false);
  assert.equal(result.has_new_personal_recipe,false);
  assert.equal(result.unlocked_heading,'已解鎖料理／玩家狀態');
  assert.equal(result.locked_heading,'未解鎖料理');
  assert.ok(result.unlocked_controls>0,'canonical unlocked controls must remain');
  assert.ok(result.level_controls>0,'canonical recipe level controls must remain');
  assert.ok(result.energy_controls>0,'canonical current-energy controls must remain');

  console.log(JSON.stringify({gate:'G51_PERSONAL_RECIPE_RETIREMENT_BROWSER',status:'PASS',result},null,2));
}finally{
  await browser.close();
}
