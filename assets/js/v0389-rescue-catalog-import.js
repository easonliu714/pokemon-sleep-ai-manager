import {isRescueReadonly,requestForcedDatabaseLoad} from './database.js';

const BUILD='20260805-v0389-rescue-catalog-import-recovery';
const STAGING_DB='pokemon_sleep_rescue_import_staging';
const STAGING_STORE='packages';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=id=>document.getElementById(id);
const ITEM_EFFECTS=[
['大師沙布蕾','biscuit','友好度增加最多的特別沙布蕾。'],['高級沙布蕾','biscuit','友好度大幅增加的高級沙布蕾。'],['超級沙布蕾','biscuit','友好度增加較多的沙布蕾。'],['寶可沙布蕾','biscuit','餵給寶可夢後可增加友好度。'],
['主技能種子','skill_seed','提升主技能等級。'],['副技能種子','skill_seed','提升可強化的副技能等級。'],['活力枕頭','recovery','回復指定幫手寶可夢的活力。'],['幫手哨子','production','立即獲得一段時間的幫手成果。'],
['食材券S','ingredient_ticket','隨機獲得少量食材。'],['食材券M','ingredient_ticket','隨機獲得中量食材。'],['食材券L','ingredient_ticket','隨機獲得大量食材。'],
['萬能糖果S','candy','可交換為少量指定寶可夢的糖果。'],['萬能糖果M','candy','可交換為中量指定寶可夢的糖果。'],['萬能糖果L','candy','可交換為大量指定寶可夢的糖果。'],
['夢之塊S','dream_cluster','使用後獲得少量夢之碎片。'],['夢之塊M','dream_cluster','使用後獲得中量夢之碎片。'],['夢之塊L','dream_cluster','使用後獲得大量夢之碎片。'],
['營地移動券','camp','重新抽選目前營地。'],['好露營券','camp','在一定期間內獲得好露營組合的效果。'],
['回復薰香','incense','睡眠研究後可獲得更多活力回復效果。'],['專注薰香','incense','睡眠研究後可獲得更多研究EXP。'],['幸運薰香','incense','睡眠研究後可獲得更多夢之碎片。'],['成長薰香','incense','睡眠研究後寶可夢可獲得更多EXP。'],['友好薰香','incense','睡眠研究時更容易遇到肚子餓的寶可夢。'],
['火之石','evolution','部分寶可夢進化所需的特殊道具。'],['水之石','evolution','部分寶可夢進化所需的特殊道具。'],['雷之石','evolution','部分寶可夢進化所需的特殊道具。'],['葉之石','evolution','部分寶可夢進化所需的特殊道具。'],['冰之石','evolution','部分寶可夢進化所需的特殊道具。'],['月之石','evolution','部分寶可夢進化所需的特殊道具。'],['光之石','evolution','部分寶可夢進化所需的特殊道具。'],['暗之石','evolution','部分寶可夢進化所需的特殊道具。'],['覺醒之石','evolution','部分寶可夢進化所需的特殊道具。'],['渾圓之石','evolution','部分寶可夢進化所需的特殊道具。'],['王者之證','evolution','部分寶可夢進化所需的特殊道具。'],['聯繫繩','evolution','部分寶可夢進化所需的特殊道具。'],['金屬膜','evolution','部分寶可夢進化所需的特殊道具。'],['銳利之爪','evolution','部分寶可夢進化所需的特殊道具。']
];

function recipes(){return Array.from(globalThis.PokemonSleepPublicRecipeRegistry||[]);}
function ingredients(){
  const names=new Set();
  for(const recipe of recipes())for(const part of String(recipe.summary||'').split('、')){const m=part.match(/^(.*)×\d+$/);if(m?.[1])names.add(m[1].trim());}
  return [...names].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}
