import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const bootstrapPath='assets/js/bootstrap.js';
const corePath='assets/js/data-consistency-multicapture.js';
const explicitPath='assets/js/explicit-manual-draft-save-v042737.js';
const versionPath='assets/js/version-authority.js';
const indexPath='index.html';
const serviceWorkerPath='service-worker.js';

for(const path of [bootstrapPath,corePath,explicitPath,versionPath,serviceWorkerPath]){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  assert.equal(syntax.status,0,`${path} syntax must pass`);
}

const bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const core=fs.readFileSync(corePath,'utf8');
const explicit=fs.readFileSync(explicitPath,'utf8');
const version=fs.readFileSync(versionPath,'utf8');
const index=fs.readFileSync(indexPath,'utf8');
const serviceWorker=fs.readFileSync(serviceWorkerPath,'utf8');

assert.match(version,/app_version:\s*'v0\.4\.27\.41'/);
assert.match(version,/app_build:\s*'20260826-v042741-single-multicapture-runtime-authority'/);
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.41-v042741-single-multicapture-runtime-authority'/);
assert.match(version,/\/\/ app_version: 'v0\.4\.27\.40'/,'v0.4.27.40 predecessor identity must remain available');

// Physical Android replay exposed two capture ledgers for one analysis revision:
// the same stateful module was loaded once by index.html and again as ?v=<build>
// from bootstrap. The production topology must have exactly one owner URL.
const staticNeedle='<script type="module" src="./assets/js/data-consistency-multicapture.js"></script>';
assert.equal(index.split(staticNeedle).length-1,1,'index.html must own exactly one static multicapture runtime');
assert.equal((bootstrap.match(/data-consistency-multicapture\.js/g)||[]).length,0,'bootstrap must not probe or dynamically import a second multicapture module URL');
assert.doesNotMatch(bootstrap,/import\(`\.\/data-consistency-multicapture\.js\?v=/,'query-versioned duplicate runtime is forbidden');

// Static dependency order is intentional: one ledger first, then the form-group
// authority, then explicit-save authority. Removing the static core without changing
// this order would leave later installers without their API.
const coreIndex=index.indexOf('./assets/js/data-consistency-multicapture.js');
const groupIndex=index.indexOf('./assets/js/review-group-isolation-v042717.js');
const saveIndex=index.indexOf('./assets/js/explicit-manual-draft-save-v042737.js');
assert.ok(coreIndex>=0&&groupIndex>coreIndex&&saveIndex>groupIndex,'static review authority load order must remain core -> group -> explicit save');

// Offline remains supported without the bootstrap duplicate because Service Worker
// precaches the single static authority and querySafeCacheMatch ignores search params.
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
  physical_failure_replayed:'explicit manual save GROUP_NOT_FOUND while navigation uses a different duplicate capture ledger',
  production_static_multicapture_instances:1,
  bootstrap_dynamic_multicapture_instances:0,
  service_worker_precache:true,
  stale_revision_fail_closed:true,
  group_not_found_fail_closed:true,
  private_player_fixture_embedded:false,
},null,2));
