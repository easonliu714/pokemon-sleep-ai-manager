import {PROMPT_CATALOG} from './prompt-catalog.js';
import {validateWorkflow,approveReviewed} from './ai-workflow.js';
import {dryRun,applyPayload} from './importer.js';

export const UC_IMG_A_VERSION='uc-img-a-2026-08-11-a';
export const UC_IMG_A_STORAGE_KEY='pokemon-sleep-uc-img-a-session-v1';
export const UC_IMG_A_COVERAGE=Object.freeze(['PARTIAL','USER_CONFIRMED_COMPLETE']);
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

export function createScreenshotUpdateSession(){
  return {
    schema:'pokemon-sleep-uc-img-a-session/1.0',version:UC_IMG_A_VERSION,
    session_id:`ucimg-${token()}`,created_at:nowIso(),updated_at:nowIso(),status:'draft',next_image_number:1,
    entries:[],coverage:Object.fromEntries(scenarioKeys.map(key=>[key,'PARTIAL'])),
    scenario_state:Object.fromEntries(scenarioKeys.map(key=>[key,{raw_response:'',last_update_id:null,last_apply_status:null}])),
  };
}

export function guessScreenshotScenario(fileName=''){
  const name=String(fileName).toLowerCase();
  if(/weekly|week|camp|event|snorlax|營地|活動|卡比獸|本週/.test(name))return 'weekly';
  if(/ingredient|food|bag.*ingredient|食材|材料/.test(name))return 'ingredients';
  if(/recipe|curry|salad|dessert|drink|meal|料理|食譜|咖哩|濃湯|沙拉|甜點|飲料/.test(name))return 'recipes';
  return null;
}

export function addScreenshotEntry(session,fileLike={}){
  const number=Number(session.next_image_number||1),guessed=guessScreenshotScenario(fileLike.name||'');
  const entry={
    entry_id:`entry-${token()}`,image_ref:`image-${String(number).padStart(3,'0')}`,
    file_name:String(fileLike.name||`image-${number}`),file_size:Number(fileLike.size||0),mime_type:String(fileLike.type||''),
    scenario_key:guessed||'',classification_source:guessed?'filename_hint':'unclassified',selected_at:nowIso(),
    object_url:null,image_available:false,
  };
  session.next_image_number=number+1;session.entries.push(entry);session.updated_at=nowIso();return entry;
}

export function assignScreenshotScenario(session,entryId,scenarioKey,{manual=true}={}){
  if(scenarioKey&&!UC_IMG_A_SCENARIOS[scenarioKey])throw new Error(`不支援的圖片情境：${scenarioKey}`);
  const entry=session.entries.find(item=>item.entry_id===entryId);if(!entry)throw new Error(`找不到圖片 entry：${entryId}`);
  entry.scenario_key=scenarioKey||'';entry.classification_source=manual?'manual':'system';session.updated_at=nowIso();return entry;
}

export function removeScreenshotEntry(session,entryId){
  const index=session.entries.findIndex(item=>item.entry_id===entryId);if(index<0)return null;
  const [removed]=session.entries.splice(index,1);if(removed?.object_url&&typeof URL!=='undefined')URL.revokeObjectURL(removed.object_url);
  session.updated_at=nowIso();return removed;
}

export function setScenarioCoverage(session,scenarioKey,coverage){
  if(!UC_IMG_A_SCENARIOS[scenarioKey])throw new Error(`不支援的情境：${scenarioKey}`);
  if(!UC_IMG_A_COVERAGE.includes(coverage))throw new Error(`不支援 coverage：${coverage}`);
  session.coverage[scenarioKey]=coverage;session.updated_at=nowIso();return coverage;
}

export function serializableScreenshotSession(session){
  const copy=clone(session);copy.entries=(copy.entries||[]).map(entry=>({...entry,object_url:null,image_available:false}));return copy;
}

