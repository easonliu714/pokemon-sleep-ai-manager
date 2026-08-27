import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const G13_OCR_AI_REGRESSION_VERSION='g13-ocr-ai-regression-2026-08-27-v042744-deferred-session-authority-public-berry';
export const G13_CORE_GATES=Object.freeze([
  'tests/g13_2c_ocr_isolation_secret_redaction_gate.mjs',
  'tests/g13_2d_duplicate_finalize_live_debug_gate.mjs',
  'tests/g13_2e_finalize_nonblocking_workbench_gate.mjs',
  'tests/g13_2f_region_ai_review_deferred_gate.mjs',
  'tests/g13_2g_lightweight_ai_review_export_feedback_gate.mjs',
  'tests/g13_6_internal_observation_parity_progress_gate.mjs',
  'tests/g13_7_structured_output_current_file_latency_guard.mjs',
  'tests/g13_8_v04278_ai_resilience_evolution_confirmation_gate.mjs',
  'tests/g13_9_v04279_multicapture_confirmation_authority_gate.mjs',
  'tests/g13_10_v042710_ai_timeout_public_hydration_gate.mjs',
  'tests/g13_11_v042711_model_health_fallback_gate.mjs',
  'tests/g13_12_v042725_android_byte_snapshot_gate.mjs',
  'tests/g13_13_v042726_standalone_android_byte_snapshot_gate.mjs',
  'tests/g13_14_v042726_standalone_snapshot_integration_gate.mjs',
  'tests/g13_15_v042727_review_berry_group_authority_gate.mjs',
  'tests/g13_16_v042728_per_image_target_wiring_recovery_gate.mjs',
  'tests/g13_17_v042729_first_render_stale_overlay_authority_gate.mjs',
  'tests/g13_18_v042730_confirmation_existing_group_navigation_gate.mjs',
  'tests/g13_19_v042730_batch_terminal_json_mobile_gate.mjs',
  'tests/g13_20_v042731_dom_observer_reentrancy_gate.mjs',
  'tests/g13_21_v042732_confirmation_first_render_projection_gate.mjs',
  'tests/g13_22_v042732_startup_watchdog_recovery_gate.mjs',
  'tests/g13_23_v042733_per_image_runtime_context_gate.mjs',
  'tests/g13_24_v042734_revision_bound_target_context_gate.mjs',
  'tests/g13_25_v042735_explicit_per_image_ai_context_gate.mjs',
  'tests/g13_26_v042736_per_image_identity_projection_isolation_gate.mjs',
  'tests/g13_27_v042737_explicit_manual_draft_save_gate.mjs',
  'tests/g13_28_v042738_authoritative_draft_navigation_gate.mjs',
  'tests/g13_29_v042739_single_confirmation_authority_gate.mjs',
  'tests/g13_30_v042740_review_session_authority_partial_merge_gate.mjs',
  'tests/g13_31_v042741_single_multicapture_runtime_authority_gate.mjs',
  'tests/g13_32_v042742_manual_save_authority_promotion_gate.mjs',
  'tests/g13_33_v042743_group_bound_review_session_cache_gate.mjs',
  'tests/g13_34_v042744_deferred_session_authority_public_berry_gate.mjs',
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

const IMMUTABLE_RELEASE_IDENTITIES=Object.freeze({
  'tests/g13_8_v04278_ai_resilience_evolution_confirmation_gate.mjs':Object.freeze({
    app_version:'v0.4.27.8',
    app_build:'20260818-v04278-ai-resilience-evolution-master-review',
    cache_name:'pokemon-sleep-ai-v0.4.27.8-v04278-ai-resilience-evolution-master-review',
  }),
  'tests/g13_9_v04279_multicapture_confirmation_authority_gate.mjs':Object.freeze({
    app_version:'v0.4.27.9',
    app_build:'20260818-v04279-confirmation-multicapture-authority-hotfix',
    cache_name:'pokemon-sleep-ai-v0.4.27.9-v04279-confirmation-multicapture-authority-hotfix',
  }),
  'tests/g13_10_v042710_ai_timeout_public_hydration_gate.mjs':Object.freeze({
    app_version:'v0.4.27.10',
    app_build:'20260818-v042710-ai-startup-timeout-public-hydration',
    cache_name:'pokemon-sleep-ai-v0.4.27.10-v042710-ai-startup-timeout-public-hydration',
  }),
});

function execute(path){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit',env:process.env});
  if(syntax.error)throw syntax.error;
  assert.equal(syntax.status,0,`g13_syntax_failed:${path}:exit_${syntax.status}`);
  const result=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`g13_gate_failed:${path}:exit_${result.status}`);
}

function runGate(path){
  assert.equal(fs.existsSync(path),true,`G13 behavioral gate missing: ${path}`);
  const identity=IMMUTABLE_RELEASE_IDENTITIES[path];
  if(!identity){execute(path);return;}

  const authorityPath='assets/js/version-authority.js';
  const original=fs.readFileSync(authorityPath,'utf8');
  const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
  if(current===identity.app_version){execute(path);return;}
  const staged=original
    .replace(/app_version:\s*'[^']+'/,`app_version: '${identity.app_version}'`)
    .replace(/app_build:\s*'[^']+'/,`app_build: '${identity.app_build}'`)
    .replace(/cache_name:\s*'[^']+'/,`cache_name: '${identity.cache_name}'`);
  try{
    fs.writeFileSync(authorityPath,staged,'utf8');
    execute(path);
  }finally{
    fs.writeFileSync(authorityPath,original,'utf8');
  }
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
  immutable_predecessor_replay:Object.keys(IMMUTABLE_RELEASE_IDENTITIES),
  gates,
},null,2));