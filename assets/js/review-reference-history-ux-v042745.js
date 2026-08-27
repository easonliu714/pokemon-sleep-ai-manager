import {rows} from './database.js';
import {
  PUBLIC_BERRY_STRENGTH_MASTER,
  PUBLIC_BERRY_STRENGTH_VERSION,
  berryNameForType,
  berryStrengthAuthority,
  canonicalBerryName,
} from './public-berry-strength-master.js';

export const REVIEW_REFERENCE_HISTORY_UX_VERSION='v0.4.27.45-review-reference-evolution-history-ux-2026-08-27-a';
export const IMPORT_HISTORY_EXPORT_SCHEMA='pokemon-sleep-import-history-export/1.0';

const text=value=>String(value??'').normalize('NFKC').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const safeJson=value=>{if(value===null||value===undefined||value==='')return null;try{return typeof value==='string'?JSON.parse(value):clone(value);}catch{return {raw:String(value),parse_error:true};}};
const trace=(event,details={},status='completed')=>{
  const payload={version:REVIEW_REFERENCE_HISTORY_UX_VERSION,...details};
  globalThis.UpdateCenterLiveDebug?.record?.(event,payload);
  globalThis.DebugTrace?.record?.('review_reference',event,{status,details:payload});
};

export function resolvePublicBerryReference({species='',observed_type='',observed_berry='',species_reference=null}={}){
  const normalizedSpecies=text(species);
  const observedType=text(observed_type);
  const rawBerry=text(observed_berry);
  const canonicalObserved=rawBerry?canonicalBerryName(rawBerry):'';
  const speciesReference=species_reference||null;
  const referenceType=observedType||text(speciesReference?.type);
  const referenceBerry=referenceType?text(berryNameForType(referenceType)):text(speciesReference?.favorite_berry);
  const observedAuthority=rawBerry?berryStrengthAuthority(canonicalObserved):null;
  const aliasNormalized=Boolean(rawBerry&&canonicalObserved&&rawBerry!==canonicalObserved);
  let status='NO_PUBLIC_REFERENCE';
  if(referenceBerry&&!rawBerry)status='AI_BLANK_PUBLIC_REFERENCE_AVAILABLE';
  else if(referenceBerry&&canonicalObserved&&canonicalObserved!==referenceBerry)status='REVIEW_REQUIRED_BERRY_PUBLIC_RELATION_MISMATCH';
  else if(referenceBerry&&canonicalObserved===referenceBerry&&aliasNormalized)status='PUBLIC_RELATION_MATCH_ALIAS_NORMALIZED';
  else if(referenceBerry&&canonicalObserved===referenceBerry)status='PUBLIC_RELATION_MATCH';
  else if(rawBerry&&!observedAuthority)status='REVIEW_REQUIRED_UNKNOWN_BERRY_NAME';
  else if(rawBerry&&observedAuthority&&aliasNormalized)status='CANONICAL_BERRY_ALIAS_AVAILABLE';
  else if(rawBerry&&observedAuthority)status='CANONICAL_BERRY_NAME_MATCH';
  const reviewRequired=['REVIEW_REQUIRED_BERRY_PUBLIC_RELATION_MISMATCH','REVIEW_REQUIRED_UNKNOWN_BERRY_NAME'].includes(status);
  return Object.freeze({
    status,
    species:normalizedSpecies||null,
    observed_type:observedType||null,
    reference_type:referenceType||null,
    observed_berry:rawBerry||null,
    canonical_observed_berry:canonicalObserved||null,
    reference_berry:referenceBerry||null,
    alias_normalized:aliasNormalized,
    review_required:reviewRequired,
    public_master_version:PUBLIC_BERRY_STRENGTH_VERSION,
    evidence_role:'REFERENCE_NOT_IMAGE_EVIDENCE',
    auto_write:false,
  });
}

export function berryReferenceHumanMessage(reference={}){
  const typeName=text(reference.reference_type);
  const raw=text(reference.observed_berry);
  const canonical=text(reference.canonical_observed_berry);
  const publicBerry=text(reference.reference_berry);
  switch(reference.status){
    case 'AI_BLANK_PUBLIC_REFERENCE_AVAILABLE':
      return `公版參考：AI 未辨識樹果；依「${typeName}」屬性公版關係，參考值為「${publicBerry}」。請人工確認後自行選擇／輸入並按「儲存人工修改」。`;
    case 'REVIEW_REQUIRED_BERRY_PUBLIC_RELATION_MISMATCH':
      return `樹果需要人工確認：目前欄位為「${raw}」；依「${typeName}」屬性公版關係，參考值為「${publicBerry}」。平台不會自動改寫。`;
    case 'REVIEW_REQUIRED_UNKNOWN_BERRY_NAME':
      return `樹果名稱「${raw}」未匹配目前公版名稱。請從公版候選確認正確名稱後再儲存。`;
    case 'PUBLIC_RELATION_MATCH_ALIAS_NORMALIZED':
    case 'CANONICAL_BERRY_ALIAS_AVAILABLE':
      return `公版名稱參考：目前輸入「${raw}」可正名為「${canonical}」。請人工確認後儲存。`;
    case 'PUBLIC_RELATION_MATCH':
      return `公版比對：目前樹果「${raw}」與「${typeName}」屬性公版關係一致。`;
    case 'CANONICAL_BERRY_NAME_MATCH':
      return `公版名稱比對：目前樹果「${raw}」為公版正式名稱。`;
    default:
      return '公版參考：目前缺少可驗證的屬性／物種關係，保留 AI 原始結果供人工確認。';
  }
}

