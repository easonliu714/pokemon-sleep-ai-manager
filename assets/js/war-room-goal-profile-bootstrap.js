import {mountWarRoomGoalProfile} from './war-room-goal-profile-ui.js';

let installed=false;
function mount(){
  const panel=document.getElementById('warroomPanel');
  if(!panel)return;
  let root=document.getElementById('warroomGoalProfile');
  if(!root){root=document.createElement('div');root.id='warroomGoalProfile';panel.prepend(root);}
  mountWarRoomGoalProfile(root);
}
function install(){
  if(installed)return;installed=true;
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="warroom"]'))queueMicrotask(mount);});
  window.addEventListener('pokemon-sleep:database-ready',()=>queueMicrotask(mount));
  window.addEventListener('pokemon-sleep:strategy-goal-profile-changed',()=>queueMicrotask(mount));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(mount),{once:true});else queueMicrotask(mount);
}
install();
