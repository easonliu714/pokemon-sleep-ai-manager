import {spawnSync} from 'node:child_process';

export const G13_OCR_AI_REGRESSION_VERSION='g13-ocr-ai-regression-2026-08-11-a';
export const G13_CORE_GATES=Object.freeze([
  'tests/g13_2c_ocr_isolation_secret_redaction_gate.mjs',
  'tests/g13_2d_duplicate_finalize_live_debug_gate.mjs',
  'tests/g13_2e_finalize_nonblocking_workbench_gate.mjs',
  'tests/g13_2f_region_ai_review_deferred_gate.mjs',
  'tests/g13_2g_lightweight_ai_review_export_feedback_gate.mjs',
]);
export const G13_PR_GATES=Object.freeze([
  ...G13_CORE_GATES,
  'tests/g13_2m_ocr_ai_ab_diagnostic_gate.mjs',
  'tests/g13_3a_real_ocr_ai_execution_gate.mjs',
  'tests/g13_3b_analysis_confirmation_apply_gate.mjs',
  'tests/g13_4_ocr_ai_cross_check_confidence_gate.mjs',
  'tests/g13_5_unified_import_pipeline_gate.mjs',
]);

function runGate(path){
  const result=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`g13_gate_failed:${path}:exit_${result.status}`);
}

const scope=process.argv.includes('--core')?'core':'all';
const gates=scope==='core'?G13_CORE_GATES:G13_PR_GATES;
for(const path of gates)runGate(path);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13_OCR_AI_REGRESSION',
  version:G13_OCR_AI_REGRESSION_VERSION,
  scope,
  gate_count:gates.length,
  workflow_wrappers_replaced:10,
  behavioral_gates_removed:0,
  gates,
},null,2));
