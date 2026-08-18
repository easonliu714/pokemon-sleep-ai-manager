import {rows,run,begin,commit,rollback,persist,snapshot} from './database.js';
import {resolveEvolutionAuthority,hydrateEvolutionDraft,evolutionAuthorityLabel} from './analysis-confirmation-evolution-authority.js';
import './analysis-confirmation-post-apply-refresh.js';

const VERSION=globalThis.PokemonSleepVersionAuthority?.app_version||'unknown';
const BUILD=globalThis.PokemonSleepVersionAuthority?.app_build||'unknown';
const ING_LEVELS=[1,30,60];
const SUB_LEVELS=[10,25,50,70,80];
let currentRevision=null;
let currentDraft=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asNumber=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const text=v=>v==null?'':String(v).trim();
const meaningful=v=>v!==null&&v!==undefined&&v!=='';
const objectText=v=>typeof v==='object'&&v!==null?'':text(v);
const makeId=()=>globalThis.crypto?.randomUUID?.()||`pokemon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const terminal=(reason,detail={})=>globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-terminal',{detail:{reason,...detail}}));

function normalizeNature(value){
  if(value&&typeof value==='object')return {name:text(value.name),up:text(value.up),down:text(value.down)};
  return {name:text(value),up:'',down:''};
}
function normalizeSubskills(value){return (Array.isArray(value)?value:[]).map((row,index)=>({unlock_level:asNumber(row?.level??row?.unlock_level)??SUB_LEVELS[index]??null,subskill_name:text(row?.name??row?.subskill_name),is_unlocked:row?.unlocked===true||Number(row?.is_unlocked)===1})).filter(row=>row.unlock_level&&row.subskill_name);}
function normalizeIngredients(value){return (Array.isArray(value)?value:[]).map((row,index)=>({unlock_level:asNumber(row?.level??row?.unlock_level)??ING_LEVELS[index]??null,ingredient_name:text(row?.name??row?.ingredient_name),quantity:asNumber(row?.count??row?.quantity)})).filter(row=>row.unlock_level&&row.ingredient_name);}
function normalizeRevision(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  if(revision?.analysis_type!=='ai'){
    const regions=Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
    return {species:'',nickname:'',level:null,sp:null,specialty:'',type:'',nature:'',nature_bonus:'',nature_penalty:'',main_skill:'',main_skill_level:null,main_skill_description:'',helper_seconds:null,carry_limit:null,favorite_berry:'',sleep_hours:null,sleep_time_text:'',evolution_level_required:null,evolution_sleep_hours_required:null,evolution_candy_required:null,evolution_item_required:'',evolution_other_requirement:'',registered_at:'',is_favorite:null,subskills:[],ingredients:[],confidence:null,source_text:regions.map(row=>`${row.name||row.region||row.region_label||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),field_evidence:{},analysis_type:'ocr'};
  }
  const observation=Array.isArray(raw?.observations)?raw.observations[0]||{}:{};const profile=observation?.profile||{};const identity=observation?.identity||{};
  const nature=normalizeNature(raw.nature);const evo=raw.evolution_requirements||{};
  const favoriteValue=observation.is_favorite??raw.is_favorite;
  return {species:text(raw.pokemon_name??profile.header_name_text??profile.species),nickname:text(raw.nickname??profile.nickname),level:asNumber(raw.level??profile.level),sp:asNumber(raw.sp??profile.sp),specialty:text(raw.specialty??profile.specialty),type:text(raw.type??profile.type),nature:nature.name||text(profile.nature),nature_bonus:nature.up||text(profile.nature_bonus),nature_penalty:nature.down||text(profile.nature_penalty),main_skill:text(profile.main_skill??raw.main_skill?.name??objectText(raw.main_skill)),main_skill_level:asNumber(profile.main_skill_level??raw.main_skill?.level),main_skill_description:text(raw.main_skill?.description),helper_seconds:asNumber(raw.helper_seconds??profile.helper_seconds),carry_limit:asNumber(raw.carry_limit??profile.carry_limit),favorite_berry:text(raw.favorite_berry??profile.favorite_berry),sleep_hours:asNumber(raw.sleep_hours??profile.sleep_hours),sleep_time_text:text(raw.sleep_time_text??profile.sleep_time_text),evolution_level_required:asNumber(evo.level_required),evolution_sleep_hours_required:asNumber(evo.sleep_hours_required),evolution_candy_required:asNumber(evo.candy_required),evolution_item_required:text(evo.item_required),evolution_other_requirement:text(evo.other),registered_at:text(identity.registered_date??raw.registered_at??raw.obtained_at),is_favorite:favoriteValue===true?1:favoriteValue===false?0:null,subskills:normalizeSubskills(raw.sub_skills?.length?raw.sub_skills:observation.subskills),ingredients:normalizeIngredients(raw.ingredients?.length?raw.ingredients:observation.ingredients),confidence:asNumber(raw.confidence),source_text:'',field_evidence:raw.field_evidence&&typeof raw.field_evidence==='object'?raw.field_evidence:{},analysis_type:'ai'};
}

