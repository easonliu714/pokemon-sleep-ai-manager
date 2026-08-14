import {rows} from './database.js';
import {resolvePublicMainSkillName} from './public-pokemon-knowledge-coverage.js';
import {
  buildPokemonRosterFilterProfiles,
  buildPokemonRosterFacetOptions,
  profileMatchesRosterFilters,
  rankRosterFilterMatches,
  rosterFilterHasRecommendationContext,
} from './pokemon-roster-filter-contract.js';

export const POKEMON_ROSTER_FILTER_UI_VERSION='pokemon-roster-unlocked-filters-ui-2026-08-14-a';

const IDS=Object.freeze({berry:'berryFilter',ingredient:'ingredientFilter',main_skill:'mainSkillFilter',subskill:'subskillFilter'});
const LABELS=Object.freeze({berry:'全部樹果',ingredient:'全部食材',main_skill:'全部主技能',subskill:'全部副技能'});
let profiles=[];
let observer=null;
let scheduled=false;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const getFilters=()=>({
  berry:document.getElementById(IDS.berry)?.value||'',
  ingredient:document.getElementById(IDS.ingredient)?.value||'',
  main_skill:document.getElementById(IDS.main_skill)?.value||'',
  subskill:document.getElementById(IDS.subskill)?.value||'',
});

function installStyle(){
  if(document.getElementById('pokemonRosterFilterStyle'))return;
  const style=document.createElement('style');
  style.id='pokemonRosterFilterStyle';
  style.textContent=`
    #pokemon .filter-bar .pokemon-facet-filter{min-width:150px}
    .pokemon-filter-recommended td{background:#fff4c9!important}
    .pokemon-filter-recommended:hover td{background:#ffedab!important}
    .pokemon-filter-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;white-space:normal}
    .pokemon-filter-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;font-size:.72rem;font-weight:750;background:#e8f4ee;color:#245d49;line-height:1.45}
    .pokemon-filter-badge.top{background:#ffe29a;color:#6d4b00}
    .pokemon-filter-badge.penalty{background:#ffe7e5;color:#8b2822}
    .pokemon-filter-badge.review{background:#fff1c7;color:#725800}
    #pokemonFacetRecommendationSummary{margin-top:7px}
    @media(max-width:700px){#pokemon .filter-bar>*{flex:1 1 calc(50% - 9px);min-width:0}#pokemon .filter-bar #pokemonSearch{flex-basis:100%}.pokemon-filter-badges{max-width:230px}}
  `;
  document.head.appendChild(style);
}

function ensureControls(){
  const bar=document.querySelector('#pokemon .filter-bar');
  if(!bar)return false;
  for(const [key,id] of Object.entries(IDS)){
    if(document.getElementById(id))continue;
    const select=document.createElement('select');
    select.id=id;
    select.className='pokemon-facet-filter';
    select.setAttribute('aria-label',LABELS[key]);
    select.innerHTML=`<option value="">${LABELS[key]}</option>`;
    select.addEventListener('change',applyFilters);
    bar.appendChild(select);
  }
  let summary=document.getElementById('pokemonFacetRecommendationSummary');
  if(!summary){
    summary=document.createElement('p');
    summary.id='pokemonFacetRecommendationSummary';
    summary.className='notice';
    const base=document.getElementById('pokemonResultSummary');
    base?.insertAdjacentElement('afterend',summary);
  }
  return true;
}

function queryRosterData(){
  try{
    return {
      pokemonRows:rows("SELECT * FROM pokemon WHERE status='active'"),
      ingredientRows:rows('SELECT * FROM pokemon_ingredients ORDER BY pokemon_id, unlock_level'),
      subskillRows:rows('SELECT * FROM pokemon_subskills ORDER BY pokemon_id, unlock_level'),
    };
  }catch{return null;}
}

function loadProfiles(){
  const data=queryRosterData();
  if(!data)return false;
  profiles=buildPokemonRosterFilterProfiles({...data,resolveMainSkillName:resolvePublicMainSkillName});
  return true;
}

