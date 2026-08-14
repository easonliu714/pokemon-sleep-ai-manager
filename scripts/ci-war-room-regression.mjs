import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const WAR_ROOM_REGRESSION_VERSION='war-room-regression-2026-08-14-a';
const read=path=>fs.readFileSync(path,'utf8');
const contracts=Object.freeze([
  'scripts/war1c-evaluation-snapshot-lifecycle-contract.mjs',
  'scripts/v044-evaluation-snapshot-lifecycle-release-contract.mjs',
  'scripts/v042-pokemon-candidate-feature-contract.mjs',
  'scripts/v042-pokemon-scoring-engine-contract.mjs',
  'scripts/war2a-current-readiness-runtime-bridge-contract.mjs',
  'scripts/v045-current-readiness-runtime-release-contract.mjs',
  'scripts/g7-recipe-portfolio-contention-contract.mjs',
  'scripts/war2b-recipe-discovery-stockpile-contract.mjs',
  'scripts/v046-recipe-discovery-release-contract.mjs',
  'scripts/v047-release-contract.mjs',
  'scripts/v0463-release-contract.mjs',
  'scripts/v0463-weekly-ai-type-repair-contract.mjs',
  'scripts/war3a-candy-inventory-contract.mjs',
  'scripts/v048-release-contract.mjs',
  'scripts/war3b-typed-event-effect-registry-contract.mjs',
  'scripts/v0491-release-contract.mjs',
  'scripts/v049-release-contract.mjs',
  'scripts/war3c-external-strategy-analysis-pack-contract.mjs',
  'scripts/v0485-release-contract.mjs',
  'scripts/v0484-release-contract.mjs',
  'scripts/v0483-release-contract.mjs',
  'scripts/v0481-live-followup-contract.mjs',
]);
const syntaxFiles=Object.freeze([
  'assets/js/evaluation-week.js','assets/js/evaluation-refresh-plan.js','assets/js/evaluation-lifecycle.js','assets/js/evaluation-lifecycle-bootstrap.js','assets/js/pokemon-evaluation-store.js','assets/js/war-room-evaluation-lifecycle-ui.js','assets/js/war-room-evaluation-lifecycle-bootstrap.js',
  'assets/js/pokemon-candidate-feature-projection.js','assets/js/pokemon-scoring-engine.js','assets/js/pokemon-candidate-local.js',
  'assets/js/public-recipe-discovery-master.js','assets/js/weekly-context-normalization.js','assets/js/recipe-discovery-stockpile.js','assets/js/recipe-discovery-stockpile-local.js','assets/js/war-room-recipe-discovery-ui.js','assets/js/war-room-recipe-discovery-bootstrap.js','assets/js/recipe-strategy-local.js','assets/js/recipe-portfolio-contention.js','assets/js/recipe-portfolio-contention-local.js','assets/js/war-room-cooking-planner-ui.js','assets/js/war-room-cooking-planner-bootstrap.js','assets/js/prompt-catalog.js',
  'assets/js/schema.js','assets/js/migrations.js','assets/js/public-candy-master.js','assets/js/canonical-registry.js','assets/js/importer.js','assets/js/ai-workflow.js','assets/js/resource-context.js','assets/js/candy-inventory-ui.js','assets/js/app.js','assets/js/backup-truth-restore.js',
  'assets/js/weekly-event-effect-registry.js','assets/js/weekly-context-import-contract.js','assets/js/weekly-context-ui-bridge.js','assets/js/pokemon-evaluation-contract.js',
  'assets/js/external-strategy-analysis-pack.js','assets/js/external-strategy-analysis-privacy.js','assets/js/external-strategy-analysis-local.js','assets/js/war-room-strategy-analysis-pack-ui.js','assets/js/version-authority.js',
]);

function runNode(path){
  assert.equal(fs.existsSync(path),true,`War Room contract missing: ${path}`);
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});assert.equal(syntax.status,0,`War Room contract syntax failed: ${path}`);
  const result=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});assert.equal(result.status,0,`War Room contract failed: ${path}`);
}
for(const path of syntaxFiles){assert.equal(fs.existsSync(path),true,`War Room runtime dependency missing: ${path}`);const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});assert.equal(result.status,0,`War Room runtime syntax failed: ${path}`);}

// Preserve WAR.2B's historical v0.4.13-only release check semantics.
const versionSource=read('assets/js/version-authority.js');
const currentVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
if(currentVersion==='v0.4.13')runNode('scripts/v0413-release-contract.mjs');
for(const path of contracts)runNode(path);
const mutation=spawnSync('git',['diff','--exit-code'],{stdio:'inherit'});assert.equal(mutation.status,0,'War Room regression mutated tracked files');
console.log(JSON.stringify({status:'PASS',gate:'WAR_ROOM_REGRESSION',version:WAR_ROOM_REGRESSION_VERSION,contract_count:contracts.length,syntax_file_count:syntaxFiles.length,conditional_v0413_executed:currentVersion==='v0.4.13',behavioral_contracts_removed:0},null,2));
