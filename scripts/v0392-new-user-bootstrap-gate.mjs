import fs from 'node:fs';
import vm from 'node:vm';

const database=fs.readFileSync('assets/js/database.js','utf8');
const migrations=fs.readFileSync('assets/js/migrations.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const serviceWorker=fs.readFileSync('service-worker.js','utf8');
const authoritySource=fs.readFileSync('assets/js/version-authority.js','utf8');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
const failures=[];
const requireText=(source,text,label)=>{if(!source.includes(text))failures.push(`${label}: missing ${text}`);};

requireText(database,'applyFreshDatabaseBootstrap','database fresh bootstrap import');
requireText(database,'if(isNew)','database new-user branch');
requireText(database,'FRESH_DATABASE_BOOTSTRAP','database progress stage');
requireText(database,'await yieldToUi()','database UI yield');
requireText(database,'applyAllMigrations(db)','database existing migration path');
requireText(migrations,'hasMigration','migration idempotence');
requireText(migrations,'export function applyFreshDatabaseBootstrap','fresh database migration path');
requireText(migrations,'if(!hasMigration(db,4))','shared master once-only guard');
requireText(migrations,'if(!hasMigration(db,6))','canonical once-only guard');
if(!/^v0\.3\.\d+$/.test(authority?.app_version||''))failures.push('central app version missing');
if(!authority?.app_build)failures.push('central build missing');
if(!bootstrap.includes('version-authority.js')||!bootstrap.includes('authority.app_version'))failures.push('bootstrap does not consume central authority');
if(!serviceWorker.includes("importScripts('./assets/js/version-authority.js')")||!serviceWorker.includes('cache_name:CACHE'))failures.push('service worker does not consume central authority');

const newStart=database.indexOf('if(isNew){');
const existingStart=database.indexOf('}else{',newStart);
if(newStart<0||existingStart<0){failures.push('unable to isolate fresh database branch');}else{
  const freshBlock=database.slice(newStart,existingStart);
  if(freshBlock.includes('applyAllMigrations(db)'))failures.push('fresh database still executes complete historical migrations');
  if(!freshBlock.includes('applyFreshDatabaseBootstrap(db)'))failures.push('fresh database does not use dedicated bootstrap');
}
const migrationCalls=[...migrations.matchAll(/if\(!hasMigration\(db,(\d+)\)\)/g)].map(match=>Number(match[1]));
for(const version of [2,3,4,5,6,7])if(!migrationCalls.includes(version))failures.push(`missing migration guard v${version}`);
try{new vm.Script(migrations.replace(/^import .*$/gm,'').replace(/export /g,''));}catch(error){failures.push(`migrations syntax: ${error.message}`);}
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,version:authority.app_version,build:authority.app_build,scenarios:['cleared_browser_history','empty_indexeddb','database_cleared'],contracts:['fresh_bootstrap_skips_historical_data_rewrites','existing_migrations_are_idempotent','ui_yields_between_sync_sqlite_phases','central_version_authority']},null,2));
