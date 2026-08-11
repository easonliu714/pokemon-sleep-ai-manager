import {PROMPT_CATALOG} from './prompt-catalog.js';
import {validateWorkflow,approveReviewed} from './ai-workflow.js';
import {dryRun,applyPayload} from './importer.js';
import {analyzeUcImgScenarioWithGemini,buildUcImgDiagnosticBundle} from './uc-img-gemini-adapter.js';
import {cleanupRestoredUcImgSession} from './uc-img-session-lifecycle.js';
import {isUcImgOwnedMemoryBlob,snapshotUcImgPickerFile,ucImgByteStateLabel} from './uc-img-image-runtime.js';
import {
  applyPublicMasterRecognitionResolution,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionPrompt,
  compilePublicMasterRecognitionToUpdatePackage,
  isPublicMasterRecognitionPayload,
  supportsPublicMasterRecognition,
} from './public-master-recognition.js';

export const UC_IMG_A_VERSION='uc-img-a-2026-08-11-d-public-master-recognition';
export const UC_IMG_A_STORAGE_KEY='pokemon-sleep-uc-img-a-session-v1';
export const UC_IMG_A_COVERAGE=Object.freeze(['PARTIAL','USER_CONFIRMED_COMPLETE']);
export const UC_IMG_A_MODES=Object.freeze(['internal','external']);
export const UC_IMG_A_SCENARIOS=Object.freeze({
  weekly:Object.freeze({key:'weekly',promptKey:'weekly',scenario:'weekly_context_update',label:'本週營地／活動',entities:['weekly_context']}),
  ingredients:Object.freeze({key:'ingredients',promptKey:'ingredients',scenario:'ingredient_inventory_update',label:'食材庫存',entities:['ingredient_inventory','account_capacity']}),
  recipes:Object.freeze({key:'recipes',promptKey:'recipes',scenario:'recipe_status_update',label:'料理解鎖／等級／能量',entities:['recipes']}),
});

const hasDocument=typeof document!=='undefined';
const hasWindow=typeof window!=='undefined';
const scenarioKeys=Object.keys(UC_IMG_A_SCENARIOS);
const clone=value=>JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const token=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const emptyScenarioState=()=>({raw_response:'',response_prompt_revision:null,response_stale:false,last_update_id:null,last_apply_status:null,ai_mode:'internal',provider_meta:null,last_ai_error:null});

export function createScreenshotUpdateSession(){
  return {
    schema:'pokemon-sleep-uc-img-a-session/1.0',version:UC_IMG_A_VERSION,
    session_id:`ucimg-${token()}`,created_at:nowIso(),updated_at:nowIso(),status:'draft',next_image_number:1,
    entries:[],coverage:Object.fromEntries(scenarioKeys.map(key=>[key,'PARTIAL'])),
    scenario_state:Object.fromEntries(scenarioKeys.map(key=>[key,emptyScenarioState()])),
  };
}

export function guessScreenshotScenario(fileName=''){
  const name=String(fileName).toLowerCase();
  if(/weekly|week|camp|event|snorlax|營地|活動|卡比獸|本週/.test(name))return 'weekly';
  if(/ingredient|food|bag.*ingredient|食材|材料/.test(name))return 'ingredients';
  if(/recipe|curry|salad|dessert|drink|meal|料理|食譜|咖哩|濃湯|沙拉|甜點|飲料/.test(name))return 'recipes';
  return null;
}

export function scenarioEntries(session,scenarioKey){return (session.entries||[]).filter(entry=>entry.scenario_key===scenarioKey);}

export function screenshotScenarioRevision(session,scenarioKey){
  const cfg=UC_IMG_A_SCENARIOS[scenarioKey];if(!cfg)return null;
  let catalog_snapshot_id=null;
  if(supportsPublicMasterRecognition(cfg.scenario))catalog_snapshot_id=buildPublicMasterCatalogSnapshot(cfg.scenario).catalog_snapshot_id;
  return JSON.stringify({
    scenario:cfg.scenario,
    coverage:session.coverage?.[scenarioKey]||'PARTIAL',
    catalog_snapshot_id,
    images:scenarioEntries(session,scenarioKey).map(entry=>({image_ref:entry.image_ref,file_name:entry.file_name})),
  });
}

function markScenarioResponseStale(session,scenarioKey){
  const state=session.scenario_state?.[scenarioKey];
  if(state?.raw_response)state.response_stale=true;
}
function markScenarioSetStale(session,keys){for(const key of new Set(keys.filter(Boolean)))markScenarioResponseStale(session,key);}

export function addScreenshotEntry(session,fileLike={}){
  const number=Number(session.next_image_number||1),guessed=guessScreenshotScenario(fileLike.name||'');
  const entry={
    entry_id:`entry-${token()}`,image_ref:`image-${String(number).padStart(3,'0')}`,
    file_name:String(fileLike.name||`image-${number}`),file_size:Number(fileLike.size||0),mime_type:String(fileLike.type||''),
    scenario_key:guessed||'',classification_source:guessed?'filename_hint':'unclassified',selected_at:nowIso(),object_url:null,image_available:false,
    byte_state:'PENDING',byte_error:null,byte_snapshot_size:0,
  };
  session.next_image_number=number+1;session.entries.push(entry);markScenarioSetStale(session,[guessed]);session.updated_at=nowIso();return entry;
}

export function assignScreenshotScenario(session,entryId,scenarioKey,{manual=true}={}){
  if(scenarioKey&&!UC_IMG_A_SCENARIOS[scenarioKey])throw new Error(`不支援的圖片情境：${scenarioKey}`);
  const entry=session.entries.find(item=>item.entry_id===entryId);if(!entry)throw new Error(`找不到圖片 entry：${entryId}`);
  const previous=entry.scenario_key;entry.scenario_key=scenarioKey||'';entry.classification_source=manual?'manual':'system';
  markScenarioSetStale(session,[previous,scenarioKey]);session.updated_at=nowIso();return entry;
}

