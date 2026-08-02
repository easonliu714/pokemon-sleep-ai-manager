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

const appVersion=source.bootstrap.match(/\bAPP_VERSION\s*=\s*'([^']+)'/)?.[1];
const build=source.bootstrap.match(/(?:^|\n)const\s+VERSION\s*=\s*'([^']+)'/)?.[1];
const cacheName=source.worker.match(/\bCACHE\s*=\s*'([^']+)'/)?.[1];
assert.ok(appVersion,'app_version_missing');
assert.ok(build,'build_missing');
assert.ok(cacheName,'service_worker_cache_name_missing');
assert.match(appVersion,/^v\d+\.\d+\.\d+$/,'app_version_format_invalid');
assert.match(build,/^\d{8}-[a-z0-9-]+$/,'build_format_invalid');
const cacheBuildSuffix=build.replace(/^\d{8}-/,'');
assert.equal(cacheName,`pokemon-sleep-ai-${appVersion}-${cacheBuildSuffix}`,'service_worker_version_mismatch');
assert.match(source.bootstrap,/data1d1-ocr-overlay-preview-event-wiring\.js/);
assert.match(source.worker,/data1d1-ocr-overlay-preview-event-wiring\.js/);
console.log('PASS DATA.1D.1 OCR overlay preview event producer, preset sync, lifecycle clear, accessibility, privacy, and version contracts');
