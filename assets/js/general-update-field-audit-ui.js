import { dryRun } from './importer.js';
import { debugTrace } from './debug-trace-manager.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const same = (a,b) => Object.is(a,b) || (a == null && b == null) || String(a ?? '') === String(b ?? '');
let loadedPayload = null;
let loadedFileName = '';
let handshakeInFlight = false;
let lastDryRunEnabled = null;
let reviewPreview = null;

const FIELD_META = {
  original_label:['名稱'], nickname:['暱稱'], level:['等級'], sp:['SP'], rating:['評級'], specialty:['專長'], type:['屬性'],
  main_skill:['主技能'], main_skill_level:['主技能等級',v=>v==null?'—':`Lv${v}`], main_skill_description:['主技能說明'],
  nature:['性格'], nature_bonus:['性格提升'], nature_penalty:['性格降低'], helper_seconds:['幫忙速度',v=>v==null?'—':`${v} 秒`],
  carry_limit:['持有上限'], favorite_berry:['樹果種類'], sleep_hours:['共眠時數',v=>v==null?'—':`${v} 小時`], sleep_time_text:['共眠時間原文'],
  obtained_at:['入手日期'], registered_at:['登錄日期'], core_role:['核心定位'], recommendation:['培養建議'], item_advice:['道具建議'], scenarios:['適用情境'], status:['狀態'],
};
const DETAIL_FIELDS = ['level','sp','specialty','type','main_skill','main_skill_level','nature','nature_bonus','nature_penalty','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','obtained_at'];
const META_FIELDS = new Set(['pokemon_instance_id','identity_fingerprint','identity_confidence','identity_review_required','last_updated_at','source_update_id','updated_at','created_at','original_species','current_species','species','original_label','registered_at','status']);
const EVIDENCE_ENTITIES = new Set(['pokemon_identity_evidence']);

function fmt(field,value){
  if (value === null || value === undefined || value === '') return '尚未匯入';
  const formatter = FIELD_META[field]?.[1];
  return formatter ? formatter(value) : String(value);
}
function fieldLabel(field){ return FIELD_META[field]?.[0] || field; }
function htmlValue(field,value){ const text=fmt(field,value); return `<span class="${text==='尚未匯入'?'unknown':''}">${esc(text)}</span>`; }

function ensurePanel() {
  const updates = $('updates');
  if (!updates || $('generalUpdateFieldAudit')) return;
  const panel = document.createElement('section');
  panel.id = 'generalUpdateFieldAudit';
  panel.className = 'panel update-review-panel';
  panel.innerHTML = `
    <div class="update-review-head">
      <div><h3>匯入內容確認</h3><p class="notice">一般 JSON 欄位稽核會直接比對目前 SQLite 與即將套用內容；請先閱讀能力差異，再確認「目前未顯示」槽位。</p></div>
      <span id="profileAuditProgress" class="badge pending">待確認</span>
    </div>
    <div id="profileAuditConfirmation"></div>
    <details class="field-audit-details"><summary>進階：資料庫欄位決策明細</summary>
      <div id="fieldAuditSummary">載入 JSON 並執行 Dry Run 後顯示欄位決策。</div>
      <div class="table-wrap"><table id="fieldAuditTable"></table></div>
    </details>`;
  const issues = $('workflowIssues');
  if (issues) issues.insertAdjacentElement('afterend', panel);
  else $('importSummary')?.insertAdjacentElement('afterend', panel);
}

function confirmationLabel(item) {
  const scope = item.slot_type === 'ingredient' ? '食材槽' : item.slot_type === 'subskill' ? '副技能槽' : (item.field || '欄位');
  const levels = Array.isArray(item.unlock_levels) ? item.unlock_levels.join('／') : (item.unlock_level ?? '—');
  return `${scope} ${levels} 目前未顯示`;
}
function workflowErrorCount() { return document.querySelectorAll('#workflowIssues .status-conflict').length; }
function traceDryRunEligibility(reason) {
  const enabled = Boolean($('dryRunBtn') && !$('dryRunBtn').disabled);
  if (enabled === lastDryRunEnabled && reason !== 'canonical_handshake') return;
  lastDryRunEnabled = enabled;
  debugTrace.record('update_center','dry_run_eligibility_changed',{status:'completed',details:{enabled,reason,workflow_error_count:workflowErrorCount()}});
}

