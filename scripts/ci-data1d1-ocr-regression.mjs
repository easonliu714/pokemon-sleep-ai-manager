import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const DATA1D1_OCR_REGRESSION_VERSION='data1d1-ocr-regression-2026-08-14-a';
export const DATA1D1_GATES=Object.freeze([
  'scripts/data1d1-layout-aware-region-ocr-regression.mjs',
  'scripts/data1d1-manual-reocr-regression.mjs',
  'scripts/data1d1-ocr-export-summary-consistency-regression.mjs',
  'scripts/data1d1-ocr-overlay-bootstrap-integration-regression.mjs',
  'scripts/data1d1-ocr-overlay-browser-lifecycle-regression.mjs',
  'scripts/data1d1-ocr-overlay-preview-event-wiring-regression.mjs',
  'scripts/data1d1-ocr-sp-thumbnail-preview-regression.mjs',
  'scripts/data1d1-ocr-thumbnail-region-confidence-regression.mjs',
  'scripts/data1d1-two-stage-ocr-versioned-exports-regression.mjs',
]);

function run(path){
  assert.equal(fs.existsSync(path),true,`DATA.1D.1 gate missing: ${path}`);
  for(const args of [['--check',path],[path]]){
    const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    assert.equal(result.status,0,`DATA.1D.1 gate failed: ${path} args=${args.join(' ')}`);
  }
}
for(const path of DATA1D1_GATES)run(path);
const mutation=spawnSync('git',['diff','--exit-code'],{stdio:'inherit'});assert.equal(mutation.status,0,'DATA.1D.1 regression mutated tracked files');
console.log(JSON.stringify({status:'PASS',gate:'DATA1D1_OCR_REGRESSION',version:DATA1D1_OCR_REGRESSION_VERSION,gate_count:DATA1D1_GATES.length,behavioral_gates_removed:0},null,2));