function canonical(entityType,rawValue){
  const raw=text(rawValue);if(!raw)return {raw,canonical:'',status:'EMPTY',commit_allowed:false};
  const exact=rows('SELECT term_id,canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1',[entityType,raw])[0];
  if(exact)return {raw,canonical:exact.canonical_name_zh_tw,status:'CANONICAL_EXACT',commit_allowed:true,term_id:exact.term_id};
  const alias=rows(`SELECT t.term_id,t.canonical_name_zh_tw,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`,[entityType,raw])[0];
  if(alias){const safe=Number(alias.is_auto_replace_safe)===1;return {raw,canonical:alias.canonical_name_zh_tw,status:safe?'CANONICAL_ALIAS_SAFE':'CANONICAL_ALIAS_REVIEW',commit_allowed:safe,term_id:alias.term_id};}
  return {raw,canonical:'',status:'CANONICAL_UNKNOWN',commit_allowed:false};
}
function canonicalBadge(result){return `<span class="badge ${result.commit_allowed?'success':'pending'}">${esc(result.status)}</span><div class="notice">原始：${esc(result.raw||'—')}<br>正式：${esc(result.canonical||'尚未確認')}</div>`;}
function ensureRoot(){let root=document.getElementById('analysisConfirmationWorkbench');if(root)return root;const updates=document.getElementById('updates');if(!updates)return null;const heading=document.createElement('h3');heading.textContent='AI／OCR 結果確認';heading.id='analysisConfirmationHeading';root=document.createElement('section');root.id='analysisConfirmationWorkbench';root.className='panel';const anchor=document.getElementById('updateCenterDynamicContent');anchor?.insertAdjacentElement('afterend',heading);heading.insertAdjacentElement('afterend',root);return root;}
function pokemonOptions(){return rows("SELECT pokemon_id,pokemon_instance_id,species,nickname,level,sp FROM pokemon WHERE status<>'archived' ORDER BY species,nickname");}
function field(label,name,value,type='text'){return `<label class="edit-field"><span>${esc(label)}</span><input data-field="${esc(name)}" type="${type}" value="${esc(value??'')}"></label>`;}
function canonicalRow(kind,level,row){const entity=kind==='ingredient'?'ingredient':'subskill';const name=kind==='ingredient'?'ingredient_name':'subskill_name';const result=canonical(entity,row?.[name]);return `<div class="skill-item"><b>Lv${level}</b><div>${field(kind==='ingredient'?'食材':'副技能',`${kind}_name_${level}`,row?.[name]||'')}${kind==='ingredient'?field('數量',`ingredient_qty_${level}`,row?.quantity,'number'):`<label><input data-check="sub_unlock_${level}" type="checkbox" ${row?.is_unlocked?'checked':''}> 已解鎖</label>`}${canonicalBadge(result)}</div></div>`;}
function evolutionNotice(d){const authority=d?.evolution_authority||{};const alert=String(authority.status||'').startsWith('REVIEW_REQUIRED')||authority.status==='MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED';return `<div class="notice ${alert?'error':'success'}" data-evolution-authority-status="${esc(authority.status||'UNKNOWN')}"><strong>公版進化條件</strong><br>${esc(evolutionAuthorityLabel(authority))}</div>`;}

