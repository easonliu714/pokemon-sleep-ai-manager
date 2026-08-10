import {isDatabaseReady} from './database.js';
import {renderWarRoomRecipeDiscovery} from './war-room-recipe-discovery-ui.js';

let installed=false;
function mount(){
  if(!isDatabaseReady())return;
  const panel=document.getElementById('warroomPanel');if(!panel)return;
  let root=document.getElementById('warroomRecipeDiscovery');
  if(!root){
    root=document.createElement('div');root.id='warroomRecipeDiscovery';
    const team=document.getElementById('warroomTeamOptimizer');
    if(team)team.insertAdjacentElement('afterend',root);else panel.prepend(root);
  }
  renderWarRoomRecipeDiscovery(root);
}
function install(){
  if(installed)return;installed=true;
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="warroom"]'))queueMicrotask(mount);});
  for(const event of ['pokemon-sleep:database-ready','pokemon-sleep:strategy-goal-profile-changed','pokemon-sleep:evaluation-snapshots-changed','pokemon-sleep:data-changed'])window.addEventListener(event,()=>queueMicrotask(mount));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>queueMicrotask(mount));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(mount),{once:true});else queueMicrotask(mount);
}
install();