function reviewPayload() {
  if (!loadedPayload) return null;
  return {
    ...loadedPayload,
    profile_audit_confirmations: Array.isArray(loadedPayload.profile_audit_confirmations)
      ? loadedPayload.profile_audit_confirmations.map(item=>({...item,status:'user_confirmed_not_visible',confirmed_by_user:true,confirmed_at:item.confirmed_at||'review-preview-only',confirmation_scope:'review_preview_only'}))
      : loadedPayload.profile_audit_confirmations,
  };
}
function refreshReviewPreview() {
  reviewPreview = null;
  const payload = reviewPayload();
  if (!payload) return;
  try {
    reviewPreview = dryRun(payload);
    debugTrace.record('update_center','human_diff_review_ready',{status:'completed',details:{operation_count:reviewPreview.operation_count,conflict_count:reviewPreview.conflict_count}});
  } catch (error) {
    debugTrace.record('update_center','human_diff_review_unavailable',{status:'blocked',details:{reason:error.message}});
  }
}
function pokemonIdOf(change){ return change?.key?.pokemon_id || change?.original_key?.pokemon_id || change?.before?.pokemon_id || change?.after?.pokemon_id || ''; }
function changesForPokemon(pokemonId){ return (reviewPreview?.changes || []).filter(change=>pokemonIdOf(change)===pokemonId); }
function primaryPokemonChange(changes){ return changes.find(c=>c.entity==='pokemon') || null; }
function visibleDiffCount(changes){
  let count=0;
  for(const change of changes){
    if(change.entity==='pokemon') count += (change.field_audit||[]).filter(a=>!META_FIELDS.has(a.field)&&!same(a.existing,a.effective)).length;
    if(change.entity==='pokemon_ingredients'||change.entity==='pokemon_subskills') count += (change.field_audit||[]).some(a=>!same(a.existing,a.effective)) ? 1 : 0;
  }
  return count;
}
function evidenceDiffCount(changes){
  return changes.filter(change=>EVIDENCE_ENTITIES.has(change.entity) && (change.field_audit||[]).some(a=>!same(a.existing,a.effective))).length;
}
function abilityGrid(change){
  const before=change?.before||{}, after=change?.after||before;
  return `<div class="review-detail-grid">${DETAIL_FIELDS.map(field=>{
    const changed=!same(before[field],after[field]);
    return `<div class="review-detail-card ${changed?'changed':'unchanged'}"><b>${esc(fieldLabel(field))}</b><div class="review-value-current">${htmlValue(field,after[field])}</div>${changed?`<div class="review-value-diff"><span class="before">${htmlValue(field,before[field])}</span><span class="arrow">→</span><span class="after">${htmlValue(field,after[field])}</span></div>`:'<small>未變更</small>'}</div>`;
  }).join('')}</div>`;
}
function slotRows(changes,entity,levels){
  const map=new Map(changes.filter(c=>c.entity===entity).map(c=>[Number(c.key?.unlock_level),c]));
  return levels.map(level=>{
    const c=map.get(level), before=c?.before||null, after=c?.after||before;
    const isIngredient=entity==='pokemon_ingredients';
    const oldText=before ? (isIngredient?`${before.ingredient_name||'尚未匯入'}${before.quantity?` × ${before.quantity}`:''}`:(before.subskill_name||'尚未匯入')) : '尚未匯入';
    const newText=after ? (isIngredient?`${after.ingredient_name||'尚未匯入'}${after.quantity?` × ${after.quantity}`:''}`:(after.subskill_name||'尚未匯入')) : '尚未匯入';
    const changed=!same(oldText,newText);
    return `<div class="review-skill-item ${changed?'changed':'unchanged'}"><b>Lv${level}</b><span class="review-skill-current">${esc(newText)}</span>${changed?`<small><span class="before">${esc(oldText)}</span> → <span class="after">${esc(newText)}</span></small>`:'<small>未變更</small>'}</div>`;
  }).join('');
}
function semanticPokemonPreview(pokemonId,pokemonLabel){
  const changes=changesForPokemon(pokemonId);
  if(!reviewPreview || !changes.length) return '<p class="profile-preview-empty">暫時無法建立資料庫差異預覽；請先確認 JSON 身份與 Dry Run 結果。</p>';
  const pokemonChange=primaryPokemonChange(changes);
  const after=pokemonChange?.after||pokemonChange?.before||{};
  const visible=visibleDiffCount(changes), evidence=evidenceDiffCount(changes);
  const subtitle=[after.nickname||'未設定暱稱',after.specialty||'未分類',after.type||'未確認'].join(' · ');
  return `<div class="semantic-review">
    <div class="semantic-review-head"><div><span class="detail-rating">${esc(after.rating||'未評級')}</span><h4>${esc(after.original_label||after.species||pokemonLabel||pokemonId)}</h4><p>${esc(subtitle)}</p></div><span class="badge ${visible?'pending':'ok'}">${visible?`${visible} 項玩家資料差異`:'玩家資料無差異'}</span></div>
    ${visible===0?`<div class="no-player-change"><b>✓ 此次不會改變可見的寶可夢能力</b><span>${evidence?`偵測到 ${evidence} 筆 Evidence／來源 metadata 更新。`:'目前資料與更新包相同。'}</span></div>`:''}
    ${abilityGrid(pokemonChange)}
    <div class="review-section"><h4>食材配置</h4><div class="review-skill-list">${slotRows(changes,'pokemon_ingredients',[1,30,60])}</div></div>
    <div class="review-section"><h4>副技能</h4><div class="review-skill-list">${slotRows(changes,'pokemon_subskills',[10,25,50,70,80])}</div></div>
    <details class="metadata-summary"><summary>辨識／來源異動 ${evidence} 筆</summary><p class="notice">Identity fingerprint、來源圖片、confidence、source_update_id 等系統欄位不列入玩家能力差異；可在進階欄位決策明細查看。</p></details>
  </div>`;
}