export function removeScreenshotEntry(session,entryId){
  const index=session.entries.findIndex(item=>item.entry_id===entryId);if(index<0)return null;
  const [removed]=session.entries.splice(index,1);markScenarioSetStale(session,[removed?.scenario_key]);
  if(removed?.object_url&&typeof URL!=='undefined')URL.revokeObjectURL(removed.object_url);session.updated_at=nowIso();return removed;
}

export function setScenarioCoverage(session,scenarioKey,coverage){
  if(!UC_IMG_A_SCENARIOS[scenarioKey])throw new Error(`不支援的情境：${scenarioKey}`);
  if(!UC_IMG_A_COVERAGE.includes(coverage))throw new Error(`不支援 coverage：${coverage}`);
  if(session.coverage?.[scenarioKey]!==coverage)markScenarioResponseStale(session,scenarioKey);
  session.coverage[scenarioKey]=coverage;session.updated_at=nowIso();return coverage;
}

export function setScenarioAiMode(session,scenarioKey,mode){
  if(!UC_IMG_A_SCENARIOS[scenarioKey])throw new Error(`不支援的情境：${scenarioKey}`);
  if(!UC_IMG_A_MODES.includes(mode))throw new Error(`不支援的 AI 模式：${mode}`);
  session.scenario_state[scenarioKey]={...emptyScenarioState(),...(session.scenario_state[scenarioKey]||{}),ai_mode:mode};
  session.updated_at=nowIso();return mode;
}

export function serializableScreenshotSession(session){
  const copy=clone(session);copy.entries=(copy.entries||[]).map(entry=>({...entry,object_url:null,image_available:false,byte_state:'NOT_AVAILABLE',byte_error:null}));return copy;
}
export function persistScreenshotSession(session,storage=hasWindow?window.localStorage:null){
  if(!storage)return false;session.updated_at=nowIso();storage.setItem(UC_IMG_A_STORAGE_KEY,JSON.stringify(serializableScreenshotSession(session)));return true;
}
export function restoreScreenshotSession(storage=hasWindow?window.localStorage:null){
  if(!storage)return createScreenshotUpdateSession();
  try{
    const raw=storage.getItem(UC_IMG_A_STORAGE_KEY);if(!raw)return createScreenshotUpdateSession();
    const parsed=JSON.parse(raw);if(parsed?.schema!=='pokemon-sleep-uc-img-a-session/1.0')return createScreenshotUpdateSession();
    parsed.version=UC_IMG_A_VERSION;
    parsed.entries=Array.isArray(parsed.entries)?parsed.entries.map(entry=>({...entry,object_url:null,image_available:false,byte_state:'NOT_AVAILABLE',byte_error:null})):[];
    parsed.coverage={...Object.fromEntries(scenarioKeys.map(key=>[key,'PARTIAL'])),...(parsed.coverage||{})};
    parsed.scenario_state={...Object.fromEntries(scenarioKeys.map(key=>[key,emptyScenarioState()])),...(parsed.scenario_state||{})};
    for(const key of scenarioKeys)parsed.scenario_state[key]={...emptyScenarioState(),...(parsed.scenario_state[key]||{})};
    const cleanup=cleanupRestoredUcImgSession(parsed);
    if(cleanup.changed)storage.setItem(UC_IMG_A_STORAGE_KEY,JSON.stringify(cleanup.session));
    return cleanup.session;
  }catch{return createScreenshotUpdateSession();}
}

export function buildScreenshotScenarioPrompt(session,scenarioKey){
  const config=UC_IMG_A_SCENARIOS[scenarioKey];if(!config)throw new Error(`不支援的情境：${scenarioKey}`);
  const entries=scenarioEntries(session,scenarioKey);if(!entries.length)throw new Error(`「${config.label}」尚未指定任何圖片`);
  const coverage=session.coverage?.[scenarioKey]||'PARTIAL';
  const imageMap=entries.map(entry=>({image_ref:entry.image_ref,file_name:entry.file_name}));
  // v0.4.11: public-backed scenarios use the same catalog-constrained recognition contract for Internal Gemini and External Prompt.
  if(supportsPublicMasterRecognition(config.scenario)){
    return `${buildPublicMasterRecognitionPrompt(config.scenario,{sessionId:session.session_id,coverage,imageMap})}\n\nUC.IMG 截圖工作階段補充：\n- 檔名只用來把附件對應到 image_ref，不是玩家資料 Evidence。\n- 只分析本次列出的圖片，不得引用其他對話、上週圖片或一般遊戲知識補玩家狀態。\n- 平台會自行把 MATCHED observation 編譯成 Update Package；不要另外輸出 operations。`;
  }
  const base=PROMPT_CATALOG[config.promptKey]?.prompt;if(!base)throw new Error(`找不到 Prompt Catalog：${config.promptKey}`);
  const map=imageMap.map(entry=>`  - ${entry.image_ref} = ${entry.file_name}`).join('\n');
  return `${base}\n\nUC.IMG-A 截圖工作階段規則：\n- session_id=${session.session_id}\n- scenario=${config.scenario}\n- coverage=${coverage}\n- 本次附件與 image_ref 對應：\n${map}\n- 上述檔名只用來把附件對應到 image_ref，不是玩家資料 Evidence；真正內容只能依圖片可見文字／數值。\n- 只分析本次列出的圖片，不得引用其他對話、上週圖片或一般遊戲知識補玩家狀態。\n- 每筆 operation.evidence.source_image_ref 必須使用上述 image_ref 之一；多張共同支持時可加 evidence.source_image_refs。\n- coverage=PARTIAL 表示只涵蓋部分畫面；沒有出現的項目絕對不得補 0、補未解鎖或清空。\n- coverage=USER_CONFIRMED_COMPLETE 只代表使用者確認本 session 已涵蓋完整畫面範圍；它是 completeness evidence，不授權你為未出現項目新增 0、false、delete 或 clear_fields。\n- 仍須遵守原情境 Prompt 的所有 fail-closed / review_required 規則。`;
}

