import { mountG121DWarroomRecommendationUI } from './g121d-evolution-recommendation-ui.js';
import { refreshG121DWarroomRecommendations } from './g121d-warroom-recommendation-provider.js';

const state={envelopes:[],bound:false};
const SLOT_ID='g121dWarroomRecommendationSlot';

function normalizeEnvelopes(value){
  const rows=Array.isArray(value)?value:(value?[value]:[]);
  return rows.filter(row=>row&&typeof row==='object');
}

function ensureRecommendationSlot(){
  const panel=document.getElementById('warroomPanel');
  if(!panel)return null;
  let slot=document.getElementById(SLOT_ID);
  if(slot&&slot.parentElement===panel)return slot;
  slot=document.createElement('div');
  slot.id=SLOT_ID;
  slot.dataset.g121dOwner='evolution-recommendation';
  slot.className='g121d-warroom-recommendation-slot';
  panel.appendChild(slot);
  return slot;
}

function render(){
  const container=ensureRecommendationSlot();
  if(!container)return {rendered:false,reason:'missing_warroom_panel'};
  container.classList.remove('loading-placeholder');
  if(!state.envelopes.length){
    container.innerHTML='<section class="g121d-evolution-card" data-authority-state="data_incomplete"><h3>進化建議</h3><p class="notice">資料不足／需確認：目前沒有具有可驗證進化分支的本機個體 recommendation envelope。</p></section>';
    return {rendered:true,valid:false,reason:'missing_g121c_envelope'};
  }
  return mountG121DWarroomRecommendationUI({container,envelopes:state.envelopes});
}

export function setG121DWarroomRecommendationEnvelopes(envelopes){
  state.envelopes=normalizeEnvelopes(envelopes);
  return render();
}

export function bindG121DWarroomRecommendationUI(){
  if(state.bound)return {bound:true,reused:true};
  state.bound=true;
  globalThis.addEventListener('pokemon-sleep:g121c-recommendations-ready',event=>{
    setG121DWarroomRecommendationEnvelopes(event?.detail?.envelopes??event?.detail?.envelope??[]);
  });
  const seeded=globalThis.PokemonSleepG121CRecommendationEnvelopes;
  if(seeded)state.envelopes=normalizeEnvelopes(seeded);
  render();
  return {bound:true,reused:false};
}

export function getG121DWarroomRecommendationBindingState(){
  return Object.freeze({bound:state.bound,envelope_count:state.envelopes.length,slot_id:SLOT_ID});
}

globalThis.PokemonSleepG121DWarroomUI=Object.freeze({
  bind:bindG121DWarroomRecommendationUI,
  setEnvelopes:setG121DWarroomRecommendationEnvelopes,
  getState:getG121DWarroomRecommendationBindingState,
});

bindG121DWarroomRecommendationUI();
refreshG121DWarroomRecommendations({reason:'warroom-module-load'});
