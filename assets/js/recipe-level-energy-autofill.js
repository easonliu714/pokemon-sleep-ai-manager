import {
  RECIPE_LEVEL_MAX,
  RECIPE_LEVEL_ENERGY_CONTRACT_VERSION,
  calculateRecipeEnergyById,
} from './recipe-level-energy-contract.js';

export const RECIPE_LEVEL_ENERGY_AUTOFILL_VERSION='recipe-level-energy-autofill-2026-08-13-b-render-hydration';

function levelInput(target){
  return target instanceof HTMLInputElement&&target.classList.contains('canonical-recipe-level');
}

function energyInputFor(level){
  return level.closest('tr')?.querySelector('.canonical-recipe-energy')||null;
}

function recipeIdFor(level){
  return String(level.dataset.id||level.closest('tr')?.dataset.recipeId||'');
}

function validLevelValue(level){
  if(level.value==='')return null;
  const parsed=Number(level.value);
  if(!Number.isInteger(parsed)||parsed<1||parsed>RECIPE_LEVEL_MAX)return null;
  return parsed;
}

function configureLevelInput(level){
  level.min='1';
  level.max=String(RECIPE_LEVEL_MAX);
  level.step='1';
  level.title=`料理等級 1–${RECIPE_LEVEL_MAX}；輸入後會依公版 Lv.1 能量與等級加成自動更新目前能量`;
  level.dataset.energyContract=RECIPE_LEVEL_ENERGY_CONTRACT_VERSION;
}

function syncEnergyFromLevel(level,{dispatch=true,renderHydration=false}={}){
  configureLevelInput(level);
  const energy=energyInputFor(level);
  if(!energy)return null;
  const parsedLevel=validLevelValue(level);
  if(level.value!==''&&parsedLevel===null){
    level.setCustomValidity(`料理等級必須是 1–${RECIPE_LEVEL_MAX} 的整數`);
    return null;
  }
  level.setCustomValidity('');
  if(parsedLevel===null)return null;
  const calculated=calculateRecipeEnergyById(recipeIdFor(level),parsedLevel);
  if(calculated===null)return null;
  energy.value=String(calculated);
  energy.dataset.autoDerived='true';
  energy.dataset.energyContract=RECIPE_LEVEL_ENERGY_CONTRACT_VERSION;
  if(renderHydration)energy.dataset.renderHydrated='true';else delete energy.dataset.renderHydrated;
  energy.title=`由料理等級 Lv.${parsedLevel} 自動計算；可由圖片匯入值覆蓋，手動變更等級時會重新同步`;
  if(dispatch)energy.dispatchEvent(new Event('input',{bubbles:true}));
  return calculated;
}

function hydrateBlankEnergyFromLevel(level){
  configureLevelInput(level);
  const energy=energyInputFor(level);
  if(!energy||energy.value!=='')return null;
  if(validLevelValue(level)===null)return null;
  return syncEnergyFromLevel(level,{dispatch:false,renderHydration:true});
}

function enhanceExistingInputs(root=document){
  root.querySelectorAll?.('.canonical-recipe-level').forEach(hydrateBlankEnergyFromLevel);
}

function onLevelEdit(event){
  if(!levelInput(event.target))return;
  syncEnergyFromLevel(event.target);
}

function onSaveCapture(event){
  const button=event.target instanceof Element?event.target.closest('.canonical-save-recipe'):null;
  if(!button)return;
  const row=button.closest('tr');
  const level=row?.querySelector('.canonical-recipe-level');
  if(!level)return;
  configureLevelInput(level);
  if(level.value!==''&&!level.checkValidity()){
    event.preventDefault();
    event.stopPropagation();
    alert(level.validationMessage);
    level.focus();
    return;
  }
  if(level.value!=='')syncEnergyFromLevel(level);
}

function install(){
  enhanceExistingInputs();
  document.addEventListener('input',onLevelEdit);
  document.addEventListener('change',onLevelEdit);
  document.addEventListener('click',onSaveCapture,true);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches('.canonical-recipe-level'))hydrateBlankEnergyFromLevel(node);
        enhanceExistingInputs(node);
      }
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.PokemonSleepRecipeLevelEnergyAutofill=Object.freeze({
  version:RECIPE_LEVEL_ENERGY_AUTOFILL_VERSION,
  contract_version:RECIPE_LEVEL_ENERGY_CONTRACT_VERSION,
  max_level:RECIPE_LEVEL_MAX,
  calculateRecipeEnergyById,
});