function render(){
  const root=ensureRoot();if(!root)return;if(!currentRevision||!currentDraft){root.innerHTML='<div class="notice">完成 OCR 或 AI 分析後，結果會出現在此處供人工確認。</div>';return;}
  const options=pokemonOptions();const d=currentDraft;
  root.innerHTML=`<section class="analysis-confirmation"><header><div><h3>分析結果人工確認</h3><p>來源：${esc(currentRevision.source_image_ref||'—')} · ${esc(currentRevision.analysis_type)} revision ${esc(currentRevision.revision_no)}</p></div><span class="badge">${esc(currentRevision.provider||'local')}</span></header>
  <div class="notice success"><strong>${esc(VERSION)} 詳情一致覆核</strong><br>空白欄位不覆蓋既有值；多張圖片保留為 Observation，衝突由使用者決定。</div>
  <h3>基本能力</h3><div class="edit-grid">${field('寶可夢名稱','species',d.species)}${field('暱稱','nickname',d.nickname)}${field('等級','level',d.level,'number')}${field('SP','sp',d.sp,'number')}${field('專長','specialty',d.specialty)}${field('屬性','type',d.type)}${field('主技能','main_skill',d.main_skill)}${field('主技能等級','main_skill_level',d.main_skill_level,'number')}${field('主技能說明','main_skill_description',d.main_skill_description)}${field('性格','nature',d.nature)}${field('性格提升','nature_bonus',d.nature_bonus)}${field('性格降低','nature_penalty',d.nature_penalty)}${field('幫忙速度秒數','helper_seconds',d.helper_seconds,'number')}${field('持有上限','carry_limit',d.carry_limit,'number')}${field('樹果種類','favorite_berry',d.favorite_berry)}${field('共眠時數','sleep_hours',d.sleep_hours,'number')}${field('共眠時間原文','sleep_time_text',d.sleep_time_text)}${field('登錄日期','registered_at',d.registered_at,'date')}${field('分析信心值','confidence',d.confidence,'number')}</div>
  <h3>進化條件</h3>${evolutionNotice(d)}<div class="edit-grid">${field('等級門檻','evolution_level_required',d.evolution_level_required,'number')}${field('共眠時數門檻','evolution_sleep_hours_required',d.evolution_sleep_hours_required,'number')}${field('糖果數量','evolution_candy_required',d.evolution_candy_required,'number')}${field('進化道具','evolution_item_required',d.evolution_item_required)}${field('其他條件','evolution_other_requirement',d.evolution_other_requirement)}</div>
  <h3>食材配置與正名</h3><div class="skill-list">${ING_LEVELS.map(level=>canonicalRow('ingredient',level,d.ingredients.find(row=>Number(row.unlock_level)===level))).join('')}</div>
  <h3>副技能與正名</h3><div class="skill-list">${SUB_LEVELS.map(level=>canonicalRow('subskill',level,d.subskills.find(row=>Number(row.unlock_level)===level))).join('')}</div>
  <details><summary>原始證據與欄位 Evidence</summary><textarea data-field="source_text" rows="6">${esc(d.source_text)}</textarea><pre class="prompt-box">${esc(JSON.stringify(d.field_evidence,null,2))}</pre></details>
  <fieldset><legend>寫入目標</legend><label><input type="radio" name="analysisTarget" value="new" checked> 建立新個體</label><label><input type="radio" name="analysisTarget" value="existing"> 疊加更新既有個體</label><label><input type="radio" name="analysisTarget" value="hold"> 暫存待判斷，不寫入正式個體</label><select id="analysisExistingPokemon"><option value="">選擇既有個體</option>${options.map(row=>`<option value="${esc(row.pokemon_id)}">${esc(row.nickname||row.species)} · Lv.${esc(row.level??'—')} · SP ${esc(row.sp??'—')}</option>`).join('')}</select></fieldset>
  <div class="buttons"><button id="applyConfirmedAnalysis">確認處置</button><button id="discardAnalysisDraft" class="secondary">捨棄本次草稿</button></div><div id="analysisConfirmationStatus" class="notice"></div></section>`;
  root.querySelector('#applyConfirmedAnalysis').onclick=applyConfirmed;
  root.querySelector('#discardAnalysisDraft').onclick=()=>{const analysisId=currentRevision?.analysis_id||null;currentRevision=null;currentDraft=null;terminal('discarded',{analysis_id:analysisId});render();};
}
function readDraft(root){const draft={...currentDraft};root.querySelectorAll('[data-field]').forEach(node=>draft[node.dataset.field]=node.type==='number'?(node.value===''?null:asNumber(node.value)):node.value.trim());draft.ingredients=ING_LEVELS.map(level=>({unlock_level:level,ingredient_name:text(root.querySelector(`[data-field="ingredient_name_${level}"]`)?.value),quantity:asNumber(root.querySelector(`[data-field="ingredient_qty_${level}"]`)?.value)})).filter(row=>row.ingredient_name);draft.subskills=SUB_LEVELS.map(level=>({unlock_level:level,subskill_name:text(root.querySelector(`[data-field="subskill_name_${level}"]`)?.value),is_unlocked:Boolean(root.querySelector(`[data-check="sub_unlock_${level}"]`)?.checked)})).filter(row=>row.subskill_name);if(!draft.species)throw new Error('寶可夢名稱不可空白');return draft;}
function patchValue(incoming,existing){return meaningful(incoming)?incoming:existing??null;}
function observationId(){return `obs:${currentRevision.analysis_id||makeId()}:${currentRevision.revision_no||1}`;}
function writeObservation({pokemonId=null,draft,mode,conflicts=[]}){run(`INSERT OR REPLACE INTO pokemon_analysis_observation(observation_id,pokemon_id,identity_group_key,source_image_ref,analysis_id,revision_no,observed_json,canonical_json,conflict_json,created_at,applied_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[observationId(),pokemonId,`${draft.species}|${draft.level??''}`,currentRevision.source_image_ref||'',currentRevision.analysis_id||'',currentRevision.revision_no||1,JSON.stringify(draft),JSON.stringify({ingredients:draft.ingredients.map(row=>({...row,canonical:canonical('ingredient',row.ingredient_name)})),subskills:draft.subskills.map(row=>({...row,canonical:canonical('subskill',row.subskill_name)}))}),JSON.stringify(conflicts),new Date().toISOString(),mode==='hold'?null:new Date().toISOString()]);}
async function applyConfirmed(){
  const root=ensureRoot(),status=root.querySelector('#analysisConfirmationStatus');
  try{
    const draft=readDraft(root),mode=root.querySelector('input[name="analysisTarget"]:checked')?.value||'new',existingId=root.querySelector('#analysisExistingPokemon').value;
    if(mode==='existing'&&!existingId)throw new Error('請選擇要更新的既有個體');
    await snapshot(`before_analysis_confirmation_${currentRevision.analysis_id}`);begin();
    try{
      if(mode==='hold'){
        writeObservation({draft,mode});commit();await persist();status.className='notice success';status.textContent='已保留本次 Observation，尚未寫入正式寶可夢。';terminal('hold',{analysis_id:currentRevision.analysis_id,mode});return;
      }
      const pokemonId=mode==='existing'?existingId:makeId(),now=new Date().toISOString();
      const before=mode==='existing'?rows('SELECT * FROM pokemon WHERE pokemon_id=?',[pokemonId])[0]||null:null;
      const columns=['species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement','registered_at'];
      const merged={};for(const column of columns)merged[column]=patchValue(draft[column],before?.[column]);
      merged.current_species=merged.species;merged.original_species=before?.original_species||merged.species;
      if(!before)merged.original_label=merged.species;
      merged.identity_confidence=patchValue(draft.confidence,before?.identity_confidence);merged.last_updated_at=now;merged.source_update_id=`analysis:${currentRevision.analysis_id}`;
      merged.field_evidence_json=JSON.stringify({...JSON.parse(before?.field_evidence_json||'{}'),...(draft.field_evidence||{})});
      const refs=new Set(JSON.parse(before?.source_image_refs_json||'[]'));if(currentRevision.source_image_ref)refs.add(currentRevision.source_image_ref);merged.source_image_refs_json=JSON.stringify([...refs]);
      if(before){run(`UPDATE pokemon SET ${Object.keys(merged).map(k=>`"${k}"=?`).join(',')} WHERE pokemon_id=?`,[...Object.values(merged),pokemonId]);}
      else{const record={pokemon_id:pokemonId,pokemon_instance_id:makeId(),...merged,status:'active',identity_review_required:0};run(`INSERT INTO pokemon(${Object.keys(record).map(k=>`"${k}"`).join(',')}) VALUES(${Object.keys(record).map(()=>'?').join(',')})`,Object.values(record));}
      for(const row of draft.subskills)run(`INSERT INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) VALUES(?,?,?,?) ON CONFLICT(pokemon_id,unlock_level) DO UPDATE SET subskill_name=excluded.subskill_name,is_unlocked=MAX(pokemon_subskills.is_unlocked,excluded.is_unlocked)`,[pokemonId,row.unlock_level,row.subskill_name,row.is_unlocked?1:0]);
      for(const row of draft.ingredients)run(`INSERT INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity) VALUES(?,?,?,?) ON CONFLICT(pokemon_id,unlock_level) DO UPDATE SET ingredient_name=excluded.ingredient_name,quantity=COALESCE(excluded.quantity,pokemon_ingredients.quantity)`,[pokemonId,row.unlock_level,row.ingredient_name,row.quantity]);
      writeObservation({pokemonId,draft,mode});run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',[pokemonId,now,mode==='existing'?'analysis_patch_update':'analysis_confirmed_create',before?JSON.stringify(before):null,JSON.stringify(merged),'使用者確認多圖疊加 AI／OCR 分析結果',merged.source_update_id]);
      commit();await persist();status.className='notice success';status.textContent=`已${mode==='existing'?'疊加更新':'建立'}：${draft.species}`;
      globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmed-applied',{detail:{analysis_id:currentRevision.analysis_id,pokemon_id:pokemonId,mode,species:draft.species,original_label:before?.original_label||draft.species,registered_at:merged.registered_at||null}}));
      terminal(mode==='existing'?'updated':'created',{analysis_id:currentRevision.analysis_id,pokemon_id:pokemonId,mode});
    }catch(error){rollback();throw error;}
  }catch(error){status.className='notice error';status.textContent=`寫入失敗：${error?.message||error}`;}
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>{currentRevision=event.detail;const normalized=normalizeRevision(currentRevision);currentDraft=hydrateEvolutionDraft(normalized,resolveEvolutionAuthority(normalized.species,rows));render();});
globalThis.addEventListener('pokemon-sleep:analysis-capture-group-reset',()=>{currentRevision=null;currentDraft=null;render();});
render();

export {VERSION,BUILD,normalizeRevision};
