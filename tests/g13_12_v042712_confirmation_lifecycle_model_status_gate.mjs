import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const controller=read('assets/js/ai-review-executor-controller.js');
const statusUi=read('assets/js/ai-review-executor-status-ui.js');
const multi=read('assets/js/data-consistency-multicapture.js');
const confirmation=read('assets/js/analysis-confirmation-workbench.js');
const refresh=read('assets/js/analysis-confirmation-post-apply-refresh.js');
const detail=read('assets/js/pokemon-detail.js');
const sw=read('service-worker.js');

assert.match(authority,/app_version:\s*'v0\.4\.27\.12'/);
assert.match(authority,/app_build:\s*'20260818-v042712-confirmation-lifecycle-model-status-ux'/);

// Model runtime state must be projected into the feature area without exposing Key material.
assert.match(controller,/pokemon-sleep:ai-model-runtime-status/);
assert.match(controller,/event\.startsWith\('ai_model_'\)/);
assert.match(statusUi,/ai_model_candidate_started/);
assert.match(statusUi,/ai_model_failover/);
assert.match(statusUi,/模型切換：/);
assert.match(statusUi,/等待 \$\{elapsed\} 秒/);
assert.match(statusUi,/data-ai-model-runtime-visible/);
assert.doesNotMatch(statusUi,/project\.key|api[_ -]?key/i);

// A terminal confirmation or a confirmed species change must end the previous capture group.
assert.match(multi,/pokemon-sleep:analysis-confirmation-terminal/);
assert.match(multi,/species_identity_changed/);
assert.match(multi,/current\.species&&next\.species&&current\.species!==next\.species/);
assert.match(multi,/pokemon-sleep:analysis-capture-group-reset/);
assert.match(confirmation,/pokemon-sleep:analysis-capture-group-reset/);
assert.match(confirmation,/terminal\('created'/);
assert.match(confirmation,/terminal\('updated'/);
assert.match(confirmation,/terminal\('hold'/);
assert.match(confirmation,/terminal\('discarded'/);

// New confirmed Pokémon must be visible immediately and carry stable display/date semantics.
assert.match(confirmation,/merged\.original_label=merged\.species/);
assert.match(confirmation,/registered_at:text\(identity\.registered_date/);
assert.match(confirmation,/field\('登錄日期','registered_at'/);
assert.match(refresh,/pokemon-sleep:analysis-confirmed-applied/);
assert.match(refresh,/SELECT \* FROM pokemon WHERE status='active'/);
assert.doesNotMatch(refresh,/location\.reload/);
assert.match(sw,/analysis-confirmation-post-apply-refresh\.js/);

// Public VERIFIED_NOT_REQUIRED is display-only; writable player fields remain null/empty.
assert.match(detail,/VERIFIED_NOT_REQUIRED_LABEL='不需要（公版已驗證）'/);
assert.match(detail,/requirement_states/);
assert.match(detail,/SQLite 玩家欄位仍維持空值/);
assert.match(detail,/p\.registered_at\|\|p\.obtained_at/);
assert.doesNotMatch(confirmation,/evolution_(?:sleep_hours_required|item_required|other_requirement)\s*=\s*['"]不需要/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042712_G13_12_CONFIRMATION_LIFECYCLE_MODEL_STATUS_UX',
  version:'v0.4.27.12',
  checks:{
    model_failover_visible:true,
    elapsed_seconds_visible:true,
    no_key_projection:true,
    cross_pokemon_group_isolation:true,
    confirmation_terminal_resets:true,
    post_apply_roster_refresh:true,
    original_label_create_fallback:true,
    registered_date_parity:true,
    verified_not_required_display_only:true,
    offline_precache_closure:true,
  },
},null,2));
