import {rows} from './database.js';

const BUILD='20260804-v0379-canonical-commit-gate';
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function resolve(entityType,rawValue){
  const raw=String(rawValue??'').normalize('NFKC').trim();
  if(!raw)return {raw_value:raw,canonical_value:'',resolution:'EMPTY',confidence:0,requires_review:true};
  const exact=rows(`SELECT term_id,canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1`,[entityType,raw])[0];
  if(exact)return {raw_value:raw,canonical_value:exact.canonical_name_zh_tw,term_id:exact.term_id,resolution:'CANONICAL_EXACT',confidence:1,requires_review:false};
  const alias=rows(`SELECT t.term_id,t.canonical_name_zh_tw,a.confidence,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`,[entityType,raw])[0];
  if(alias)return {raw_value:raw,canonical_value:alias.canonical_name_zh_tw,term_id:alias.term_id,resolution:alias.is_auto_replace_safe?'CANONICAL_ALIAS_SAFE':'CANONICAL_ALIAS_REVIEW',confidence:Number(alias.confidence||0),requires_review:!alias.is_auto_replace_safe};
  return {raw_value:raw,canonical_value:'',resolution:'CANONICAL_UNKNOWN',confidence:0,requires_review:true};
}

function panel(root){
  let node=root.querySelector('#canonicalCommitGateStatus');
  if(!node){
    node=document.createElement('section');node.id='canonicalCommitGateStatus';node.className='notice';
    const target=root.querySelector('#captureGroupStatus')||root.querySelector('.analysis-confirmation header');
    target?.insertAdjacentElement('afterend',node);
  }
  return node;
}

function parseIngredients(root){
  const textarea=root.querySelector('[data-json-field="ingredients"]');
  if(!textarea)return {textarea,items:[]};
  let value;
  try{value=JSON.parse(textarea.value||'[]');}catch{throw new Error('食材 JSON 格式錯誤');}
  if(!Array.isArray(value))throw new Error('食材 JSON 必須是陣列');
  return {textarea,items:value};
}

function canonicalizeIngredients(root){
  const {textarea,items}=parseIngredients(root);
  const report=[];
  const normalized=items.map((item,index)=>{
    const raw=item?.ingredient_name??item?.name??'';
    const resolution=resolve('ingredient',raw);
    report.push({index,unlock_level:item?.unlock_level??item?.level??[1,30,60][index],...resolution});
    return {...item,ingredient_name:resolution.canonical_value||String(raw||'').trim(),canonical_source_value:String(raw||'').trim(),canonical_resolution:resolution.resolution,canonical_term_id:resolution.term_id||null};
  });
  if(textarea)textarea.value=JSON.stringify(normalized,null,2);
  return report;
}

function render(root,report,blocked){
  const node=panel(root);
  if(!node)return;
  const safe=report.filter((item)=>item.resolution==='CANONICAL_ALIAS_SAFE');
  node.className=`notice ${blocked.length?'error':'success'}`;
  node.innerHTML=`<b>Canonical 正規名詞 Gate</b><br>食材 ${report.length} 筆；完全一致 ${report.filter((item)=>item.resolution==='CANONICAL_EXACT').length}；安全修正 ${safe.length}；需覆核／未知 ${blocked.length}`+
    (safe.length?`<details><summary>已自動修正</summary>${safe.map((item)=>`${esc(item.raw_value)} → <b>${esc(item.canonical_value)}</b>`).join('<br>')}</details>`:'')+
    (blocked.length?`<details open><summary>阻擋項目</summary>${blocked.map((item)=>`Lv${esc(item.unlock_level)}：${esc(item.raw_value||'空白')} · ${esc(item.resolution)}${item.canonical_value?` · 建議 ${esc(item.canonical_value)}`:''}`).join('<br>')}</details><small>請將食材 JSON 改成公版正式名稱後再次確認寫入。</small>`:'<br><small>所有食材名稱已通過公版主檔；正式寫入仍由人工確認、Snapshot 與 Transaction 控制。</small>');
}

function gate(event){
  const button=event.target.closest?.('#applyConfirmedAnalysis');if(!button)return;
  const root=document.getElementById('analysisConfirmationWorkbench');if(!root)return;
  try{
    const report=canonicalizeIngredients(root);
    const blocked=report.filter((item)=>item.requires_review||!item.canonical_value);
    render(root,report,blocked);
    globalThis.UpdateCenterLiveDebug?.record?.('canonical_commit_gate_checked',{ingredient_count:report.length,safe_alias_count:report.filter((item)=>item.resolution==='CANONICAL_ALIAS_SAFE').length,blocked_count:blocked.length,registry_version:rows("SELECT value_json FROM settings WHERE key='canonical_registry_version'")[0]?.value_json||null});
    if(blocked.length){event.preventDefault();event.stopImmediatePropagation();throw new Error(`有 ${blocked.length} 筆食材名稱尚未通過 Canonical Gate`);}
  }catch(error){
    event.preventDefault();event.stopImmediatePropagation();
    const status=root.querySelector('#analysisConfirmationStatus');if(status){status.className='notice error';status.textContent=`正式寫入已阻擋：${error.message}`;}
    globalThis.UpdateCenterLiveDebug?.record?.('canonical_commit_gate_blocked',{message:error.message});
  }
}

window.addEventListener('click',gate,true);
window.addEventListener('pokemon-sleep:analysis-revision-saved',()=>setTimeout(()=>{
  const root=document.getElementById('analysisConfirmationWorkbench');if(!root)return;
  try{const report=canonicalizeIngredients(root);render(root,report,report.filter((item)=>item.requires_review||!item.canonical_value));}catch{}
},0));
window.dispatchEvent(new CustomEvent('pokemon-sleep:canonical-commit-gate-ready',{detail:{build:BUILD,entities:['ingredient']}}));
