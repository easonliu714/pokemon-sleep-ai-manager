import {summarizeIdentityImportWizard} from './identity-import-wizard.js';
import {createAndroidImportFilePicker} from './android-import-file-picker.js';

let current={state:null,prepared:null,applyResult:null,fileResult:null};

function ensureRoot(){
  let root=document.getElementById('identityImportWizardRoot');
  if(root)return root;
  const updates=document.getElementById('updates');
  if(!updates)return null;
  const heading=document.createElement('h3');
  heading.id='identityImportWizardHeading';
  heading.textContent='AI 匯入精靈';
  root=document.createElement('section');
  root.id='identityImportWizardRoot';
  root.className='panel';
  const anchor=document.getElementById('identityConfirmationHeading')||document.getElementById('workflowIssues')||updates.querySelector('h3');
  if(anchor?.parentElement===updates){anchor.insertAdjacentElement('afterend',heading);heading.insertAdjacentElement('afterend',root);}else updates.append(heading,root);
  return root;
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

function renderApplyResult(result){
  if(!result)return '';
  const status=result.ok?'已提交':'已回滾／未提交';
  const tone=result.ok?'success':'error';
  const snapshot=result.snapshot?.snapshot_id||'—';
  const errors=(result.errors||[]).map(escapeHtml).join('、')||'—';
  return `<div class="notice ${tone}"><strong>${status}</strong><br>Snapshot：${escapeHtml(snapshot)}<br>已處理：${Number(result.applied||0)}<br>錯誤：${errors}</div>`;
}

function fileSummary(result){
  if(!result)return '';
  const archive=result.archives?.[0];
  const archiveSummary=archive?`；ZIP 圖片 ${archive.summary.image_count}/${archive.summary.entry_count}`:'';
  return `<div class="notice ${result.ok?'success':'error'}">${result.ok?'檔案檢查完成':'檔案檢查失敗'}：${escapeHtml(result.source_type||'—')}；來源 ${result.files?.length||0}${archiveSummary}${result.errors?.length?`；${result.errors.map(escapeHtml).join('、')}`:''}</div>`;
}

function attachPicker(root){
  const slot=root.querySelector('#tech2dFilePickerSlot');
  if(!slot||slot.childElementCount)return;
  slot.appendChild(createAndroidImportFilePicker({
    onInspect:result=>{
      current.fileResult=result;
      window.dispatchEvent(new CustomEvent('pokemon-sleep:identity-import-files-selected',{detail:result}));
      render();
    },
    onError:result=>{current.fileResult=result;render();}
  }));
}

function render(){
  const root=ensureRoot();
  if(!root)return;
  let stateHtml='<div class="notice">尚未載入匯入工作。可先選擇同一類型的截圖或單一 ZIP 建立待審資料。</div>';
  if(current.state){
    const summary=summarizeIdentityImportWizard(current.state);
    const errors=summary.errors.length?`<div class="notice error">${summary.errors.map(escapeHtml).join('、')}</div>`:'';
    stateHtml=`
      <div class="identity-import-summary">
        <div><strong>階段</strong><br>${escapeHtml(summary.step)}</div>
        <div><strong>進度</strong><br>${summary.progress_percent}%</div>
        <div><strong>觀察資料</strong><br>${summary.observation_count}</div>
        <div><strong>候選解析</strong><br>${summary.resolution_count}</div>
        <div><strong>待確認</strong><br>${summary.confirmation_count}</div>
        <div><strong>操作預覽</strong><br>${summary.operation_count}</div>
      </div>${errors}`;
  }
  root.innerHTML=`
    <div id="tech2dFilePickerSlot"></div>
    ${fileSummary(current.fileResult)}
    ${stateHtml}
    ${renderApplyResult(current.applyResult)}
    <div class="notice">只有完成最終確認後才可套用；套用前必須建立 Snapshot，失敗時整批 rollback。</div>`;
  attachPicker(root);
}

export function mountIdentityImportWizard(prepared){
  current={...current,state:prepared?.state||prepared||null,prepared:prepared||null,applyResult:prepared?.applyResult||current.applyResult};
  render();
}

export function mountIdentityImportApplyResult(result){current.applyResult=result||null;render();}

window.PokemonSleepIdentityImportWizard={
  mount:mountIdentityImportWizard,
  showApplyResult:mountIdentityImportApplyResult,
  clear:()=>{current={state:null,prepared:null,applyResult:null,fileResult:null};render();}
};
window.addEventListener('pokemon-sleep:identity-import-state',event=>mountIdentityImportWizard(event.detail?.prepared||event.detail?.state||null));
window.addEventListener('pokemon-sleep:identity-import-result',event=>mountIdentityImportApplyResult(event.detail||null));

const style=document.createElement('style');
style.textContent='.identity-import-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px}.identity-import-summary>div{border:1px solid #dfe8e3;border-radius:10px;padding:10px;background:#fff}.tech2d-file-picker{display:grid;gap:8px;margin-bottom:10px}.tech2d-file-picker button{min-height:44px;width:100%}@media(max-width:560px){.identity-import-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.identity-import-summary>div{min-height:44px}}';
style.id='identityImportWizardStyles';
if(!document.getElementById(style.id))document.head.appendChild(style);
render();
