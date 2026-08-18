import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const G13_OCR_AI_REGRESSION_VERSION='g13-ocr-ai-regression-2026-08-18-e-v04278-resilience-evolution-review';
export const G13_CORE_GATES=Object.freeze([
  'tests/g13_2c_ocr_isolation_secret_redaction_gate.mjs',
  'tests/g13_2d_duplicate_finalize_live_debug_gate.mjs',
  'tests/g13_2e_finalize_nonblocking_workbench_gate.mjs',
  'tests/g13_2f_region_ai_review_deferred_gate.mjs',
  'tests/g13_2g_lightweight_ai_review_export_feedback_gate.mjs',
  'tests/g13_6_internal_observation_parity_progress_gate.mjs',
  'tests/g13_7_structured_output_current_file_latency_guard.mjs',
  'tests/g13_8_v04278_ai_resilience_evolution_confirmation_gate.mjs',
]);
export const G13_REMAINING_WRAPPER_GATES=Object.freeze([
  'scripts/g13-2a-ai-project-pool-executor-regression.mjs',
  'scripts/g13-2b-ocr-runtime-hardening-regression.mjs',
  'tests/g13_2h_sequential_advanced_ai_review_gate.mjs',
  'tests/g13_2i_progressive_ai_review_bootstrap_gate.mjs',
  'tests/g13_2l_direct_minimal_review_gate.mjs',
]);
export const G13_PR_GATES=Object.freeze([
  ...G13_CORE_GATES,
  'tests/g13_2m_ocr_ai_ab_diagnostic_gate.mjs',
  'tests/g13_3a_real_ocr_ai_execution_gate.mjs',
  'tests/g13_3b_analysis_confirmation_apply_gate.mjs',
  'tests/g13_4_ocr_ai_cross_check_confidence_gate.mjs',
  'tests/g13_5_unified_import_pipeline_gate.mjs',
  ...G13_REMAINING_WRAPPER_GATES,
]);

function runGate(path){
  assert.equal(fs.existsSync(path),true,`G13 behavioral gate missing: ${path}`);
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit',env:process.env});
  if(syntax.error)throw syntax.error;
  assert.equal(syntax.status,0,`g13_syntax_failed:${path}:exit_${syntax.status}`);
  const result=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`g13_gate_failed:${path}:exit_${result.status}`);
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
  remaining_wrapper_gate_count:G13_REMAINING_WRAPPER_GATES.length,
  behavioral_gates_removed:0,
  gates,
},null,2));