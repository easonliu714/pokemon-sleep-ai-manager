import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

export const LEGACY_RUNTIME_REGRESSION_VERSION='legacy-runtime-regression-2026-08-14-a';

const existingContracts=Object.freeze([
  'tests/v03751_version_authority_gate.mjs',
  'tests/v0387-safe-boot-contract.test.mjs',
  'tests/v0389-rescue-catalog-import-contract.test.mjs',
  'scripts/v0392-new-user-bootstrap-gate.mjs',
]);

function annotationSafe(value){return String(value??'').replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');}
function run(command,args,{label=command}={}){
  const result=spawnSync(command,args,{encoding:'utf8'});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.error)throw result.error;
  if(result.status!==0){
    const detail=[result.stderr,result.stdout].filter(Boolean).join('\n').trim()||`exit ${result.status}`;
    console.error(`::error title=${annotationSafe(label)}::${annotationSafe(detail)}`);
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}
const read=path=>fs.readFileSync(path,'utf8');

for(const path of existingContracts){
  assert.equal(fs.existsSync(path),true,`legacy behavioral contract missing: ${path}`);
  run(process.execPath,['--check',path],{label:`syntax:${path}`});
  run(process.execPath,[path],{label:`contract:${path}`});
}

// v0.3.82 historical intent: snapshot/import/master/migration are present and
// runtime/cache authority stays centralized instead of being copied into feature files.
{
  const required=['assets/js/v0382-image-byte-snapshot.js','assets/js/unified-import-analysis-workbench.js','assets/js/migrations.js','assets/js/shared-master-data.js','assets/js/public-recipe-master.js','assets/js/public-recipe-master-sync.js','assets/js/version-authority.js'];
  for(const path of required)assert.equal(fs.existsSync(path),true,`v0382 dependency missing: ${path}`);
  const authoritySource=read('assets/js/version-authority.js');const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);const authority=sandbox.PokemonSleepVersionAuthority;
  assert.ok(authority?.app_version&&authority?.app_build&&authority?.cache_name,'central version authority incomplete');
  const workbench=read('assets/js/unified-import-analysis-workbench.js'),migrations=read('assets/js/migrations.js'),shared=read('assets/js/shared-master-data.js'),recipe=read('assets/js/public-recipe-master.js'),sync=read('assets/js/public-recipe-master-sync.js');
  assert.match(workbench,/image_byte_snapshot|sourceBlob|readImage/);assert.match(migrations,/schema_migrations|apply.*Migration/i);assert.match(shared,/MASTER_DATA_VERSION/);assert.match(shared,/applySharedMasterData/);assert.match(shared,/ingredient_master/);assert.doesNotMatch(shared,/const\s+RECIPES/);assert.match(recipe,/PUBLIC_RECIPE_MASTER_VERSION/);assert.match(sync,/syncPublicRecipeMaster/);assert.match(migrations,/public_recipe_master_version/);
  for(const path of required.filter(path=>path!=='assets/js/version-authority.js')){const source=read(path);assert.doesNotMatch(source,/const\s+APP_VERSION\s*=\s*['"]/);assert.doesNotMatch(source,/const\s+CACHE(?:_NAME)?\s*=\s*['"]/);}
  console.log('PASS legacy v0.3.82 centralized-authority contract');
}

// v0.3.85 / v0.3.87.1 boot-isolation and finalize behavior, successor-aware.
{
  for(const path of ['assets/js/database.js','assets/js/app.js','assets/js/bootstrap.js','assets/js/v0383-catalog-ocr-review-contract.js','assets/js/public-catalog-workbench.js','assets/js/version-authority.js'])assert.equal(fs.existsSync(path),true,`${path} missing`);
  const database=read('assets/js/database.js'),app=read('assets/js/app.js'),bootstrap=read('assets/js/bootstrap.js'),catalogContract=read('assets/js/v0383-catalog-ocr-review-contract.js'),catalog=read('assets/js/public-catalog-workbench.js');
  assert.match(database,/BOOT_PERSIST_SKIPPED|boot_persist_skipped/);assert.match(database,/RESCUE_READY/);assert.match(database,/BOOTSTRAP_COMPLETE/);assert.match(database,/dispatchReady/);assert.match(database+bootstrap,/APP_READY/);
  assert.match(catalogContract,/database_write_performed:false/);assert.match(catalogContract,/PokemonSleepPublicRecipeRegistry/);assert.match(catalog,/item_catalog_state/);assert.match(catalog,/recipe_catalog_state/);assert.match(app,/initializeDatabase/);assert.match(app,/setupG3Pages/);assert.match(app,/refresh/);assert.match(bootstrap,/PokemonSleepVersionAuthority|version-authority\.js/);
  for(const [path,source] of [['assets/js/database.js',database],['assets/js/app.js',app],['assets/js/bootstrap.js',bootstrap]]){assert.doesNotMatch(source,/const\s+APP_VERSION\s*=\s*['"]/);assert.doesNotMatch(source,/const\s+CACHE(?:_NAME)?\s*=\s*['"]/);}
  console.log('PASS legacy boot-isolation/finalize contract');
}

// v0.3.88 zero-SQL rescue behavior. This is a current safety boundary, not an old version marker.
{
  const database=read('assets/js/database.js'),app=read('assets/js/app.js');
  assert.match(database,/RESCUE_READY/);assert.match(database,/BOOTSTRAP_COMPLETE/);assert.match(database,/rescueReadonly/);assert.match(database,/readonly_rescue_mode/);assert.match(database,/zero_sql:true/);assert.match(database,/if\(rescueReadonly\)return \[\]/);assert.match(database,/if\(rescueReadonly\)return 0/);assert.match(app,/initializeDatabase/);
  const start=database.indexOf('async function createReadonlyRescueDatabase'),end=database.indexOf('export async function inspectDatabaseBoot',start);assert.ok(start>=0&&end>start,'unable to isolate createReadonlyRescueDatabase');const rescue=database.slice(start,end);assert.doesNotMatch(rescue,/initSqlJs|new SQL\.Database|loadDatabaseBytes/);assert.match(rescue,/db=null/);assert.match(rescue,/dispatchReadyAsync\(detail\)/);
  console.log('PASS legacy zero-SQL rescue contract');
}

// v0.3.90 worker isolation + v0.3.91 lifecycle-race closure under central authority.
{
  for(const path of ['assets/js/database.js','assets/js/storage.js','assets/js/sqlite-load-worker.js','assets/js/v0390-worker-load-control.js','assets/js/bootstrap.js','assets/js/version-authority.js','service-worker.js','index.html'])assert.equal(fs.existsSync(path),true,`${path} missing`);
  const database=read('assets/js/database.js'),storage=read('assets/js/storage.js'),worker=read('assets/js/sqlite-load-worker.js'),control=read('assets/js/v0390-worker-load-control.js'),bootstrap=read('assets/js/bootstrap.js'),authority=read('assets/js/version-authority.js'),sw=read('service-worker.js'),index=read('index.html');
  assert.match(database,/loadDatabaseBytesInWorker/);assert.match(storage,/new Worker\(new URL\('\.\/sqlite-load-worker\.js'/);assert.match(storage,/LEGACY_DB_WORKER_UNRESPONSIVE/);assert.match(worker,/maxTransferBytes/);assert.match(control,/cancelForcedDatabaseLoad/);
  const forced=database.split('if(inspection.exists&&forced){',2)[1]?.split("emit('SQLJS_LOADING'",1)[0]||'';assert.match(forced,/loadDatabaseBytesInWorker/);assert.doesNotMatch(forced,/loadDatabaseBytes\(\)/);
  const cancel=storage.split('export function cancelWorkerDatabaseLoad(){',2)[1]?.split('export function loadDatabaseBytesInWorker',1)[0]||'',load=storage.split('export function loadDatabaseBytesInWorker',2)[1]?.split('export async function saveDatabaseBytes',1)[0]||'';assert.match(cancel,/const worker=sqliteLoadWorker/);assert.match(cancel,/worker\.terminate\(\)/);assert.doesNotMatch(cancel,/sqliteLoadWorker\?\.terminate\(\)/);assert.match(storage,/sqliteLoadWorkerGeneration/);assert.match(load,/const isCurrent=/);assert.match(load,/legacy_db_worker_superseded/);
  assert.match(authority,/app_version\s*:\s*'v\d+\.\d+\.\d+(?:\.\d+)?'/);assert.match(bootstrap,/const APP_VERSION=authority\.app_version/);assert.match(bootstrap,/const VERSION=authority\.app_build/);assert.match(sw,/cache_name:CACHE/);assert.match(index,/src="\.\/assets\/js\/bootstrap\.js"/);assert.doesNotMatch(index,/bootstrap\.js\?v=/);
  console.log('PASS legacy worker isolation/lifecycle contract');
}

run('git',['diff','--exit-code'],{label:'legacy-runtime mutation guard'});
console.log(JSON.stringify({status:'PASS',gate:'LEGACY_RUNTIME_REGRESSION',version:LEGACY_RUNTIME_REGRESSION_VERSION,existing_contract_count:existingContracts.length,embedded_behavior_groups:4,player_data_write:false,release_authority_mutation:false},null,2));
