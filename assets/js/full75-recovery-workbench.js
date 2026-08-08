import './general-update-field-audit-ui.js';
import './profile-completeness.js';
import { debugTrace } from './debug-trace-manager.js';

// v0.3.99.4 — the dedicated FULL75 frontend workbench is formally retired.
// Keep this module path as a legacy compatibility / historical-CI anchor only.
// Legacy FULL75 JSON must be selected through the normal #jsonFile Update Center
// and is subject to the same structure validation, review, Dry Run, Snapshot,
// Transaction, Apply, rollback and duplicate-update protections as every other
// supported JSON scenario. This module must never create a FULL75-specific DOM
// surface or expose a dedicated Apply / forwarding control.
const BUILD = '20260808-v03994-mobile-validation-hotfix';

function recordRetirementClosure() {
  debugTrace.record('full75_recovery', 'full75_frontend_surface_removed', {
    status: 'completed',
    details: {
      build: BUILD,
      dedicated_ui_present: false,
      dedicated_apply_enabled: false,
      dedicated_forward_control_present: false,
      general_update_center_required: true,
      legacy_json_compatibility_retained: true,
      blank_values_preserve_existing: true,
      profile_completeness_enabled: true,
    },
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', recordRetirementClosure, { once: true });
} else {
  recordRetirementClosure();
}
