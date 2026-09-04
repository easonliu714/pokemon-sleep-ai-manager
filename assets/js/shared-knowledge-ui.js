import './v0395-dom-render-scheduler.js';
import {rows,isRescueReadonly} from './database.js';
import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_NATURE_MASTER,PUBLIC_MAIN_SKILL_MASTER,PUBLIC_EVOLUTION_MASTER,PUBLIC_POKEMON_KNOWLEDGE_VERSION} from './public-pokemon-knowledge-master.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false,scheduled=false;
const activeView=()=>document.querySelector('.view.active')?.id||'dashboard';
const yieldToUi=()=>new Promise(resolve=>setTimeout(resolve,0));

function knowledgeSlot(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return null;
  let slot=document.getElementById('knowledgePokemonSlot');
  if(!slot){slot=document.createElement('section');slot.id='knowledgePokemonSlot';slot.dataset.pageSlot='knowledge-pokemon';slot.dataset.hydrationState='pending';panel.appendChild(slot);}
  return slot;
}
function ensureKnowledgeUi(){
  const slot=knowledgeSlot();if(!slot)return false;
  if(!document.getElementById('berryMasterTable')){
    slot.classList.remove('loading-placeholder');
    slot.innerHTML=`
      <h3>樹果與屬性對照</h3><p class="notice">樹果／屬性為公版資料；救援模式亦可完整瀏覽，不依賴玩家 SQLite。</p><div class="table-wrap"><table id="berryMasterTable"></table></div>
      <h3>性格影響表</h3><p class="notice">依遊戲性格名稱呈現提升／降低項目；只投影公版效果，不寫入玩家個體欄位。</p><div class="table-wrap"><table id="natureMasterTable"></table></div>
      <h3>主技能說明表</h3><p class="notice">公版說明由版本化 Master 提供；個體只需要保存主技能名稱與等級。</p><div class="table-wrap"><table id="mainSkillMasterTable"></table></div>
      <h3>進化條件表</h3><p class="notice">目前只列入已核對的公版進化 route；未列出代表「尚未收錄／核對」，不代表該寶可夢不能進化。</p><div class="table-wrap"><table id="evolutionMasterTable"></table></div>
      <p class="notice">Pokémon Knowledge Master：<b>${esc(PUBLIC_POKEMON_KNOWLEDGE_VERSION)}</b></p>`;
  }
  return true;
}
function removeLegacyDuplicate(){document.getElementById('encyclopediaNavBtn')?.remove();document.getElementById('encyclopedia')?.remove();document.getElementById('sharedKnowledgeBlock')?.remove();}
function table(el,data,columns){if(!el)return;const head=columns.map(c=>`<th>${esc(c.label)}</th>`).join('');const body=data.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');el.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="10">目前沒有資料</td></tr>'}</tbody>`;}
function berryRows(){if(isRescueReadonly())return PUBLIC_BERRY_TYPES;try{const data=rows('SELECT type_name,berry_name,source_name,verified_at,data_version FROM berry_master ORDER BY type_name');return data.length?data:PUBLIC_BERRY_TYPES;}catch{return PUBLIC_BERRY_TYPES;}}
function natureRows(){if(isRescueReadonly())return PUBLIC_NATURE_MASTER;try{const data=rows('SELECT * FROM nature_master ORDER BY nature_name');return data.length?data:PUBLIC_NATURE_MASTER;}catch{return PUBLIC_NATURE_MASTER;}}
function mainSkillRows(){if(isRescueReadonly())return PUBLIC_MAIN_SKILL_MASTER;try{const data=rows('SELECT * FROM main_skill_master ORDER BY main_skill_name');return data.length?data:PUBLIC_MAIN_SKILL_MASTER;}catch{return PUBLIC_MAIN_SKILL_MASTER;}}
function evolutionRows(){if(isRescueReadonly())return PUBLIC_EVOLUTION_MASTER;try{const data=rows('SELECT * FROM pokemon_evolution_master ORDER BY from_species,to_species');return data.length?data:PUBLIC_EVOLUTION_MASTER;}catch{return PUBLIC_EVOLUTION_MASTER;}}
function renderPublicPokemonKnowledge(){
  if(!ensureKnowledgeUi())return;
  table(document.getElementById('berryMasterTable'),berryRows(),[{label:'屬性',key:'type_name'},{label:'樹果種類',key:'berry_name'},{label:'資料來源',key:'source_name'},{label:'核對日期',key:'verified_at'}]);
  table(document.getElementById('natureMasterTable'),natureRows(),[{label:'性格',key:'nature_name'},{label:'提升',render:r=>r.positive_effect==='無'?'—':`↑ ${esc(r.positive_effect)}`},{label:'降低',render:r=>r.negative_effect==='無'?'—':`↓ ${esc(r.negative_effect)}`},{label:'說明',key:'description_zh_tw'},{label:'版本',key:'data_version'}]);
  table(document.getElementById('mainSkillMasterTable'),mainSkillRows(),[{label:'主技能',key:'main_skill_name'},{label:'公版說明',key:'description_zh_tw'},{label:'核對狀態',key:'verification_status'},{label:'版本',key:'data_version'}]);
  table(document.getElementById('evolutionMasterTable'),evolutionRows(),[{label:'進化前',key:'from_species'},{label:'進化後',key:'to_species'},{label:'等級',render:r=>r.required_level==null?'—':`Lv${r.required_level}`},{label:'一起睡覺的時間',render:r=>r.required_sleep_hours==null?'—':`${r.required_sleep_hours} 小時`},{label:'糖果',render:r=>r.required_candy==null?'—':r.required_candy},{label:'道具',render:r=>esc(r.required_item||'—')},{label:'其他條件',render:r=>esc(r.other_requirement||'—')},{label:'版本',key:'data_version'}]);
  const slot=knowledgeSlot();if(slot){slot.dataset.hydrationState='ready';slot.classList.remove('loading-placeholder');}
  globalThis.DebugTrace?.record?.('knowledge','knowledge_page_slot_hydrated',{status:'completed',details:{slot:'knowledgePokemonSlot',single_owner:true,parent_preserved:true}});
}
function renderBerryMaster(){renderPublicPokemonKnowledge();}

function recipeAuthorityCompatibilitySnapshot(){const week=currentWeeklyContext();return {target_id:'recipeWeeklyAuthoritySummary',week_start:week?.week_start||null,dish_category:normalizeDishCategory(week?.dish_category),authority:week?.authority_source||'MISSING'};}

export async function renderSharedKnowledge(){if(rendering)return;removeLegacyDuplicate();if(activeView()!=='knowledge')return;rendering=true;try{await yieldToUi();renderPublicPokemonKnowledge();}catch(error){console.warn('Shared knowledge render deferred',error);}finally{rendering=false;}}
function schedule(){if(scheduled||activeView()!=='knowledge')return;scheduled=true;setTimeout(()=>{scheduled=false;void renderSharedKnowledge();},0);}
function boot(){
  removeLegacyDuplicate();
  globalThis.addEventListener('pokemon-sleep:view-activated',event=>{if(event?.detail?.view==='knowledge')schedule();});
  document.addEventListener('pokemon-sleep-data-refreshed',()=>schedule());
  window.addEventListener('pokemon-sleep:database-ready',()=>schedule());
  if(activeView()==='knowledge')schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

export {renderBerryMaster,recipeAuthorityCompatibilitySnapshot};