export function persistScreenshotSession(session,storage=hasWindow?window.localStorage:null){
  if(!storage)return false;session.updated_at=nowIso();storage.setItem(UC_IMG_A_STORAGE_KEY,JSON.stringify(serializableScreenshotSession(session)));return true;
}

export function restoreScreenshotSession(storage=hasWindow?window.localStorage:null){
  if(!storage)return createScreenshotUpdateSession();
  try{
    const raw=storage.getItem(UC_IMG_A_STORAGE_KEY);if(!raw)return createScreenshotUpdateSession();
    const parsed=JSON.parse(raw);if(parsed?.schema!=='pokemon-sleep-uc-img-a-session/1.0')return createScreenshotUpdateSession();
    parsed.entries=Array.isArray(parsed.entries)?parsed.entries.map(entry=>({...entry,object_url:null,image_available:false})):[];
    parsed.coverage={...Object.fromEntries(scenarioKeys.map(key=>[key,'PARTIAL'])),...(parsed.coverage||{})};
    parsed.scenario_state={...Object.fromEntries(scenarioKeys.map(key=>[key,{raw_response:'',last_update_id:null,last_apply_status:null}])),...(parsed.scenario_state||{})};
    for(const key of scenarioKeys)parsed.scenario_state[key]={raw_response:'',last_update_id:null,last_apply_status:null,...(parsed.scenario_state[key]||{})};
    return parsed;
  }catch{return createScreenshotUpdateSession();}
}

export function scenarioEntries(session,scenarioKey){return (session.entries||[]).filter(entry=>entry.scenario_key===scenarioKey);}

export function buildScreenshotScenarioPrompt(session,scenarioKey){
  const config=UC_IMG_A_SCENARIOS[scenarioKey];if(!config)throw new Error(`不支援的情境：${scenarioKey}`);
  const entries=scenarioEntries(session,scenarioKey);if(!entries.length)throw new Error(`「${config.label}」尚未指定任何圖片`);
  const coverage=session.coverage?.[scenarioKey]||'PARTIAL',refs=entries.map(entry=>entry.image_ref),base=PROMPT_CATALOG[config.promptKey]?.prompt;
  if(!base)throw new Error(`找不到 Prompt Catalog：${config.promptKey}`);
  return `${base}\n\nUC.IMG-A 截圖工作階段規則：\n- session_id=${session.session_id}\n- scenario=${config.scenario}\n- 本次圖片 image_ref：${refs.join('、')}\n- coverage=${coverage}\n- 只分析本次列出的圖片，不得引用其他對話、上週圖片或一般遊戲知識補玩家狀態。\n- 每筆 operation.evidence.source_image_ref 必須使用上述 image_ref 之一；多張共同支持時可加 evidence.source_image_refs。\n- coverage=PARTIAL 表示只涵蓋部分畫面；沒有出現的食材／料理絕對不得補 0、補未解鎖或清空。\n- coverage=USER_CONFIRMED_COMPLETE 只代表使用者確認本 session 已涵蓋完整畫面範圍；它是 completeness evidence，不授權你為未出現項目新增 0、false、delete 或 clear_fields。\n- 圖片檔名不是資料 Evidence，真正內容只能依圖片可見文字／數值。\n- 仍須遵守原情境 Prompt 的所有 fail-closed / review_required 規則。`;
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
  let payload;
  try{const value=extractJsonObjectText(input);payload=typeof value==='string'?JSON.parse(value):clone(value);}
  catch(error){return {ok:false,payload:null,errors:[`JSON 解析失敗：${error.message}`],warnings:[],review:[],summary:{scenario:config.scenario}};}
  const workflow=validateWorkflow(payload),errors=[...(workflow.errors||[])],warnings=[...(workflow.warnings||[])],review=[...(workflow.review||[])];
  if(payload.scenario!==config.scenario)errors.push(`scenario 必須為 ${config.scenario}，目前為 ${payload.scenario||'未提供'}`);
  const allowed=new Set(config.entities),ops=Array.isArray(payload.operations)?payload.operations:[],assignedRefs=new Set(scenarioEntries(session,scenarioKey).map(entry=>entry.image_ref));
  if(!assignedRefs.size)errors.push(`「${config.label}」沒有已指定圖片`);if(scenarioKey==='weekly'&&ops.length!==1)errors.push('Weekly Context 必須只有 1 筆 operation');
  const seen=new Set();
  ops.forEach((operation,index)=>{
    const label=`#${index+1}`;if(!allowed.has(operation.entity))errors.push(`${label} entity ${operation.entity||'未提供'} 不屬於 UC.IMG-A ${config.label}`);
    if(operation.action!=='upsert')errors.push(`${label} 截圖更新只允許 action=upsert`);if(scenarioKey==='weekly'&&operation.entity!=='weekly_context')errors.push(`${label} Weekly 只能更新 weekly_context`);
    const signature=operationKeySignature(operation);if(seen.has(signature))warnings.push(`${label} 與其他 operation 使用相同目標 key：${signature}；請確認多圖重疊是否重複辨識`);seen.add(signature);
    const refs=evidenceRefs(operation);if(!refs.length)errors.push(`${label} 缺少 evidence.source_image_ref/source_image_refs`);for(const ref of refs)if(!assignedRefs.has(ref))errors.push(`${label} evidence 引用了不屬於本情境的 image_ref：${ref}`);
  });
  const coverage=session.coverage?.[scenarioKey]||'PARTIAL';if(!UC_IMG_A_COVERAGE.includes(coverage))errors.push(`不合法 coverage：${coverage}`);
  if(coverage==='USER_CONFIRMED_COMPLETE')warnings.push('本次 coverage 已由使用者標記完整；此標記不代表未出現項目可自動歸零/未解鎖。');
  const uniqueErrors=[...new Set(errors)],uniqueWarnings=[...new Set(warnings)];
  return {ok:uniqueErrors.length===0&&review.length===0,payload,errors:uniqueErrors,warnings:uniqueWarnings,review,summary:{...(workflow.summary||{}),uc_img_a_version:UC_IMG_A_VERSION,session_id:session.session_id,scenario_key:scenarioKey,expected_scenario:config.scenario,assigned_image_count:assignedRefs.size,coverage,traceable_evidence:ops.length>0&&ops.every(operation=>evidenceRefs(operation).length>0)}};
}