function rescueNotice(section,text){
  if(!section)return;let box=section.querySelector('.v0389-rescue-notice');
  if(!box){box=document.createElement('div');box.className='panel notice v0389-rescue-notice';section.insertBefore(box,section.children[1]||null);}box.textContent=text;
}
function renderIngredients(){
  const table=$('ingredientTable');if(!table)return;
  const data=ingredients();rescueNotice($('ingredients'),`救援模式公版：食材 ${data.length} 種。玩家庫存尚未載入，畫面不以 0 代替真實數量。`);
  table.innerHTML=`<thead><tr><th>食材</th><th>玩家數量</th><th>狀態</th></tr></thead><tbody>${data.map(name=>`<tr><td>${esc(name)}</td><td>尚未載入</td><td>公版唯讀</td></tr>`).join('')}</tbody>`;
}
function renderItems(){
  const table=$('itemTable');if(!table)return;
  rescueNotice($('items'),`救援模式公版：道具 ${ITEM_EFFECTS.length} 種。玩家庫存與保留量尚未載入。`);
  table.innerHTML=`<thead><tr><th>道具</th><th>分類</th><th>玩家庫存</th><th>功能說明</th></tr></thead><tbody>${ITEM_EFFECTS.map(([name,category,effect])=>`<tr><td>${esc(name)}</td><td>${esc(category)}</td><td>尚未載入</td><td>${esc(effect)}</td></tr>`).join('')}</tbody>`;
}
function renderRecipes(){
  const table=$('recipeTable');if(!table)return;const data=recipes();
  rescueNotice($('recipes'),`救援模式公版：料理 ${data.length} 道。解鎖、料理等級與目前能量均屬玩家狀態，目前尚未載入。`);
  table.innerHTML=`<thead><tr><th>分類</th><th>料理</th><th>配方</th><th>解鎖</th><th>料理等級</th><th>目前能量</th></tr></thead><tbody>${data.map(row=>`<tr><td>${esc(row.category)}</td><td>${esc(row.recipe_name)}</td><td>${esc(row.summary)}</td><td>尚未載入</td><td>尚未載入</td><td>尚未載入</td></tr>`).join('')}</tbody>`;
}
function renderRescueCatalog(){if(!isRescueReadonly())return false;renderIngredients();renderItems();renderRecipes();return true;}

function openStageDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(STAGING_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STAGING_STORE))db.createObjectStore(STAGING_STORE,{keyPath:'update_id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function stagePut(payload){const db=await openStageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STAGING_STORE,'readwrite');tx.objectStore(STAGING_STORE).put({update_id:payload.update_id,payload,staged_at:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function stageList(){const db=await openStageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STAGING_STORE,'readonly');const req=tx.objectStore(STAGING_STORE).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[]);};req.onerror=()=>{db.close();reject(req.error);};});}
async function stageDelete(updateId){const db=await openStageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STAGING_STORE,'readwrite');tx.objectStore(STAGING_STORE).delete(updateId);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
function validatePayload(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('JSON 根節點必須是物件');
  for(const key of ['schema_version','update_id','generated_at','operations'])if(!(key in payload))throw new Error(`缺少欄位：${key}`);
  if(!Array.isArray(payload.operations))throw new Error('operations 必須是陣列');if(payload.operations.length>5000)throw new Error('單包最多 5000 operations');
  payload.operations.forEach((op,index)=>{if(!op||typeof op!=='object')throw new Error(`操作 ${index} 格式錯誤`);for(const key of ['entity','action','key'])if(!(key in op))throw new Error(`操作 ${index} 缺少 ${key}`);});
  return {update_id:String(payload.update_id),operation_count:payload.operations.length,entities:[...new Set(payload.operations.map(op=>op.entity))]};
}
function ensurePanel(){
  let panel=document.getElementById('v0389RescueTools');if(panel)return panel;
  const host=$('updates')||$('dashboard')||document.querySelector('main');if(!host)return null;
  panel=document.createElement('section');panel.id='v0389RescueTools';panel.className='panel';
  panel.innerHTML=`<h3>救援模式資料工具</h3><p id="v0389ModeText"></p><div class="button-row"><button id="v0389LoadPlayerDb">載入玩家資料庫並切換一般模式</button><label class="button">選擇 JSON 暫存<input id="v0389JsonFile" type="file" accept="application/json,.json" hidden></label></div><div id="v0389StageMessage" class="notice"></div><div id="v0389StageList"></div>`;
  host.insertBefore(panel,host.firstChild);return panel;
}
async function renderStages(){
  const panel=ensurePanel();if(!panel)return;const rescue=isRescueReadonly();panel.querySelector('#v0389ModeText').textContent=rescue?'目前為救援／唯讀模式：JSON 僅解析、驗證及暫存，不修改玩家資料。':'一般模式已載入：暫存 JSON 可執行 Dry Run 與套用。';
  const list=await stageList();const target=panel.querySelector('#v0389StageList');
  target.innerHTML=list.length?`<h4>待處理 JSON（${list.length}）</h4>${list.map(item=>`<div class="panel v0389-stage" data-id="${esc(item.update_id)}"><b>${esc(item.update_id)}</b>｜${item.payload.operations.length} operations｜${esc(item.staged_at)}<div>${rescue?'載入玩家資料庫後才能 Dry Run／套用。':`<button data-action="dry">Dry Run</button><button data-action="apply">套用</button>`}<button data-action="delete">移除暫存</button></div><pre class="v0389-result"></pre></div>`).join('')}`:'<p>目前沒有暫存 JSON。</p>';
  target.querySelectorAll('.v0389-stage button').forEach(button=>button.addEventListener('click',async()=>{const card=button.closest('.v0389-stage'),id=card.dataset.id,item=list.find(row=>row.update_id===id),out=card.querySelector('.v0389-result');try{if(button.dataset.action==='delete'){await stageDelete(id);await renderStages();return;}const importer=await import('./importer.js');const preview=importer.dryRun(item.payload);out.textContent=JSON.stringify({operation_count:preview.operation_count,ready_count:preview.ready_count,conflict_count:preview.conflict_count},null,2);if(button.dataset.action==='apply'){if(preview.conflict_count)throw new Error('仍有衝突，禁止套用');if(!confirm(`確認套用 ${preview.operation_count} 筆操作？`))return;await importer.applyPayload(item.payload);await stageDelete(id);window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'staged_json',operation:'applied'}}));await renderStages();}}catch(error){out.textContent=`失敗：${error.message}`;}}));
}
function installControls(){
  const panel=ensurePanel();if(!panel)return;
  panel.querySelector('#v0389LoadPlayerDb').onclick=()=>{if(!confirm('將重新載入頁面並嘗試開啟玩家 SQLite。若載入失敗，下次開啟會自動回到救援模式。是否繼續？'))return;requestForcedDatabaseLoad();location.reload();};
  panel.querySelector('#v0389JsonFile').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;const message=panel.querySelector('#v0389StageMessage');try{const payload=JSON.parse(await file.text());const summary=validatePayload(payload);await stagePut(payload);message.textContent=`已驗證並暫存：${summary.update_id}，${summary.operation_count} operations；尚未修改玩家資料。`;await renderStages();}catch(error){message.textContent=`JSON 暫存失敗：${error.message}`;}finally{event.target.value='';}};
  renderStages().catch(console.error);
}
function install(){renderRescueCatalog();installControls();for(const button of document.querySelectorAll('nav button'))button.addEventListener('click',()=>setTimeout(()=>{renderRescueCatalog();renderStages().catch(console.error);},0),true);window.addEventListener('pokemon-sleep:public-recipe-registry-ready',renderRescueCatalog);window.addEventListener('pokemon-sleep:database-ready',()=>{renderRescueCatalog();renderStages().catch(console.error);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.PokemonSleepV0389Rescue=Object.freeze({build:BUILD,validatePayload,stagePut,stageList,stageDelete,renderRescueCatalog});
