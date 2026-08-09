import {isDatabaseReady} from './database.js';
import {renderWarRoomEvaluationLifecycle} from './war-room-evaluation-lifecycle-ui.js';

let installed=false;
function mount(state=null){
  if(!isDatabaseReady())return;
  const panel=document.getElementById('warroomPanel');if(!panel)return;
  let root=document.getElementById('warroomEvaluationLifecycle');
  if(!root){
    root=document.createElement('div');root.id='warroomEvaluationLifecycle';
    const goal=document.getElementById('warroomGoalProfile');
    if(goal)goal.insertAdjacentElement('afterend',root);else panel.prepend(root);
  }
  renderWarRoomEvaluationLifecycle(root,state);
}
function install(){
  if(installed)return;installed=true;
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="warroom"]'))queueMicrotask(()=>mount());});
  window.addEventListener('pokemon-sleep:database-ready',()=>queueMicrotask(()=>mount()));
  window.addEventListener('pokemon-sleep:evaluation-lifecycle-state',event=>queueMicrotask(()=>mount(event.detail||null)));
  window.addEventListener('pokemon-sleep:strategy-goal-profile-changed',()=>queueMicrotask(()=>mount()));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>queueMicrotask(()=>mount()));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(()=>mount()),{once:true});else queueMicrotask(()=>mount());
}
install();
