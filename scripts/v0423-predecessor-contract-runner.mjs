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
}else if(current==='v0.4.26'){
  staged=staged
    .replace("app_version: 'v0.4.26'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260814-v0426-g75e3a-ingredient-rate-reference-boundary'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.26-v0426-g75e3a-ingredient-rate-reference-boundary'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.27'){
  staged=staged
    .replace("app_version: 'v0.4.27'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260814-v0427-g75e3b-ingredient-slot-distribution'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27-v0427-g75e3b-ingredient-slot-distribution'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.27.1'){
  staged=staged
    .replace("app_version: 'v0.4.27.1'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260816-v04271-ingredient-inventory-integrity-hotfix'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.1-v04271-ingredient-inventory-integrity-hotfix'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.27.2'){
  staged=staged
    .replace("app_version: 'v0.4.27.2'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260816-v04272-ingredient-unlock-semantics-hotfix'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.27.3'){
  // v0.4.27.3 changes public name canonicalization and screenshot intake
  // semantics only. Production numeric authority remains unchanged at 4/7.
  staged=staged
    .replace("app_version: 'v0.4.27.3'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260817-v04273-weekly-recipe-semantic-intake-hotfix'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.3-v04273-weekly-recipe-semantic-intake-hotfix'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}else if(current==='v0.4.27.4'){
  // v0.4.27.4 closes live screenshot/berry identity regressions only.
  // Production numeric authority remains unchanged at 4/7.
  staged=staged
    .replace("app_version: 'v0.4.27.4'","app_version: 'v0.4.22.1'")
    .replace("app_build: '20260817-v04274-live-s2-s4-hotfix'","app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'","cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}

try{
  if(staged!==original)fs.writeFileSync(authorityPath,staged,'utf8');
  const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exitCode=result.status??1;
}finally{
  if(staged!==original)fs.writeFileSync(authorityPath,original,'utf8');
}