import {rows} from './database.js';
import {
  isPublicMasterRecognitionPayload,
  compilePublicMasterRecognitionToUpdatePackage,
} from './public-master-recognition.js';
import {
  INGREDIENT_INVENTORY_INTEGRITY_VERSION,
  buildIngredientAbsenceCandidates,
  ingredientNamesFromUpdatePackage,
  applyIngredientAbsenceConfirmations,
  validateIngredientAbsenceConfirmationPackage,
} from './ingredient-inventory-integrity-contract.js';

const STYLE_ID='ingredientInventoryIntegrityStyle';
const REVIEW_CLASS='ingredient-absence-review';
let scheduled=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean=value=>String(value??'').trim();

function extractJson(text){
  const source=clean(text);if(!source)return null;
  const fenced=source.match(/```(?:json)?\s*([\s\S]*?)```/i);return JSON.parse((fenced?.[1]||source).trim());
}
function ingredientPanel(){return document.querySelector('#ucImgA .uc-img-scenario[data-scenario="ingredients"]');}
function coverage(panel){return panel?.querySelector('.uc-img-coverage')?.value||'PARTIAL';}
function imageRefs(){
  return [...document.querySelectorAll('#ucImgA .uc-img-card')]
    .filter(card=>card.querySelector('.uc-img-classify')?.value==='ingredients')
    .map(card=>clean(card.querySelector('.uc-img-ref')?.textContent)).filter(Boolean);
}
function establishedRows(){
  try{return rows(`SELECT ingredient_name,quantity FROM ingredient_catalog_state WHERE player_record_exists=1 ORDER BY ingredient_name`);}catch{return [];}
}
function sourceState(panel){
  const textarea=panel?.querySelector('.uc-img-response');if(!textarea)return {textarea:null,raw:null,compiled:null,unresolved:[],errors:[]};
  let raw=null;try{raw=extractJson(textarea.value);}catch(error){return {textarea,raw:null,compiled:null,unresolved:[],errors:[`AI JSON 尚無法解析：${error.message}`]};}
  if(!raw)return {textarea,raw:null,compiled:null,unresolved:[],errors:[]};
  if(isPublicMasterRecognitionPayload(raw)){
    const refs=[...new Set((raw.observations||[]).map(item=>item?.source_image_ref).filter(Boolean))];
    const compiled=compilePublicMasterRecognitionToUpdatePackage(raw,'ingredients',{allowedImageRefs:refs});
    return {textarea,raw,compiled:compiled.update_package,unresolved:compiled.unresolved||[],errors:compiled.errors||[],source_kind:'recognition'};
  }
  return {textarea,raw,compiled:raw,unresolved:[],errors:[],source_kind:'update_package'};
}
function confirmationsFrom(state){return Array.isArray(state?.compiled?.inventory_absence_confirmations)?state.compiled.inventory_absence_confirmations:[];}
function reviewState(panel){
  const state=sourceState(panel),currentCoverage=coverage(panel);
  if(!state.compiled)return {...state,coverage:currentCoverage,candidates:[],confirmations:[],blocked_reason:null};
  const confirmations=confirmationsFrom(state);
  const recognized=ingredientNamesFromUpdatePackage(state.compiled);
  const candidates=buildIngredientAbsenceCandidates({coverage:currentCoverage,recognizedIngredientNames:recognized,establishedInventoryRows:establishedRows(),confirmations});
  let blockedReason=null;
  if(currentCoverage==='USER_CONFIRMED_COMPLETE'&&state.unresolved.length)blockedReason='請先完成 Public Master Recognition 的 AMBIGUOUS / UNMATCHED 覆核，再判斷完整庫存缺席項目。';
  if(currentCoverage==='USER_CONFIRMED_COMPLETE'&&state.errors.length)blockedReason=state.errors[0];
  return {...state,coverage:currentCoverage,candidates,confirmations,blocked_reason:blockedReason};
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;
  style.textContent=`.${REVIEW_CLASS}{margin:10px 0;padding:12px;border:1px solid #e3c87a;border-radius:10px;background:#fffaf0}.ingredient-absence-card{padding:10px;margin-top:8px;border:1px solid #ead9a4;border-radius:9px;background:#fff}.ingredient-absence-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.ingredient-absence-actions button{flex:1 1 150px}.ingredient-absence-resolved{color:#1f7a5a;font-weight:750}.ingredient-absence-blocked{color:#8a5b00;font-weight:700}.ingredient-integrity-badge{display:inline-block;margin-left:6px;font-size:.75rem;color:#687d74}@media(max-width:700px){.${REVIEW_CLASS}{padding:10px}.ingredient-absence-actions{display:grid;grid-template-columns:1fr}.ingredient-absence-actions button{width:100%}}`;
  document.head.appendChild(style);
}
function resolutionLabel(value){return value==='CONFIRMED_EXHAUSTED'?'已確認用罄 → 0':value==='PRESERVE_EXISTING_NOT_CAPTURED'?'照片未拍到 → 保留既有值':'待確認';}
function render(){
  scheduled=false;ensureStyle();const panel=ingredientPanel();if(!panel)return;
  panel.querySelector(`.${REVIEW_CLASS}`)?.remove();
  const state=reviewState(panel);if(state.coverage!=='USER_CONFIRMED_COMPLETE'||!state.compiled)return;
  const host=document.createElement('section');host.className=REVIEW_CLASS;host.dataset.integrityVersion=INGREDIENT_INVENTORY_INTEGRITY_VERSION;
  if(state.blocked_reason){host.innerHTML=`<b>完整庫存缺席覆核</b><span class="ingredient-integrity-badge">${esc(INGREDIENT_INVENTORY_INTEGRITY_VERSION)}</span><div class="ingredient-absence-blocked">${esc(state.blocked_reason)}</div>`;insert(panel,host);return;}
  if(!state.candidates.length){host.innerHTML=`<b>完整庫存缺席覆核</b><span class="ingredient-integrity-badge">PASS</span><div class="notice">所有既有已建立食材都已在本次完整截圖中出現，或已有明確缺席處理紀錄；不會因 null / missing 自動歸零。</div>`;insert(panel,host);return;}
  const unresolved=state.candidates.filter(item=>item.status!=='RESOLVED');
  host.innerHTML=`<b>完整庫存中未找到的已建立食材：${state.candidates.length}</b><span class="ingredient-integrity-badge">待確認 ${unresolved.length}</span><div class="notice">缺席本身不是 0。只有你明確確認「已用罄」才會建立 quantity=0；「照片未拍到」會保留 SQLite 既有值。</div>${state.candidates.map(item=>`<article class="ingredient-absence-card" data-name="${esc(item.ingredient_name)}"><div><b>${esc(item.ingredient_name)}</b> · 目前 SQLite：<b>${item.previous_quantity}</b></div>${item.status==='RESOLVED'?`<div class="ingredient-absence-resolved">${esc(resolutionLabel(item.resolution))}</div>`:`<div class="ingredient-absence-actions"><button data-resolution="CONFIRMED_EXHAUSTED">已用罄 → 更新為 0</button><button data-resolution="PRESERVE_EXISTING_NOT_CAPTURED">照片沒拍到 → 保留 ${item.previous_quantity}</button><button data-resolution="AI_REVIEW">AI 漏判／辨識錯誤</button></div>`}</article>`).join('')}`;
  insert(panel,host);bindCards(panel,host,state);
}
function insert(panel,host){const issues=panel.querySelector('.uc-img-issues');if(issues)issues.insertAdjacentElement('afterend',host);else panel.appendChild(host);}
function mergedConfirmations(state,name,resolution,previousQuantity){
  const map=new Map((state.confirmations||[]).map(item=>[item.ingredient_name,{...item}]));
  map.set(name,{ingredient_name:name,previous_quantity:previousQuantity,resolution,confirmed_by_user:true,confirmed_at:new Date().toISOString()});return [...map.values()];
}
function commitResolution(panel,state,item,resolution){
  if(resolution==='AI_REVIEW'){
    alert(`請回到 AI JSON／Public Master Recognition 檢查「${item.ingredient_name}」是否漏判。此項仍維持 REVIEW_REQUIRED，不會套用 0。`);panel.querySelector('.uc-img-response')?.focus();return;
  }
  if(resolution==='CONFIRMED_EXHAUSTED'&&!confirm(`確認「${item.ingredient_name}」目前已用罄，將以明確 quantity=0 覆蓋既有 ${item.previous_quantity}？`))return;
  if(resolution==='PRESERVE_EXISTING_NOT_CAPTURED'&&!confirm(`確認本次完整庫存截圖沒有拍到「${item.ingredient_name}」，保留既有數量 ${item.previous_quantity}？`))return;
  const refs=[...new Set([...imageRefs(),...(state.compiled.operations||[]).flatMap(operation=>[operation?.evidence?.source_image_ref,...(operation?.evidence?.source_image_refs||[])]).filter(Boolean))];
  const confirmations=mergedConfirmations(state,item.ingredient_name,resolution,item.previous_quantity);
  const payload=applyIngredientAbsenceConfirmations(state.compiled,confirmations,{sourceImageRefs:refs});
  state.textarea.value=JSON.stringify(payload,null,2);state.textarea.dispatchEvent(new Event('input',{bubbles:true}));
  panel.querySelector('.uc-img-parse')?.click();setTimeout(schedule,0);
}
function bindCards(panel,host,state){
  host.querySelectorAll('.ingredient-absence-card').forEach(card=>{const item=state.candidates.find(candidate=>candidate.ingredient_name===card.dataset.name);if(!item)return;card.querySelectorAll('[data-resolution]').forEach(button=>button.addEventListener('click',()=>commitResolution(panel,state,item,button.dataset.resolution)));});
}
function gateAction(event){
  const target=event.target instanceof Element?event.target.closest('.uc-img-dry,.uc-img-apply'):null;if(!target)return;
  const panel=target.closest('.uc-img-scenario[data-scenario="ingredients"]');if(!panel||coverage(panel)!=='USER_CONFIRMED_COMPLETE')return;
  const state=reviewState(panel);const unresolved=state.candidates.filter(item=>item.status!=='RESOLVED');
  const validation=state.compiled?validateIngredientAbsenceConfirmationPackage(state.compiled,{coverage:state.coverage}):{ok:true,errors:[]};
  if(state.blocked_reason||unresolved.length||!validation.ok){
    event.preventDefault();event.stopImmediatePropagation();
    const reason=state.blocked_reason||validation.errors?.[0]||`仍有 ${unresolved.length} 個完整庫存缺席項目尚未確認。`;
    alert(`Ingredient Inventory Integrity Gate：${reason}`);schedule();
  }
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(render,0);}
function boot(){
  ensureStyle();document.addEventListener('click',gateAction,true);document.addEventListener('input',event=>{if(event.target?.matches?.('#ucImgA .uc-img-response'))schedule();},true);document.addEventListener('change',event=>{if(event.target?.matches?.('#ucImgA .uc-img-coverage,#ucImgA .uc-img-classify'))schedule();},true);window.addEventListener('pokemon-sleep:data-changed',schedule);
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true});schedule();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}

export {reviewState};