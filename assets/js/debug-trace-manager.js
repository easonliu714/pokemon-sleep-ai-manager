const TRACE_SCHEMA='pokemon-sleep-debug-trace/1.0';
const STORAGE_KEY='pokemon_sleep_debug_trace_v1';
const MODE_KEY='pokemon_sleep_debug_mode_v1';
const MAX_EVENTS=1500;
const MAX_STORAGE_BYTES=1500000;
const TERMINAL=new Set(['completed','blocked','cancelled','failed','timeout']);
const SENSITIVE=/^(content|data|payload|raw|image|blob|bytes|arrayBuffer|password|token|secret|authorization)$/i;
const uuid=()=>globalThis.crypto?.randomUUID?.()||`dbg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch{return String(value);}};
const byteLength=value=>new Blob([value]).size;

function safeError(error){
  if(!error)return null;
  return {name:String(error.name||'Error'),message:String(error.message||error).slice(0,1000),stack:String(error.stack||'').slice(0,5000)};
}
function safeFile(file){
  const name=String(file?.name||'');
  const ext=(name.match(/\.[^.]+$/)?.[0]||'').toLowerCase();
  return {name_hint:name?`${name.slice(0,2)}***${ext}`:'',extension:ext,type:String(file?.type||''),size:Number(file?.size||0),last_modified:Number(file?.lastModified||0)};
}
function sanitize(value,depth=0,key=''){
  if(depth>5)return '[max-depth]';
  if(SENSITIVE.test(key))return '[redacted]';
  if(value instanceof Error)return safeError(value);
  if(typeof File!=='undefined'&&value instanceof File)return safeFile(value);
  if(typeof FileList!=='undefined'&&value instanceof FileList)return Array.from(value).map(safeFile);
  if(value==null||['string','number','boolean'].includes(typeof value))return typeof value==='string'?value.slice(0,3000):value;
  if(Array.isArray(value))return value.slice(0,100).map(item=>sanitize(item,depth+1,key));
  if(typeof value==='object'){
    const output={};
    for(const [childKey,childValue] of Object.entries(value).slice(0,100))output[childKey]=sanitize(childValue,depth+1,childKey);
    return output;
  }
  return String(value).slice(0,1000);
}
function environment(){
  return {
    url:location.href.split('#')[0],origin:location.origin,path:location.pathname,
    user_agent:navigator.userAgent,language:navigator.language,platform:navigator.platform,
    online:navigator.onLine,display_mode:matchMedia('(display-mode: standalone)').matches?'standalone':'browser',
    viewport:{width:innerWidth,height:innerHeight,device_pixel_ratio:devicePixelRatio},
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    storage:{local_storage:typeof localStorage!=='undefined',indexed_db:typeof indexedDB!=='undefined'},
    service_worker:{supported:'serviceWorker'in navigator,controlled:Boolean(navigator.serviceWorker?.controller)}
  };
}

class DebugTraceManager {
  constructor(){
    this.sessionId=uuid();this.sequence=0;this.events=[];this.operations=new Map();
    this.mode=localStorage.getItem(MODE_KEY)||'standard';this.startedAt=now();this.listenersInstalled=false;
    this.restore();this.record('app','session_started',{status:'started',environment:environment()});
  }
  restore(){
    try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(Array.isArray(saved))this.events=saved.slice(-MAX_EVENTS);}catch{this.events=[];}
  }
  persist(){
    let candidate=this.events.slice(-MAX_EVENTS);
    while(candidate.length&&byteLength(JSON.stringify(candidate))>MAX_STORAGE_BYTES)candidate=candidate.slice(Math.max(1,Math.floor(candidate.length*.1)));
    this.events=candidate;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));}catch(error){console.warn('[DebugTrace] persistence failed',error);}
    this.refreshUI();
  }
  record(category,event,{status='info',operation_id=null,parent_operation_id=null,details=null,error=null,duration_ms=null}={}){
    const entry={schema:TRACE_SCHEMA,seq:++this.sequence,timestamp:now(),monotonic_ms:Math.round(performance.now()),session_id:this.sessionId,operation_id,parent_operation_id,category,event,status,page:document.querySelector('.view.active')?.id||null,details:sanitize(details),error:safeError(error),duration_ms};
    this.events.push(entry);this.persist();return entry;
  }
  begin(name,details={},parentOperationId=null){
    const id=uuid();const started=performance.now();this.operations.set(id,{name,started,parentOperationId});
    this.record('operation',name,{status:'started',operation_id:id,parent_operation_id:parentOperationId,details});return id;
  }
  end(id,status='completed',details={}){
    if(!TERMINAL.has(status))throw new Error(`invalid_terminal_status:${status}`);
    const op=this.operations.get(id);const duration=op?Math.round(performance.now()-op.started):null;
    this.record('operation',op?.name||'unknown_operation',{status,operation_id:id,parent_operation_id:op?.parentOperationId||null,details,duration_ms:duration});this.operations.delete(id);
  }
  fail(id,error,details={}){this.end(id,'failed',{...details,error:safeError(error)});}
  setMode(mode){if(!['standard','detailed'].includes(mode))throw new Error('invalid_debug_mode');this.mode=mode;localStorage.setItem(MODE_KEY,mode);this.record('diagnostic','mode_changed',{status:'completed',details:{mode}});}
  captureState(label,state){return this.record('state',label,{status:'snapshot',details:state});}
  export(){
    const openOperations=Array.from(this.operations.entries()).map(([id,op])=>({operation_id:id,name:op.name,age_ms:Math.round(performance.now()-op.started),parent_operation_id:op.parentOperationId}));
    const report={schema:TRACE_SCHEMA,exported_at:now(),app:{version:document.documentElement.dataset.appVersion||null,build:document.documentElement.dataset.appBuild||null},session:{id:this.sessionId,started_at:this.startedAt,mode:this.mode},environment:environment(),summary:this.summary(),open_operations:openOperations,events:this.events};
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`pokemon_sleep_debug_${report.app.version||'unknown'}_${this.sessionId}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    this.record('diagnostic','trace_exported',{status:'completed',details:{event_count:this.events.length,open_operation_count:openOperations.length}});
  }
  clear(){this.events=[];this.operations.clear();localStorage.removeItem(STORAGE_KEY);this.record('diagnostic','trace_cleared',{status:'completed'});}
  summary(){
    const current=this.events.filter(e=>e.session_id===this.sessionId);return {event_count:current.length,warning_count:current.filter(e=>e.status==='warning').length,error_count:current.filter(e=>e.status==='failed'||e.error).length,last_event:current.at(-1)?.event||null,last_error:[...current].reverse().find(e=>e.status==='failed'||e.error)||null};
  }
  installGlobalListeners(){
    if(this.listenersInstalled)return;this.listenersInstalled=true;
    addEventListener('error',event=>this.record('runtime','window_error',{status:'failed',details:{filename:event.filename,lineno:event.lineno,colno:event.colno},error:event.error||event.message}),true);
    addEventListener('unhandledrejection',event=>this.record('runtime','unhandled_rejection',{status:'failed',error:event.reason}),true);
    addEventListener('online',()=>this.record('network','online',{status:'completed'}));addEventListener('offline',()=>this.record('network','offline',{status:'warning'}));
    document.addEventListener('visibilitychange',()=>this.record('app','visibility_changed',{status:'completed',details:{visibility:document.visibilityState}}));
    document.addEventListener('click',event=>{const target=event.target?.closest?.('button,a,[role="button"]');if(!target)return;this.record('ui','control_clicked',{status:'completed',details:{id:target.id||null,label:(target.textContent||target.getAttribute('aria-label')||'').trim().slice(0,120),view:target.closest('.view')?.id||null,disabled:Boolean(target.disabled)}});},true);
    document.addEventListener('change',event=>{const target=event.target;if(!target)return;const details={id:target.id||null,type:target.type||target.tagName,value_kind:target.type==='file'?'file_selection':'control_change'};if(target.type==='file')details.files=Array.from(target.files||[]).map(safeFile);else if(this.mode==='detailed')details.value=String(target.value||'').slice(0,200);this.record('ui','control_changed',{status:'completed',details});},true);
    document.addEventListener('submit',event=>this.record('ui','form_submitted',{status:'completed',details:{id:event.target?.id||null}}),true);
    navigator.serviceWorker?.addEventListener('controllerchange',()=>this.record('service_worker','controller_changed',{status:'completed',details:{controlled:Boolean(navigator.serviceWorker.controller)}}));
  }
  installUI(){
    if(document.getElementById('diagnostics'))return;
    const nav=document.querySelector('nav');const main=document.querySelector('main');if(!nav||!main)return;
    const button=document.createElement('button');button.dataset.view='diagnostics';button.textContent='診斷中心';nav.append(button);
    const section=document.createElement('section');section.id='diagnostics';section.className='view';section.innerHTML=`<div class="section-head"><h2>診斷中心</h2><span class="badge" id="debugModeBadge"></span></div><div class="cards"><article><strong id="debugSession">—</strong><span>Session</span></article><article><strong id="debugEventCount">0</strong><span>事件</span></article><article><strong id="debugErrorCount">0</strong><span>錯誤</span></article><article><strong id="debugLastEvent">—</strong><span>最後事件</span></article></div><div class="panel"><p id="debugLastError">目前沒有錯誤。</p><div class="buttons"><button id="debugExportBtn">匯出診斷 JSON</button><button id="debugModeBtn">切換詳細模式</button><button id="debugClearBtn" class="danger">清除診斷紀錄</button></div><p class="notice">只記錄操作、狀態、效能與錯誤中繼資料；不匯出圖片、ZIP、資料庫內容或敏感欄位。</p></div><h3>最近事件</h3><div class="table-wrap"><table id="debugEventTable"></table></div>`;main.append(section);
    button.addEventListener('click',()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===section));this.record('navigation','view_changed',{status:'completed',details:{view:'diagnostics'}});this.refreshUI();});
    section.querySelector('#debugExportBtn').addEventListener('click',()=>this.export());section.querySelector('#debugModeBtn').addEventListener('click',()=>this.setMode(this.mode==='standard'?'detailed':'standard'));section.querySelector('#debugClearBtn').addEventListener('click',()=>this.clear());this.refreshUI();
  }
  refreshUI(){
    const summary=this.summary();const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
    set('debugSession',this.sessionId.slice(0,12));set('debugEventCount',summary.event_count);set('debugErrorCount',summary.error_count);set('debugLastEvent',summary.last_event||'—');set('debugModeBadge',`模式：${this.mode}`);set('debugLastError',summary.last_error?`最後錯誤：${summary.last_error.event}／${summary.last_error.error?.message||summary.last_error.status}`:'目前沒有錯誤。');set('debugModeBtn',this.mode==='standard'?'切換詳細模式':'切換標準模式');
    const table=document.getElementById('debugEventTable');if(table){const rows=this.events.filter(e=>e.session_id===this.sessionId).slice(-50).reverse();table.innerHTML='<thead><tr><th>時間</th><th>分類</th><th>事件</th><th>狀態</th><th>操作 ID</th></tr></thead><tbody>'+rows.map(e=>`<tr><td>${e.timestamp.slice(11,23)}</td><td>${e.category}</td><td>${e.event}</td><td>${e.status}</td><td>${e.operation_id?.slice(0,8)||'—'}</td></tr>`).join('')+'</tbody>';}
  }
}

export const debugTrace=new DebugTraceManager();
debugTrace.installGlobalListeners();
addEventListener('DOMContentLoaded',()=>debugTrace.installUI(),{once:true});
globalThis.DebugTrace=debugTrace;
export {DebugTraceManager,sanitize as sanitizeDebugValue,safeFile as summarizeDebugFile};
