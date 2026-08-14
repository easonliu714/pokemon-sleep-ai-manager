import assert from 'node:assert/strict';
import fs from 'node:fs';

export const G13_WORKFLOW_CONSOLIDATION_VERSION='g13-workflow-consolidation-2026-08-14-b';
const retired=Object.freeze([
  '.github/workflows/g13-2c-ocr-isolation-secret-redaction.yml',
  '.github/workflows/g13-2d-duplicate-finalize-live-debug.yml',
  '.github/workflows/g13-2e-finalize-nonblocking-workbench.yml',
  '.github/workflows/g13-2f-region-ai-review-deferred.yml',
  '.github/workflows/g13-2g-lightweight-ai-review-export-feedback.yml',
  '.github/workflows/g13-2m-ocr-ai-ab-diagnostic.yml',
  '.github/workflows/g13-3a-real-ocr-ai-execution.yml',
  '.github/workflows/g13-3b-analysis-confirmation-apply.yml',
  '.github/workflows/g13-4-ocr-ai-cross-check-confidence.yml',
  '.github/workflows/g13-5-unified-import-pipeline.yml',
  '.github/workflows/g13-2a-ai-project-pool-executor.yml',
  '.github/workflows/g13-2b-ocr-runtime-hardening.yml',
  '.github/workflows/g13-2h-sequential-advanced-ai-review.yml',
  '.github/workflows/g13-2i-progressive-ai-review-bootstrap.yml',
  '.github/workflows/g13-2l-direct-minimal-review.yml',
]);
for(const path of retired)assert.equal(fs.existsSync(path),false,`retired G13 workflow still exists: ${path}`);
assert.equal(fs.existsSync('.github/workflows/g13-ocr-ai-regression.yml'),true);
const gates=Object.freeze([
  'tests/g13_2c_ocr_isolation_secret_redaction_gate.mjs',
  'tests/g13_2d_duplicate_finalize_live_debug_gate.mjs',
  'tests/g13_2e_finalize_nonblocking_workbench_gate.mjs',
  'tests/g13_2f_region_ai_review_deferred_gate.mjs',
  'tests/g13_2g_lightweight_ai_review_export_feedback_gate.mjs',
  'tests/g13_2m_ocr_ai_ab_diagnostic_gate.mjs',
  'tests/g13_3a_real_ocr_ai_execution_gate.mjs',
  'tests/g13_3b_analysis_confirmation_apply_gate.mjs',
  'tests/g13_4_ocr_ai_cross_check_confidence_gate.mjs',
  'tests/g13_5_unified_import_pipeline_gate.mjs',
  'scripts/g13-2a-ai-project-pool-executor-regression.mjs',
  'scripts/g13-2b-ocr-runtime-hardening-regression.mjs',
  'tests/g13_2h_sequential_advanced_ai_review_gate.mjs',
  'tests/g13_2i_progressive_ai_review_bootstrap_gate.mjs',
  'tests/g13_2l_direct_minimal_review_gate.mjs',
]);
for(const path of gates)assert.equal(fs.existsSync(path),true,`G13 behavioral gate missing: ${path}`);
const runner=fs.readFileSync('scripts/ci-g13-ocr-ai-regression.mjs','utf8');const workflow=fs.readFileSync('.github/workflows/g13-ocr-ai-regression.yml','utf8');
for(const path of gates)assert.ok(runner.includes(path),`G13 runner lost gate: ${path}`);
for(const token of ['concurrency:','cancel-in-progress: true','--core','node scripts/ci-g13-ocr-ai-regression.mjs'])assert.ok(workflow.includes(token),`G13 consolidated workflow missing ${token}`);
for(const path of ['assets/js/android-import-file-picker.js','assets/js/unified-import-analysis-workbench.js','assets/js/two-stage-forced-ocr-entry.js'])assert.ok(workflow.includes(path),`G13.5 syntax contract lost: ${path}`);
console.log(JSON.stringify({status:'PASS',gate:'CI_G13_WORKFLOW_CONSOLIDATION',version:G13_WORKFLOW_CONSOLIDATION_VERSION,retired_workflow_count:retired.length,replacement_workflow_count:1,net_workflow_reduction:retired.length-1,preserved_behavioral_gate_count:gates.length,behavioral_gates_removed:0},null,2));