export function evolutionRequirementSemantic({authority_status='',public_requirement_state='',current_value=''}={}){
  const status=text(authority_status),state=text(public_requirement_state),value=text(current_value);
  if(status==='VERIFIED_TERMINAL_CURRENT_SLEEP')return Object.freeze({kind:'TERMINAL',label:'已完全進化',detail:'公版已驗證：目前物種在 Pokémon Sleep 中已沒有下一階進化。'});
  if(state==='VERIFIED_NOT_REQUIRED'){
    if(value)return Object.freeze({kind:'NOT_REQUIRED_CONFLICT',label:'不需要',detail:`公版已驗證此條件不需要；目前欄位為「${value}」，請人工確認。`});
    return Object.freeze({kind:'NOT_REQUIRED',label:'不需要',detail:'公版已驗證：此進化條件不需要。'});
  }
  return Object.freeze({kind:'NONE',label:'',detail:''});
}

export function buildImportHistoryExport(queryRows=rows,{exported_at=nowIso()}={}){
  const batches=(queryRows('SELECT * FROM import_batches ORDER BY imported_at DESC')||[]).map(batch=>{
    const changes=(queryRows('SELECT * FROM import_changes WHERE update_id=? ORDER BY operation_index,id',[batch.update_id])||[]).map(change=>({
      id:change.id,
      operation_index:change.operation_index,
      entity:change.entity,
      action:change.action,
      key:safeJson(change.key_json),
      before:safeJson(change.before_json),
      after:safeJson(change.after_json),
      status:change.status,
      message:change.message,
    }));
    return {
      update_id:batch.update_id,
      schema_version:batch.schema_version,
      generated_at:batch.generated_at,
      imported_at:batch.imported_at,
      source:batch.source,
      operation_count:batch.operation_count,
      result:safeJson(batch.result_json),
      changes,
    };
  });
  return Object.freeze({
    schema:IMPORT_HISTORY_EXPORT_SCHEMA,
    version:REVIEW_REFERENCE_HISTORY_UX_VERSION,
    exported_at,
    batch_count:batches.length,
    change_count:batches.reduce((sum,batch)=>sum+batch.changes.length,0),
    batches,
  });
}

function ensureBerryDatalist(doc=document){
  let list=doc.getElementById('publicBerryNamesV042745');
  if(list)return list;
  list=doc.createElement('datalist');list.id='publicBerryNamesV042745';
  for(const row of PUBLIC_BERRY_STRENGTH_MASTER){const option=doc.createElement('option');option.value=row.berry_name;option.label=`${row.type_name}屬性`;list.appendChild(option);}
  doc.body?.appendChild(list);return list;
}

function speciesReference(species){
  return globalThis.PokemonSleepReviewSessionRuntimeV042744?.getPublicFixedFields?.(species)||null;
}

export function decorateBerryReference(root=document.getElementById('analysisConfirmationWorkbench')){
  const section=root?.querySelector?.('.analysis-confirmation');if(!section)return null;
  const speciesInput=section.querySelector('[data-field="species"]'),typeInput=section.querySelector('[data-field="type"]'),berryInput=section.querySelector('[data-field="favorite_berry"]');
  if(!berryInput)return null;
  ensureBerryDatalist(section.ownerDocument||document);berryInput.setAttribute('list','publicBerryNamesV042745');
  const reference=resolvePublicBerryReference({species:speciesInput?.value,observed_type:typeInput?.value,observed_berry:berryInput.value,species_reference:speciesReference(speciesInput?.value)});
  const holder=berryInput.closest('.edit-field')||berryInput.parentElement;if(!holder)return reference;
  let note=holder.querySelector('[data-v042745-berry-reference]');if(!note){note=(section.ownerDocument||document).createElement('small');note.dataset.v042745BerryReference='true';holder.appendChild(note);}
  note.className=reference.review_required?'notice error':'notice';note.textContent=berryReferenceHumanMessage(reference);
  note.dataset.referenceStatus=reference.status;note.dataset.autoWrite='false';
  trace('v042745_berry_public_reference_rendered',{status:reference.status,species:reference.species,observed_type:reference.observed_type,observed_berry:reference.observed_berry,reference_berry:reference.reference_berry,review_required:reference.review_required,auto_write:false});
  return reference;
}

