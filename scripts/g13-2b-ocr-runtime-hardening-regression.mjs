import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['assets/js/data1d-local-ocr-runtime.js','assets/js/data1d-ocr-first-classifier.js','assets/js/android-import-file-picker.js','assets/js/ocr-runtime-monitor.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);if(file.endsWith('.js')||file.endsWith('.mjs')){const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,`syntax:${file}:${check.stderr}`);}}
const [runtime,classifier,picker,monitor,bootstrap,worker]=files.map(file=>fs.readFileSync(file,'utf8'));
for(const token of ['DEFAULT_TIMEOUT_MS=30000','DEFAULT_STALL_MS=20000','ocr_timeout','ocr_stalled','terminateWorker','workerGeneration','ocr_runtime_retrying','async cancel','active_job'])assert.ok(runtime.includes(token),`runtime:${token}`);
for(const token of ['signal,timeoutMs','throwIfCancelled','itemTimeoutMs=DEFAULT_ITEM_TIMEOUT_MS','ocr-item-started','ocr-item-failed','await new Promise(resolve=>setTimeout(resolve,0))'])assert.ok(classifier.includes(token),`classifier:${token}`);
for(const token of ['PokemonSleepOCR?.cancel','正在強制停止 OCR','itemTimeoutMs:30000','失敗'])assert.ok(picker.includes(token),`picker:${token}`);
for(const token of ['OCR Runtime Monitor','exportOcrRuntimeMonitor','active_job','ocr_runtime_job_failed','pokemon_sleep_ocr_runtime_'])assert.ok(monitor.includes(token),`monitor:${token}`);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.60'/);assert.match(bootstrap,/20260803-g13-2b-ocr-runtime-hardening/);assert.match(bootstrap,/ocr-runtime-monitor\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.60-g13-2b-ocr-runtime-hardening/);assert.match(worker,/ocr-runtime-monitor\.js/);
assert.doesNotMatch(monitor,/image_base64|image_bytes|ocr_full_text|api.?key/i);
console.log(JSON.stringify({ok:true,gate:'G13.2B OCR runtime hardening',timeout_ms:30000,stall_ms:20000,worker_recovery:true,abort_terminate:true,runtime_monitor:true,version:'v0.3.60'}));