function installStyle(){
  if(!hasDocument||document.getElementById('ucImgAStyle'))return;const el=document.createElement('style');el.id='ucImgAStyle';
  el.textContent=`.uc-img-a{margin-top:18px;border:1px solid #cfe0d7;background:#fafffc}.uc-img-a h3{margin-top:0}.uc-img-a-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.uc-img-a-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.uc-img-a-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:14px 0}.uc-img-card,.uc-img-scenario{border:1px solid #dbe4df;border-radius:12px;padding:10px;background:#fff;min-width:0}.uc-img-preview{aspect-ratio:16/9;background:#eef4f1;border-radius:9px;overflow:hidden;display:grid;place-items:center;color:#687d74;margin-bottom:8px;text-align:center}.uc-img-preview img{width:100%;height:100%;object-fit:contain;background:#111}.uc-img-meta{font-size:.82rem;color:#687d74;overflow-wrap:anywhere}.uc-img-ref{font-weight:800;color:#1f7a5a}.uc-img-card select,.uc-img-scenario textarea{width:100%}.uc-img-card select{margin-top:8px}.uc-img-scenarios{display:grid;gap:12px}.uc-img-scenario-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.uc-img-scenario textarea{min-height:150px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45}.uc-img-prompt{min-height:190px}.uc-img-result{margin-top:10px;padding:10px;border-radius:9px;background:#f4f7f5;overflow-wrap:anywhere}.uc-img-preview-table{overflow:auto;max-width:100%;margin-top:10px}.uc-img-preview-table table{min-width:560px}.uc-img-privacy{padding:10px;border-radius:9px;background:#fff8df;color:#6c5710;line-height:1.5}@media(max-width:700px){.uc-img-a{padding:12px}.uc-img-a-images{grid-template-columns:1fr 1fr}.uc-img-a-toolbar>*{flex:1 1 150px}.uc-img-scenario{padding:10px}.uc-img-preview-table{border:1px solid #dbe4df;border-radius:10px}}@media(max-width:420px){.uc-img-a-images{grid-template-columns:1fr}}`;
  document.head.appendChild(el);
}
const scenarioOptions=selected=>`<option value="">未分類</option>${scenarioKeys.map(key=>`<option value="${key}" ${selected===key?'selected':''}>${esc(UC_IMG_A_SCENARIOS[key].label)}</option>`).join('')}`;
const previewHtml=preview=>!preview?.changes?.length?'<div class="notice">尚無 Dry Run 差異。</div>':`<div class="uc-img-preview-table"><table><thead><tr><th>#</th><th>實體</th><th>要求</th><th>實際</th><th>狀態</th><th>訊息</th></tr></thead><tbody>${preview.changes.map(c=>`<tr><td>${esc(c.index)}</td><td>${esc(c.entity)}</td><td>${esc(c.requested_action)}</td><td>${esc(c.effective_action)}</td><td>${esc(c.status)}</td><td>${esc(c.message||'')}</td></tr>`).join('')}</tbody></table></div>`;

