// RATE.3 + Owner #796 read-only choice UX. No rating UPDATE, SQLite/IDB or Apply.
// All choices default to preserving existing ratings; a review is nonpersistent.
import {planPokemonRosterProvisionalRegrade,POKEMON_PROVISIONAL_RATING_LABELS as GRADES} from './pokemon-provisional-rating.js';
import {eligiblePokemonRosterRatingChoiceIds,selectPokemonRosterRatingRows,
  reviewPokemonRosterRatingChoiceIntent} from './pokemon-roster-rating-choice.js';

const clean=value=>String(value??'').normalize('NFKC').trim();
const esc=value=>clean(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
  // Entire source facts, not just the letter grade, are re-read at explicit review.
  // This in-memory comparison token is NOT a durable generation/SHA or Apply proof.
  const source_token=JSON.stringify({pokemon,ingredients,subskills});
  return {status:'PREVIEW_ONLY',plan,rows:items,source_token,
    player_data_write:false,overwrite_allowed:false};
}

export function renderPokemonRosterRatingViewHtml(view,{
  selectedPokemonIds=[],gradeFilter='',gradeTarget='new',sortBy='pokemon',descending=false
}={}){
  if(view?.status!=='PREVIEW_ONLY'||!view.plan)
    return '<div class="notice" data-rate3-hold="true">HOLD：無法取得完整唯讀資料，未產生任何新評級。</div>';
  const {summary,rule_version}=view.plan;
  const eligibleIds=new Set(eligiblePokemonRosterRatingChoiceIds(view));
  const selected=new Set(selectedPokemonIds.filter(id=>eligibleIds.has(id)));
  const choices=GRADES.map(grade=>`<option value="${esc(grade)}"${gradeFilter===grade?' selected':''}>${esc(grade)}</option>`).join('');
  const option=(value,name,current)=>`<option value="${value}"${current===value?' selected':''}>${name}</option>`;
  const controls=`<div class="filter-bar" data-rate-choice-controls="true">
    <label>評級查詢 <select data-rate-choice-filter><option value="">全部15級</option>${choices}</select></label>
    <label>查詢欄位 <select data-rate-choice-target>${option('new','建議新評',gradeTarget)}${option('old','既有舊評',gradeTarget)}</select></label>
    <label>排序 <select data-rate-choice-sort>${option('pokemon','個體名稱',sortBy)}${option('old','舊評級',sortBy)}${option('new','新評級',sortBy)}${option('status','可選／HOLD',sortBy)}</select></label>
    <label><input type="checkbox" data-rate-choice-desc${descending?' checked':''}>反向</label>
    <button type="button" data-rate-choice-action="all">全選可採用</button>
    <button type="button" data-rate-choice-action="none">全不選／保留原評</button>
    <button type="button" data-rate-choice-action="review">確認審閱選擇（不儲存）</button>
  </div><p class="notice" data-rate-choice-count>擬採用 ${selected.size}／${eligibleIds.size} 隻；未選擇均保留原評。此為非持久意向，並未更新任何資料。</p>
  <div class="notice" data-rate-choice-review-result aria-live="polite"></div>`;
  const rows=selectPokemonRosterRatingRows(view,{gradeFilter,gradeTarget,sortBy,descending});
  const body=rows.map(item=>{
    const held=item.status!=='PROVISIONAL_HEURISTIC';
    const canChoose=eligibleIds.has(item.pokemon_id);
    const checked=selected.has(item.pokemon_id);
    const evidence=part=>part.map(x=>`${label(x.name)} (Lv${label(x.unlock_level)})`).join('、')||'—';
    const reasons=[...(item.missing_inputs||[]),...(item.reason_codes||[])].join('、');
    const action=canChoose
      ?`<label><input type="checkbox" data-rate-choice-row="${esc(item.pokemon_id)}"${checked?' checked':''}> ${checked?'擬採用新評':'保留原評'}</label>`
      :'<label><input type="checkbox" disabled> HOLD／維持原評</label>';
    return `<tr data-rate3-state="${held?'HOLD':'PROVISIONAL'}"><td>${action}</td><td>${esc(item.species)}<small>${esc(item.nickname)}</small></td><td>${esc(label(item.pokemon_id))}<small>${esc(label(item.pokemon_instance_id))}</small></td><td>${esc(label(item.previous_rating))}</td><td>${held?'HOLD':esc(label(item.proposed_rating))}</td><td>${held?'不得覆蓋':item.changed?'建議不同':'相同'}</td><td>${esc(evidence(item.current_evidence))}</td><td>${esc(evidence(item.future_evidence))}</td><td>${esc(reasons)}</td></tr>`;
  }).join('');
  return `<div class="notice" data-rate3-readonly="true"><strong>全盒評等差異預覽（唯讀，未覆寫）</strong> · 規則 ${esc(rule_version)} · 共 ${summary.total} 隻／可初評 ${summary.eligible}／建議不同 ${summary.changed}／HOLD ${summary.held}。本平台啟發式非官方戰力；不是 durable snapshot，資料變更後必須重新產生。舊評級預設保留，尚無正式持久套用權限。</div>${controls}<div class="table-wrap"><table><thead><tr><th>保留／擬採用</th><th>寶可夢</th><th>個體識別</th><th>舊評</th><th>建議新評</th><th>差異</th><th>CURRENT 證據</th><th>FUTURE 證據</th><th>缺值／理由</th></tr></thead><tbody>${body||'<tr><td colspan="9">目前沒有可比對個體</td></tr>'}</tbody></table></div>`;
}

