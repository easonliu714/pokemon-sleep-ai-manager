import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const paths={
  wiring:'assets/js/data1d1-ocr-overlay-preview-event-wiring.js',
  bootstrap:'assets/js/bootstrap.js',
  worker:'service-worker.js',
  adapter:'assets/js/pokemon-zip-adapter.js',
  bridge:'assets/js/data1d1-ocr-overlay-update-center-bridge.js'
};
for(const path of Object.values(paths))assert.equal(fs.existsSync(path),true,`missing_required_file:${path}`);
for(const path of [paths.wiring,paths.bootstrap,paths.worker]){
  const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(checked.status,0,`javascript_syntax_failed:${path}:${checked.stderr}`);
}
const source=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
const tokens=(text,values,label)=>{for(const value of values)assert.match(text,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${label}_missing:${value}`);};

tokens(source.wiring,[
  'pokemon-sleep:identity-import-files-selected',
  'pokemon-sleep:ocr-overlay-preview-requested',
  'pokemon-sleep:ocr-region-preset-changed',
  'pokemon-sleep:ocr-overlay-preview-cleared',
  "archive.readImage(path,{type:'blob'})",
  'buildRegionConfig',
  'MutationObserver',
  "setAttribute('role','button')",
  "setAttribute('tabindex','0')",
  "['Enter',' ']",
  'import_source_changed',
  'ocr_cancel_requested',
  'pagehide',
  'requestId+=1',
  'blob_size',
  'dispose()'
],'wiring');
assert.doesNotMatch(source.wiring,/localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|image_base64|btoa\(/);
tokens(source.adapter,["readImage(path,{type='blob'}"],'zip_adapter');
tokens(source.bridge,['pokemon-sleep:ocr-overlay-preview-requested','pokemon-sleep:ocr-region-preset-changed','pokemon-sleep:ocr-overlay-preview-cleared'],'bridge');
assert.match(source.bootstrap,/APP_VERSION = 'v0\.3\.51'/);
assert.match(source.bootstrap,/20260802-data1d1-ocr-overlay-preview-event-wiring/);
assert.match(source.bootstrap,/data1d1-ocr-overlay-preview-event-wiring\.js/);
assert.match(source.worker,/pokemon-sleep-ai-v0\.3\.51-data1d1-ocr-overlay-preview-event-wiring/);
assert.match(source.worker,/data1d1-ocr-overlay-preview-event-wiring\.js/);
console.log('PASS DATA.1D.1 OCR overlay preview event producer, preset sync, lifecycle clear, accessibility, and privacy contracts');
