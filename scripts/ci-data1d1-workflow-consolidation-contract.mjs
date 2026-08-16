import assert from 'node:assert/strict';
import fs from 'node:fs';

export const DATA1D1_WORKFLOW_CONSOLIDATION_VERSION='data1d1-workflow-consolidation-2026-08-16-b-p6b-successor';
const retired=Object.freeze([
  '.github/workflows/data1d1-layout-aware-region-ocr.yml',
  '.github/workflows/data1d1-manual-reocr.yml',
  '.github/workflows/data1d1-ocr-export-summary-consistency.yml',
  '.github/workflows/data1d1-ocr-overlay-bootstrap-integration.yml',
  '.github/workflows/data1d1-ocr-overlay-browser-lifecycle.yml',
  '.github/workflows/data1d1-ocr-overlay-preview-event-wiring.yml',
  '.github/workflows/data1d1-ocr-sp-thumbnail-preview-regression.yml',
  '.github/workflows/data1d1-ocr-thumbnail-region-confidence.yml',
  '.github/workflows/data1d1-two-stage-ocr-versioned-exports.yml',
  '.github/workflows/data1d1-ocr-regression.yml',
]);
const gates=Object.freeze([
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
for(const path of retired)assert.equal(fs.existsSync(path),false,`retired DATA.1D.1 workflow still exists: ${path}`);
for(const path of gates)assert.equal(fs.existsSync(path),true,`DATA.1D.1 behavioral gate missing: ${path}`);
const runnerPath='scripts/ci-data1d1-ocr-regression.mjs';
const workflowPath='.github/workflows/screenshot-pipeline-regression.yml';
assert.equal(fs.existsSync(runnerPath),true,'DATA.1D.1 runner missing');
assert.equal(fs.existsSync(workflowPath),true,'screenshot pipeline successor missing');
const runner=fs.readFileSync(runnerPath,'utf8'),workflow=fs.readFileSync(workflowPath,'utf8');
for(const path of gates)assert.ok(runner.includes(path),`DATA.1D.1 runner lost gate: ${path}`);
for(const token of [
  'local-ocr:',
  'concurrency:',
  'cancel-in-progress: true',
  'contents: read',
  'node scripts/ci-data1d1-ocr-regression.mjs',
  'node scripts/ci-data1d1-workflow-consolidation-contract.mjs',
])assert.ok(workflow.includes(token),`DATA.1D.1 screenshot successor missing: ${token}`);
console.log(JSON.stringify({status:'PASS',gate:'DATA1D1_WORKFLOW_CONSOLIDATION',version:DATA1D1_WORKFLOW_CONSOLIDATION_VERSION,retired_workflow_count:retired.length,replacement_workflow_count:1,replacement_workflow:'screenshot-pipeline-regression.yml',replacement_job:'local-ocr',preserved_behavioral_gate_count:gates.length,behavioral_gates_removed:0},null,2));
