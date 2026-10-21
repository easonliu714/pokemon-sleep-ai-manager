import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Synthetic public-only DOM in real Chromium; scripts suppressed, no SQLite/IDB/SW.
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const css=path=>{const source=fs.readFileSync(path,'utf8');const value=source.match(/style\.textContent=\x60([\s\S]*?)\x60;/)?.[1];assert.ok(value,'missing runtime CSS: '+path);return value;};
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:360,height:915},serviceWorkers:'block'});
const results=[];
try{
 await page.route(/\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* synthetic layout only */'}));
 const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response?.status(),200);
 await page.addStyleTag({content:css('assets/js/v03993-public-knowledge-coverage-ui.js')});
 await page.addStyleTag({content:css('assets/js/camp-berry-knowledge-ui.js')});
 await page.evaluate(()=>{
  const long='PUBLIC_MASTER_UNRESOLVED_SOURCE_IDENTIFIER_'.repeat(4);
  const table=id=>'<div class="table-wrap" role="region" tabindex="0"><table id="'+id+'" style="min-width:920px"><tr>'+Array.from({length:7},(_,i)=>'<th>欄位'+i+'</th>').join('')+'</tr><tr>'+Array.from({length:7},(_,i)=>'<td><a href="#source'+i+'">'+long+'</a></td>').join('')+'</tr></table></div>';
  document.getElementById('warroomPanel').innerHTML='<div class="panel"><h3>Goal / Hard Constraints</h3><form id="warRoomGoalProfileForm" class="edit-grid"><label class="edit-field"><span>策略名稱</span><input name="profile_name"></label><label class="edit-field"><span>主要目標</span><select><option>均衡</option></select></label><fieldset class="edit-field full"><legend>限制</legend><label><input type="checkbox">'+long+'</label></fieldset><label class="edit-field"><span>同物種最多</span><input type="number" value="2"></label><label class="edit-field"><span>料理政策</span><select><option>已解鎖</option></select></label><div class="edit-field full"><div class="controlled-number-map-row"><span>'+long+'</span><input type="number"><button type="button">移除</button></div></div></form>'+table('warroomWideTable')+'</div>';
  document.getElementById('sharedKnowledgePanel').innerHTML='<section class="public-coverage-block"><div class="public-coverage-head"><div><h3>Pokémon 公版 Master Coverage</h3><p>'+long+'</p></div><span class="badge pending">REVIEW</span></div><div class="public-coverage-grid">'+Array.from({length:4},(_,i)=>'<div class="public-coverage-card"><b>'+long+i+'</b><span>Coverage</span><small>'+long+'</small></div>').join('')+'</div><div class="public-coverage-lists"><div class="public-coverage-list"><ul><li>'+long+'</li></ul></div><div class="public-coverage-list"><a href="#source">'+long+'</a></div></div>'+table('knowledgeWideTable')+'</section><section id="campBerryMasterBlock"><div class="table-wrap camp-berry-scroll" tabindex="0"><table id="campBerryMasterTable"><tr>'+Array.from({length:5},()=>'<th>營地來源</th>').join('')+'</tr><tr>'+Array.from({length:5},()=>'<td>'+long+'</td>').join('')+'</tr></table></div></section>';
 });
 for(const width of [360,390,412,430]){
  await page.setViewportSize({width,height:915});
  for(const view of ['warroom','knowledge']){
   const x=await page.evaluate(view=>{
    document.querySelectorAll('section.view').forEach(n=>n.classList.toggle('active',n.id===view));
    const panel=document.getElementById(view==='warroom'?'warroomPanel':'sharedKnowledgePanel'),box=panel.getBoundingClientRect();
    const escaped=[...panel.querySelectorAll('input:not([type=checkbox]),select,textarea,fieldset,.edit-field,.public-coverage-card,.public-coverage-list,.public-coverage-grid')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<box.left-1||r.right>box.right+1);}).map(n=>n.tagName+'.'+n.className);
    const wraps=[...panel.querySelectorAll('.table-wrap')].map(n=>{n.scrollLeft=140;const r=n.getBoundingClientRect();return {client:n.clientWidth,scroll:n.scrollWidth,left:r.left,right:r.right,overflow:getComputedStyle(n).overflowX,moved:n.scrollLeft>0};});
    const fields=panel.querySelectorAll('#warRoomGoalProfileForm>.edit-field');
    return {doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,htmlOverflow:getComputedStyle(document.documentElement).overflowX,bodyOverflow:getComputedStyle(document.body).overflowX,left:box.left,right:box.right,escaped,wraps,oneColumn:view==='warroom'?fields[1].getBoundingClientRect().top>=fields[0].getBoundingClientRect().bottom-1:null,cells:[...panel.querySelectorAll('td')].map(n=>({overflow:getComputedStyle(n).overflow,ellipsis:getComputedStyle(n).textOverflow}))};
   },view);
   assert.ok(x.doc<=width&&x.body<=width,view+'@'+width+' page overflow: '+JSON.stringify(x));
   assert.notEqual(x.htmlOverflow,'hidden');assert.notEqual(x.bodyOverflow,'hidden');
   assert.deepEqual(x.escaped,[],view+'@'+width+' escaped child');
   assert.ok(x.wraps.length>=(view==='knowledge'?2:1));
   for(const w of x.wraps){assert.ok(w.left>=x.left-1&&w.right<=x.right+1,view+'@'+width+' wrapper escaped');assert.equal(w.overflow,'auto');assert.ok(w.scroll>w.client+100&&w.moved,view+'@'+width+' table scroll unavailable');}
   assert.ok(x.cells.every(c=>c.overflow!=='hidden'&&c.ellipsis!=='ellipsis'),view+'@'+width+' clipped data');
   if(view==='warroom'){assert.equal(x.oneColumn,true);await page.locator('#warRoomGoalProfileForm input[name="profile_name"]').fill('mobile-'+width);assert.equal(await page.locator('#warRoomGoalProfileForm input[name="profile_name"]').inputValue(),'mobile-'+width);}
   results.push({view,width,documentWidth:x.doc,scrollRegions:x.wraps.length});
  }
 }
 console.log(JSON.stringify({gate:'G479_RESPONSIVE_BOTH_VIEWS',status:'PASS',evidence:'SYNTHETIC_DOM_REAL_CHROMIUM',results}));
}finally{await browser.close();}