function setOptions(select,values,placeholder){
  if(!select)return;
  const current=select.value;
  const nextValues=[...values];
  select.innerHTML=`<option value="">${esc(placeholder)}</option>${nextValues.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
  select.value=nextValues.includes(current)?current:'';
}

function refreshFacetOptions(){
  const facets=buildPokemonRosterFacetOptions(profiles);
  setOptions(document.getElementById(IDS.berry),facets.berries,LABELS.berry);
  setOptions(document.getElementById(IDS.ingredient),facets.ingredients,LABELS.ingredient);
  setOptions(document.getElementById(IDS.main_skill),facets.main_skills,LABELS.main_skill);
  setOptions(document.getElementById(IDS.subskill),facets.subskills,LABELS.subskill);
}

function clearRowDecorations(row){
  row.classList.remove('pokemon-filter-recommended');
  row.querySelectorAll('.pokemon-filter-badges').forEach(node=>node.remove());
}

function appendBadges(row,badges,{top=false}={}){
  if(!row?.cells?.length)return;
  const values=[];
  if(top)values.push({kind:'top',label:'★ 第一推薦'});
  values.push(...badges);
  if(!values.length)return;
  const wrap=document.createElement('div');
  wrap.className='pokemon-filter-badges';
  for(const item of values){
    const badge=document.createElement('span');
    badge.className=`pokemon-filter-badge ${item.kind||''}`.trim();
    badge.textContent=item.label;
    wrap.appendChild(badge);
  }
  row.cells[0].appendChild(wrap);
}

function applyFilters(){
  if(!profiles.length&&!loadProfiles())return;
  const filters=getFilters();
  const rowElements=[...document.querySelectorAll('#pokemonTable tr.pokemon-row')];
  const rowById=new Map(rowElements.map(row=>[String(row.dataset.pokemonId||''),row]));
  const baseVisibleProfiles=profiles.filter(profile=>rowById.has(profile.pokemon_id));
  const matching=baseVisibleProfiles.filter(profile=>profileMatchesRosterFilters(profile,filters));
  const matchingIds=new Set(matching.map(profile=>profile.pokemon_id));
  for(const row of rowElements){
    clearRowDecorations(row);
    row.hidden=!matchingIds.has(String(row.dataset.pokemonId||''));
  }

  const recommendationContext=rosterFilterHasRecommendationContext(filters);
  const ranked=recommendationContext?rankRosterFilterMatches(matching,filters):[];
  const rankedById=new Map(ranked.map(item=>[item.profile.pokemon_id,item]));
  const topId=ranked[0]?.profile?.pokemon_id||null;
  for(const id of matchingIds){
    const row=rowById.get(id),rankedItem=rankedById.get(id);
    if(!row||!rankedItem)continue;
    const top=id===topId;
    if(top)row.classList.add('pokemon-filter-recommended');
    appendBadges(row,rankedItem.evidence.badges,{top});
  }

  const baseSummary=document.getElementById('pokemonResultSummary');
  if(baseSummary)baseSummary.textContent=`顯示 ${matching.length}／${profiles.length} 隻；篩選器只使用目前已解鎖資料，點選任一列查看或編輯完整個體資料`;
  const recommendationSummary=document.getElementById('pokemonFacetRecommendationSummary');
  if(recommendationSummary){
    if(!recommendationContext)recommendationSummary.textContent='選擇樹果、食材、主技能或副技能後，會以已驗證的正向加成 Evidence 優先標示第一推薦；不推算未驗證的實際產量。';
    else if(!ranked.length)recommendationSummary.textContent='目前條件沒有符合的已解鎖寶可夢。';
    else {
      const top=ranked[0],name=top.profile.pokemon.original_label||top.profile.pokemon.nickname||top.profile.pokemon.species||top.profile.pokemon_id;
      const reasons=top.evidence.badges.filter(item=>item.kind!=='penalty'&&item.kind!=='review').map(item=>item.label);
      recommendationSummary.textContent=`第一推薦：${name}${reasons.length?`；依據：${reasons.join('、')}`:'；目前沒有額外正向加成，依既有評級與 Lv 作穩定排序。'}`;
    }
  }
}

function refreshFromDatabase(){
  if(!ensureControls())return;
  if(!loadProfiles())return;
  refreshFacetOptions();
  applyFilters();
}

function scheduleRefresh(){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(()=>{scheduled=false;refreshFromDatabase();});
}

function observePokemonTable(){
  const table=document.getElementById('pokemonTable');
  if(!table||observer)return;
  observer=new MutationObserver(mutations=>{
    const structural=mutations.some(mutation=>[...mutation.addedNodes,...mutation.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('tr')||node.querySelector?.('tr'))));
    if(structural)scheduleRefresh();
  });
  observer.observe(table,{childList:true,subtree:true});
}

function install(){
  installStyle();
  if(!ensureControls())return;
  observePokemonTable();
  scheduleRefresh();
  window.addEventListener('pokemon-sleep:database-ready',scheduleRefresh);
  document.addEventListener('pokemon-sleep-data-refreshed',scheduleRefresh);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.PokemonSleepRosterFilterUI=Object.freeze({version:POKEMON_ROSTER_FILTER_UI_VERSION,refresh:scheduleRefresh});
