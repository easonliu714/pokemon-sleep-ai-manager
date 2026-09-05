import './v0395-dom-render-scheduler.js';
import './v03992-update-center-guided-ux.js';
import {rows,isRescueReadonly} from './database.js';
import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_NATURE_MASTER,PUBLIC_MAIN_SKILL_MASTER,PUBLIC_EVOLUTION_MASTER,PUBLIC_POKEMON_KNOWLEDGE_VERSION} from './public-pokemon-knowledge-master.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false,scheduled=false;
const activeView=()=>document.querySelector('.view.active')?.id||'dashboard';
const yieldToUi=()=>new Promise(resolve=>setTimeout(resolve,0));
const knowledgeCache={ready:false,berry:null,nature:null,skills:null,evolution:null,revision:0};
const pageProgress=(state,message,details={})=>globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:page-hydration-progress',{detail:{page:'knowledge',state,message,...details}}));

function ensureKnowledgeUi(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return null;
  let pokemonSlot=document.getElementById('knowledgePokemonSlot');
  let candySlot=document.getElementById('knowledgeCandySlot');
  if(!pokemonSlot){pokemonSlot=document.createElement('section');pokemonSlot.id='knowledgePokemonSlot';pokemonSlot.dataset.renderOwner='shared-knowledge-ui';panel.prepend(pokemonSlot);}
  if(!candySlot){candySlot=document.createElement('section');candySlot.id='knowledgeCandySlot';candySlot.dataset.renderOwner='candy-inventory-ui';panel.appendChild(candySlot);}
  if(!document.getElementById('berryMasterTable')){
    pokemonSlot.innerHTML=`
      <h3>樹果與屬性對照</h3><p class="notice">樹果／屬性為公版資料；救援模式亦可完整瀏覽，不依賴玩家 SQLite。</p><div class="table-wrap"><table id="berryMasterTable"></table></div>
      <h3>性格影響表</h3><p class="notice">依遊戲性格名稱呈現提升／降低項目；只投影公版效果，不寫入玩家個體欄位。</p><div class="table-wrap"><table id="natureMasterTable"></table></div>
      <h3>主技能說明表</h3><p class="notice">公版說明由版本化 Master 提供；個體只需要保存主技能名稱與等級。</p><div class="table-wrap"><table id="mainSkillMasterTable"></table></div>
      <h3>進化條件表</h3><p class="notice">目前只列入已核對的公版進化 route；未列出代表「尚未收錄／核對」，不代表該寶可夢不能進化。</p><div class="table-wrap"><table id="evolutionMasterTable"></table></div>
      <p class="notice">Pokémon Knowledge Master：<b>${esc(PUBLIC_POKEMON_KNOWLEDGE_VERSION)}</b></p>`;
  }
  panel.classList.remove('loading-placeholder');panel.dataset.pageLayout='fixed';
  return {panel,pokemonSlot,candySlot};
}
function removeLegacyDuplicate(){document.getElementById('encyclopediaNavBtn')?.remove();document.getElementById('encyclopedia')?.remove();document.getElementById('sharedKnowledgeBlock')?.remove();}
function table(el,data,columns){if(!el)return;const head=columns.map(c=>`<th>${esc(c.label)}</th>`).join('');const body=data.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');el.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="10">目前沒有資料</td></tr>'}</tbody>`;}
function berryRows(){if(isRescueReadonly())return PUBLIC_BERRY_TYPES;try{const data=rows('SELECT type_name,berry_name,source_name,verified_at,data_version FROM berry_master ORDER BY type_name');return data.length?data:PUBLIC_BERRY_TYPES;}catch{return PUBLIC_BERRY_TYPES;}}
function natureRows(){if(isRescueReadonly())return PUBLIC_NATURE_MASTER;try{const data=rows('SELECT * FROM nature_master ORDER BY nature_name');return data.length?data:PUBLIC_NATURE_MASTER;}catch{return PUBLIC_NATURE_MASTER;}}
function mainSkillRows(){if(isRescueReadonly())return PUBLIC_MAIN_SKILL_MASTER;try{const data=rows('SELECT * FROM main_skill_master ORDER BY main_skill_name');return data.length?data:PUBLIC_MAIN_SKILL_MASTER;}catch{return PUBLIC_MAIN_SKILL_MASTER;}}
function evolutionRows(){if(isRescueReadonly())return PUBLIC_EVOLUTION_MASTER;try{const data=rows('SELECT * FROM pokemon_evolution_master ORDER BY from_species,to_species');return data.length?data:PUBLIC_EVOLUTION_MASTER;}catch{return PUBLIC_EVOLUTION_MASTER;}}
export function prewarmSharedKnowledge({force=false}={}){
  if(knowledgeCache.ready&&!force)return {...knowledgeCache};
  const started=performance.now();
  knowledgeCache.berry=berryRows();
  knowledgeCache.nature=natureRows();
  knowledgeCache.skills=mainSkillRows();
  knowledgeCache.evolution=evolutionRows();
  knowledgeCache.ready=true;knowledgeCache.revision+=1;
  globalThis.DebugTrace?.record?.('page_hydration','shared_knowledge_data_prewarmed',{status:'completed',details:{berry_count:knowledgeCache.berry.length,nature_count:knowledgeCache.nature.length,skill_count:knowledgeCache.skills.length,evolution_count:knowledgeCache.evolution.length,elapsed_ms:Math.round(performance.now()-started),dom_materialized:false,revision:knowledgeCache.revision}});
  return {...knowledgeCache};
}
function renderPublicPokemonKnowledge(){
  const slots=ensureKnowledgeUi();if(!slots)return false;
  const cache=prewarmSharedKnowledge();
  table(document.getElementById('berryMasterTable'),cache.berry,[{label:'屬性',key:'type_name'},{label:'樹果種類',key:'berry_name'},{label:'資料來源',key:'source_name'},{label:'核對日期',key:'verified_at'}]);
  table(document.getElementById('natureMasterTable'),cache.nature,[{label:'性格',key:'nature_name'},{label:'提升',render:r=>r.positive_effect==='無'?'—':`↑ ${esc(r.positive_effect)}`},{label:'降低',render:r=>r.negative_effect==='無'?'—':`↓ ${esc(r.negative_effect)}`},{label:'說明',key:'description_zh_tw'},{label:'版本',key:'data_version'}]);
  table(document.getElementById('mainSkillMasterTable'),cache.skills,[{label:'主技能',key:'main_skill_name'},{label:'公版說明',key:'description_zh_tw'},{label:'核對狀態',key:'verification_status'},{label:'版本',key:'data_version'}]);
  table(document.getElementById('evolutionMasterTable'),cache.evolution,[{label:'進化前',key:'from_species'},{label:'進化後',key:'to_species'},{label:'等級',render:r=>r.required_level==null?'—':`Lv${r.required_level}`},{label:'一起睡覺的時間',render:r=>r.required_sleep_hours==null?'—':`${r.required_sleep_hours} 小時`},{label:'糖果',render:r=>r.required_candy==null?'—':r.required_candy},{label:'道具',render:r=>esc(r.required_item||'—')},{label:'其他條件',render:r=>esc(r.other_requirement||'—')},{label:'版本',key:'data_version'}]);
  slots.pokemonSlot.dataset.materialized='true';
  return true;
}
function renderBerryMaster(){renderPublicPokemonKnowledge();}

// Historical v0.4.6.2 contract probe only. Recipe rendering moved to recipe-unified-player-workbench.js.
function recipeAuthorityCompatibilitySnapshot(){const week=currentWeeklyContext();return {target_id:'recipeWeeklyAuthoritySummary',week_start:week?.week_start||null,dish_category:normalizeDishCategory(week?.dish_category),authority:week?.authority_source||'MISSING'};}

export async function renderSharedKnowledge(){
  if(rendering)return false;removeLegacyDuplicate();if(activeView()!=='knowledge')return false;
  rendering=true;pageProgress('loading','資料百科：建立本機已預熱表格…',{surface:'pokemon-knowledge'});
  try{await yieldToUi();const ok=renderPublicPokemonKnowledge();pageProgress('ready','資料百科：公版表格已載入',{surface:'pokemon-knowledge'});return ok;}
  catch(error){pageProgress('failed','資料百科：公版表格載入失敗',{surface:'pokemon-knowledge'});console.warn('Shared knowledge render deferred',error);return false;}
  finally{rendering=false;}
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;renderSharedKnowledge();},0);}
function boot(){
  removeLegacyDuplicate();ensureKnowledgeUi();
  document.querySelector('nav')?.addEventListener('click',event=>{if(event.target?.closest?.('button[data-view]')?.dataset?.view==='knowledge')schedule();});
  document.addEventListener('pokemon-sleep-data-refreshed',()=>{knowledgeCache.ready=false;if(activeView()==='knowledge')schedule();});
  window.addEventListener('pokemon-sleep:database-ready',()=>{knowledgeCache.ready=false;setTimeout(()=>{try{prewarmSharedKnowledge();}catch{}},0);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

export {renderBerryMaster,recipeAuthorityCompatibilitySnapshot};
