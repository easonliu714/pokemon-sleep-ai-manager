// RATE.3: existing Pokémon box comparison only. Never apply, persist or mutate a rating.
// This projection is not a durable snapshot or an admitted multi-tab Writer.
import {planPokemonRosterProvisionalRegrade,POKEMON_PROVISIONAL_RATING_LABELS} from './pokemon-provisional-rating.js';

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

function renderPokemonRosterRatingBaseHtml(view){
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


// G14.RATE read-only freshness: JSON.stringify silently drops undefined and
// functions, converts NaN/Infinity to null, and fills sparse array holes with
// null. Such noncanonical facts cannot certify an existing user's adopt intent.
// Reject them before tokenization; this is NOT a durable SQLite authority.
function ratingSourceIsCanonicalJson(value,seen){
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object'||seen.has(value))return false;
  seen.add(value);
  if(Array.isArray(value)){
    // Exactly the indexed elements and the built-in length: no holes, symbols
    // or extra properties that JSON would silently ignore.
    if(Reflect.ownKeys(value).length!==value.length+1)return false;
    for(let i=0;i<value.length;i++)
      if(!Object.hasOwn(value,i)||!ratingSourceIsCanonicalJson(value[i],seen))return false;
    return true;
  }
  if(Object.getPrototypeOf(value)!==Object.prototype)return false;
  return Reflect.ownKeys(value).every(key=>{
    if(typeof key!=='string')return false;
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor?.enumerable&&Object.hasOwn(descriptor,'value')
      &&ratingSourceIsCanonicalJson(descriptor.value,seen);
  });
}
export function sourceTokenForPokemonRating({pokemon,ingredients,subskills}={}){
  if(![pokemon,ingredients,subskills].every(Array.isArray))return null;
  try{
    const facts=[pokemon,ingredients,subskills];
    return ratingSourceIsCanonicalJson(facts,new WeakSet())?JSON.stringify(facts):null;
  }catch{return null;}
}
export function createPokemonRatingSelection(view){
  const rows=view?.status==='PREVIEW_ONLY'?view.rows:[];
  const ids=new Map(),instances=new Map(),eligible=[],held=[];
  for(const x of rows){
    const id=clean(x.pokemon_id),instance=clean(x.pokemon_instance_id);
    ids.set(id,(ids.get(id)||0)+1);
    if(instance)instances.set(instance,(instances.get(instance)||0)+1);
  }
  for(const x of rows){
    const id=clean(x.pokemon_id),instance=clean(x.pokemon_instance_id),reasons=[];
    if(!id||ids.get(id)!==1)reasons.push('missing_or_duplicate_pokemon_id');
    if(!instance||instances.get(instance)!==1)reasons.push('missing_or_duplicate_instance_id');
    if(x.status!=='PROVISIONAL_HEURISTIC'||!POKEMON_PROVISIONAL_RATING_LABELS.includes(x.proposed_rating))
      reasons.push('provisional_rating_hold');
    (reasons.length?held:eligible).push({...x,selection_hold_reasons:reasons});
  }
  return {status:view?.status==='PREVIEW_ONLY'?'NON_PERSISTENT_INTENT':'HOLD_SOURCE_UNAVAILABLE',
    eligible,held,selected:new Set(),rule_version:view?.plan?.rule_version||null,
    player_data_write:false,overwrite_allowed:false};
}
export function changePokemonRatingSelection(model,instanceId,adopt){
  const id=clean(instanceId);
  if(model?.status!=='NON_PERSISTENT_INTENT'||!id||
    !model.eligible.some(x=>clean(x.pokemon_instance_id)===id))return false;
  if(adopt===true)model.selected.add(id);else model.selected.delete(id);
  return true;
}
export function reviewPokemonRatingSelection(model){
  const map=x=>({pokemon_id:x.pokemon_id,pokemon_instance_id:x.pokemon_instance_id,
    old_rating:x.previous_rating??null,new_rating:x.proposed_rating??null,
    rule_version:x.rule_version||model.rule_version});
  return {status:model?.status==='NON_PERSISTENT_INTENT'?'NON_PERSISTENT_REVIEW_ONLY':'HOLD_SOURCE_UNAVAILABLE',
    adopt:(model?.eligible||[]).filter(x=>model.selected.has(clean(x.pokemon_instance_id))).map(map),
    keep:(model?.eligible||[]).filter(x=>!model.selected.has(clean(x.pokemon_instance_id))).map(map),
    held:(model?.held||[]).map(x=>({...map(x),reasons:x.selection_hold_reasons})),
    player_data_write:false,overwrite_allowed:false,durable_snapshot:false};
}
export function renderPokemonRosterRatingViewHtml(view,model=createPokemonRatingSelection(view),
  {gradeFilter='',sortMode='id',reviewOpen=false}={}){
  const base=renderPokemonRosterRatingBaseHtml(view);
  if(view?.status!=='PREVIEW_ONLY'||!view.plan)return base;
  const eligible=new Set(model.eligible.map(x=>clean(x.pokemon_instance_id)));
  const held=new Set(model.held.map(x=>clean(x.pokemon_id)+'|'+clean(x.pokemon_instance_id)));
  const rank=x=>POKEMON_PROVISIONAL_RATING_LABELS.indexOf(x);
  const visible=view.rows.filter(x=>!gradeFilter||x.proposed_rating===gradeFilter).slice();
  visible.sort((a,b)=>{
    if(sortMode==='grade-high'||sortMode==='grade-low'){
      const ra=rank(a.proposed_rating),rb=rank(b.proposed_rating);
      // RATE.3/4: HOLD, missing and identity-conflicted rows have no trusted
      // 15-band ordering. Keep them after eligible rows in BOTH directions;
      // reversing an unknown sentinel previously put HOLD first in grade-low.
      const aEligible=a.status==='PROVISIONAL_HEURISTIC'&&eligible.has(clean(a.pokemon_instance_id))&&ra>=0;
      const bEligible=b.status==='PROVISIONAL_HEURISTIC'&&eligible.has(clean(b.pokemon_instance_id))&&rb>=0;
      if(aEligible!==bEligible)return aEligible?-1:1;
      if(aEligible&&bEligible&&ra!==rb)return sortMode==='grade-high'?ra-rb:rb-ra;
    }
    return clean(a.pokemon_id).localeCompare(clean(b.pokemon_id));
  });
  const body=visible.map(x=>{
    const id=clean(x.pokemon_instance_id);
    const blocked=x.status!=='PROVISIONAL_HEURISTIC'||held.has(clean(x.pokemon_id)+'|'+id)||!eligible.has(id);
    const selected=!blocked&&model.selected.has(id);
    const reason=model.held.find(y=>clean(y.pokemon_id)===clean(x.pokemon_id)&&clean(y.pokemon_instance_id)===id);
    return '<tr data-rate4-state="'+(blocked?'HOLD':'ELIGIBLE')+'"><td>'+esc(x.species)
      +'</td><td>'+esc(label(x.pokemon_id))+' / '+esc(label(id))+'</td><td>'+esc(label(x.previous_rating))
      +'</td><td>'+(blocked?'HOLD':esc(label(x.proposed_rating)))+'</td><td>'
      +(blocked?'<input type="checkbox" disabled> HOLD '+esc((reason?.selection_hold_reasons||[]).join('、'))
        :'<label><input type="checkbox" data-rate4-choice="'+esc(id)+'"'+(selected?' checked':'')+'> 擬採用</label>')
      +'</td></tr>';
  }).join('');
  const grades=POKEMON_PROVISIONAL_RATING_LABELS.map(x=>'<option value="'+x+'"'+(gradeFilter===x?' selected':'')+'>'+x+'</option>').join('');
  const sorts=[['id','個體識別'],['grade-high','新評高→低'],['grade-low','新評低→高']]
    .map(([id,name])=>'<option value="'+id+'"'+(sortMode===id?' selected':'')+'>'+name+'</option>').join('');
  const review=reviewPokemonRatingSelection(model);
  const count='擬採用 '+review.adopt.length+'／保留 '+review.keep.length+'／HOLD '+review.held.length;
  const detail=reviewOpen?'<div class="notice" data-rate4-review-panel="true">僅供檢視的選擇意向（未保存）：'
    +esc(count)+'。正式持久套用須另行確認、快照、跨分頁准入與 durable ACK。<ul>'
    +review.adopt.map(x=>'<li>'+esc(x.pokemon_id)+' / '+esc(x.pokemon_instance_id)+'：'
      +esc(label(x.old_rating))+' → '+esc(label(x.new_rating))+'</li>').join('')+'</ul></div>':'';
  return base+'<div class="notice" data-rate4-readonly="true">逐隻選擇預設保留原評；擬採用僅存在本頁記憶體，沒有修改 pokemon.rating。</div>'
    +'<div class="filter-bar" data-rate4-controls="true"><button type="button" data-rate4-select-all="true">全選擬採用</button>'
    +'<button type="button" data-rate4-keep-all="true">全部保留</button>'
    +'<button type="button" data-rate4-review="true">檢視選擇意向（不儲存）</button>'
    +'<label>建議評級 <select data-rate4-filter="true"><option value="">全部15級</option>'+grades+'</select></label>'
    +'<label>排序 <select data-rate4-sort="true">'+sorts+'</select></label>'
    +'<span data-rate4-count="true">'+esc(count)+'</span></div>'+detail
    +'<div class="table-wrap"><table><thead><tr><th>寶可夢</th><th>個體</th><th>舊評</th><th>建議新評</th><th>逐隻意向</th></tr></thead><tbody>'
    +(body||'<tr><td colspan="5">目前沒有可比對個體</td></tr>')+'</tbody></table></div>';
}

let panel=null,model=null,view=null,token=null;
let gradeFilter='',sortMode='id',reviewOpen=false;
export function invalidatePokemonRosterRatingPreview(){
  model=null;view=null;token=null;gradeFilter='';sortMode='id';reviewOpen=false;
  if(panel&&!panel.hidden)
    panel.innerHTML='<div class="notice" data-rate4-stale="true" data-rate3-stale="true">資料已變動，擬採用選擇已清除；請重新產生唯讀預覽。</div>';
}
export function setupPokemonRosterRatingPreview({readRoster,readIngredients,readSubskills}={}){
  const section=document.getElementById('pokemon'),heading=section?.querySelector('.section-head');
  if(!heading||section.querySelector('[data-rate3-preview-button]'))return;
  const button=document.createElement('button');
  button.type='button';button.dataset.rate3PreviewButton='true';
  button.textContent='預覽全盒新舊評級（唯讀）';
  panel=document.createElement('div');panel.className='panel';panel.id='pokemonRosterRatingPreview';panel.hidden=true;
  heading.append(button);
  (section.querySelector('.filter-bar')||heading).insertAdjacentElement('afterend',panel);
  const readSource=()=>{
    if(typeof readRoster!=='function'||typeof readIngredients!=='function'||typeof readSubskills!=='function')
      throw new Error('READ_ONLY_READER_UNAVAILABLE');
    return {pokemon:readRoster(),ingredients:readIngredients(),subskills:readSubskills()};
  };
  const fresh=()=>{
    try{
      if(!token||sourceTokenForPokemonRating(readSource())!==token){
        invalidatePokemonRosterRatingPreview();return false;
      }
      return true;
    }catch{invalidatePokemonRosterRatingPreview();return false;}
  };
  const paint=()=>{panel.innerHTML=renderPokemonRosterRatingViewHtml(view,model,{gradeFilter,sortMode,reviewOpen});};
  button.addEventListener('click',()=>{
    invalidatePokemonRosterRatingPreview();panel.hidden=false;
    panel.innerHTML='<div class="notice">正在讀取本機個體資料（不修改 SQLite）…</div>';
    try{
      const source=readSource();token=sourceTokenForPokemonRating(source);
      if(!token)throw new Error('NON_CANONICAL_READ_ONLY_SOURCE');
      view=buildPokemonRosterRatingView(source);model=createPokemonRatingSelection(view);paint();
    }catch{
      invalidatePokemonRosterRatingPreview();
      panel.innerHTML='<div class="notice" data-rate3-hold="true">HOLD：唯讀來源不明，沒有修改任何評級。</div>';
    }
  });
  panel.addEventListener('change',event=>{
    if(!model||!fresh())return;
    const t=event.target;
    if(t.matches('[data-rate4-choice]')){
      changePokemonRatingSelection(model,t.dataset.rate4Choice,t.checked);reviewOpen=false;
    }else if(t.matches('[data-rate4-filter]')){
      gradeFilter=POKEMON_PROVISIONAL_RATING_LABELS.includes(t.value)?t.value:'';
    }else if(t.matches('[data-rate4-sort]')){
      sortMode=['id','grade-high','grade-low'].includes(t.value)?t.value:'id';
    }else return;
    paint();
  });
  panel.addEventListener('click',event=>{
    const t=event.target.closest('button');
    if(!t||!model||!fresh())return;
    if(t.hasAttribute('data-rate4-select-all')){
      for(const x of model.eligible)changePokemonRatingSelection(model,x.pokemon_instance_id,true);
      reviewOpen=false;
    }else if(t.hasAttribute('data-rate4-keep-all')){
      model.selected.clear();reviewOpen=false;
    }else if(t.hasAttribute('data-rate4-review'))reviewOpen=true;
    else return;
    paint();
  });
}
