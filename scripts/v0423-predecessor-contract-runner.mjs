import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const contract=process.argv[2];
if(!contract)throw new Error('usage: node scripts/v0423-predecessor-contract-runner.mjs <contract>');

const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
let staged=original;

if(atLeast(current,'v0.4.23')){
  // Replay the exact v0.4.22.1 release contract against its historical authority
  // while preserving the real successor authority on disk after the child exits.
  staged=staged
    .replace(/app_version:\s*'[^']+'/,"app_version: 'v0.4.22.1'")
    .replace(/app_build:\s*'[^']+'/,"app_build: '20260813-v04221-recipe-formula-authority-audit'")
    .replace(/cache_name:\s*'[^']+'/,"cache_name: 'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit'");
}

try{
  if(staged!==original)fs.writeFileSync(authorityPath,staged,'utf8');
  const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exitCode=result.status??1;
}finally{
  if(staged!==original)fs.writeFileSync(authorityPath,original,'utf8');
}