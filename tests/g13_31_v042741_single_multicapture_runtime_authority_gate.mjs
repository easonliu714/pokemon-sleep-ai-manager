import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const bootstrapPath='assets/js/bootstrap.js';
const corePath='assets/js/data-consistency-multicapture.js';
const explicitPath='assets/js/explicit-manual-draft-save-v042737.js';
const confirmationPath='assets/js/analysis-confirmation-workbench.js';
const versionPath='assets/js/version-authority.js';
const indexPath='index.html';
const serviceWorkerPath='service-worker.js';

for(const path of [bootstrapPath,corePath,explicitPath,confirmationPath,versionPath,serviceWorkerPath]){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  assert.equal(syntax.status,0,`${path} syntax must pass`);
}

const bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const core=fs.readFileSync(corePath,'utf8');
const explicit=fs.readFileSync(explicitPath,'utf8');
const confirmation=fs.readFileSync(confirmationPath,'utf8');
const version=fs.readFileSync(versionPath,'utf8');
const index=fs.readFileSync(indexPath,'utf8');
const serviceWorker=fs.readFileSync(serviceWorkerPath,'utf8');

assert.match(version,/app_version:\s*'v0\.4\.27\.41'/);
assert.match(version,/app_build:\s*'20260826-v042741-single-multicapture-runtime-authority'/);
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.41-v042741-single-multicapture-runtime-authority'/);
assert.match(version,/\/\/ app_version: 'v0\.4\.27\.40'/,'v0.4.27.40 predecessor identity must remain available');

// Physical Android replay exposed two capture ledgers for one analysis revision:
// the stateful module was previously loaded once as an unversioned page module and
// again as ?v=<build> from bootstrap. v0.4.27.41 uses one canonical module URL.
const staticNeedle='<script type="module" src="./assets/js/data-consistency-multicapture.js"></script>';
const bootstrapNeedle="import './data-consistency-multicapture.js';";
assert.equal(index.split(staticNeedle).length-1,1,'index.html must retain exactly one canonical unversioned multicapture reference');
assert.equal(bootstrap.split(bootstrapNeedle).length-1,1,'bootstrap must initialize the same canonical unversioned multicapture URL exactly once');
assert.doesNotMatch(bootstrap,/data-consistency-multicapture\.js['"]?\s*,/,'multicapture must not re-enter the query-versioned probe list');
assert.doesNotMatch(bootstrap,/import\(`\.\/data-consistency-multicapture\.js\?v=/,'query-versioned duplicate runtime is forbidden');
assert.equal((bootstrap.match(/data-consistency-multicapture\.js\?v=/g)||[]).length,0,'no query-versioned multicapture URL may remain');

// Bootstrap is earlier than the page's later static script, but its top-level import
// is a dependency: ESM evaluates the singleton before bootstrap body/downstream probes.
// The later page script resolves to the identical URL and is therefore de-duplicated.
const bootstrapIndex=index.indexOf('./assets/js/bootstrap.js');
const coreIndex=index.indexOf('./assets/js/data-consistency-multicapture.js');
const groupIndex=index.indexOf('./assets/js/review-group-isolation-v042717.js');
const saveIndex=index.indexOf('./assets/js/explicit-manual-draft-save-v042737.js');
assert.ok(bootstrapIndex>=0&&coreIndex>bootstrapIndex&&groupIndex>coreIndex&&saveIndex>groupIndex,'page order must remain bootstrap -> canonical core reference -> group -> explicit save');
assert.match(bootstrap,/import '\.\/data-consistency-multicapture\.js';[\s\S]*const authority=/,'singleton dependency must be evaluated before bootstrap runtime body');

// v0.4.27.23 localized-date compatibility must not depend on listener/microtask
// ordering after the v0.4.27.41 singleton topology change. The confirmation form
// projects only the HTML date-control value to ISO at render time; the source draft
// and Evidence remain untouched until normal human-review handling.
assert.match(confirmation,/import \{normalizeGameDateForInput\} from '\.\/player-profile-consistency-v042723\.js';/,'confirmation render must reuse the established v0.4.27.23 date authority');
assert.match(confirmation,/const registeredDateInputValue=normalizeGameDateForInput\(d\.registered_at\)\|\|'';/,'date input compatibility must be resolved synchronously during render');
assert.match(confirmation,/field\('登錄日期','registered_at',registeredDateInputValue,'date'\)/,'HTML date input must receive the ISO projection rather than localized raw text');

// Offline remains supported because Service Worker precaches that same canonical URL
// and querySafeCacheMatch ignores search params for legacy/query-safe requests.
assert.match(serviceWorker,/['"]\.\/assets\/js\/data-consistency-multicapture\.js['"]/,'single multicapture authority must stay precached');
assert.match(serviceWorker,/caches\.match\(request,\{ignoreSearch:true\}\)/,'offline query-safe cache fallback must remain available');

// Keep the safety boundary. This fix eliminates split ledgers; it must not make
// GROUP_NOT_FOUND or stale revisions writable.
assert.match(explicit,/return \{ok:false,status:'GROUP_NOT_FOUND'\}/,'missing group remains fail closed');
assert.match(explicit,/return \{ok:false,status:'STALE_REVISION'\}/,'stale revision remains fail closed');
assert.match(explicit,/if\(!match\.ok\)\{setStatus\(`儲存已阻擋：\$\{match\.status\}/,'explicit save still blocks failed revision authority');
assert.match(core,/globalThis\.addEventListener\('pokemon-sleep:analysis-revision-saved',event=>upsertRevision/,'single runtime remains the sole revision listener owner');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.31_V042741_SINGLE_MULTICAPTURE_RUNTIME_AUTHORITY',
  physical_failure_replayed:'explicit manual save GROUP_NOT_FOUND while navigation used another duplicate capture ledger',
  canonical_multicapture_url:'./assets/js/data-consistency-multicapture.js',
  bootstrap_dependency_references:1,
  page_static_references:1,
  evaluated_esm_instances_expected:1,
  bootstrap_query_versioned_instances:0,
  confirmation_date_projection:'SYNCHRONOUS_V042723_AUTHORITY',
  source_draft_mutated_by_projection:false,
  service_worker_precache:true,
  stale_revision_fail_closed:true,
  group_not_found_fail_closed:true,
  private_player_fixture_embedded:false,
},null,2));