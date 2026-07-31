import {summarizeIdentityImportWizard} from './identity-import-wizard.js';

let current={state:null,prepared:null};

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

function render(){
  const root=ensureRoot();
  if(!root)return;
  if(!current.state){
    root.innerHTML='<div class="notice">尚未載入匯入工作。可由 JSON、截圖或 ZIP 建立待審資料。</div>';
    return;
  }
  const summary=summarizeIdentityImportWizard(current.state);
  const errors=summary.errors.length?`<div class="notice error">${summary.errors.map(escapeHtml).join('、')}</div>`:'';
  root.innerHTML=`
    <div class="identity-import-summary">
      <div><strong>階段</strong><br>${escapeHtml(summary.step)}</div>
      <div><strong>進度</strong><br>${summary.progress_percent}%</div>
      <div><strong>觀察資料</strong><br>${summary.observation_count}</div>
      <div><strong>候選解析</strong><br>${summary.resolution_count}</div>
      <div><strong>待確認</strong><br>${summary.confirmation_count}</div>
      <div><strong>操作預覽</strong><br>${summary.operation_count}</div>
    </div>
    ${errors}
    <div class="notice">此畫面只顯示匯入計畫；尚未執行 SQLite 寫入。</div>
  `;
}

export function mountIdentityImportWizard(prepared){
  current={state:prepared?.state||prepared||null,prepared:prepared||null};
  render();
}

window.PokemonSleepIdentityImportWizard={mount:mountIdentityImportWizard,clear:()=>{current={state:null,prepared:null};render();}};
window.addEventListener('pokemon-sleep:identity-import-state',event=>mountIdentityImportWizard(event.detail?.prepared||event.detail?.state||null));

const style=document.createElement('style');
style.textContent='.identity-import-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px}.identity-import-summary>div{border:1px solid #dfe8e3;border-radius:10px;padding:10px;background:#fff}@media(max-width:560px){.identity-import-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.identity-import-summary>div{min-height:44px}}';
style.id='identityImportWizardStyles';
if(!document.getElementById(style.id))document.head.appendChild(style);
render();