export function mountUnifiedScreenshotUpdateCenter(){
  if(!hasDocument)return null;const host=document.getElementById('updateCenterDynamicContent');if(!host||document.getElementById('ucImgA'))return null;installStyle();
  let session=restoreScreenshotSession();const runtime={};const root=document.createElement('section');root.id='ucImgA';root.className='panel uc-img-a';host.prepend(root);
  const save=()=>persistScreenshotSession(session),rt=key=>(runtime[key]??={result:null,preview:null}),clearRt=key=>{if(key)runtime[key]={result:null,preview:null};else for(const k of scenarioKeys)runtime[k]={result:null,preview:null};},count=key=>scenarioEntries(session,key).length;
  const panelMarkup=key=>{
    const cfg=UC_IMG_A_SCENARIOS[key],s=session.scenario_state[key]||{};let prompt='';try{if(count(key))prompt=buildScreenshotScenarioPrompt(session,key);}catch{}
    return `<section class="uc-img-scenario" data-scenario="${key}"><div class="uc-img-scenario-head"><div><b>${esc(cfg.label)}</b><div class="notice">scenario=<code>${esc(cfg.scenario)}</code> · 已指定 ${count(key)} 張</div></div><label>Coverage <select class="uc-img-coverage"><option value="PARTIAL" ${session.coverage[key]==='PARTIAL'?'selected':''}>PARTIAL／部分畫面</option><option value="USER_CONFIRMED_COMPLETE" ${session.coverage[key]==='USER_CONFIRMED_COMPLETE'?'selected':''}>USER_CONFIRMED_COMPLETE／我確認完整</option></select></label></div><p class="notice">完整 Coverage 只是 Evidence；未出現項目仍不會自動歸零、鎖定或刪除。</p><textarea class="uc-img-prompt" readonly placeholder="先指定此類型圖片">${esc(prompt)}</textarea><div class="buttons"><button class="uc-img-copy-prompt" ${prompt?'':'disabled'}>複製此情境 Prompt</button></div><label><b>貼回 AI JSON</b><textarea class="uc-img-response" placeholder="可貼 raw JSON 或 JSON code fence">${esc(s.raw_response||'')}</textarea></label><div class="buttons"><button class="uc-img-parse">解析／結構檢查</button><button class="uc-img-approve" disabled>確認待覆核</button><button class="uc-img-dry" disabled>使用既有 Dry Run</button><button class="uc-img-apply danger" disabled>套用更新</button></div><div class="uc-img-result" data-result>尚未解析。</div><div class="uc-img-issues" data-issues></div><div data-preview></div></section>`;
  };
  function render(){
    root.innerHTML=`<div class="uc-img-a-head"><div><h3>從遊戲截圖更新 <small>UC.IMG-A</small></h3><p class="notice">Phase A：本週環境、食材庫存、料理狀態。圖片只留目前頁面記憶體；重新整理後保留分類、Coverage 與 AI JSON，但不保留圖片 bytes。</p></div><span class="badge">${esc(session.session_id)}</span></div><div class="uc-img-privacy">隱私：截圖不會寫入 SQLite 或 GitHub。請把 Prompt 與對應圖片交給信賴的 AI 模型辨識；套用仍經既有 Review → Dry Run → Snapshot → Apply。</div><div class="uc-img-a-toolbar buttons"><label>加入截圖 <input id="ucImgFiles" type="file" accept="image/*" multiple></label><button id="ucImgReset">建立新工作階段</button><button id="ucImgReload">重新載入資料畫面</button></div><div class="notice">圖片：${session.entries.length} 張；Weekly=${count('weekly')}、食材=${count('ingredients')}、料理=${count('recipes')}、未分類=${session.entries.filter(i=>!i.scenario_key).length}</div><div class="uc-img-a-images">${session.entries.length?session.entries.map(e=>`<article class="uc-img-card" data-entry-id="${esc(e.entry_id)}"><div class="uc-img-preview">${e.object_url?`<img src="${esc(e.object_url)}" alt="${esc(e.image_ref)}">`:'<span>圖片 bytes 未保留<br>需要時重新選取即可</span>'}</div><div class="uc-img-ref">${esc(e.image_ref)}</div><div class="uc-img-meta">${esc(e.file_name)} · ${e.file_size?`${Math.round(e.file_size/1024)} KB`:'metadata only'}</div><select class="uc-img-classify">${scenarioOptions(e.scenario_key)}</select><div class="buttons"><button class="uc-img-remove">移除</button></div></article>`).join(''):'<div class="notice">尚未加入圖片。</div>'}</div><div class="uc-img-scenarios">${scenarioKeys.map(panelMarkup).join('')}</div>`;
    bind();for(const key of scenarioKeys)renderResult(key);
  }
  function bind(){
    root.querySelector('#ucImgFiles').onchange=event=>{for(const file of [...event.target.files]){const entry=addScreenshotEntry(session,file);try{entry.object_url=URL.createObjectURL(file);entry.image_available=true;}catch{}}save();clearRt();render();};
    root.querySelector('#ucImgReset').onclick=()=>{if(!confirm('建立新的截圖更新工作階段？目前尚未套用的分類與 AI JSON 將清除。'))return;for(const e of session.entries||[])if(e.object_url)URL.revokeObjectURL(e.object_url);session=createScreenshotUpdateSession();save();clearRt();render();};
    root.querySelector('#ucImgReload').onclick=()=>location.reload();
    root.querySelectorAll('.uc-img-card').forEach(card=>{const id=card.dataset.entryId;card.querySelector('.uc-img-classify').onchange=e=>{assignScreenshotScenario(session,id,e.target.value,{manual:true});save();clearRt();render();};card.querySelector('.uc-img-remove').onclick=()=>{removeScreenshotEntry(session,id);save();clearRt();render();};});
    root.querySelectorAll('.uc-img-scenario').forEach(panel=>{const key=panel.dataset.scenario;panel.querySelector('.uc-img-coverage').onchange=e=>{setScenarioCoverage(session,key,e.target.value);save();clearRt(key);render();};panel.querySelector('.uc-img-copy-prompt').onclick=async()=>{try{await navigator.clipboard.writeText(buildScreenshotScenarioPrompt(session,key));alert('Prompt 已複製；請連同對應圖片交給信賴的 AI 模型。');}catch(error){alert(`複製失敗：${error.message}`);}};panel.querySelector('.uc-img-response').oninput=e=>{session.scenario_state[key].raw_response=e.target.value;session.scenario_state[key].last_apply_status=null;save();clearRt(key);};panel.querySelector('.uc-img-parse').onclick=()=>parse(key);panel.querySelector('.uc-img-approve').onclick=()=>approve(key);panel.querySelector('.uc-img-dry').onclick=()=>dry(key);panel.querySelector('.uc-img-apply').onclick=()=>apply(key);});
  }
  function parse(key){const r=rt(key);r.preview=null;r.result=validateScreenshotScenarioPayload(session,key,session.scenario_state[key]?.raw_response||'');renderResult(key);}
  function approve(key){const r=rt(key);if(!r.result?.payload||!r.result.review?.length)return;if(!confirm(`確認已人工檢查 ${r.result.review.length} 筆待覆核項目？`))return;const approved=approveReviewed(r.result.payload);session.scenario_state[key].raw_response=JSON.stringify(approved,null,2);save();r.result=validateScreenshotScenarioPayload(session,key,approved);r.preview=null;renderResult(key);}
  function dry(key){const r=rt(key);if(!r.result?.payload)return;if(r.result.errors.length||r.result.review.length)return alert('請先排除結構錯誤與待覆核項目');try{r.preview=dryRun(r.result.payload);renderResult(key);}catch(error){alert(error.message);}}
  async function apply(key){const r=rt(key);if(!r.result?.payload||!r.preview||r.preview.conflict_count)return;if(!confirm(`確定套用 ${UC_IMG_A_SCENARIOS[key].label} 更新？`))return;try{const result=await applyPayload(r.result.payload);session.scenario_state[key].last_update_id=r.result.payload.update_id;session.scenario_state[key].last_apply_status='APPLIED';session.status='partially_applied';save();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'uc-img-a',scenario:key,update_id:r.result.payload.update_id}}));alert(`更新完成，共 ${result.operation_count} 筆。`);r.preview=null;renderResult(key);}catch(error){alert(`套用失敗：${error.message}`);}}
  function renderResult(key){
    const panel=root.querySelector(`.uc-img-scenario[data-scenario="${key}"]`);if(!panel)return;const r=rt(key),result=r.result,resultEl=panel.querySelector('[data-result]'),issues=panel.querySelector('[data-issues]'),preview=panel.querySelector('[data-preview]'),approveBtn=panel.querySelector('.uc-img-approve'),dryBtn=panel.querySelector('.uc-img-dry'),applyBtn=panel.querySelector('.uc-img-apply');
    if(!result){resultEl.textContent=session.scenario_state[key]?.last_apply_status==='APPLIED'?`已套用 update_id=${session.scenario_state[key].last_update_id}`:'尚未解析。';issues.innerHTML='';preview.innerHTML='';approveBtn.disabled=dryBtn.disabled=applyBtn.disabled=true;return;}
    resultEl.innerHTML=`操作：<b>${result.summary.operation_count||0}</b> · 圖片：<b>${result.summary.assigned_image_count||0}</b> · coverage：<b>${esc(result.summary.coverage||'—')}</b> · Evidence：<b>${result.summary.traceable_evidence?'PASS':'FAIL'}</b> · 錯誤：<b>${result.errors.length}</b> · 警告：<b>${result.warnings.length}</b> · 待覆核：<b>${result.review.length}</b>`;
    issues.innerHTML=[...result.errors.map(v=>`<div class="status-conflict">錯誤：${esc(v)}</div>`),...result.warnings.map(v=>`<div>警告：${esc(v)}</div>`),...result.review.map(v=>`<div>待覆核：${esc(v.operation_id)}／${esc(v.entity)}</div>`)].join('')||'<div class="status-ready">結構檢查通過。</div>';
    approveBtn.disabled=!result.review.length;dryBtn.disabled=Boolean(result.errors.length||result.review.length);preview.innerHTML=previewHtml(r.preview);applyBtn.disabled=!r.preview||r.preview.conflict_count!==0||Boolean(result.errors.length||result.review.length);
  }
  render();return {get session(){return session;},runtime,render};
}

function boot(){try{mountUnifiedScreenshotUpdateCenter();}catch(error){console.error('UC.IMG-A mount failed',error);}}
if(hasDocument){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);}