let panel=null,activeView=null,selectedIds=new Set(),filterGrade='',filterTarget='new',sortChoice='pokemon',reverseSort=false;
export function invalidatePokemonRosterRatingPreview(){
  activeView=null;selectedIds.clear();filterGrade='';filterTarget='new';sortChoice='pokemon';reverseSort=false;
  if(!panel||panel.hidden)return;
  panel.innerHTML='<div class="notice" data-rate3-stale="true">資料畫面已重新整理，先前比較與所有擬採用選擇已失效；請重新產生唯讀預覽。</div>';
}

/** Existing Pokémon view, explicit click only; readers are SELECT-only callbacks. */
export function setupPokemonRosterRatingPreview({readRoster,readIngredients,readSubskills}={}){
  const section=document.getElementById('pokemon');
  const heading=section?.querySelector('.section-head');
  if(!heading||section.querySelector('[data-rate3-preview-button]'))return;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.rate3PreviewButton='true';
  button.textContent='預覽全盒新舊評級（唯讀）／重新計算';
  panel=document.createElement('div');
  panel.className='panel';
  panel.id='pokemonRosterRatingPreview';
  panel.hidden=true;
  heading.append(button);
  (section.querySelector('.filter-bar')||heading).insertAdjacentElement('afterend',panel);
  const readView=()=>{
    if(typeof readRoster!=='function'||typeof readIngredients!=='function'||typeof readSubskills!=='function')
      throw new Error('READ_ONLY_READER_UNAVAILABLE');
    return buildPokemonRosterRatingView({
      pokemon:readRoster(),ingredients:readIngredients(),subskills:readSubskills(),
    });
  };
  const show=()=>{
    panel.innerHTML=renderPokemonRosterRatingViewHtml(activeView,{
      selectedPokemonIds:[...selectedIds],gradeFilter:filterGrade,
      gradeTarget:filterTarget,sortBy:sortChoice,descending:reverseSort,
    });
  };
  button.addEventListener('click',()=>{
    panel.hidden=false;
    invalidatePokemonRosterRatingPreview();
    panel.innerHTML='<div class="notice">正在讀取本機個體資料（不修改 SQLite）…</div>';
    try{activeView=readView();show();}
    catch{activeView=null;panel.innerHTML='<div class="notice" data-rate3-hold="true">HOLD：資料讀取或持久化狀態不明，已停止本次比較；沒有修改任何評級。</div>';}
  });
  panel.addEventListener('change',event=>{
    if(!activeView)return;
    const element=event.target;
    if(element.matches('[data-rate-choice-row]')){
      const id=element.dataset.rateChoiceRow;
      if(!eligiblePokemonRosterRatingChoiceIds(activeView).includes(id))return;
      if(element.checked)selectedIds.add(id);else selectedIds.delete(id);
    }else if(element.matches('[data-rate-choice-filter]'))filterGrade=element.value;
    else if(element.matches('[data-rate-choice-target]'))filterTarget=element.value;
    else if(element.matches('[data-rate-choice-sort]'))sortChoice=element.value;
    else if(element.matches('[data-rate-choice-desc]'))reverseSort=element.checked;
    else return;
    show();
  });
  panel.addEventListener('click',event=>{
    const action=event.target.closest('[data-rate-choice-action]')?.dataset.rateChoiceAction;
    if(!activeView||!action)return;
    if(action==='all'){selectedIds=new Set(eligiblePokemonRosterRatingChoiceIds(activeView));show();return;}
    if(action==='none'){selectedIds.clear();show();return;}
    if(action==='review'){
      let result;
      try{result=reviewPokemonRosterRatingChoiceIntent({
        preview:activeView,freshView:readView(),selectedPokemonIds:[...selectedIds],
        explicitReview:true,
      });}catch{result={status:'HOLD_READ_ONLY_REVIEW',reason_codes:['FRESH_SOURCE_READ_FAILED']};}
      const notice=panel.querySelector('[data-rate-choice-review-result]');
      if(result.status==='REVIEWED_NONPERSISTENT_INTENT')
        notice.textContent=`已審閱 ${result.selected_count} 隻非持久選擇意向；舊評級仍保留，未儲存、未寫入。正式採用另需安全 Writer 與再次確認。`;
      else{
        selectedIds.clear();activeView=null;
        panel.innerHTML=`<div class="notice" data-rate3-stale="true">HOLD：資料或選擇已失效（${esc((result.reason_codes||[]).join('、'))}），已清除全部擬採用選擇。請重新計算。</div>`;
      }
    }
  });
}