async function synchronizeCanonicalPayload(reason='confirmation_change') {
  if (!loadedPayload || handshakeInFlight) return false;
  const input=$('jsonFile'); if(!input) return false;
  handshakeInFlight=true;
  const confirmations=Array.isArray(loadedPayload.profile_audit_confirmations)?loadedPayload.profile_audit_confirmations:[];
  const confirmedCount=confirmations.filter(item=>item.confirmed_by_user===true).length;
  debugTrace.record('update_center','canonical_payload_rebuilt',{status:'completed',details:{reason,confirmation_count:confirmations.length,confirmed_count:confirmedCount}});
  try{
    const file=new File([JSON.stringify(loadedPayload,null,2)],loadedFileName||`pokemon_sleep_confirmed_${Date.now()}.json`,{type:'application/json'});
    const mainHandler=input.onchange;
    if(typeof mainHandler!=='function') throw new Error('update_center_main_file_handler_unavailable');
    await mainHandler.call(input,{target:{files:[file]},currentTarget:input,type:'change'});
    debugTrace.record('update_center','main_state_payload_reloaded',{status:'completed',details:{reason,confirmation_count:confirmations.length,confirmed_count:confirmedCount}});
    debugTrace.record('update_center','workflow_validation_completed',{status:'completed',details:{reason,error_count:workflowErrorCount(),dry_run_enabled:Boolean($('dryRunBtn')&&!$('dryRunBtn').disabled)}});
    traceDryRunEligibility('canonical_handshake');
    return true;
  }catch(error){ debugTrace.record('update_center','canonical_payload_handshake_failed',{status:'failed',details:{reason},error}); throw error; }
  finally{ handshakeInFlight=false; }
}

