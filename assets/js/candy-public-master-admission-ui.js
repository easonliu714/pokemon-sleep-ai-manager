import {
  PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  admitPublicCandyFromObservedName,
} from './public-candy-local-admission-authority.js';
import {replayCandyRecognitionAgainstCurrentMaster} from './candy-quantity-confirmation-authority.js';

export const CANDY_PUBLIC_MASTER_ADMISSION_UI_VERSION='candy-public-master-admission-ui-2026-09-01-a';

const clean=value=>String(value??'').trim();

function parseWorking(){
  const area=document.getElementById('candyB5WorkingJson');
  if(!area)throw new Error('找不到 Working / Resolved Recognition JSON');
  const value=JSON.parse(clean(area.value));
  return {area,value};
}

function admissionMessage(observation){
  const quantity=observation?.observed_data?.quantity;
  return `目前 Public Candy Master 無法 exact 對應：\n\n${clean(observation?.observed_text)||'未讀到名稱'}${Number.isInteger(quantity)?`\nOCR 候選數量：${quantity}`:''}\n\n是否建立「本機 Public Candy identity」並立即用同一筆 observation 重新對應？\n\n只會保存糖果 identity、來源圖片與確認紀錄；玩家 quantity 不會寫入 Public Master。下一版才會依實機截圖 evidence 評估提升為全域 source-controlled 公版。`;
}

function directAdmit(card){
  try{
    const observationId=clean(card?.dataset?.id);
    const {area,value}=parseWorking();
    const observation=(value.observations||[]).find(item=>item?.observation_id===observationId);
    if(!observation)throw new Error(`找不到 observation：${observationId}`);
    if(!confirm(admissionMessage(observation)))return;
    const confirmedAt=new Date().toISOString();
    const admission=admitPublicCandyFromObservedName({
      observedText:observation.observed_text,
      sourceImageRef:observation.source_image_ref,
      observationId:observation.observation_id,
      confirmedAt,
    });
    const replay=replayCandyRecognitionAgainstCurrentMaster(value,'candies');
    const resolved=(replay.payload.observations||[]).find(item=>item?.observation_id===observationId);
    if(!resolved||resolved.status!=='MATCHED'||clean(resolved.canonical_name)!==clean(observation.observed_text))throw new Error('Local admission 已建立，但 exact replay 未形成同名 MATCH；已停止，不會寫玩家資料');
    resolved.user_resolution={
      action:'USER_CONFIRMED_MATCH',
      confirmed_at:confirmedAt,
      canonical_name:resolved.canonical_name,
      admission:{
        action:PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
        authority:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
        result:admission.status,
        candy_id:admission.row.candy_id,
        source_image_ref:admission.row.source_image_ref,
        observation_id:admission.row.observation_id,
        quantity_in_public_master:false,
      },
    };
    area.value=JSON.stringify(replay.payload,null,2);
    area.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('candyB5Parse')?.click();
    window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'candy_public_master_local_admission',candy_id:admission.row.candy_id}}));
    alert(`Public Candy identity 已${admission.status==='CREATED'?'建立':'存在'}：${admission.row.candy_name}\n\n同一筆 observation 已重新對應。請接著核對遊戲畫面並確認 quantity；Gemini Raw JSON 不會被改寫。`);
  }catch(error){
    alert(`建立 Public Candy identity 失敗：${error?.message||error}`);
  }
}

function wire(){
  const section=document.getElementById('candyQuantityScreenshotB5');
  if(!section)return;
  section.querySelectorAll('[data-kind="identity"]').forEach(card=>{
    const button=card.querySelector('[data-action="gap"]');
    if(!button||button.dataset.p053Admission==='1')return;
    button.dataset.p053Admission='1';
    button.textContent='建立公版糖果並重新對應';
    button.title='一次確認後建立本機 Public Candy identity，並立即重播同一筆 observation；不寫入玩家 quantity。';
    button.onclick=event=>{event.preventDefault();event.stopPropagation();directAdmit(card);};
  });
}

function boot(){
  wire();
  const observer=new MutationObserver(wire);
  observer.observe(document.documentElement,{subtree:true,childList:true});
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
}
