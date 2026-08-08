const $=id=>document.getElementById(id);
let scheduled=false,installed=false;

function ensureStyle(){if($('v03992GuidedStyle'))return;const style=document.createElement('style');style.id='v03992GuidedStyle';style.textContent=`
.guided-update-flow{margin:12px 0 18px;padding:14px;border:1px solid #d8e4df;border-radius:14px;background:#fff}.guided-update-flow h3{margin:0 0 6px}.guided-update-flow>p{margin:0 0 12px}.guided-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.guided-step{padding:10px;border-radius:10px;background:#f2f6f4;border:1px solid #e1e8e5;min-height:72px}.guided-step b{display:block;margin-bottom:4px}.guided-step small{display:block;line-height:1.45}.guided-step.done{background:#e7f5ee;border-color:#b9dfcd}.guided-step.active{background:#fff6d8;border-color:#ead48a}.guided-step.blocked{background:#f8eeee;border-color:#e6c5c5}.guided-review-required{background:#fff7dd!important;color:#6d5612!important;border-left:4px solid #dfbd49;padding:7px 9px;border-radius:6px}.guided-dryrun-note{margin:10px 0;padding:10px 12px;border-radius:10px;background:#edf7f2}.guided-dryrun-note.warning{background:#fff6d8}.raw-dryrun-details{margin-top:12px}.raw-dryrun-details>summary{cursor:pointer;font-weight:700}.raw-dryrun-details .table-wrap{margin-top:10px}#workflowSummary{max-height:7.5em;overflow:auto;overflow-wrap:anywhere}#workflowIssues{max-height:18rem;overflow:auto;overflow-wrap:anywhere}@media(max-width:720px){.guided-steps{grid-template-columns:1fr 1fr}.guided-step{min-height:64px}#workflowSummary{max-height:6.5em}#workflowIssues{max-height:14rem}}`;
document.head.appendChild(style);}

function ensureFlow(){const updates=$('updates');if(!updates)return null;let flow=$('guidedUpdateFlow');if(flow)return flow;flow=document.createElement('section');flow.id='guidedUpdateFlow';flow.className='guided-update-flow';flow.innerHTML=`<h3>更新流程</h3><p class="notice">依序完成資料檢查、必要覆核、Dry Run、確認套用。Dry Run 不會寫入 SQLite；只有最後「套用更新」才會修改玩家資料。</p><div class="guided-steps"><div id="guidedStep1" class="guided-step"><b>1. 載入與檢查</b><small>選擇 JSON 並確認結構。</small></div><div id="guidedStep2" class="guided-step"><b>2. 覆核差異</b><small>若有「目前未顯示」欄位，先人工確認。</small></div><div id="guidedStep3" class="guided-step"><b>3. Dry Run</b><small>預演資料庫差異，不寫入資料。</small></div><div id="guidedStep4" class="guided-step"><b>4. 套用更新</b><small>確認 Dry Run 結果後才可正式寫入。</small></div></div><div id="guidedActionHint" class="guided-dryrun-note">請先選擇 JSON。</div>`;const heading=updates.querySelector('h2');heading?.insertAdjacentElement('afterend',flow);return flow;}

function ensureRawDetails(){const table=$('changeTable');const wrap=table?.closest('.table-wrap');if(!wrap||wrap.closest('#rawDryRunDetails'))return;const details=document.createElement('details');details.id='rawDryRunDetails';details.className='raw-dryrun-details';details.innerHTML='<summary>進階：原始資料庫變更明細（JSON／機器欄位）</summary><p class="notice">一般比對請以上方「匯入內容確認」的人類可讀 Before → After 為準；此表僅供進階稽核與除錯。</p>';wrap.parentNode.insertBefore(details,wrap);details.appendChild(wrap);}

function reviewProgress(){const badge=$('profileAuditProgress');const text=badge?.textContent?.trim()||'';const match=text.match(/(\d+)\s*\/\s*(\d+)/);if(match)return {confirmed:Number(match[1]),total:Number(match[2]),text};const cards=document.querySelectorAll('#profileAuditConfirmation input[type="checkbox"]');const checked=Array.from(cards).filter(x=>x.checked).length;return {confirmed:checked,total:cards.length,text};}
function workflowLoaded(){return Boolean($('jsonFile')?.files?.length)||!/尚未選擇更新包/.test($('workflowSummary')?.textContent||'');}
function dryRunComplete(){const text=$('importSummary')?.textContent?.trim()||'';return Boolean(text)&&!text.includes('尚未執行 Dry Run');}
function appliedReadonly(){return ($('profileAuditDryRunState')?.textContent||'').includes('唯讀比對模式');}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function setClass(el,className){if(el&&el.className!==className)el.className=className;}
function setStep(id,status,detail){const el=$(id);if(!el)return;const desired=`guided-step${status?` ${status}`:''}`;setClass(el,desired);setText(el.querySelector('small'),detail);}
function setHint(hint,text,warning=false){if(!hint)return;setClass(hint,`guided-dryrun-note${warning?' warning':''}`);setText(hint,text);}

