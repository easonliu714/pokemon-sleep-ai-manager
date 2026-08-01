import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const paths=['assets/js/debug-trace-manager.js','assets/js/bootstrap.js','assets/js/android-import-file-picker.js','assets/js/identity-import-wizard-entry.js','assets/js/data1-zip-inventory.js','service-worker.js'];
for(const path of paths){
  if(!fs.existsSync(path))throw new Error(`missing_required_file:${path}`);
  if(path.endsWith('.js')){const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(checked.status!==0)throw new Error(`javascript_syntax_failed:${path}:${checked.stderr}`);}
}
const [tracePath,bootstrapPath,pickerPath,wizardPath,inventoryPath,workerPath]=paths;
const trace=fs.readFileSync(tracePath,'utf8');const bootstrap=fs.readFileSync(bootstrapPath,'utf8');const picker=fs.readFileSync(pickerPath,'utf8');const wizard=fs.readFileSync(wizardPath,'utf8');const inventory=fs.readFileSync(inventoryPath,'utf8');const worker=fs.readFileSync(workerPath,'utf8');
const requiredTraceTokens=['class DebugTraceManager','window_error','unhandled_rejection','control_clicked','control_changed','service_worker','operation_id','parent_operation_id','completed','blocked','cancelled','failed','timeout','export()','exportIssueBundle','recordStage','recordProgress','business_stage','sanitize','[redacted]','MAX_STORAGE_BYTES','診斷中心','匯出診斷 JSON','匯出 Issue Bundle','目前紀錄模式：','標準模式：','明細模式：','localTime'];
for(const token of requiredTraceTokens)if(!trace.includes(token))throw new Error(`trace_contract_missing:${token}`);
const pickerTokens=['IMAGE_ACCEPT','ZIP_ACCEPT','tech2dImageInput','tech2dZipInput','選擇圖片','選擇 ZIP','single_zip_per_batch_required','一次只能選擇一個 ZIP','import_source_inspection','file_selection_received','zip_inventory_manifest_completed','buildPrivateZipInventory'];
for(const token of pickerTokens)if(!picker.includes(token))throw new Error(`picker_contract_missing:${token}`);
for(const token of ['PRIVATE_ZIP_INVENTORY_SCHEMA','source_image_ref','review_required','validatePrivateZipInventory','downloadPrivateZipInventory'])if(!inventory.includes(token))throw new Error(`inventory_contract_missing:${token}`);
if(!wizard.includes('humanizeImportError'))throw new Error('wizard_human_error_missing');
if(!wizard.includes('tech2d-file-picker-actions'))throw new Error('split_picker_layout_missing');
if(!wizard.includes('匯出私人清點 Manifest'))throw new Error('inventory_export_ui_missing');
if(!bootstrap.startsWith("import {debugTrace} from './debug-trace-manager.js"))throw new Error('debug_trace_not_initialized_first');
if(!bootstrap.includes("APP_VERSION = 'v0.3.39'"))throw new Error('app_version_not_bumped');
if(!bootstrap.includes('20260801-data1a-zip-inventory'))throw new Error('build_not_bumped');
if(!bootstrap.includes('data1-zip-inventory.js'))throw new Error('inventory_not_probed');
if(!worker.includes("'./assets/js/debug-trace-manager.js'"))throw new Error('debug_trace_not_precached');
if(!worker.includes("'./assets/js/data1-zip-inventory.js'"))throw new Error('inventory_not_precached');
if(!worker.includes('v0.3.39-data1a-zip-inventory'))throw new Error('service_worker_cache_not_bumped');
if(/\.content\b|\.payload\b/.test(trace.match(/function safeFile[\s\S]*?\n}/)?.[0]||''))throw new Error('file_content_must_not_be_exported');
console.log(JSON.stringify({ok:true,trace_schema:'pokemon-sleep-debug-trace/1.1',version:'v0.3.39',checks:requiredTraceTokens.length+pickerTokens.length+14}));
