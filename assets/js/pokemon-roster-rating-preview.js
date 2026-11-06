// RATE.3: existing Pokémon box comparison only. Never apply, persist or mutate a rating.
// This projection is not a durable snapshot or an admitted multi-tab Writer.
import {planPokemonRosterProvisionalRegrade} from './pokemon-provisional-rating.js';

const clean=value=>String(value??'').normalize('NFKC').trim();
const esc=value=>clean(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]));
const label=value=>value===null||value===undefined||value===''?'—':clean(value);
const groupById=rows=>{
  const result=new Map();
  for(const row of rows){
    const id=clean(row?.pokemon_id);
    if(!result.has(id))result.set(id,[]);
    result.get(id).push({...row});
  }
  return result;
};

/** Pure, read-only whole-box plan. Never substitute absent SQL results with zero rows. */
export function buildPokemonRosterRatingView({pokemon,ingredients,subskills}={}){
  if(!Array.isArray(pokemon)||!Array.isArray(ingredients)||!Array.isArray(subskills))
    return {status:'HOLD_SOURCE_UNAVAILABLE',plan:null,rows:[],player_data_write:false,overwrite_allowed:false};
  const ingredientMap=groupById(ingredients),subskillMap=groupById(subskills);
  const details=pokemon.map(row=>({
    pokemon_id:row?.pokemon_id,
    ingredients:ingredientMap.get(clean(row?.pokemon_id))||[],
    subskills:subskillMap.get(clean(row?.pokemon_id))||[],
  }));
  const plan=planPokemonRosterProvisionalRegrade({pokemon,details});
  const byId=new Map(pokemon.map(row=>[clean(row?.pokemon_id),row]));
  const items=[...plan.proposals,...plan.held].map(row=>{
    const original=byId.get(clean(row.pokemon_id))||{};
    const breakdown=Array.isArray(row.score_breakdown)?row.score_breakdown:[];
    return {...row,
      species:original.current_species||original.species||original.original_label||'',
      nickname:original.nickname||'',
      level:original.level??null,
      current_evidence:breakdown.filter(x=>x.scope==='CURRENT'),
      future_evidence:breakdown.filter(x=>x.scope==='FUTURE'),
    };
  });
  return {status:'PREVIEW_ONLY',plan,rows:items,player_data_write:false,overwrite_allowed:false};
}

export function renderPokemonRosterRatingViewHtml(view){
  if(view?.status!=='PREVIEW_ONLY'||!view.plan)
    return '<div class="notice" data-rate3-hold="true">HOLD：無法取得完整唯讀資料，未產生任何新評級。</div>';
  const {summary,rule_version}=view.plan;
  const body=view.rows.map(item=>{
    const held=item.status!=='PROVISIONAL_HEURISTIC';
    const evidence=part=>part.map(x=>`${label(x.name)} (Lv${label(x.unlock_level)})`).join('、')||'—';
    const reasons=[...(item.missing_inputs||[]),...(item.reason_codes||[])].join('、');
    return `<tr data-rate3-state="${held?'HOLD':'PROVISIONAL'}"><td>${esc(item.species)}<small>${esc(item.nickname)}</small></td><td>${esc(label(item.pokemon_id))}<small>${esc(label(item.pokemon_instance_id))}</small></td><td>${esc(label(item.previous_rating))}</td><td>${held?'HOLD':esc(label(item.proposed_rating))}</td><td>${held?'不得覆蓋':item.changed?'建議不同':'相同'}</td><td>${esc(evidence(item.current_evidence))}</td><td>${esc(evidence(item.future_evidence))}</td><td>${esc(reasons)}</td></tr>`;
  }).join('');
  return `<div class="notice" data-rate3-readonly="true"><strong>全盒評等差異預覽（唯讀，未覆寫）</strong> · 規則 ${esc(rule_version)} · 共 ${summary.total} 隻／可初評 ${summary.eligible}／建議不同 ${summary.changed}／HOLD ${summary.held}。本平台啟發式非官方戰力；不是 durable snapshot，資料變更後必須重新產生。舊評級保留，尚無批次套用權限。</div><div class="table-wrap"><table><thead><tr><th>寶可夢</th><th>個體識別</th><th>舊評</th><th>建議新評</th><th>差異</th><th>CURRENT 證據</th><th>FUTURE 證據</th><th>缺值／理由</th></tr></thead><tbody>${body||'<tr><td colspan="8">目前沒有可比對個體</td></tr>'}</tbody></table></div>`;
}

let panel=null;
export function invalidatePokemonRosterRatingPreview(){
  if(!panel||panel.hidden)return;
  panel.innerHTML='<div class="notice" data-rate3-stale="true">資料畫面已重新整理，先前比較已失效；請重新產生唯讀預覽。</div>';
}

/** Existing Pokémon view, explicit click only; readers are SELECT-only callbacks. */
export function setupPokemonRosterRatingPreview({readRoster,readIngredients,readSubskills}={}){
  const section=document.getElementById('pokemon');
  const heading=section?.querySelector('.section-head');
  if(!heading||section.querySelector('[data-rate3-preview-button]'))return;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.rate3PreviewButton='true';
  button.textContent='預覽全盒新舊評級（唯讀）';
  panel=document.createElement('div');
  panel.className='panel';
  panel.id='pokemonRosterRatingPreview';
  panel.hidden=true;
  heading.append(button);
  (section.querySelector('.filter-bar')||heading).insertAdjacentElement('afterend',panel);
  button.addEventListener('click',()=>{
    panel.hidden=false;
    panel.innerHTML='<div class="notice">正在讀取本機個體資料（不修改 SQLite）…</div>';
    try{
      if(typeof readRoster!=='function'||typeof readIngredients!=='function'||typeof readSubskills!=='function')
        throw new Error('READ_ONLY_READER_UNAVAILABLE');
      const view=buildPokemonRosterRatingView({
        pokemon:readRoster(),ingredients:readIngredients(),subskills:readSubskills(),
      });
      panel.innerHTML=renderPokemonRosterRatingViewHtml(view);
    }catch{
      panel.innerHTML='<div class="notice" data-rate3-hold="true">HOLD：資料讀取或持久化狀態不明，已停止本次比較；沒有修改任何評級。</div>';
    }
  });
}
