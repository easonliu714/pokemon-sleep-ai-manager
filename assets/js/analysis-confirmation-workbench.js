import {rows,run,begin,commit,rollback,persist,snapshot} from './database.js';

const VERSION='v0.3.73';
const BUILD='20260804-g13-3b-analysis-confirmation-apply';
let currentRevision=null;
let currentDraft=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asNumber=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const text=v=>v==null?'':String(v).trim();
const normalizeSubskills=value=>(Array.isArray(value)?value:[]).map((row,index)=>({unlock_level:asNumber(row?.level??row?.unlock_level)??[10,25,50,75,100][index]??null,subskill_name:text(row?.name??row?.subskill_name),is_unlocked:row?.unlocked?1:0})).filter(row=>row.unlock_level&&row.subskill_name);
const normalizeIngredients=value=>(Array.isArray(value)?value:[]).map((row,index)=>({unlock_level:asNumber(row?.level??row?.unlock_level)??[1,30,60][index]??null,ingredient_name:text(row?.name??row?.ingredient_name),quantity:asNumber(row?.count??row?.quantity)})).filter(row=>row.unlock_level&&row.ingredient_name);

function normalizeRevision(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  if(revision?.analysis_type==='ai'){
    return {
      species:text(raw.pokemon_name),nickname:'',level:asNumber(raw.level),sp:asNumber(raw.sp),nature:text(raw.nature),
      main_skill:text(raw.main_skill?.name??raw.main_skill),main_skill_level:asNumber(raw.main_skill?.level),
      subskills:normalizeSubskills(raw.sub_skills),ingredients:normalizeIngredients(raw.ingredients),
      confidence:asNumber(raw.confidence),source_text:'',analysis_type:'ai'
    };
  }
  const regions=Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
  return {species:'',nickname:'',level:null,sp:null,nature:'',main_skill:'',main_skill_level:null,subskills:[],ingredients:[],confidence:null,source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),analysis_type:'ocr'};
}

function ensureRoot(){
  let root=document.getElementById('analysisConfirmationWorkbench');
  if(root)return root;
  const updates=document.getElementById('updates');if(!updates)return null;
  const heading=document.createElement('h3');heading.textContent='AI／OCR 結果確認';heading.id='analysisConfirmationHeading';
  root=document.createElement('section');root.id='analysisConfirmationWorkbench';root.className='panel';
  const anchor=document.getElementById('updateCenterDynamicContent');anchor?.insertAdjacentElement('afterend',heading);heading.insertAdjacentElement('afterend',root);
  return root;
}

function pokemonOptions(){return rows("SELECT pokemon_id,pokemon_instance_id,species,nickname,level,sp FROM pokemon WHERE status<>'archived' ORDER BY species,nickname");}
function field(label,name,value,type='text'){return `<label>${esc(label)}<input data-field="${esc(name)}" type="${type}" value="${esc(value??'')}"></label>`;}
function render(){
  const root=ensureRoot();if(!root)return;
  if(!currentRevision||!currentDraft){root.innerHTML='<div class="notice">完成 OCR 或 AI 分析後，結果會出現在此處供人工確認。</div>';return;}
  const options=pokemonOptions();
  root.innerHTML=`<section class="analysis-confirmation">
    <header><div><h3>分析結果人工確認</h3><p>來源：${esc(currentRevision.source_image_ref||'—')} · ${esc(currentRevision.analysis_type)} revision ${esc(currentRevision.revision_no)}</p></div><span class="badge">${esc(currentRevision.provider||'local')}</span></header>
    <div class="notice">分析結果只作為草稿；按下確認前不會寫入正式寶可夢資料。</div>
    <div class="analysis-grid">
      ${field('寶可夢名稱','species',currentDraft.species)}${field('暱稱','nickname',currentDraft.nickname)}${field('等級','level',currentDraft.level,'number')}${field('SP','sp',currentDraft.sp,'number')}
      ${field('性格','nature',currentDraft.nature)}${field('主技能','main_skill',currentDraft.main_skill)}${field('主技能等級','main_skill_level',currentDraft.main_skill_level,'number')}${field('分析信心值','confidence',currentDraft.confidence,'number')}
    </div>
    <label>OCR 原始證據<textarea data-field="source_text" rows="8">${esc(currentDraft.source_text)}</textarea></label>
    <details open><summary>副技能 JSON</summary><textarea data-json-field="subskills" rows="7">${esc(JSON.stringify(currentDraft.subskills,null,2))}</textarea></details>
    <details><summary>食材 JSON</summary><textarea data-json-field="ingredients" rows="6">${esc(JSON.stringify(currentDraft.ingredients,null,2))}</textarea></details>
    <fieldset><legend>寫入目標</legend>
      <label><input type="radio" name="analysisTarget" value="new" checked> 建立新個體</label>
      <label><input type="radio" name="analysisTarget" value="existing"> 更新既有個體</label>
      <select id="analysisExistingPokemon"><option value="">選擇既有個體</option>${options.map(row=>`<option value="${esc(row.pokemon_id)}">${esc(row.nickname||row.species)} · Lv.${esc(row.level??'—')} · SP ${esc(row.sp??'—')}</option>`).join('')}</select>
    </fieldset>
    <div class="buttons"><button id="applyConfirmedAnalysis">確認並寫入正式資料</button><button id="discardAnalysisDraft" class="secondary">捨棄本次草稿</button></div>
    <div id="analysisConfirmationStatus" class="notice"></div>
  </section>`;
  root.querySelector('#applyConfirmedAnalysis').onclick=applyConfirmed;
  root.querySelector('#discardAnalysisDraft').onclick=()=>{currentRevision=null;currentDraft=null;render();};
}

