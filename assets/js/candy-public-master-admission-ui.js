import {
  PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  commitPublicCandyLocalAdmission,
  preparePublicCandyLocalAdmission,
  readPublicCandyLocalAdmissionState,
  removePublicCandyLocalAdmission,
} from './public-candy-local-admission-authority.js';
import {PUBLIC_CANDY_MASTER_VERSION} from './public-candy-master.js';
import {begin,commit,isDatabaseReady,isRescueReadonly,persist,rollback,rows,run} from './database.js';
import {replayCandyRecognitionAgainstCurrentMaster} from './candy-quantity-confirmation-authority.js';

export const CANDY_PUBLIC_MASTER_ADMISSION_UI_VERSION='candy-public-master-admission-ui-2026-09-01-c';

const clean=value=>String(value??'').trim();
const sqlColumns=['candy_id','candy_name','candy_type','target_species_name','target_type_name','name_rule','verification_status','source_type','source_name','source_ref','verified_at','data_version'];

function parseWorking(){
  const area=document.getElementById('candyB5WorkingJson');
  if(!area)throw new Error('找不到 Working / Resolved Recognition JSON');
  const value=JSON.parse(clean(area.value));
  return {area,value};
}

function admissionMessage(observation){
  const quantity=observation?.observed_data?.quantity;
  return `目前 Public Candy Master 無法 exact 對應：\n\n${clean(observation?.observed_text)||'未讀到名稱'}${Number.isInteger(quantity)?`\nOCR 候選數量：${quantity}`:''}\n\n是否直接建立「本機 Public Candy identity」並立即用同一筆 observation 重新對應？\n\n只會保存糖果 identity、來源圖片與確認紀錄；玩家 quantity 不會寫入 Public Master。建立後會先驗證 local overlay 與 SQLite 都已儲存，再進行同筆 replay。下一版才會依實機截圖 evidence 評估提升為全域 source-controlled 公版。`;
}

function sqliteAdmissionRow(candyId){
  return rows('SELECT candy_id,candy_name,candy_type,target_species_name,target_type_name,name_rule,verification_status,source_type,source_name,source_ref,verified_at,data_version FROM candy_master WHERE candy_id=?',[candyId])[0]||null;
}

function upsertSqliteAdmission(row){
  run(`INSERT INTO candy_master(candy_id,candy_name,candy_type,target_species_name,target_type_name,name_rule,verification_status,source_type,source_name,source_ref,verified_at,data_version)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(candy_id) DO UPDATE SET
    candy_name=excluded.candy_name,candy_type=excluded.candy_type,target_species_name=excluded.target_species_name,target_type_name=excluded.target_type_name,
    name_rule=excluded.name_rule,verification_status=excluded.verification_status,source_type=excluded.source_type,source_name=excluded.source_name,
    source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,[
    row.candy_id,row.candy_name,row.candy_type,row.target_species_name,null,row.name_rule,row.verification_status,
    row.source_type,row.source_name,row.source_ref,row.confirmed_at,PUBLIC_CANDY_MASTER_VERSION,
  ]);
}

function restoreSqliteAdmission(prior,row){
  if(!prior){run('DELETE FROM candy_master WHERE candy_id=?',[row.candy_id]);return;}
  run(`INSERT OR REPLACE INTO candy_master(${sqlColumns.join(',')}) VALUES(${sqlColumns.map(()=>'?').join(',')})`,sqlColumns.map(column=>prior[column]??null));
}

async function persistSqliteMutation(mutator){
  begin();
  try{mutator();commit();}catch(error){rollback();throw error;}
  await persist();
}

async function persistAdmissionPair(prepared){
  if(!isDatabaseReady()||isRescueReadonly())throw new Error('目前不是可寫入的正常 SQLite 模式，不能建立本機 Public Candy identity');
  const priorSqlite=sqliteAdmissionRow(prepared.candy_id);
  const priorLocal=readPublicCandyLocalAdmissionState().rows.find(row=>row.candy_id===prepared.candy_id)||null;
  await persistSqliteMutation(()=>upsertSqliteAdmission(prepared));
  const sqliteReadback=sqliteAdmissionRow(prepared.candy_id);
  if(!sqliteReadback||clean(sqliteReadback.candy_name)!==clean(prepared.candy_name)){
    await persistSqliteMutation(()=>restoreSqliteAdmission(priorSqlite,prepared));
    throw new Error('Public Candy SQLite 儲存後 readback 驗證失敗');
  }
  try{
    const admission=commitPublicCandyLocalAdmission(prepared);
    return {admission,prepared,priorSqlite,priorLocal};
  }catch(error){
    await persistSqliteMutation(()=>restoreSqliteAdmission(priorSqlite,prepared));
    throw error;
  }
}

async function rollbackNewAdmissionPair(pair){
  if(pair?.admission?.status!=='CREATED')return;
  await persistSqliteMutation(()=>restoreSqliteAdmission(pair.priorSqlite,pair.prepared));
  removePublicCandyLocalAdmission(pair.prepared.candy_id,{expectedObservationId:pair.prepared.observation_id});
}

async function directAdmit(card){
  let pair=null;
  try{
    const observationId=clean(card?.dataset?.id);
    const {area,value}=parseWorking();
    const observation=(value.observations||[]).find(item=>item?.observation_id===observationId);
    if(!observation)throw new Error(`找不到 observation：${observationId}`);
    if(!isDatabaseReady()||isRescueReadonly())throw new Error('目前不是可寫入的正常 SQLite 模式，不能建立本機 Public Candy identity');
    if(!confirm(admissionMessage(observation)))return;
    const confirmedAt=new Date().toISOString();
    const prepared=preparePublicCandyLocalAdmission({observation,confirmedAt});
    pair=await persistAdmissionPair(prepared);
    const replay=replayCandyRecognitionAgainstCurrentMaster(value,'candies');
    const resolved=(replay.payload.observations||[]).find(item=>item?.observation_id===observationId);
    if(!resolved||resolved.status!=='MATCHED'||clean(resolved.canonical_name)!==clean(observation.observed_text)){
      await rollbackNewAdmissionPair(pair);
      throw new Error('Local admission 已儲存，但 exact replay 未形成同名 MATCH；新 admission 已回復，不會寫玩家 quantity');
    }
    resolved.user_resolution={
      action:'USER_CONFIRMED_MATCH',
      confirmed_at:confirmedAt,
      canonical_name:resolved.canonical_name,
      admission:{
        action:PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
        authority:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
        result:pair.admission.status,
        candy_id:pair.admission.row.candy_id,
        source_image_ref:pair.admission.row.source_image_ref,
        observation_id:pair.admission.row.observation_id,
        quantity_in_public_master:false,
        local_storage_readback_verified:true,
        sqlite_master_readback_verified:true,
      },
    };
    area.value=JSON.stringify(replay.payload,null,2);
    area.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('candyB5Parse')?.click();
    window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'candy_public_master_local_admission',candy_id:pair.admission.row.candy_id}}));
    alert(`Public Candy identity 已${pair.admission.status==='CREATED'?'建立':'存在'}並完成雙層儲存核對：${pair.admission.row.candy_name}\n\n同一筆 observation 已重新對應。請接著核對遊戲畫面並確認 quantity；Gemini Raw JSON 不會被改寫。`);
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
    button.title='一次確認後建立並核對本機 Public Candy identity，立即重播同一筆 observation；不寫入玩家 quantity。';
    button.onclick=event=>{event.preventDefault();event.stopPropagation();void directAdmit(card);};
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
