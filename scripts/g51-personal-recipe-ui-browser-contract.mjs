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
  const startup=await page.locator('#dbStatus').textContent();
  assert.equal(startup,'App 已就緒',`G5.1 browser gate requires normal App Ready; observed=${startup||'missing'}`);

  const recipeNav=page.locator('nav[aria-label="主要功能"] button[data-view="recipes"]');
  await recipeNav.click();
  await page.waitForFunction(()=>Boolean(document.getElementById('g51PersonalRecipeRoot')),null,{timeout:10000});

  const result=await page.evaluate(()=>{
    const section=document.getElementById('recipes');
    const root=document.getElementById('g51PersonalRecipeRoot');
    const table=section?.querySelector('.table-wrap');
    const button=document.getElementById('g51NewRecipeBtn');
    const form=document.getElementById('g51PersonalRecipeForm');
    const rootIndex=[...(section?.children||[])].indexOf(root);
    const tableIndex=[...(section?.children||[])].indexOf(table);
    return {
      recipe_active:section?.classList.contains('active')||false,
      root_present:Boolean(root),
      root_authority:root?.dataset?.g51Authority||'',
      new_button_text:button?.textContent?.trim()||'',
      create_form_hidden:form?.classList.contains('hidden')||false,
      root_before_public_table:rootIndex>=0&&tableIndex>=0&&rootIndex<tableIndex,
      public_readonly_text:root?.textContent?.includes('公版料理主檔保持唯讀')||false,
    };
  });

  assert.equal(result.recipe_active,true);
  assert.equal(result.root_present,true);
  assert.match(result.root_authority,/^g51-personal-recipe-ui-/);
  assert.equal(result.new_button_text,'新增個人食譜');
  assert.equal(result.create_form_hidden,true);
  assert.equal(result.root_before_public_table,true);
  assert.equal(result.public_readonly_text,true);
  console.log(JSON.stringify({status:'PASS',gate:'G51_PERSONAL_RECIPE_UI_BROWSER',result},null,2));
}finally{
  await browser.close();
}
