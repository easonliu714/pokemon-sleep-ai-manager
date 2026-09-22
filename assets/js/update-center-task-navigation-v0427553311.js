const ROUTES=Object.freeze({
  'shared-screenshot:weekly':{preferredSelector:'#ucImgA',fallbackSelectors:['#updateCenterAnalysisStaticShell'],scenario:'weekly'},
  'shared-screenshot:ingredients':{preferredSelector:'#ucImgA',fallbackSelectors:['#updateCenterAnalysisStaticShell'],scenario:'ingredients'},
  'shared-screenshot:recipes':{preferredSelector:'#ucImgA',fallbackSelectors:['#updateCenterAnalysisStaticShell'],scenario:'recipes'},
  'candy-screenshot':{preferredSelector:'#candyQuantityScreenshotB5',fallbackSelectors:['#updateCenterCandyStaticShell']},
  'pokemon-ocr-ai-import':{preferredSelector:'#identityImportWizardRoot',fallbackSelectors:['#unifiedImportAnalysisWorkbench','#updateCenterOcrStaticShell']},
});

function firstTarget(selectors=[]){
  for(const selector of selectors){
    const target=document.querySelector(selector);
    if(target)return target;
  }
  return null;
}

function stickyMainNavOffset(){
  const stickyNav=document.querySelector('nav[aria-label="主要功能"]');
  const height=stickyNav?.getBoundingClientRect?.().height||0;
  return Math.ceil(height)+8;
}

export function scrollTaskTargetToTop(target,{behavior='smooth'}={}){
  if(!target?.getBoundingClientRect)return false;
  const top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-stickyMainNavOffset());
  if(typeof window.scrollTo==='function')window.scrollTo({top,behavior});
  else target.scrollIntoView({behavior,block:'start'});
  return true;
}

export function waitForPreferredTarget(config,{timeoutMs=2400,pollMs=80}={}){
  return new Promise(resolve=>{
    const started=Date.now();
    const check=()=>{
      const target=config?.preferredSelector?document.querySelector(config.preferredSelector):null;
      if(target)return resolve(target);
      if(Date.now()-started>=timeoutMs)return resolve(null);
      window.setTimeout(check,pollMs);
    };
    check();
  });
}

function markScenarioFocus(config){
  if(!config?.scenario)return;
  const panel=document.querySelector(`#ucImgA .uc-img-scenario[data-scenario="${config.scenario}"]`);
  if(!panel)return;
  panel.dataset.taskNavigationFocus='true';
  window.setTimeout(()=>delete panel.dataset.taskNavigationFocus,1600);
}

export function navigateUpdateCenterTask(route){
  const config=ROUTES[route];
  if(!config)return false;
  const preferred=config.preferredSelector?document.querySelector(config.preferredSelector):null;
  if(preferred){
    scrollTaskTargetToTop(preferred);
    markScenarioFocus(config);
    return true;
  }
  const fallback=firstTarget(config.fallbackSelectors);
  if(!fallback)return false;

  // Dynamic Update Center modules can hydrate after the card click. A fallback shell is
  // only a temporary landing point; once the real function root exists, re-anchor to
  // its measured top so font size/card height changes cannot leave the user below it.
  scrollTaskTargetToTop(fallback);
  waitForPreferredTarget(config).then(target=>{
    if(!target)return;
    scrollTaskTargetToTop(target);
    markScenarioFocus(config);
  });
  return true;
}

function install(){
  const root=document.getElementById('updateCenterTaskNavigationV0427553311');
  if(!root)return;
  root.addEventListener('click',event=>{
    const card=event.target.closest?.('[data-update-task-route]');
    if(!card)return;
    event.preventDefault();
    navigateUpdateCenterTask(card.dataset.updateTaskRoute);
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
