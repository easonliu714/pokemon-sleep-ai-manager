import {summarizeIdentityImportWizard} from './identity-import-wizard.js';
import {createAndroidImportFilePicker,humanizeImportError} from './android-import-file-picker.js';
import {downloadPrivateZipInventory} from './data1-zip-inventory.js';

let current={state:null,prepared:null,applyResult:null,fileResult:null,exportFeedback:null};
let exportFeedbackTimer=null;

function ensureRoot(){
  let root=document.getElementById('identityImportWizardRoot');
  if(root)return root;
  const updates=document.getElementById('updates');
  if(!updates)return null;
  const heading=document.createElement('h3');heading.id='identityImportWizardHeading';heading.textContent='AI 匯入精靈';
  root=document.createElement('section');root.id='identityImportWizardRoot';root.className='panel';
  const anchor=document.getElementById('identityConfirmationHeading')||document.getElementById('workflowIssues')||updates.querySelector('h3');
  if(anchor?.parentElement===updates){anchor.insertAdjacentElement('afterend',heading);heading.insertAdjacentElement('afterend',root);}else updates.append(heading,root);
  return root;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function renderApplyResult(result){if(!result)return '';const status=result.ok?'已提交':'已回滾／未提交';const tone=result.ok?'success':'error';const snapshot=result.snapshot?.snapshot_id||'—';const errors=(result.errors||[]).map(escapeHtml).join('、')||'—';return `<div class="notice ${tone}"><strong>${status}</strong><br>Snapshot：${escapeHtml(snapshot)}<br>已處理：${Number(result.applied||0)}<br>錯誤：${errors}</div>`;}
function renderExportFeedback(){
  const feedback=current.exportFeedback;
  if(!feedback)return '';
  return `<div id="data1ExportFeedback" class="notice success" role="status" aria-live="polite"><strong>Manifest 已下載</strong><br>檔名：${escapeHtml(feedback.file_name)}<br>清點筆數：${Number(feedback.total||0)}；待處理：${Number(feedback.pending||0)}</div>`;
}
function fileSummary(result){
  if(!result)return '';
  const archive=result.archives?.[0];
  if(result.ok){
    if(result.source_type==='zip'){
      const inventory=result.inventory;
      return `<div class="notice success"><strong>ZIP 清點完成</strong><br>圖片：${archive?.summary?.image_count||0}/${archive?.summary?.entry_count||0}<br>待處理：${inventory?.summary?.pending||0}；疑似重複：${inventory?.summary?.duplicate||0}；待覆核：${inventory?.summary?.review_required||0}</div>${inventory?'<div class="buttons"><button id="data1ExportInventoryBtn" class="secondary">匯出私人清點 Manifest</button></div>':''}${renderExportFeedback()}`;
    }
    return `<div class="notice success">圖片檢查完成：來源 ${result.files?.length||0}</div>`;
  }
  const messages=(result.errors||[]).map(code=>`${humanizeImportError(code)} <small>(${escapeHtml(code)})</small>`).join('<br>');
  return `<div class="notice error"><strong>檔案檢查未通過</strong><br>${messages}</div>`;
}
function attachPicker(root){const slot=root.querySelector('#tech2dFilePickerSlot');if(!slot||slot.childElementCount)return;slot.appendChild(createAndroidImportFilePicker({onInspect:result=>{current.fileResult=result;current.exportFeedback=null;window.dispatchEvent(new CustomEvent('pokemon-sleep:identity-import-files-selected',{detail:result}));render();},onError:result=>{current.fileResult=result;current.exportFeedback=null;render();}}));}
function attachInventoryExport(root){
  const button=root.querySelector('#data1ExportInventoryBtn');
  if(!button||!current.fileResult?.inventory)return;
  button.addEventListener('click',()=>{
    const archiveName=current.fileResult.files?.[0]?.name||'pokemon_sleep';
    const base=archiveName.replace(/\.zip$/i,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
    const fileName=`${base}_private_inventory_manifest.json`;
    const total=current.fileResult.inventory.summary.total;
    const pending=current.fileResult.inventory.summary.pending;
    button.disabled=true;
    button.textContent='下載中…';
    downloadPrivateZipInventory(current.fileResult.inventory,{fileName});
    current.exportFeedback={file_name:fileName,total,pending,downloaded_at:new Date().toISOString()};
    globalThis.DebugTrace?.record?.('data1','private_inventory_exported',{status:'completed',details:{file_name:fileName,total,pending}});
    render();
    clearTimeout(exportFeedbackTimer);
    exportFeedbackTimer=setTimeout(()=>{
      const activeButton=document.getElementById('data1ExportInventoryBtn');
      if(activeButton){activeButton.disabled=false;activeButton.textContent='再次匯出私人清點 Manifest';}
    },1200);
  });
}
function render(){
  const root=ensureRoot();if(!root)return;
  let stateHtml='<div class="notice">尚未載入匯入工作。請選擇多張同一情境圖片，或選擇一個 ZIP。ZIP 會先建立私人清點 Manifest，不會把圖片或私人資料提交 GitHub。</div>';
  if(current.state){const summary=summarizeIdentityImportWizard(current.state);const errors=summary.errors.length?`<div class="notice error">${summary.errors.map(escapeHtml).join('、')}</div>`:'';stateHtml=`<div class="identity-import-summary"><div><strong>階段</strong><br>${escapeHtml(summary.step)}</div><div><strong>進度</strong><br>${summary.progress_percent}%</div><div><strong>觀察資料</strong><br>${summary.observation_count}</div><div><strong>候選解析</strong><br>${summary.resolution_count}</div><div><strong>待確認</strong><br>${summary.confirmation_count}</div><div><strong>操作預覽</strong><br>${summary.operation_count}</div></div>${errors}`;}
  root.innerHTML=`<div id="tech2dFilePickerSlot"></div>${fileSummary(current.fileResult)}${stateHtml}${renderApplyResult(current.applyResult)}<div class="notice">只有完成最終確認後才可套用；套用前必須建立 Snapshot，失敗時整批 rollback。</div>`;attachPicker(root);attachInventoryExport(root);
}
export function mountIdentityImportWizard(prepared){current={...current,state:prepared?.state||prepared||null,prepared:prepared||null,applyResult:prepared?.applyResult||current.applyResult};render();}
export function mountIdentityImportApplyResult(result){current.applyResult=result||null;render();}
window.PokemonSleepIdentityImportWizard={mount:mountIdentityImportWizard,showApplyResult:mountIdentityImportApplyResult,clear:()=>{current={state:null,prepared:null,applyResult:null,fileResult:null,exportFeedback:null};render();}};
window.addEventListener('pokemon-sleep:identity-import-state',event=>mountIdentityImportWizard(event.detail?.prepared||event.detail?.state||null));window.addEventListener('pokemon-sleep:identity-import-result',event=>mountIdentityImportApplyResult(event.detail||null));
const style=document.createElement('style');style.textContent='.identity-import-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px}.identity-import-summary>div{border:1px solid #dfe8e3;border-radius:10px;padding:10px;background:#fff}.tech2d-file-picker{display:grid;gap:8px;margin-bottom:10px}.tech2d-file-picker-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tech2d-file-picker button{min-height:44px;width:100%}@media(max-width:560px){.identity-import-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.identity-import-summary>div{min-height:44px}.tech2d-file-picker-actions{grid-template-columns:1fr}}';style.id='identityImportWizardStyles';if(!document.getElementById(style.id))document.head.appendChild(style);render();
