import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const authorityPath=path.join(root,'assets/js/version-authority.js');
const source=fs.readFileSync(authorityPath,'utf8');
const sandbox={};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:authorityPath});
const authority=sandbox.PokemonSleepVersionAuthority;
if(!authority?.app_version||!authority?.app_build||!authority?.cache_name)throw new Error('version_authority_invalid');

const stripComments=text=>text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\n)\s*\/\/.*(?=\n|$)/g,'$1');
const activeFiles=['assets/js/bootstrap.js','assets/js/runtime-version.js','assets/js/v0394-startup-watchdog.js','service-worker.js'];
for(const file of activeFiles){
  const executable=stripComments(fs.readFileSync(path.join(root,file),'utf8'));
  if(executable.includes(authority.app_version)||executable.includes(authority.app_build)||executable.includes(authority.cache_name))throw new Error(`hardcoded_current_authority:${file}`);
}

const bootstrap=fs.readFileSync(path.join(root,'assets/js/bootstrap.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
for(const [name,text] of [['bootstrap',bootstrap],['service-worker',worker]])if(!/version-authority\.js/.test(text))throw new Error(`authority_import_missing:${name}`);
if(!/cache_name:CACHE/.test(worker))throw new Error('service_worker_cache_not_parameterized');
if(!/encodeURIComponent\(VERSION\)/.test(bootstrap))throw new Error('dynamic_import_token_not_parameterized');
console.log(JSON.stringify({ok:true,authority,active_files:activeFiles,legacy_parser_bridges_ignored:true},null,2));