function renderConfirmations(){
  const target=$('profileAuditConfirmation'); if(!target)return;
  const items=Array.isArray(loadedPayload?.profile_audit_confirmations)?loadedPayload.profile_audit_confirmations:[];
  const progress=$('profileAuditProgress');
  if(!items.length){ if(progress){progress.textContent='無待確認';progress.className='badge ok';} target.innerHTML='<p>此更新包沒有「未顯示槽位」確認項目。</p>'; return; }
  const confirmedCount=items.filter(item=>item.status==='user_confirmed_not_visible'&&item.confirmed_by_user===true).length;
  if(progress){progress.textContent=`${confirmedCount}/${items.length}`;progress.className=confirmedCount===items.length?'badge ok':'badge pending';}
  const groups=new Map();
  items.forEach((item,index)=>{const key=item.pokemon_id||item.pokemon_label||`item-${index}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({item,index});});
  target.innerHTML=`<p class="notice update-review-instruction">以下不是 JSON 原始欄位，而是「目前 SQLite → 匯入後」的人類可讀能力預覽。紅／綠差異才是本次會改變的玩家資料。</p><div class="profile-confirmation-groups">${[...groups.entries()].map(([key,entries])=>{
    const first=entries[0].item,label=first.pokemon_label||first.pokemon_id||key,groupConfirmed=entries.filter(({item})=>item.confirmed_by_user===true).length;
    return `<article class="profile-confirmation-card" data-profile-group="${esc(key)}"><div class="profile-confirmation-card-head"><div><strong>${esc(label)}</strong><small>${groupConfirmed}/${entries.length} 已確認</small></div></div>${semanticPokemonPreview(first.pokemon_id,first.pokemon_label)}<div class="profile-confirmation-checks">${entries.map(({item,index})=>`<label class="profile-confirmation-check"><input type="checkbox" data-profile-confirmation="${index}" ${item.confirmed_by_user===true?'checked':''}><span><b>${esc(confirmationLabel(item))}</b><small>${item.confirmed_by_user===true?'已採納目前辨識結果':'待人工核對'}</small></span></label>`).join('')}</div></article>`;
  }).join('')}</div><div class="buttons update-review-actions"><button id="acceptProfileAuditBtn">全部採納目前辨識結果</button></div>`;
  target.querySelectorAll('[data-profile-confirmation]').forEach(checkbox=>checkbox.addEventListener('change',async()=>{
    const index=Number(checkbox.dataset.profileConfirmation),confirmedAt=new Date().toISOString(),next=[...items];
    next[index]={...next[index],status:'user_confirmed_not_visible',confirmed_by_user:checkbox.checked,confirmed_at:checkbox.checked?confirmedAt:null,confirmation_scope:checkbox.checked?'current_observation':null};
    loadedPayload={...loadedPayload,profile_audit_confirmations:next};
    debugTrace.record('update_center','profile_confirmation_checkbox_changed',{status:'completed',details:{index,confirmed:checkbox.checked}});
    await synchronizeCanonicalPayload('single_confirmation'); refreshReviewPreview(); renderConfirmations();
  }));
  $('acceptProfileAuditBtn')?.addEventListener('click',async()=>{
    const confirmedAt=new Date().toISOString();
    loadedPayload={...loadedPayload,profile_audit_confirmations:items.map(item=>({...item,status:'user_confirmed_not_visible',confirmed_by_user:true,confirmed_at:confirmedAt,confirmation_scope:'current_observation'}))};
    debugTrace.record('update_center','profile_audit_confirmed',{status:'completed',details:{confirmation_count:items.length,empty_slots_preserved:true}});
    await synchronizeCanonicalPayload('accept_all_confirmations'); refreshReviewPreview(); renderConfirmations();
  });
}

function decisionText(decision){return ({preserve_existing_empty_incoming:'保留既有值',ignore_empty_incoming:'忽略空值',explicit_clear:'明確清空',same_value:'值相同',update_non_empty:'更新有效值',insert_non_empty:'新增有效值',unchanged:'不變'})[decision]||decision;}
function renderAudit(preview){
  const summary=$('fieldAuditSummary'),table=$('fieldAuditTable'); if(!summary||!table)return;
  const audit=preview.audit_summary||{};
  summary.innerHTML=`情境：<b>${esc(preview.scenario||'general')}</b>；欄位：<b>${audit.field_count||0}</b>；保留既有值：<b>${audit.preserved_existing_count||0}</b>；明確清空：<b>${audit.explicit_clear_count||0}</b>；有效更新：<b>${audit.non_empty_update_count||0}</b>；用戶確認：<b>${audit.profile_confirmation_count||0}</b>`;
  const records=preview.changes.flatMap(change=>(change.field_audit||[]).map(field=>({operation:change.index+1,entity:change.entity,key:JSON.stringify(change.key),...field})));
  table.innerHTML=records.length?`<thead><tr><th>#</th><th>實體</th><th>Key</th><th>欄位</th><th>既有值</th><th>輸入值</th><th>決策</th><th>套用後</th></tr></thead><tbody>${records.map(row=>`<tr><td>${row.operation}</td><td>${esc(row.entity)}</td><td><code>${esc(row.key)}</code></td><td>${esc(fieldLabel(row.field))}</td><td>${esc(fmt(row.field,row.existing))}</td><td>${esc(fmt(row.field,row.incoming))}</td><td>${esc(decisionText(row.decision))}</td><td>${esc(fmt(row.field,row.effective))}</td></tr>`).join('')}</tbody>`:'<tbody><tr><td>沒有可稽核欄位。</td></tr></tbody>';
}
function bind(){
  ensurePanel();
  $('jsonFile')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0]; if(!file||handshakeInFlight)return;
    try{ loadedPayload=JSON.parse(await file.text()); loadedFileName=file.name; refreshReviewPreview(); debugTrace.record('update_center','json_file_loaded',{status:'completed',details:{confirmation_count:Array.isArray(loadedPayload?.profile_audit_confirmations)?loadedPayload.profile_audit_confirmations.length:0}}); renderConfirmations(); $('fieldAuditSummary').textContent='JSON 已載入；請先查看人類可讀差異、完成必要確認，再執行 Dry Run。'; $('fieldAuditTable').innerHTML=''; queueMicrotask(()=>traceDryRunEligibility('json_file_loaded')); }
    catch{ loadedPayload=null; reviewPreview=null; }
  });
  $('dryRunBtn')?.addEventListener('click',()=>{
    const blocked=Boolean($('dryRunBtn')?.disabled); debugTrace.record('update_center',blocked?'dry_run_blocked':'dry_run_started',{status:blocked?'blocked':'started',details:{workflow_error_count:workflowErrorCount()}});
    setTimeout(()=>{if(!loadedPayload||blocked)return;try{const preview=dryRun(loadedPayload);reviewPreview=preview;renderAudit(preview);renderConfirmations();debugTrace.record('update_center','dry_run_completed',{status:'completed',details:{operation_count:preview.operation_count,ready_count:preview.ready_count,conflict_count:preview.conflict_count}});}catch(error){$('fieldAuditSummary').textContent=`欄位稽核尚未完成：${error.message}`;debugTrace.record('update_center','dry_run_blocked',{status:'blocked',details:{reason:error.message,workflow_error_count:workflowErrorCount()}});}},0);
  },true);
}
window.addEventListener('DOMContentLoaded',bind,{once:true});
