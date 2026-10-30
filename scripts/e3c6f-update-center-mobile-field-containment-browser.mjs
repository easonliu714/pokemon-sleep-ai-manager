import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Actual PWA DOM, not a handcrafted mock. Form is never submitted.
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const widths=[320,360,390,430,700,768];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:840},deviceScaleFactor:2,serviceWorkers:'block',
  });
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#dbStatus')?.textContent?.includes('就緒'),{timeout:60000});
  // Hidden Update Center is not visible until its real navigation is activated.
  await page.locator('nav button[data-view="updates"]').click();
  await page.waitForSelector('#e3c6bCaptureForm',{timeout:30000});
  await page.locator('#e3c6bCaptureForm').scrollIntoViewIfNeeded();
  const results=[];
  for(const width of widths){
    await page.setViewportSize({width,height:840});
    const r=await page.evaluate(()=>{
      const form=document.querySelector('#e3c6bCaptureForm');
      const panel=document.querySelector('#e3c6bFirstPartyPanel');
      const bb=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
      const names=['berry_items_collected','berry_count_completeness_status',
        'ingredient_items_collected','inventory_items_before_collection','pokemon_id','source_key'];
      const controls=names.map(name=>{
        const input=form.elements.namedItem(name);
        return {name,control:input?bb(input):null,field:input?.closest('.edit-field')?bb(input.closest('.edit-field')):null};
      });
      return {width:innerWidth,form:bb(form),panel:bb(panel),
        scroll:form.scrollWidth,client:form.clientWidth,controls,
        columns:getComputedStyle(form).gridTemplateColumns.trim().split(/\s+/).length,
        fix:!!document.querySelector('#e3c6fMobileCaptureContainmentStyle')};
    });
    assert.equal(r.fix,true,'network-first E3C JS must install scoped style');
    assert.ok(r.form.width>0&&r.form.right<=width+1,'form overflows viewport '+width);
    assert.ok(r.form.right<=r.panel.right+1,'form overflows panel '+width);
    assert.ok(r.scroll<=r.client+1,'form scroll overflow at '+width+' '+JSON.stringify(r));
    assert.equal(r.columns,width<=700?1:2,'form responsive columns at '+width);
    for(const row of r.controls){
      assert.ok(row.control&&row.field,'missing named field '+row.name);
      assert.ok(row.control.width>60,'unusable control width '+row.name+' '+width);
      assert.ok(row.control.left>=row.field.left-1,'left escape '+row.name+' '+width);
      assert.ok(row.control.right<=row.field.right+1,'right escape '+row.name+' '+width);
      assert.ok(row.control.right<=r.form.right+1,'form escape '+row.name+' '+width);
    }
    results.push({width,columns:r.columns,scrollWidth:r.scroll,clientWidth:r.client});
  }
  const berry=page.locator('#e3c6bCaptureForm [name="berry_items_collected"]');
  const ingredient=page.locator('#e3c6bCaptureForm [name="ingredient_items_collected"]');
  const status=page.locator('#e3c6bCaptureForm [name="berry_count_completeness_status"]');
  assert.equal(await status.inputValue(),'POSSIBLY_CENSORED_BY_SNORLAX');
  await berry.fill('12');
  await ingredient.fill('7');
  assert.equal(await berry.inputValue(),'12');
  assert.equal(await ingredient.inputValue(),'7');
  assert.equal(await berry.getAttribute('min'),'0');
  assert.equal(await ingredient.getAttribute('step'),'1');
  assert.equal(await page.locator('#e3c6bCaptureForm [name="observation_evidence_refs"]').count(),1);
  console.log('PASS E3C6F_ANDROID_320_360_390_430_700_SINGLE_COLUMN_CONTAINED');
  console.log('PASS E3C6F_768_DESKTOP_TWO_COLUMN_CONTAINED');
  console.log('PASS E3C6F_INPUT_SEMANTICS_CENSORED_DEFAULT_UNCHANGED');
  console.log(JSON.stringify({results,source:'real-PWA-DOM',playerWrites:false}));
}finally{await browser.close();}