export function extractJsonObjectText(input){
  if(typeof input!=='string')return input;const source=input.trim(),fenced=source.match(/```(?:json)?\s*([\s\S]*?)```/i),body=(fenced?.[1]||source).trim();
  const start=body.indexOf('{'),end=body.lastIndexOf('}');if(start<0||end<start)throw new Error('找不到 JSON 物件');return body.slice(start,end+1);
}

function operationKeySignature(operation){
  const key=operation?.key||{};
  if(operation?.entity==='ingredient_inventory')return `ingredient_inventory:${key.ingredient_name||''}`;
  if(operation?.entity==='account_capacity')return `account_capacity:${key.capacity_key||''}`;
  if(operation?.entity==='recipes')return `recipes:${key.recipe_id||key.recipe_name||''}`;
  if(operation?.entity==='weekly_context')return `weekly_context:${key.context_id||''}`;
  return `${operation?.entity||'unknown'}:${JSON.stringify(key)}`;
}
function evidenceRefs(operation){
  const refs=[];if(operation?.evidence?.source_image_ref)refs.push(operation.evidence.source_image_ref);
  if(Array.isArray(operation?.evidence?.source_image_refs))refs.push(...operation.evidence.source_image_refs);return [...new Set(refs.filter(Boolean))];
}

export function validateScreenshotScenarioPayload(session,scenarioKey,input){
  const config=UC_IMG_A_SCENARIOS[scenarioKey];if(!config)throw new Error(`不支援的情境：${scenarioKey}`);
  let sourcePayload;try{const value=extractJsonObjectText(input);sourcePayload=typeof value==='string'?JSON.parse(value):clone(value);}catch(error){return {ok:false,payload:null,source_payload:null,errors:[`JSON 解析失敗：${error.message}`],warnings:[],review:[],summary:{scenario:config.scenario}};}
  const assignedRefs=new Set(scenarioEntries(session,scenarioKey).map(entry=>entry.image_ref));
  let payload=sourcePayload,recognition=null,recognitionErrors=[],recognitionWarnings=[],recognitionReview=[];
  // v0.4.11: Recognition JSON is revalidated against the exact current public catalog before deterministic Update Package compilation.
  if(isPublicMasterRecognitionPayload(sourcePayload)){
    const compiled=compilePublicMasterRecognitionToUpdatePackage(sourcePayload,config.scenario,{allowedImageRefs:[...assignedRefs]});
    payload=compiled.update_package;
    recognition={
      ...compiled,
      source_payload:sourcePayload,
      catalog_options:compiled.snapshot?.rows?.map(row=>row[compiled.snapshot.display_name_field]).filter(Boolean)||[],
    };
    recognitionErrors=[...(compiled.errors||[])];recognitionWarnings=[...(compiled.warnings||[])];
    recognitionReview=(compiled.unresolved||[]).map(item=>({
      kind:'public_master_recognition',operation_id:item.observation_id,entity:compiled.snapshot?.authority||'public_master',key:null,
      evidence:{source_image_ref:item.source_image_ref,confidence:item.confidence},recognition:item,
    }));
  }
  const workflow=validateWorkflow(payload),errors=[...recognitionErrors,...(workflow.errors||[])],warnings=[...recognitionWarnings,...(workflow.warnings||[])],review=[...(workflow.review||[]),...recognitionReview];
  if(payload?.scenario!==config.scenario)errors.push(`scenario 必須為 ${config.scenario}，目前為 ${payload?.scenario||'未提供'}`);
  const allowed=new Set(config.entities),ops=Array.isArray(payload?.operations)?payload.operations:[];
  if(!assignedRefs.size)errors.push(`「${config.label}」沒有已指定圖片`);if(scenarioKey==='weekly'&&ops.length!==1)errors.push('Weekly Context 必須只有 1 筆 operation');
  const seen=new Set();
  ops.forEach((operation,index)=>{
    const label=`#${index+1}`;if(!allowed.has(operation.entity))errors.push(`${label} entity ${operation.entity||'未提供'} 不屬於 UC.IMG-A ${config.label}`);
    if(operation.action!=='upsert')errors.push(`${label} 截圖更新只允許 action=upsert`);if(scenarioKey==='weekly'&&operation.entity!=='weekly_context')errors.push(`${label} Weekly 只能更新 weekly_context`);
    const signature=operationKeySignature(operation);if(seen.has(signature))warnings.push(`${label} 與其他 operation 使用相同目標 key：${signature}；請確認多圖重疊是否重複辨識`);seen.add(signature);
    const refs=evidenceRefs(operation);if(!refs.length)errors.push(`${label} 缺少 evidence.source_image_ref/source_image_refs`);for(const ref of refs)if(!assignedRefs.has(ref))errors.push(`${label} evidence 引用了不屬於本情境的 image_ref：${ref}`);
  });
  const coverage=session.coverage?.[scenarioKey]||'PARTIAL';if(!UC_IMG_A_COVERAGE.includes(coverage))errors.push(`不合法 coverage：${coverage}`);if(coverage==='USER_CONFIRMED_COMPLETE')warnings.push('本次 coverage 已由使用者標記完整；此標記不代表未出現項目可自動歸零/未解鎖。');
  const recognitionTraceable=recognition?((sourcePayload.observations||[]).length>0&&(sourcePayload.observations||[]).every(item=>assignedRefs.has(item.source_image_ref))):null;
  const traceableEvidence=recognition?recognitionTraceable:(ops.length>0&&ops.every(operation=>evidenceRefs(operation).length>0));
  const uniqueErrors=[...new Set(errors)],uniqueWarnings=[...new Set(warnings)];
  return {
    ok:uniqueErrors.length===0&&review.length===0,payload,source_payload:sourcePayload,recognition,
    errors:uniqueErrors,warnings:uniqueWarnings,review,
    summary:{
      ...(workflow.summary||{}),uc_img_a_version:UC_IMG_A_VERSION,session_id:session.session_id,scenario_key:scenarioKey,expected_scenario:config.scenario,
      assigned_image_count:assignedRefs.size,coverage,traceable_evidence:traceableEvidence,
      recognition_contract:Boolean(recognition),recognition_authority:recognition?.summary?.authority||null,
      recognition_matched_count:recognition?.summary?.matched_count??null,recognition_unresolved_count:recognition?.summary?.unresolved_count??null,
      recognition_ignored_count:recognition?.summary?.ignored_count??null,catalog_snapshot_id:recognition?.summary?.catalog_snapshot_id||null,
    },
  };
}