const EVOLUTION_FIELDS=Object.freeze(['evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement']);
export function decorateEvolutionSemantics(root=document.getElementById('analysisConfirmationWorkbench')){
  const section=root?.querySelector?.('.analysis-confirmation');if(!section)return {terminal:false,decorated:0};
  const authorityNotice=section.querySelector('[data-evolution-authority-status]');const authorityStatus=text(authorityNotice?.dataset?.evolutionAuthorityStatus);
  let banner=authorityNotice?.querySelector?.('[data-v042745-evolution-semantic]')||null,decorated=0;
  if(authorityStatus==='VERIFIED_TERMINAL_CURRENT_SLEEP'&&authorityNotice){
    if(!banner){banner=(section.ownerDocument||document).createElement('div');banner.dataset.v042745EvolutionSemantic='true';authorityNotice.appendChild(banner);}
    banner.textContent='狀態：已完全進化（公版已驗證）';banner.className='badge success';
  }else banner?.remove?.();
  for(const field of EVOLUTION_FIELDS){
    const input=section.querySelector(`[data-field="${field}"]`);if(!input)continue;
    let note=input.closest('.edit-field')?.querySelector?.(`[data-v042745-evolution-field="${field}"]`)||null;
    const semantic=evolutionRequirementSemantic({authority_status:authorityStatus,public_requirement_state:input.dataset.publicRequirementState,current_value:input.value});
    if(semantic.kind==='NONE'){note?.remove?.();continue;}
    if(!note){note=(section.ownerDocument||document).createElement('small');note.dataset.v042745EvolutionField=field;input.closest('.edit-field')?.appendChild(note);}
    note.className=semantic.kind==='NOT_REQUIRED_CONFLICT'?'notice error':'notice';note.textContent=semantic.detail;
    input.placeholder=semantic.label;input.title=semantic.detail;decorated+=1;
  }
  trace('v042745_evolution_semantics_rendered',{authority_status:authorityStatus||null,terminal:authorityStatus==='VERIFIED_TERMINAL_CURRENT_SLEEP',decorated_fields:decorated});
  return {terminal:authorityStatus==='VERIFIED_TERMINAL_CURRENT_SLEEP',decorated};
}

function historyFileName(date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  return `pokemon_sleep_import_history_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`;
}

export function downloadImportHistoryJson({doc=document,queryRows=rows}={}){
  const payload=buildImportHistoryExport(queryRows);const body=JSON.stringify(payload,null,2);const blob=new Blob([body],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=doc.createElement('a');anchor.href=url;anchor.download=historyFileName();anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  trace('v042745_import_history_json_exported',{batch_count:payload.batch_count,change_count:payload.change_count,file_name:anchor.download});return payload;
}

export function enhanceImportHistoryUi(doc=document){
  const heading=doc.getElementById('importHistoryHeading'),wrap=doc.getElementById('importHistoryWrap');if(!heading||!wrap)return false;
  let details=doc.getElementById('importHistoryDetailsV042745');
  if(!details){
    details=doc.createElement('details');details.id='importHistoryDetailsV042745';details.dataset.defaultCollapsed='true';
    const summary=doc.createElement('summary');summary.textContent='匯入歷程（預設收合，點此展開）';
    const controls=doc.createElement('div');controls.className='buttons';
    const exportButton=doc.createElement('button');exportButton.type='button';exportButton.id='exportImportHistoryJsonBtnV042745';exportButton.textContent='匯出匯入歷程 JSON';controls.appendChild(exportButton);
    heading.replaceWith(details);details.append(summary,controls,wrap);exportButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();try{downloadImportHistoryJson({doc});}catch(error){alert(`匯出失敗：${error?.message||error}`);}});
  }
  details.open=false;
  trace('v042745_import_history_collapsed_ui_ready',{default_collapsed:true,json_export:true});return true;
}

function scheduleReviewDecoration(){
  const run=()=>{decorateBerryReference();decorateEvolutionSemantics();};
  if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);
}

function boot(){
  enhanceImportHistoryUi(document);scheduleReviewDecoration();
  globalThis.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',scheduleReviewDecoration);
  globalThis.addEventListener('pokemon-sleep:analysis-confirmation-merged',scheduleReviewDecoration);
  document.addEventListener('input',event=>{if(['species','type','favorite_berry',...EVOLUTION_FIELDS].includes(event.target?.dataset?.field))scheduleReviewDecoration();},true);
  document.addEventListener('change',event=>{if(['species','type','favorite_berry',...EVOLUTION_FIELDS].includes(event.target?.dataset?.field))scheduleReviewDecoration();},true);
  trace('v042745_review_reference_history_ux_ready',{berry_reference:true,public_name_datalist:true,evolution_semantics:true,import_history_default_collapsed:true,import_history_json_export:true,no_player_auto_write:true,no_new_mutation_observer:true});
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
