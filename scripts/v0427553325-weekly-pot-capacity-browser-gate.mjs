import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Actual app CSS + source-bound Weekly field DOM in real Chromium; no SQLite/IDB writes.
const g3=fs.readFileSync('assets/js/g3-planning.js','utf8');
assert.ok(g3.includes('id="weeklyContextForm"')&&g3.includes("field('pot_size', '鍋子容量', row.pot_size, 'number')"));
assert.ok(g3.includes('class="edit-field"'));
const editor=fs.readFileSync('assets/css/editor.css','utf8');
assert.match(editor,/\.edit-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
const css=fs.readFileSync('assets/css/app.css','utf8');
assert.ok(css.includes('#weeklyContextForm .edit-field> :is(input,select,textarea)'));
assert.doesNotMatch(css,/(?:html|body)\s*\{[^}]*overflow-x:\s*hidden/);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:360,height:915},serviceWorkers:'block'});
const results=[];
try{
  await page.route(/\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* synthetic DOM only */'}));
  const response=await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200);
  await page.evaluate(()=>{
    const field=(name,label,type,value)=>'<label class="edit-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+value+'"></label>';
    const select=(name,label,value)=>'<label class="edit-field"><span>'+label+'</span><select name="'+name+'"><option>'+value+'</option></select></label>';
    document.getElementById('weeklyContextPanel').innerHTML='<form id="weeklyContextForm"><div class="edit-grid">'+
      field('week_start','週起始日','date','2026-10-19')+select('camp','營地','萌綠之島')+
      select('dish_category','料理類型','咖哩／濃湯')+field('pot_size','鍋子容量（來源：帳號鍋子容量）','number','63')+
      select('favorite_berry_1','喜好樹果 1','請選擇')+select('favorite_berry_2','喜好樹果 2','請選擇')+
      '<label class="edit-field full"><span>備註</span><textarea name="base_notes">備註</textarea></label>'+
      '</div><button type="button">儲存本週環境</button></form>';
  });
  for(const width of [360,390,412,430]){
    await page.setViewportSize({width,height:915});
    const v=await page.evaluate(()=>{
      document.querySelectorAll('section.view').forEach(n=>n.classList.toggle('active',n.id==='weekly'));
      const p=document.getElementById('weeklyContextPanel').getBoundingClientRect();
      const form=document.getElementById('weeklyContextForm'),fields=[...form.querySelectorAll('.edit-field')];
      const controls=fields.flatMap(label=>[...label.querySelectorAll('input,select,textarea')].map(el=>{
        const r=el.getBoundingClientRect(),l=label.getBoundingClientRect();
        return {name:el.name,left:r.left,right:r.right,labelLeft:l.left,labelRight:l.right,width:r.width,editable:!el.disabled};
      }));
      return {doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:window.innerWidth,
        panelLeft:p.left,panelRight:p.right,controls,firstRowTwoCols:Math.abs(fields[0].getBoundingClientRect().top-fields[1].getBoundingClientRect().top)<2,
        globalOverflow:[getComputedStyle(document.documentElement).overflowX,getComputedStyle(document.body).overflowX]};
    });
    assert.ok(v.doc<=width&&v.body<=width,'Weekly viewport scroll exceeded '+width+': '+JSON.stringify(v));
    assert.ok(v.panelLeft>=0&&v.panelRight<=width+1,'Weekly parent panel escaped');
    assert.equal(v.firstRowTwoCols,true,'Original 2-column weekly layout must remain');
    assert.ok(v.controls.length>=7);
    for(const control of v.controls){
      assert.ok(control.left>=Math.max(v.panelLeft,control.labelLeft)-1,'left escape '+width+': '+JSON.stringify(control));
      assert.ok(control.right<=Math.min(v.panelRight,control.labelRight)+1,'right escape '+width+': '+JSON.stringify(control));
      assert.ok(control.width>20&&control.editable,'field inactive '+width);
    }
    assert.ok(!v.globalOverflow.includes('hidden'),'Do not hide global page overflow');
    await page.locator('#weeklyContextForm [name="pot_size"]').fill('63');
    assert.equal(await page.locator('#weeklyContextForm [name="pot_size"]').inputValue(),'63');
    results.push({width,documentWidth:v.doc,bodyWidth:v.body,twoColumns:true,potContained:true});
  }
  await page.setViewportSize({width:360,height:915});
  const breaker=await page.addStyleTag({content:'#weeklyContextForm input[name="pot_size"]{width:280px!important;min-width:280px!important;max-width:none!important}'});
  const negative=await page.evaluate(()=>{
    const input=document.querySelector('#weeklyContextForm input[name="pot_size"]');
    return input.getBoundingClientRect().right>document.getElementById('weeklyContextPanel').getBoundingClientRect().right+1;
  });
  assert.equal(negative,true,'deliberately oversize input must be detected');
  await breaker.evaluate(el=>el.remove());
  console.log(JSON.stringify({gate:'G479_R2_WEEKLY_POT_NUMBER_VIEWPORT',status:'PASS',mode:'REAL_CHROMIUM_SYNTHETIC_DOM',results,negative_overflow_detected:true}));
}finally{await browser.close();}