function readDraft(root){
  const draft={...currentDraft};root.querySelectorAll('[data-field]').forEach(node=>draft[node.dataset.field]=node.type==='number'?(node.value===''?null:asNumber(node.value)):node.value.trim());
  for(const name of ['subskills','ingredients']){const node=root.querySelector(`[data-json-field="${name}"]`);try{draft[name]=JSON.parse(node.value||'[]');}catch{throw new Error(`${name} JSON 格式錯誤`);}}
  if(!draft.species)throw new Error('寶可夢名稱不可空白');return draft;
}
function makeId(){return globalThis.crypto?.randomUUID?.()||`pokemon-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
async function applyConfirmed(){
  const root=ensureRoot(),status=root.querySelector('#analysisConfirmationStatus');
  try{
    const draft=readDraft(root),mode=root.querySelector('input[name="analysisTarget"]:checked')?.value||'new';
    const existingId=root.querySelector('#analysisExistingPokemon').value;
    if(mode==='existing'&&!existingId)throw new Error('請選擇要更新的既有個體');
    const pokemonId=mode==='existing'?existingId:makeId(),now=new Date().toISOString();
    const before=mode==='existing'?rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null:null;
    await snapshot(`before_analysis_confirmation_${currentRevision.analysis_id}`);begin();
    try{
      const record={pokemon_id:pokemonId,pokemon_instance_id:before?.pokemon_instance_id||makeId(),species:draft.species,current_species:draft.species,original_species:before?.original_species||draft.species,nickname:draft.nickname||null,level:draft.level,sp:draft.sp,nature:draft.nature||null,main_skill:draft.main_skill||null,main_skill_level:draft.main_skill_level,identity_confidence:draft.confidence,identity_review_required:0,status:'active',last_updated_at:now,source_update_id:`analysis:${currentRevision.analysis_id}`};
      if(before){run('UPDATE pokemon SET species=?,current_species=?,nickname=?,level=?,sp=?,nature=?,main_skill=?,main_skill_level=?,identity_confidence=?,identity_review_required=0,last_updated_at=?,source_update_id=? WHERE pokemon_id=?',[record.species,record.current_species,record.nickname,record.level,record.sp,record.nature,record.main_skill,record.main_skill_level,record.identity_confidence,now,record.source_update_id,pokemonId]);}
      else{run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,original_species,current_species,species,nickname,level,sp,nature,main_skill,main_skill_level,identity_confidence,identity_review_required,status,last_updated_at,source_update_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[record.pokemon_id,record.pokemon_instance_id,record.original_species,record.current_species,record.species,record.nickname,record.level,record.sp,record.nature,record.main_skill,record.main_skill_level,record.identity_confidence,0,'active',now,record.source_update_id]);}
      run('DELETE FROM pokemon_subskills WHERE pokemon_id=?',[pokemonId]);for(const row of draft.subskills||[])run('INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?)',[pokemonId,row.unlock_level,row.subskill_name,row.is_unlocked?1:0]);
      run('DELETE FROM pokemon_ingredients WHERE pokemon_id=?',[pokemonId]);for(const row of draft.ingredients||[])run('INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?)',[pokemonId,row.unlock_level,row.ingredient_name,row.quantity??null]);
      run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[pokemonId,now,mode==='existing'?'analysis_confirmed_update':'analysis_confirmed_create',before?JSON.stringify(before):null,JSON.stringify(record),'使用者確認 AI／OCR 分析結果',record.source_update_id]);
      commit();await persist();
      status.className='notice success';status.textContent=`已${mode==='existing'?'更新':'建立'}正式資料：${draft.species}（${pokemonId}）`;
      globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmed-applied',{detail:{analysis_id:currentRevision.analysis_id,pokemon_id:pokemonId,mode}}));
      globalThis.UpdateCenterLiveDebug?.record?.('analysis_confirmed_applied',{analysis_id:currentRevision.analysis_id,pokemon_id:pokemonId,mode});
    }catch(error){rollback();throw error;}
  }catch(error){status.className='notice error';status.textContent=`寫入失敗：${error?.message||error}`;globalThis.UpdateCenterLiveDebug?.record?.('analysis_confirmation_failed',{message:error?.message||String(error)});}
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>{currentRevision=event.detail;currentDraft=normalizeRevision(currentRevision);render();globalThis.UpdateCenterLiveDebug?.record?.('analysis_confirmation_ready',{analysis_id:currentRevision.analysis_id,analysis_type:currentRevision.analysis_type,revision_no:currentRevision.revision_no});});
function updateVersion(){document.documentElement.dataset.appVersion=VERSION;document.documentElement.dataset.appBuild=BUILD;const badge=document.getElementById('appVersion');if(badge)badge.textContent=`版本 ${VERSION}`;}
updateVersion();setTimeout(updateVersion,0);render();
