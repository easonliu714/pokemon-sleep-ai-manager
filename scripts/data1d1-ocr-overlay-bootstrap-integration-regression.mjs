import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const paths={
  bootstrap:'assets/js/bootstrap.js',
  overlayBootstrap:'assets/js/data1d1-ocr-overlay-update-center-bootstrap.js',
  bridge:'assets/js/data1d1-ocr-overlay-update-center-bridge.js',
  mount:'assets/js/data1d1-ocr-overlay-update-center-mount.js',
  integration:'assets/js/data1d1-ocr-overlay-controller-integration.js',
  lifecycle:'assets/js/data1d1-ocr-overlay-lifecycle-events.js',
  wiring:'assets/js/data1d1-ocr-thumbnail-overlay-wiring.js',
  worker:'service-worker.js'
};

for(const path of Object.values(paths)){
  assert.equal(fs.existsSync(path),true,`missing_required_file:${path}`);
  if(path.endsWith('.js')){
    const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(checked.status,0,`javascript_syntax_failed:${path}:${checked.stderr}`);
  }
}

const read=key=>fs.readFileSync(paths[key],'utf8');
const bootstrap=read('bootstrap');
const overlayBootstrap=read('overlayBootstrap');
const worker=read('worker');
const token=(source,value,label)=>assert.match(source,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${label}:${value}`);
const appVersion=bootstrap.match(/\bAPP_VERSION\s*=\s*'([^']+)'/)?.[1];
const build=bootstrap.match(/(?:^|\n)const\s+VERSION\s*=\s*'([^']+)'/)?.[1];
const cacheName=worker.match(/\bCACHE\s*=\s*'([^']+)'/)?.[1];
assert.ok(appVersion,'app_version_missing');
assert.ok(build,'build_missing');
assert.ok(cacheName,'service_worker_cache_name_missing');
assert.notEqual(build,appVersion,'build_must_not_equal_app_version');

for(const value of [
  'data1d1-ocr-overlay-update-center-bootstrap.js',
  'bootstrapOcrOverlayUpdateCenter',
  'OcrOverlayUpdateCenterBootstrap',
  "document.querySelector('#ocrThumbnailOverlaySlot')",
  'pokemon-sleep:identity-import-files-selected',
  'ocr_thumbnail_overlay_bootstrap_deferred'
])token(bootstrap,value,'bootstrap_contract_missing');

for(const value of [
  "BOOTSTRAP_SCHEMA='pokemon-sleep-ocr-overlay-update-center-bootstrap/1.1'",
  'waitForHost',
  'ocr_overlay_update_center_host_timeout',
  'INSTANCE_KEY',
  'PROMISE_KEY',
  'OcrOverlayUpdateCenterBootstrapPromise',
  'Promise.resolve',
  "addEventListener?.('pagehide'",
  'dispose',
  'ocr_thumbnail_overlay_update_center_bootstrap_failed',
  'delete target[PROMISE_KEY]'
])token(overlayBootstrap,value,'overlay_bootstrap_contract_missing');

const overlayModules=[
  'data1d1-ocr-thumbnail-overlay-wiring.js',
  'data1d1-ocr-overlay-lifecycle-events.js',
  'data1d1-ocr-overlay-controller-integration.js',
  'data1d1-ocr-overlay-update-center-mount.js',
  'data1d1-ocr-overlay-update-center-bridge.js',
  'data1d1-ocr-overlay-update-center-bootstrap.js'
];
for(const moduleName of overlayModules){
  token(bootstrap,moduleName,'module_not_probed');
  token(worker,`./assets/js/${moduleName}`,'module_not_precached');
}

const cacheBuildSuffix=build.replace(/^\d{8}-/,'');
assert.equal(cacheName,`pokemon-sleep-ai-${appVersion}-${cacheBuildSuffix}`,'service_worker_version_mismatch');
assert.doesNotMatch(overlayBootstrap,/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
assert.match(
  bootstrap,
  /if\s*\(\s*globalThis\.OcrOverlayUpdateCenterBootstrap\s*\|\|\s*!document\.querySelector\(\s*'#ocrThumbnailOverlaySlot'\s*\)\s*\)\s*return\s*;/,
  'overlay bootstrap must use the existing-instance or missing-host early return'
);

console.log(JSON.stringify({
  ok:true,
  gate:'DATA.1D.1 OCR overlay bootstrap integration',
  version:appVersion,
  build,
  cache_name:cacheName,
  checks:43,
  hardware_validation_required_next:true
}));
