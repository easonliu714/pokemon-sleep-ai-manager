const ROUTES=Object.freeze({
  'shared-screenshot:weekly':{selectors:['#ucImgA','#updateCenterAnalysisStaticShell'],scenario:'weekly'},
  'shared-screenshot:ingredients':{selectors:['#ucImgA','#updateCenterAnalysisStaticShell'],scenario:'ingredients'},
  'shared-screenshot:recipes':{selectors:['#ucImgA','#updateCenterAnalysisStaticShell'],scenario:'recipes'},
  'candy-screenshot':{selectors:['#candyQuantityScreenshotB5','#updateCenterCandyStaticShell']},
  'pokemon-ocr-ai-import':{selectors:['#identityImportWizardRoot','#unifiedImportAnalysisWorkbench','#updateCenterOcrStaticShell']},
});

function firstTarget(selectors=[]){
  for(const selector of selectors){
    const target=document.querySelector(selector);
    if(target)return target;
  }
  return null;
}

export function navigateUpdateCenterTask(route){
  const config=ROUTES[route];
  if(!config)return false;
  const target=firstTarget(config.selectors);
  if(!target)return false;
  target.scrollIntoView({behavior:'smooth',block:'start'});
  if(config.scenario){
    const panel=document.querySelector(`#ucImgA .uc-img-scenario[data-scenario="${config.scenario}"]`);
    if(panel){
      panel.dataset.taskNavigationFocus='true';
      setTimeout(()=>delete panel.dataset.taskNavigationFocus,1600);
    }
  }
  return true;
}

function install(){
  const root=document.getElementById('updateCenterTaskNavigationV0427553311');
  if(!root)return;
  root.addEventListener('click',event=>{
    const card=event.target.closest?.('[data-update-task-route]');
    if(!card)return;
    event.preventDefault();
    const route=card.dataset.updateTaskRoute;
    if(navigateUpdateCenterTask(route))return;
    // Update Center dynamic modules may still be hydrating. Fall back to the governed
    // static shell immediately; the user never lands on a meaningless diagnostics anchor.
    const fallback=ROUTES[route]?.selectors?.map(selector=>document.querySelector(selector)).find(Boolean);
    fallback?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
