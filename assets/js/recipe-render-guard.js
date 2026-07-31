import {renderSharedKnowledge} from './shared-knowledge-ui.js';

let repairing=false;

function isLegacyRecipeTable(table){
  if(!table)return false;
  const headers=[...table.querySelectorAll('thead th')].map(item=>item.textContent.trim());
  return headers.length===3
    && headers[0]==='分類'
    && headers[1]==='食譜'
    && headers[2]==='已開啟';
}

function repair(){
  if(repairing)return;
  const table=document.getElementById('recipeTable');
  if(!isLegacyRecipeTable(table))return;
  repairing=true;
  try{renderSharedKnowledge(true);}finally{queueMicrotask(()=>{repairing=false;});}
}

function boot(){
  const table=document.getElementById('recipeTable');
  if(!table)return;
  const observer=new MutationObserver(repair);
  observer.observe(table,{childList:true,subtree:true});
  repair();
  document.addEventListener('pokemon-sleep-data-refreshed',()=>queueMicrotask(repair));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
