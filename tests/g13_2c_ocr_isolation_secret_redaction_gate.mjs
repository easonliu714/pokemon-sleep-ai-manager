import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const debug=read('assets/js/debug-trace-manager.js');
const picker=read('assets/js/android-import-file-picker.js');
const ui=read('assets/js/data1d1-ocr-runtime-ui.js');
const monitor=read('assets/js/ocr-runtime-monitor.js');
const bootstrap=read('assets/js/bootstrap.js');
const sw=read('service-worker.js');

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.64'/);
assert.match(bootstrap,/20260803-g13-2f-region-ai-review-deferred/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.64-g13-2f-region-ai-review-deferred/);
assert.match(debug,/SECRET_CONTROL_IDS/);assert.match(debug,/aiApiKeysInput/);assert.match(debug,/secret_control_change/);assert.match(debug,/redacted=true/);assert.match(debug,/key_count/);assert.match(debug,/SECRET_PATTERNS/);assert.match(debug,/deepRedact/);assert.match(debug,/bundle_schema:'pokemon-sleep-issue-bundle\/1\.1'/);assert.doesNotMatch(debug,/details\.value=String\(target\.value/);assert.match(debug,/PERSIST_DEBOUNCE_MS/);assert.match(debug,/schedulePersist/);assert.match(debug,/setTimeout\(\(\)=>\{this\.persistTimer=null;this\.persistNow\(\);\},PERSIST_DEBOUNCE_MS\)/);
assert.match(picker,/圖片指紋：\$\{progress\.current\}\/\$\{progress\.total\}/);assert.match(picker,/尚未開始 OCR/);assert.match(picker,/ocr_started/);assert.match(picker,/ocr_total/);assert.match(picker,/ocr-batch-finalizing|dispatchBatch\('finalizing'/);assert.match(picker,/PokemonSleepOCR\?\.cancel/);
assert.match(ui,/phase:'IDLE'/);assert.match(ui,/CANCELLING/);assert.match(ui,/FINALIZING/);assert.match(ui,/COMPLETED_WITH_FAILURES/);assert.match(ui,/normalizePercent/);assert.match(ui,/PokemonSleepOCR\?\.cancel/);assert.match(ui,/STATE\.progress=99/);assert.match(ui,/progress:100/);
assert.match(monitor,/scheduleRender/);assert.match(monitor,/FINALIZING/);assert.match(monitor,/rawProgress<=1\?rawProgress\*100/);
console.log(JSON.stringify({ok:true,gate:'G13.2C compatibility',version:'v0.3.64'}));
