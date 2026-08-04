import {rows,run,begin,commit,rollback,persist,snapshot,scalar} from './database.js';
import {openPokemonDetail} from './pokemon-detail.js';

const VERSION='v0.3.78';
const BUILD='20260804-v0377c-data-consistency-multicapture';
const groups=new Map();
let activeGroupId=`capture-${Date.now()}`;
let latestRevision=null;

const text=value=>{
  if(value==null)return '';
  if(typeof value==='string')return value.trim();
  if(typeof value==='number')return String(value);
  if(typeof value==='object')return text(value.name??value.nature_name??value.label??value.value??'');
  return '';
};
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const badString=value=>/^\[(object Object|object Array)\]$|^(undefined|null)$/i.test(String(value??'').trim());
const clean=value=>{const result=text(value);return badString(result)?'':result;};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function normalizeSubskills(value){
  return (Array.isArray(value)?value:[]).map((row,index)=>({
    unlock_level:number(row?.unlock_level??row?.level)??[10,25,50,75,100][index]??null,
    subskill_name:clean(row?.subskill_name??row?.name),
    is_unlocked:row?.is_unlocked??row?.unlocked?1:0,
  })).filter(row=>row.unlock_level&&row.subskill_name);
}
function normalizeIngredients(value){
  return (Array.isArray(value)?value:[]).map((row,index)=>({
    unlock_level:number(row?.unlock_level??row?.level)??[1,30,60][index]??null,
    ingredient_name:clean(row?.ingredient_name??row?.name),
    quantity:number(row?.quantity??row?.count),
  })).filter(row=>row.unlock_level&&row.ingredient_name);
}
function normalizeRevision(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  if(revision?.analysis_type==='ai')return {
    species:clean(raw.pokemon_name),nickname:'',level:number(raw.level),sp:number(raw.sp),nature:clean(raw.nature),
    main_skill:clean(raw.main_skill?.name??raw.main_skill),main_skill_level:number(raw.main_skill?.level),
    confidence:number(raw.confidence),subskills:normalizeSubskills(raw.sub_skills),ingredients:normalizeIngredients(raw.ingredients),
    source_text:'',source_refs:[revision.source_image_ref].filter(Boolean),analysis_ids:[revision.analysis_id].filter(Boolean),
  };
  const regions=Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
  return {species:'',nickname:'',level:null,sp:null,nature:'',main_skill:'',main_skill_level:null,confidence:null,subskills:[],ingredients:[],source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),source_refs:[revision.source_image_ref].filter(Boolean),analysis_ids:[revision.analysis_id].filter(Boolean)};
}
function blank(value){return value==null||value===''||(Array.isArray(value)&&value.length===0);}
function mergeDraft(base,next){
  const out={...base};const conflicts=[];
  for(const key of ['species','nickname','level','sp','nature','main_skill','main_skill_level','confidence']){
    if(blank(next[key]))continue;
    if(blank(out[key]))out[key]=next[key];
    else if(String(out[key])!==String(next[key]))conflicts.push({field:key,existing:out[key],incoming:next[key]});
  }
  if(next.subskills?.length){if(!out.subskills?.length)out.subskills=next.subskills;else if(JSON.stringify(out.subskills)!==JSON.stringify(next.subskills))conflicts.push({field:'subskills',existing:out.subskills,incoming:next.subskills});}
  if(next.ingredients?.length){if(!out.ingredients?.length)out.ingredients=next.ingredients;else if(JSON.stringify(out.ingredients)!==JSON.stringify(next.ingredients))conflicts.push({field:'ingredients',existing:out.ingredients,incoming:next.ingredients});}
  out.source_text=[out.source_text,next.source_text].filter(Boolean).join('\n\n---\n\n');
  out.source_refs=[...new Set([...(out.source_refs||[]),...(next.source_refs||[])])];
  out.analysis_ids=[...new Set([...(out.analysis_ids||[]),...(next.analysis_ids||[])])];
  out.conflicts=[...(out.conflicts||[]),...conflicts];
  return out;
}
function group(){if(!groups.has(activeGroupId))groups.set(activeGroupId,{draft:{source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[]},created_at:new Date().toISOString()});return groups.get(activeGroupId);}
function startNewGroup(){activeGroupId=`capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;group();renderGroupNotice();}
function applyMergedDraftToForm(){
  const root=document.getElementById('analysisConfirmationWorkbench');if(!root)return;
  const draft=group().draft;
  for(const key of ['species','nickname','level','sp','nature','main_skill','main_skill_level','confidence','source_text']){
    const node=root.querySelector(`[data-field="${key}"]`);if(node&&!blank(draft[key]))node.value=draft[key];
  }
  for(const key of ['subskills','ingredients']){const node=root.querySelector(`[data-json-field="${key}"]`);if(node&&draft[key]?.length)node.value=JSON.stringify(draft[key],null,2);}
  renderGroupNotice();
}
function renderGroupNotice(){
  const root=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');if(!root)return;
  let panel=root.querySelector('#captureGroupStatus');if(!panel){panel=document.createElement('section');panel.id='captureGroupStatus';panel.className='notice';root.querySelector('header')?.insertAdjacentElement('afterend',panel);}
  const data=group().draft;
  panel.innerHTML=`<b>同一寶可夢多截圖群組</b><br>來源圖片：${data.source_refs?.length||0}；分析 revision：${data.analysis_ids?.length||0}；衝突：${data.conflicts?.length||0}<br><small>${(data.source_refs||[]).map(esc).join('、')||'尚無來源'}</small><div class="buttons"><button type="button" id="startNewCaptureGroup" class="secondary">下一隻寶可夢／建立新群組</button></div>${data.conflicts?.length?`<details><summary>欄位衝突，請以表單目前值人工確認</summary><pre>${esc(JSON.stringify(data.conflicts,null,2))}</pre></details>`:''}`;
  panel.querySelector('#startNewCaptureGroup').onclick=startNewGroup;
}
function readForm(){
  const root=document.getElementById('analysisConfirmationWorkbench');
  const draft={};for(const key of ['species','nickname','level','sp','nature','main_skill','main_skill_level','confidence','source_text']){const node=root.querySelector(`[data-field="${key}"]`);draft[key]=node?.type==='number'?number(node.value):clean(node?.value);}
  for(const key of ['subskills','ingredients']){const node=root.querySelector(`[data-json-field="${key}"]`);try{draft[key]=JSON.parse(node?.value||'[]');}catch{throw new Error(`${key} JSON 格式錯誤`);}}
  draft.subskills=normalizeSubskills(draft.subskills);draft.ingredients=normalizeIngredients(draft.ingredients);
  if(!draft.species)throw new Error('寶可夢名稱不可空白');
  for(const key of ['species','nickname','nature','main_skill'])if(badString(draft[key]))throw new Error(`${key} 包含無效物件字串`);
  return draft;
}
function tableColumns(name){return rows(`PRAGMA table_info(${name})`).map(row=>row.name);}
function insertPokemon(record){
  const columns=tableColumns('pokemon');const keys=Object.keys(record).filter(key=>columns.includes(key));
  run(`INSERT INTO pokemon(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,keys.map(key=>record[key]));
}
function patchPokemon(id,draft,now,sourceId){
  const columns=tableColumns('pokemon');const values={};
  const candidates={species:draft.species,current_species:draft.species,original_label:draft.nickname||draft.species,nickname:draft.nickname,level:draft.level,sp:draft.sp,nature:draft.nature,main_skill:draft.main_skill,main_skill_level:draft.main_skill_level,identity_confidence:draft.confidence,last_updated_at:now,source_update_id:sourceId};
  for(const [key,value] of Object.entries(candidates))if(columns.includes(key)&&!blank(value))values[key]=value;
  values.identity_review_required=0;
  const keys=Object.keys(values);if(keys.length)run(`UPDATE pokemon SET ${keys.map(key=>`${key}=?`).join(',')} WHERE pokemon_id=?`,[...keys.map(key=>values[key]),id]);
}
async function safeApply(event){
  const button=event.target.closest?.('#applyConfirmedAnalysis');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  const root=document.getElementById('analysisConfirmationWorkbench'),status=root?.querySelector('#analysisConfirmationStatus');
  try{
    const draft=readForm(),mode=root.querySelector('input[name="analysisTarget"]:checked')?.value||'new',existingId=root.querySelector('#analysisExistingPokemon')?.value;
    if(mode==='existing'&&!existingId)throw new Error('請選擇要更新的既有個體');
    const pokemonId=mode==='existing'?existingId:(crypto.randomUUID?.()||`pokemon-${Date.now()}`),now=new Date().toISOString(),sourceId=`analysis-group:${activeGroupId}`;
    const before=mode==='existing'?rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null:null;
    await snapshot(`before_multicapture_confirmation_${activeGroupId}`);begin();
    try{
      if(before)patchPokemon(pokemonId,draft,now,sourceId);else insertPokemon({pokemon_id:pokemonId,pokemon_instance_id:crypto.randomUUID?.()||pokemonId,original_species:draft.species,current_species:draft.species,species:draft.species,original_label:draft.nickname||draft.species,nickname:draft.nickname||null,level:draft.level,sp:draft.sp,nature:draft.nature||null,main_skill:draft.main_skill||null,main_skill_level:draft.main_skill_level,identity_confidence:draft.confidence,identity_review_required:0,status:'active',last_updated_at:now,source_update_id:sourceId});
      if(draft.subskills.length){run('DELETE FROM pokemon_subskills WHERE pokemon_id=?',[pokemonId]);for(const row of draft.subskills)run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',[pokemonId,row.unlock_level,row.subskill_name,row.is_unlocked]);}
      if(draft.ingredients.length){run('DELETE FROM pokemon_ingredients WHERE pokemon_id=?',[pokemonId]);for(const row of draft.ingredients)run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',[pokemonId,row.unlock_level,row.ingredient_name,row.quantity]);}
      run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[pokemonId,now,mode==='existing'?'multicapture_patch_update':'multicapture_create',before?JSON.stringify(before):null,JSON.stringify({...draft,source_refs:group().draft.source_refs,analysis_ids:group().draft.analysis_ids}),'使用者確認同一寶可夢多截圖合併結果',sourceId]);
      commit();await persist();
    }catch(error){rollback();throw error;}
    if(status){status.className='notice success';status.textContent=`已${mode==='existing'?'安全補丁更新':'建立'}正式資料：${draft.species}（${pokemonId}）`;}    
    dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'pokemon',pokemon_id:pokemonId,operation:mode,group_id:activeGroupId}}));
    dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmed-applied',{detail:{analysis_ids:group().draft.analysis_ids,pokemon_id:pokemonId,mode,group_id:activeGroupId}}));
    globalThis.UpdateCenterLiveDebug?.record?.('multicapture_patch_applied',{pokemon_id:pokemonId,mode,source_count:group().draft.source_refs.length,analysis_count:group().draft.analysis_ids.length});
    startNewGroup();
  }catch(error){if(status){status.className='notice error';status.textContent=`寫入失敗：${error?.message||error}`;}globalThis.UpdateCenterLiveDebug?.record?.('multicapture_patch_failed',{message:error?.message||String(error)});}
}
function refreshPokemonUi(){
  const data=rows("SELECT * FROM pokemon WHERE status='active' ORDER BY CASE rating WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 WHEN 'B' THEN 4 ELSE 9 END, level DESC, species");
  const table=document.getElementById('pokemonTable'),summary=document.getElementById('pokemonResultSummary'),count=document.getElementById('pokemonCount');if(count)count.textContent=data.length;if(summary)summary.textContent=`顯示 ${data.length}／${data.length} 隻；點選任一列查看或編輯完整個體資料`;
  if(table){table.innerHTML=`<thead><tr><th>名稱</th><th>Lv</th><th>評級</th><th>專長</th><th>屬性</th><th>暱稱</th><th>等效字數</th><th>定位</th></tr></thead><tbody>${data.map(row=>`<tr class="pokemon-row" data-pokemon-id="${esc(row.pokemon_id)}"><td>${esc(row.original_label||row.nickname||row.species||row.current_species||'未命名個體')}</td><td>${esc(row.level??'—')}</td><td>${esc(row.rating||'未設定')}</td><td>${esc(row.specialty||'未設定')}</td><td>${esc(row.type||'未設定')}</td><td>${esc(row.nickname||'—')}</td><td>${esc(row.nickname_halfwidth_units??'—')}</td><td>${esc(row.core_role||'未設定')}</td></tr>`).join('')}</tbody>`;table.querySelectorAll('.pokemon-row').forEach(row=>row.onclick=()=>openPokemonDetail(row.dataset.pokemonId));}
}
addEventListener('pokemon-sleep:analysis-revision-saved',event=>{latestRevision=event.detail;const merged=mergeDraft(group().draft,normalizeRevision(latestRevision));groups.get(activeGroupId).draft=merged;setTimeout(applyMergedDraftToForm,0);globalThis.UpdateCenterLiveDebug?.record?.('multicapture_revision_merged',{group_id:activeGroupId,source_count:merged.source_refs.length,analysis_count:merged.analysis_ids.length,conflict_count:merged.conflicts.length});});
addEventListener('pokemon-sleep:data-changed',()=>setTimeout(refreshPokemonUi,0));
document.addEventListener('click',safeApply,true);
document.addEventListener('click',event=>{if(event.target.closest?.('nav button[data-view="pokemon"]'))setTimeout(refreshPokemonUi,0);},true);
function version(){document.documentElement.dataset.appVersion=VERSION;document.documentElement.dataset.appBuild=BUILD;const badge=document.getElementById('appVersion');if(badge)badge.textContent=`版本 ${VERSION}`;}
version();setTimeout(version,0);globalThis.UpdateCenterLiveDebug?.record?.('data_consistency_multicapture_ready',{version:VERSION,build:BUILD,patch_semantics:true});