function installStyle(){
  if(!hasDocument||document.getElementById('ucImgAStyle'))return;const el=document.createElement('style');el.id='ucImgAStyle';
  el.textContent=`.uc-img-a{margin-top:18px;border:1px solid #cfe0d7;background:#fafffc}.uc-img-a h3{margin-top:0}.uc-img-a-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.uc-img-a-toolbar,.uc-img-ai-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.uc-img-a-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:14px 0}.uc-img-card,.uc-img-scenario{border:1px solid #dbe4df;border-radius:12px;padding:10px;background:#fff;min-width:0}.uc-img-preview{aspect-ratio:16/9;background:#eef4f1;border-radius:9px;overflow:hidden;display:grid;place-items:center;color:#687d74;margin-bottom:8px;text-align:center}.uc-img-preview img{width:100%;height:100%;object-fit:contain;background:#111}.uc-img-meta{font-size:.82rem;color:#687d74;overflow-wrap:anywhere}.uc-img-ref{font-weight:800;color:#1f7a5a}.uc-img-byte-error{color:#8a1f1f;font-weight:700}.uc-img-card select,.uc-img-scenario textarea{width:100%}.uc-img-card select{margin-top:8px}.uc-img-scenarios{display:grid;gap:12px}.uc-img-scenario-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.uc-img-scenario textarea{min-height:150px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45}.uc-img-prompt{min-height:190px}.uc-img-result{margin-top:10px;padding:10px;border-radius:9px;background:#f4f7f5;overflow-wrap:anywhere}.uc-img-preview-table{overflow:auto;max-width:100%;margin-top:10px}.uc-img-preview-table table{min-width:560px}.uc-img-privacy{padding:10px;border-radius:9px;background:#fff8df;color:#6c5710;line-height:1.5}.uc-img-stale{background:#fff1f1;color:#8a1f1f;padding:8px;border-radius:8px;margin:8px 0}.uc-img-ai-note{padding:8px;border-radius:8px;background:#eef7ff;margin:8px 0;line-height:1.45}.uc-img-ai-error{padding:8px;border-radius:8px;background:#fff1f1;color:#8a1f1f;margin:8px 0}.uc-img-recognition{margin-top:10px;padding:10px;border:1px solid #e3c87a;border-radius:10px;background:#fffaf0}.uc-img-recognition-card{margin-top:8px;padding:10px;border:1px solid #ead9a4;border-radius:9px;background:#fff}.uc-img-recognition-card select{width:100%;margin:8px 0}.uc-img-recognition-actions{display:flex;gap:6px;flex-wrap:wrap}.uc-img-gap{font-weight:700;color:#8a5b00}@media(max-width:700px){.uc-img-a{padding:12px}.uc-img-a-images{grid-template-columns:1fr 1fr}.uc-img-a-toolbar>*,.uc-img-ai-bar>*{flex:1 1 150px}.uc-img-scenario{padding:10px}.uc-img-preview-table{border:1px solid #dbe4df;border-radius:10px}.uc-img-recognition-actions>*{flex:1 1 130px}}@media(max-width:420px){.uc-img-a-images{grid-template-columns:1fr}}`;
  document.head.appendChild(el);
}
const scenarioOptions=selected=>`<option value="">未分類</option>${scenarioKeys.map(key=>`<option value="${key}" ${selected===key?'selected':''}>${esc(UC_IMG_A_SCENARIOS[key].label)}</option>`).join('')}`;
const previewHtml=preview=>!preview?.changes?.length?'<div class="notice">尚無 Dry Run 差異。</div>':`<div class="uc-img-preview-table"><table><thead><tr><th>#</th><th>實體</th><th>要求</th><th>實際</th><th>狀態</th><th>訊息</th></tr></thead><tbody>${preview.changes.map(c=>`<tr><td>${esc(c.index)}</td><td>${esc(c.entity)}</td><td>${esc(c.requested_action)}</td><td>${esc(c.effective_action)}</td><td>${esc(c.status)}</td><td>${esc(c.message||'')}</td></tr>`).join('')}</tbody></table></div>`;

function candidateOptions(item,allOptions){
  const preferred=[...(item.candidate_names||[])],ordered=[...preferred,...allOptions.filter(name=>!preferred.includes(name))];
  return `<option value="">請選擇公版候選</option>${ordered.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}`;
}
function recognitionReviewHtml(result){
  const unresolved=result?.recognition?.unresolved||[];if(!unresolved.length)return '';
  const allOptions=result.recognition.catalog_options||[];
  return `<section class="uc-img-recognition"><b>Public Master 對應待確認：${unresolved.length}</b><div class="notice">相近名稱只作候選，不會自動寫入。所有未匹配項目都必須由使用者處理後才能 Dry Run。</div>${unresolved.map(item=>{
    const gap=item.user_resolution?.action==='PUBLIC_MASTER_GAP_CONFIRMED';
    return `<article class="uc-img-recognition-card" data-observation-id="${esc(item.observation_id)}"><div><b>${esc(item.status)}</b> · ${esc(item.observed_text||'未讀到文字')} · ${esc(item.source_image_ref||'—')} · confidence=${esc(item.confidence??'—')}</div><div class="notice">辨識值：<code>${esc(JSON.stringify(item.observed_data||{}))}</code>${item.reason?` · ${esc(item.reason)}`:''}</div>${gap?'<div class="uc-img-gap">已標記為 Public Master gap；仍禁止套用，待後續公版 Evidence 治理。</div>':''}<select class="uc-img-rec-candidate">${candidateOptions(item,allOptions)}</select><div class="uc-img-recognition-actions"><button data-rec-action="MATCH">確認公版候選</button><button data-rec-action="IGNORE">辨識誤判／忽略</button><button data-rec-action="MASTER_GAP">標記公版缺口</button></div></article>`;
  }).join('')}</section>`;
}

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
  const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('瀏覽器未允許複製');return true;
}

