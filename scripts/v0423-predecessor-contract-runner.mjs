import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const contract=process.argv[2];
if(!contract)throw new Error('usage: node scripts/v0423-predecessor-contract-runner.mjs <contract>');

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
let staged=original;

if(current==='v0.4.23'){
  staged=staged
    .replace("app_version: 'v0.4.23'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260814-v0423-g75e1-production-modifier-structural'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.23-v0423-g75e1-production-modifier-structural'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.24'){
  staged=staged
    .replace("app_version: 'v0.4.24'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260814-v0424-g75e2a-nature-numeric-modifier'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.24-v0424-g75e2a-nature-numeric-modifier'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.25'){
  staged=staged
    .replace("app_version: 'v0.4.25'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260814-v0425-g75e2b-recipe-name-subskill'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.25-v0425-g75e2b-recipe-name-subskill'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}

try{
  if(staged!==original)fs.writeFileSync(authorityPath,staged,'utf8');
  const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exitCode=result.status??1;
}finally{
  if(staged!==original)fs.writeFileSync(authorityPath,original,'utf8');
}
