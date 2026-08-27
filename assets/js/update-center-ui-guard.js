import './review-reference-history-ux-v042745.js';

function clearPreview(){
  const summary=document.getElementById('importSummary');
  const table=document.getElementById('changeTable');
  const apply=document.getElementById('applyBtn');
  if(summary) summary.textContent='尚未執行 Dry Run。';
  if(table) table.innerHTML='';
  if(apply) apply.disabled=true;
}

function boot(){
  const input=document.getElementById('jsonFile');
  if(!input) return;
  input.addEventListener('change',clearPreview,{capture:true});
  document.getElementById('validateJsonBtn')?.addEventListener('click',()=>{
    const issues=document.getElementById('workflowIssues');
    if(issues?.querySelector('.status-conflict')) clearPreview();
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

export {clearPreview};
