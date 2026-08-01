import fs from 'node:fs';
import vm from 'node:vm';

const tracePath='assets/js/debug-trace-manager.js';
const bootstrapPath='assets/js/bootstrap.js';
const workerPath='service-worker.js';
for(const path of [tracePath,bootstrapPath,workerPath]){
  if(!fs.existsSync(path))throw new Error(`missing_required_file:${path}`);
}
const trace=fs.readFileSync(tracePath,'utf8');
const bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const worker=fs.readFileSync(workerPath,'utf8');
new vm.SourceTextModule(trace,{identifier:tracePath});
new vm.SourceTextModule(bootstrap,{identifier:bootstrapPath});

const requiredTraceTokens=[
  'class DebugTraceManager','window_error','unhandled_rejection','control_clicked','control_changed',
  'service_worker','operation_id','parent_operation_id','completed','blocked','cancelled','failed','timeout',
  'export()','sanitize','[redacted]','MAX_STORAGE_BYTES','診斷中心','匯出診斷 JSON'
];
for(const token of requiredTraceTokens)if(!trace.includes(token))throw new Error(`trace_contract_missing:${token}`);
if(!bootstrap.startsWith("import {debugTrace} from './debug-trace-manager.js"))throw new Error('debug_trace_not_initialized_first');
if(!bootstrap.includes("APP_VERSION = 'v0.3.37'"))throw new Error('app_version_not_bumped');
if(!bootstrap.includes("debugTrace.record('bootstrap'"))throw new Error('bootstrap_trace_missing');
if(!worker.includes("'./assets/js/debug-trace-manager.js'"))throw new Error('debug_trace_not_precached');
if(!worker.includes('v0.3.37-debug-trace-manager'))throw new Error('service_worker_cache_not_bumped');
if(/\.content\b|\.payload\b/.test(trace.match(/function safeFile[\s\S]*?\n}/)?.[0]||''))throw new Error('file_content_must_not_be_exported');
console.log(JSON.stringify({ok:true,trace_schema:'pokemon-sleep-debug-trace/1.0',version:'v0.3.37',checks:requiredTraceTokens.length+6}));
