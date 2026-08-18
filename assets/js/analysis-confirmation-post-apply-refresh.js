import {rows,scalar} from './database.js';
import {openPokemonDetail} from './pokemon-detail.js';

export const ANALYSIS_POST_APPLY_REFRESH_VERSION='pokemon-sleep-analysis-post-apply-refresh/1.0-v042712';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const byId=id=>document.getElementById(id);

function currentPokemon(){
  return rows("SELECT * FROM pokemon WHERE status='active' ORDER BY CASE rating WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 WHEN 'B' THEN 4 ELSE 9 END, level DESC, species");
}
function filteredPokemon(data){
  const query=byId('pokemonSearch')?.value.trim().toLowerCase()??'';
  const rating=byId('ratingFilter')?.value??'';
  const specialty=byId('specialtyFilter')?.value??'';
  return data.filter(pokemon=>(!query||JSON.stringify(pokemon).toLowerCase().includes(query))&&(!rating||pokemon.rating===rating)&&(!specialty||pokemon.specialty===specialty));
}
function renderRoster(){
  const table=byId('pokemonTable');if(!table)return false;
  const all=currentPokemon(),data=filteredPokemon(all),summary=byId('pokemonResultSummary'),count=byId('pokemonCount');
  if(summary)summary.textContent=`顯示 ${data.length}／${all.length} 隻；點選任一列查看或編輯完整個體資料`;
  if(count)count.textContent=scalar("SELECT COUNT(*) FROM pokemon WHERE status='active'")||0;
  if(!data.length){table.innerHTML='<tbody><tr><td>目前沒有資料</td></tr></tbody>';return true;}
  const columns=[['名稱',row=>row.original_label||row.species||''],['Lv',row=>row.level],['評級',row=>row.rating],['專長',row=>row.specialty],['屬性',row=>row.type],['暱稱',row=>row.nickname],['等效字數',row=>row.nickname_halfwidth_units],['定位',row=>row.core_role]];
  const header=columns.map(([label])=>`<th>${esc(label)}</th>`).join('');
  const body=data.map(row=>`<tr class="pokemon-row" data-pokemon-id="${esc(row.pokemon_id)}">${columns.map(([,get])=>`<td>${esc(get(row))}</td>`).join('')}</tr>`).join('');
  table.innerHTML=`<thead><tr>${header}</tr></thead><tbody>${body}</tbody>`;
  table.querySelectorAll('.pokemon-row').forEach(row=>{row.onclick=()=>openPokemonDetail(row.dataset.pokemonId);});
  return true;
}
function safeRender(reason){
  try{const rendered=renderRoster();globalThis.UpdateCenterLiveDebug?.record?.('analysis_post_apply_roster_refresh',{reason,rendered,version:ANALYSIS_POST_APPLY_REFRESH_VERSION});}
  catch(error){globalThis.UpdateCenterLiveDebug?.record?.('analysis_post_apply_roster_refresh_failed',{reason,message:error?.message||String(error)});}
}

if(typeof globalThis.addEventListener==='function'){
  globalThis.addEventListener('pokemon-sleep:analysis-confirmed-applied',()=>queueMicrotask(()=>safeRender('analysis_confirmed_applied')));
}
if(typeof document!=='undefined'){
  for(const id of ['pokemonSearch','ratingFilter','specialtyFilter'])document.getElementById(id)?.addEventListener('input',()=>safeRender('filter_input'));
}

export {renderRoster};
