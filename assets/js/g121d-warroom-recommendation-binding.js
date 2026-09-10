import { mountG121DWarroomRecommendationUI } from './g121d-evolution-recommendation-ui.js';

const state={envelopes:[],bound:false};

function normalizeEnvelopes(value){
  const rows=Array.isArray(value)?value:(value?[value]:[]);
  return rows.filter(row=>row&&typeof row==='object');
}

function render(){
  const container=document.getElementById('warroomPanel');
  if(!container)return {rendered:false,reason:'missing_warroom_panel'};
  container.classList.remove('loading-placeholder');
  if(!state.envelopes.length){
    container.innerHTML='<section class="g121d-evolution-card" data-authority-state="data_incomplete"><h3>進化建議</h3><p class="notice">資料不足／需確認：尚未取得 G12.1C deterministic recommendation envelope。</p></section>';
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
  return Object.freeze({bound:state.bound,envelope_count:state.envelopes.length});
}

globalThis.PokemonSleepG121DWarroomUI=Object.freeze({
  bind:bindG121DWarroomRecommendationUI,
  setEnvelopes:setG121DWarroomRecommendationEnvelopes,
  getState:getG121DWarroomRecommendationBindingState,
});

bindG121DWarroomRecommendationUI();