function relabelReviewIssues(){let pending=0;document.querySelectorAll('#workflowIssues .status-conflict').forEach(el=>{if(!el.textContent.includes('profile_audit_confirmations'))return;pending+=1;if(!el.classList.contains('guided-review-required'))el.classList.add('guided-review-required');if(/^錯誤\s*[：:]/.test(el.textContent))el.textContent=el.textContent.replace(/^錯誤\s*[：:]/,'待確認：');});return pending;}
function normalizeWorkflowSummary(pending){
  const el=$('workflowSummary');if(!el)return;
  const text=el.textContent||'';
  const normalized=text.match(/結構錯誤：\s*(\d+)\s*；\s*待人工確認：\s*(\d+)/);
  if(normalized){const replacement=`結構錯誤：${Number(normalized[1])}；待人工確認：${Number(pending||0)}`;setText(el,text.replace(normalized[0],replacement));return;}
  if(!pending)return;
  const match=text.match(/(^|[；\s])錯誤：\s*(\d+)/);if(!match)return;
  const structural=Math.max(0,Number(match[2])-pending);setText(el,text.replace(match[0],`${match[1]}結構錯誤：${structural}；待人工確認：${pending}`));
}

function render(){scheduled=false;ensureStyle();if(!ensureFlow())return;ensureRawDetails();const pendingIssues=relabelReviewIssues();normalizeWorkflowSummary(pendingIssues);const loaded=workflowLoaded(),review=reviewProgress(),readonly=appliedReadonly(),dryDone=dryRunComplete(),dryBtn=$('dryRunBtn'),applyBtn=$('applyBtn'),hint=$('guidedActionHint');
  if(!loaded){setStep('guidedStep1','active','請選擇 JSON 並執行結構檢查。');setStep('guidedStep2','', '等待 JSON。');setStep('guidedStep3','', '等待資料檢查。');setStep('guidedStep4','', '等待 Dry Run。');setHint(hint,'請先選擇 JSON。');return;}
  setStep('guidedStep1','done','JSON 已載入；請查看結構檢查結果。');
  if(review.total&&review.confirmed<review.total){setStep('guidedStep2','active',`需人工確認 ${review.confirmed}/${review.total}；完成後才會解鎖 Dry Run。`);setStep('guidedStep3','blocked','目前被人工覆核 Gate 鎖定。');setStep('guidedStep4','', '等待 Dry Run。');setHint(hint,`下一步：請往下完成 ${review.confirmed}/${review.total} 項「目前未顯示」覆核。這些是待確認，不代表 JSON 結構錯誤。`,true);return;}
  setStep('guidedStep2','done',review.total?`必要覆核已完成 ${review.confirmed}/${review.total}。`:'本包沒有需要人工確認的項目。');
  if(readonly){setStep('guidedStep3','done','此 Update ID 已套用；僅提供唯讀 Before → After 比對。');setStep('guidedStep4','blocked','重複更新保護：不可再次 Apply。');setHint(hint,'此更新包已經套用過。請直接查看上方人類可讀差異；正式 Dry Run／Apply 會被重複更新保護阻擋。');return;}
  if(!dryDone){const enabled=Boolean(dryBtn&&!dryBtn.disabled);setStep('guidedStep3',enabled?'active':'blocked',enabled?'現在可執行 Dry Run；此步驟不會寫入 SQLite。':'仍有驗證條件未完成，請查看下方提示。');setStep('guidedStep4','', '等待 Dry Run 完成。');setHint(hint,enabled?'下一步：按「Dry Run」預演實際資料庫變更；確認結果後才會開放套用。':'Dry Run 尚未解鎖，請先完成畫面中的必要覆核／驗證。',!enabled);return;}
  setStep('guidedStep3','done','Dry Run 已完成；請確認人類可讀差異。');const canApply=Boolean(applyBtn&&!applyBtn.disabled);setStep('guidedStep4',canApply?'active':'blocked',canApply?'確認差異正確後可正式套用。':'Dry Run 尚未達到可套用條件。');setHint(hint,canApply?'最後一步：確認差異後按「套用更新」。系統會先建立 Snapshot，再以 Transaction 寫入。':'請查看 Dry Run 結果中的衝突或阻擋原因。',!canApply);}

function schedule(){if(scheduled)return;scheduled=true;setTimeout(render,0);}
function boot(){if(installed)return;installed=true;ensureStyle();ensureFlow();ensureRawDetails();const updates=$('updates');if(updates)new MutationObserver(schedule).observe(updates,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class']});$('jsonFile')?.addEventListener('change',schedule);$('dryRunBtn')?.addEventListener('click',()=>setTimeout(schedule,0));$('applyBtn')?.addEventListener('click',()=>setTimeout(schedule,0));window.addEventListener('pokemon-sleep:data-changed',schedule);schedule();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