export function mountUnifiedScreenshotUpdateCenter(){
  if(!hasDocument)return null;const host=document.getElementById('updateCenterDynamicContent');if(!host||document.getElementById('ucImgA'))return null;installStyle();
  let session=restoreScreenshotSession();const runtime={files:new Map(),scenario:{}};const root=document.createElement('section');root.id='ucImgA';root.className='panel uc-img-a';host.prepend(root);
  const save=()=>persistScreenshotSession(session),rt=key=>(runtime.scenario[key]??={result:null,preview:null,busy:false}),clearRt=key=>{if(key)runtime.scenario[key]={result:null,preview:null,busy:false};else runtime.scenario={};},count=key=>scenarioEntries(session,key).length;
  const entryReady=entry=>entry?.byte_state==='READY'&&entry.image_available===true&&isUcImgOwnedMemoryBlob(runtime.files.get(entry.entry_id));
  const hasImageBytes=key=>{const entries=scenarioEntries(session,key);return Boolean(entries.length&&entries.every(entryReady));};
  const byteSummary=key=>{
    const entries=scenarioEntries(session,key);if(!entries.length)return '圖片 bytes：NOT AVAILABLE';
    const ready=entries.filter(entryReady).length,pending=entries.filter(entry=>entry.byte_state==='PENDING').length,failed=entries.filter(entry=>entry.byte_state==='READ_FAILED').length;
    if(failed)return `圖片 bytes：READ FAILED ${failed}/${entries.length}`;
    if(pending)return `圖片 bytes：準備中 ${ready}/${entries.length}`;
    if(ready===entries.length)return `圖片 bytes：READY（記憶體快照） ${ready}/${entries.length}`;
    return `圖片 bytes：NOT AVAILABLE ${ready}/${entries.length}`;
  };
  const panelMarkup=key=>{
    const cfg=UC_IMG_A_SCENARIOS[key],s=session.scenario_state[key]||emptyScenarioState();let prompt='';try{if(count(key))prompt=buildScreenshotScenarioPrompt(session,key);}catch{}
    const stale=s.response_stale&&s.raw_response?'<div class="uc-img-stale">圖片分類／Coverage／Public Master 已變更：目前 AI JSON 已過期，請重新分析或依最新 Prompt 貼回新的辨識 JSON。</div>':'';
    const aiError=s.last_ai_error?`<div class="uc-img-ai-error">${esc(s.last_ai_error)}</div>`:'';
    const provider=s.provider_meta?.provider?`最近來源：${esc(s.provider_meta.provider)}${s.provider_meta.model?` · ${esc(s.provider_meta.model)}`:''}${s.provider_meta.project_alias?` · ${esc(s.provider_meta.project_alias)}`:''}${s.provider_meta.response_contract?` · ${esc(s.provider_meta.response_contract)}`:''}`:'尚無 AI 回應來源';
    const recognitionNote=supportsPublicMasterRecognition(cfg.scenario)?'<br><b>公版約束：</b>AI 先回傳 MATCHED / AMBIGUOUS / UNMATCHED Recognition；平台再驗證 Public Master 並編譯 Update Package。':' ';
    return `<section class="uc-img-scenario" data-scenario="${key}"><div class="uc-img-scenario-head"><div><b>${esc(cfg.label)}</b><div class="notice">scenario=<code>${esc(cfg.scenario)}</code> · 已指定 ${count(key)} 張</div></div><label>Coverage <select class="uc-img-coverage"><option value="PARTIAL" ${session.coverage[key]==='PARTIAL'?'selected':''}>PARTIAL／部分畫面</option><option value="USER_CONFIRMED_COMPLETE" ${session.coverage[key]==='USER_CONFIRMED_COMPLETE'?'selected':''}>USER_CONFIRMED_COMPLETE／我確認完整</option></select></label></div><p class="notice">完整 Coverage 只是 Evidence；未出現項目仍不會自動歸零、鎖定或刪除。</p><div class="uc-img-ai-note"><b>雙模式 AI Intake</b><br>內部 Gemini：直接送出目前頁面的圖片 bytes；外部 Prompt：可交給 ChatGPT、Gemini 或其他模型。兩者最後都只會進入同一套 Review / Dry Run / Apply。${recognitionNote}</div><div class="uc-img-ai-bar"><label>分析方式 <select class="uc-img-ai-mode"><option value="internal" ${s.ai_mode==='internal'?'selected':''}>Gemini API 直接分析</option><option value="external" ${s.ai_mode==='external'?'selected':''}>外部 AI Prompt</option></select></label><button class="uc-img-internal" ${prompt&&hasImageBytes(key)?'':'disabled'}>Gemini API 直接分析</button><button class="uc-img-open-settings">API Key / 模型設定</button></div><div class="notice">${esc(byteSummary(key))} · ${provider}</div>${aiError}<details ${s.ai_mode==='external'?'open':''}><summary>外部 AI Prompt／備援模式</summary><textarea class="uc-img-prompt" readonly placeholder="先指定此類型圖片">${esc(prompt)}</textarea><div class="buttons"><button class="uc-img-copy-prompt" ${prompt?'':'disabled'}>複製外部 AI Prompt</button></div></details>${stale}<label><b>AI JSON（原始辨識結果，可直接複製供稽核）</b><textarea class="uc-img-response" placeholder="內部 Gemini 成功後會自動顯示；也可貼 raw JSON 或 JSON code fence">${esc(s.raw_response||'')}</textarea></label><div class="buttons"><button class="uc-img-copy-json" ${s.raw_response?'':'disabled'}>複製 JSON</button><button class="uc-img-copy-diagnostic" ${s.raw_response?'':'disabled'}>複製 AI 診斷包</button><button class="uc-img-parse">解析／結構檢查</button><button class="uc-img-approve" disabled>確認待覆核</button><button class="uc-img-dry" disabled>使用既有 Dry Run</button><button class="uc-img-apply danger" disabled>套用更新</button></div><div class="uc-img-result" data-result>尚未解析。</div><div class="uc-img-issues" data-issues></div><div data-preview></div></section>`;
  };
  function render(){
    root.innerHTML=`<div class="uc-img-a-head"><div><h3>從遊戲截圖更新 <small>UC.IMG-A</small></h3><p class="notice">本週環境、食材庫存、料理狀態。支援 Gemini API 直接分析與外部 AI Prompt 雙模式；有 Public Master 的情境先做 constrained recognition；圖片只留目前頁面記憶體。</p></div><span class="badge">${esc(session.session_id)}</span></div><div class="uc-img-privacy">隱私：Public Master 候選只包含公版資料，不含玩家庫存／解鎖／私人寶可夢；截圖不會寫入 SQLite 或 GitHub；Gemini API Key 沿用既有 Key Vault / Project Pool。只有平台 revalidate 後的 MATCHED 才能進既有 Review → Dry Run → Snapshot → Apply。</div><div class="uc-img-a-toolbar buttons"><label>加入截圖 <input id="ucImgFiles" type="file" accept="image/*" multiple></label><button id="ucImgReset">建立新工作階段</button><button id="ucImgReload">重新載入資料畫面</button></div><div class="notice">圖片：${session.entries.length} 張；Weekly=${count('weekly')}、食材=${count('ingredients')}、料理=${count('recipes')}、未分類=${session.entries.filter(i=>!i.scenario_key).length}</div><div class="uc-img-a-images">${session.entries.length?session.entries.map(e=>`<article class="uc-img-card" data-entry-id="${esc(e.entry_id)}"><div class="uc-img-preview">${e.object_url?`<img src="${esc(e.object_url)}" alt="${esc(e.image_ref)}">`:`<span>${esc(ucImgByteStateLabel(e))}<br>${e.byte_state==='READ_FAILED'?'請重新選取此圖片':'圖片 bytes 不會持久保存'}</span>`}</div><div class="uc-img-ref">${esc(e.image_ref)}</div><div class="uc-img-meta">${esc(e.file_name)} · ${e.file_size?`${Math.round(e.file_size/1024)} KB`:'metadata only'} · <span class="${e.byte_state==='READ_FAILED'?'uc-img-byte-error':''}">${esc(ucImgByteStateLabel(e))}</span></div><select class="uc-img-classify">${scenarioOptions(e.scenario_key)}</select><div class="buttons"><button class="uc-img-remove">移除</button></div></article>`).join(''):'<div class="notice">尚未加入圖片。</div>'}</div><div class="uc-img-scenarios">${scenarioKeys.map(panelMarkup).join('')}</div>`;
    bind();for(const key of scenarioKeys)renderResult(key);
  }
  function bind(){
    root.querySelector('#ucImgFiles').onchange=async event=>{
      const files=[...event.target.files];if(!files.length)return;
      // v0.4.11.2: start every picker read immediately. Do not retain Android File references as long-lived runtime authority.
      const jobs=files.map(file=>{
        const entry=addScreenshotEntry(session,file);entry.byte_state='PENDING';entry.byte_error=null;
        return snapshotUcImgPickerFile(file).then(snapshot=>({ok:true,entry,snapshot})).catch(error=>({ok:false,entry,error}));
      });
      save();clearRt();render();
      const results=await Promise.all(jobs),failures=[];
      for(const result of results){
        const {entry}=result;
        if(result.ok){
          runtime.files.set(entry.entry_id,result.snapshot.blob);entry.byte_state='READY';entry.byte_error=null;entry.byte_snapshot_size=result.snapshot.byte_length;entry.mime_type=result.snapshot.mime_type;entry.image_available=true;
          try{entry.object_url=URL.createObjectURL(result.snapshot.blob);}catch{entry.object_url=null;}
        }else{
          runtime.files.delete(entry.entry_id);entry.byte_state='READ_FAILED';entry.byte_error=result.error?.message||String(result.error);entry.byte_snapshot_size=0;entry.image_available=false;entry.object_url=null;failures.push(entry);
        }
      }
      save();clearRt();render();
      if(failures.length)alert(`有 ${failures.length} 張圖片在選取後立即讀取失敗，已禁止內部 Gemini：\n${failures.map(entry=>`${entry.image_ref} ${entry.file_name}`).join('\n')}\n請重新選取失敗圖片。`);
    };
    root.querySelector('#ucImgReset').onclick=()=>{if(!confirm('建立新的截圖更新工作階段？目前尚未套用的分類與 AI JSON 將清除。'))return;for(const e of session.entries||[])if(e.object_url)URL.revokeObjectURL(e.object_url);runtime.files.clear();session=createScreenshotUpdateSession();save();clearRt();render();};
    root.querySelector('#ucImgReload').onclick=()=>location.reload();
    root.querySelectorAll('.uc-img-card').forEach(card=>{const id=card.dataset.entryId;card.querySelector('.uc-img-classify').onchange=e=>{assignScreenshotScenario(session,id,e.target.value,{manual:true});save();clearRt();render();};card.querySelector('.uc-img-remove').onclick=()=>{runtime.files.delete(id);removeScreenshotEntry(session,id);save();clearRt();render();};});
    root.querySelectorAll('.uc-img-scenario').forEach(panel=>{
      const key=panel.dataset.scenario;
      panel.querySelector('.uc-img-coverage').onchange=e=>{setScenarioCoverage(session,key,e.target.value);save();clearRt(key);render();};
      panel.querySelector('.uc-img-ai-mode').onchange=e=>{setScenarioAiMode(session,key,e.target.value);save();render();};
      panel.querySelector('.uc-img-internal').onclick=()=>runInternal(key);
      panel.querySelector('.uc-img-open-settings').onclick=()=>{document.querySelector('nav button[data-view="guide"]')?.click();setTimeout(()=>document.getElementById('aiProjectPoolSettings')?.scrollIntoView({behavior:'smooth',block:'start'}),0);};
      panel.querySelector('.uc-img-copy-prompt').onclick=async()=>{try{await copyText(buildScreenshotScenarioPrompt(session,key));alert('外部 AI Prompt 已複製；請連同對應圖片交給信賴的 AI 模型。');}catch(error){alert(`複製失敗：${error.message}`);}};
      panel.querySelector('.uc-img-copy-json').onclick=async()=>{try{await copyText(session.scenario_state[key]?.raw_response||'');alert('AI JSON 已複製。');}catch(error){alert(`複製失敗：${error.message}`);}};
      panel.querySelector('.uc-img-copy-diagnostic').onclick=async()=>{try{const r=rt(key),state=session.scenario_state[key];const validation=r.result||validateScreenshotScenarioPayload(session,key,state?.raw_response||'');const bundle=buildUcImgDiagnosticBundle({appVersion:globalThis.PokemonSleepVersionAuthority?.app_version||document.documentElement.dataset.appVersion||null,session,scenarioKey:key,config:UC_IMG_A_SCENARIOS[key],coverage:session.coverage[key],rawResponse:state?.raw_response||'',validation,providerMeta:state?.provider_meta});await copyText(JSON.stringify(bundle,null,2));alert('AI 診斷包已複製；不含 API Key 與圖片 bytes。');}catch(error){alert(`診斷包建立失敗：${error.message}`);}};
      panel.querySelector('.uc-img-response').oninput=e=>{const state=session.scenario_state[key];state.raw_response=e.target.value;state.response_prompt_revision=screenshotScenarioRevision(session,key);state.response_stale=false;state.last_apply_status=null;state.last_ai_error=null;state.provider_meta={provider:'external_or_manual',model:null,project_alias:null,image_count:count(key),response_contract:null,completed_at:nowIso()};save();clearRt(key);};
      panel.querySelector('.uc-img-parse').onclick=()=>parse(key);panel.querySelector('.uc-img-approve').onclick=()=>approve(key);panel.querySelector('.uc-img-dry').onclick=()=>dry(key);panel.querySelector('.uc-img-apply').onclick=()=>apply(key);
    });
  }
  async function runInternal(key){
    const cfg=UC_IMG_A_SCENARIOS[key],entries=scenarioEntries(session,key),state=session.scenario_state[key],r=rt(key);if(r.busy)return;
    if(!hasImageBytes(key))return alert('內部 Gemini 只接受已完成平台記憶體快照的圖片。若顯示準備中／讀取失敗／重新整理後遺失，請重新選取圖片。');
    const poolData=globalThis.PokemonSleepAiProjectPool;if(!poolData?.projects?.length)return alert('尚未設定 Gemini API Key。請先到「使用說明 → AI API Key 與備援 Project」設定並測試 Key。');
    r.busy=true;state.last_ai_error=null;render();
    try{
      const analysis=await analyzeUcImgScenarioWithGemini({scenarioKey:key,config:cfg,entries,fileMap:runtime.files,prompt:buildScreenshotScenarioPrompt(session,key),poolData,onTrace:(event,details)=>globalThis.DebugTrace?.record?.('uc_img_gemini',event,{status:event.endsWith('failed')?'failed':event.endsWith('completed')?'completed':'started',details})});
      globalThis.PokemonSleepAiProjectPool={...poolData,projects:analysis.projects};
      state.raw_response=analysis.raw_json;state.response_prompt_revision=screenshotScenarioRevision(session,key);state.response_stale=false;state.last_apply_status=null;state.ai_mode='internal';state.provider_meta={provider:'gemini',model:analysis.model,project_alias:analysis.project_alias,image_count:analysis.image_count,response_contract:analysis.response_contract,completed_at:analysis.completed_at};state.last_ai_error=null;save();
      r.result=validateScreenshotScenarioPayload(session,key,analysis.payload);r.preview=null;
    }catch(error){state.last_ai_error=error?.message||String(error);save();alert(`Gemini 分析失敗：${state.last_ai_error}`);}
    finally{r.busy=false;render();}
  }
  function parse(key){const state=session.scenario_state[key];if(state?.response_stale)return alert('目前 AI JSON 已過期；請依最新圖片分類／Coverage／Public Master 重新產生並貼回。');const r=rt(key);r.preview=null;r.result=validateScreenshotScenarioPayload(session,key,state?.raw_response||'');renderResult(key);}
  function resolveRecognition(key,observationId,action,displayName=null){
    try{
      const state=session.scenario_state[key],value=extractJsonObjectText(state?.raw_response||''),raw=typeof value==='string'?JSON.parse(value):clone(value);
      if(!isPublicMasterRecognitionPayload(raw))throw new Error('目前 AI JSON 不是 Public Master Recognition 格式');
      const updated=applyPublicMasterRecognitionResolution(raw,UC_IMG_A_SCENARIOS[key].scenario,observationId,action,displayName);
      state.raw_response=JSON.stringify(updated,null,2);state.response_prompt_revision=screenshotScenarioRevision(session,key);state.response_stale=false;save();
      const r=rt(key);r.preview=null;r.result=validateScreenshotScenarioPayload(session,key,updated);renderResult(key);
    }catch(error){alert(`Public Master 對應失敗：${error.message}`);}
  }
  function approve(key){
    const r=rt(key);if(!r.result?.payload||!r.result.review?.length)return;
    const genericReview=r.result.review.filter(item=>item.kind!=='public_master_recognition');
    if(!genericReview.length)return alert('請使用 Public Master 對應卡逐筆處理 AMBIGUOUS / UNMATCHED 項目。');
    if(!confirm(`確認已人工檢查 ${genericReview.length} 筆待覆核項目？`))return;
    const approved=approveReviewed(r.result.payload);const state=session.scenario_state[key];state.raw_response=JSON.stringify(approved,null,2);state.response_prompt_revision=screenshotScenarioRevision(session,key);state.response_stale=false;save();r.result=validateScreenshotScenarioPayload(session,key,approved);r.preview=null;renderResult(key);
  }
  function dry(key){const r=rt(key);if(session.scenario_state[key]?.response_stale)return alert('AI JSON 已過期，請重新辨識。');if(!r.result?.payload)return;if(r.result.errors.length||r.result.review.length)return alert('請先排除結構錯誤與 Public Master／人工待覆核項目');try{r.preview=dryRun(r.result.payload);renderResult(key);}catch(error){alert(error.message);}}
  async function apply(key){const r=rt(key);if(session.scenario_state[key]?.response_stale)return alert('AI JSON 已過期，禁止套用。');if(!r.result?.payload||!r.preview||r.preview.conflict_count)return;if(!confirm(`確定套用 ${UC_IMG_A_SCENARIOS[key].label} 更新？`))return;try{const result=await applyPayload(r.result.payload);const state=session.scenario_state[key];state.last_update_id=r.result.payload.update_id;state.last_apply_status='APPLIED';session.status='partially_applied';save();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'uc-img-a',scenario:key,update_id:r.result.payload.update_id}}));alert(`更新完成，共 ${result.operation_count} 筆。`);r.preview=null;renderResult(key);}catch(error){alert(`套用失敗：${error.message}`);}}
  function renderResult(key){
    const panel=root.querySelector(`.uc-img-scenario[data-scenario="${key}"]`);if(!panel)return;const r=rt(key),result=r.result,state=session.scenario_state[key]||emptyScenarioState(),resultEl=panel.querySelector('[data-result]'),issues=panel.querySelector('[data-issues]'),preview=panel.querySelector('[data-preview]'),approveBtn=panel.querySelector('.uc-img-approve'),dryBtn=panel.querySelector('.uc-img-dry'),applyBtn=panel.querySelector('.uc-img-apply'),internalBtn=panel.querySelector('.uc-img-internal');
    if(internalBtn){internalBtn.disabled=r.busy||!hasImageBytes(key);internalBtn.textContent=r.busy?'Gemini 分析中…':'Gemini API 直接分析';}
    if(state.response_stale){resultEl.textContent='AI JSON 已過期；請依最新 Prompt／Public Master 重新辨識。';issues.innerHTML='';preview.innerHTML='';approveBtn.disabled=dryBtn.disabled=applyBtn.disabled=true;return;}
    if(!result){resultEl.textContent=state.last_apply_status==='APPLIED'?`已套用 update_id=${state.last_update_id}`:'尚未解析。';issues.innerHTML='';preview.innerHTML='';approveBtn.disabled=dryBtn.disabled=applyBtn.disabled=true;return;}
    const rec=result.summary.recognition_contract?` · Master：<b>${esc(result.summary.recognition_authority||'—')}</b> · MATCHED：<b>${result.summary.recognition_matched_count||0}</b> · 未解：<b>${result.summary.recognition_unresolved_count||0}</b> · 忽略：<b>${result.summary.recognition_ignored_count||0}</b>`:'';
    resultEl.innerHTML=`操作：<b>${result.summary.operation_count||0}</b> · 圖片：<b>${result.summary.assigned_image_count||0}</b> · coverage：<b>${esc(result.summary.coverage||'—')}</b> · Evidence：<b>${result.summary.traceable_evidence?'PASS':'FAIL'}</b> · 錯誤：<b>${result.errors.length}</b> · 警告：<b>${result.warnings.length}</b> · 待覆核：<b>${result.review.length}</b>${rec}`;
    const genericReview=result.review.filter(item=>item.kind!=='public_master_recognition');
    const messages=[...result.errors.map(v=>`<div class="status-conflict">錯誤：${esc(v)}</div>`),...result.warnings.map(v=>`<div>警告：${esc(v)}</div>`),...genericReview.map(v=>`<div>待覆核：${esc(v.operation_id)}／${esc(v.entity)}</div>`)].join('');
    issues.innerHTML=(messages||(!result.recognition?.unresolved?.length?'<div class="status-ready">結構檢查通過。</div>':''))+recognitionReviewHtml(result);
    issues.querySelectorAll('.uc-img-recognition-card').forEach(card=>{
      const observationId=card.dataset.observationId,select=card.querySelector('.uc-img-rec-candidate');
      card.querySelector('[data-rec-action="MATCH"]').onclick=()=>{if(!select.value)return alert('請先選擇一個公版候選。');resolveRecognition(key,observationId,'MATCH',select.value);};
      card.querySelector('[data-rec-action="IGNORE"]').onclick=()=>{if(confirm('確認這一列是辨識誤判或非目標 UI 文字，忽略且不建立更新 operation？'))resolveRecognition(key,observationId,'IGNORE');};
      card.querySelector('[data-rec-action="MASTER_GAP"]').onclick=()=>{if(confirm('確認畫面確實存在此項目，但目前 Public Master 沒有可靠對應？此動作只保留 gap evidence，不會寫入玩家資料或公版 Master。'))resolveRecognition(key,observationId,'MASTER_GAP');};
    });
    approveBtn.disabled=!genericReview.length;dryBtn.disabled=Boolean(result.errors.length||result.review.length);preview.innerHTML=previewHtml(r.preview);applyBtn.disabled=!r.preview||r.preview.conflict_count!==0||Boolean(result.errors.length||result.review.length);
  }
  render();return {get session(){return session;},runtime,render};
}

function boot(){try{mountUnifiedScreenshotUpdateCenter();}catch(error){console.error('UC.IMG-A mount failed',error);}}
if(hasDocument){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);}
