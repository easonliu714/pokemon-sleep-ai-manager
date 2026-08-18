import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(!atLeast(current,'v0.4.27.5'))throw new Error(`V04275_PREDECESSOR_RUNNER_UNEXPECTED_VERSION:${current}`);
const staged=original
  .replace(/app_version:\s*'[^']+'/,"app_version: 'v0.4.27.4'")
  .replace(/app_build:\s*'[^']+'/,"app_build: '20260817-v04274-live-s2-s4-hotfix'")
  .replace(/cache_name:\s*'[^']+'/,"cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'");
const contracts=[
  'scripts/v04271-release-contract.mjs',
  'scripts/v04272-release-contract.mjs',
  'scripts/v04273-release-contract.mjs',
  'scripts/v04274-release-contract.mjs',
];
try{
  fs.writeFileSync(authorityPath,staged,'utf8');
  for(const contract of contracts){
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`V04275_PREDECESSOR_RELEASE_FAILED:${contract}:${result.status}`);
  }
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}
console.log(JSON.stringify({status:'PASS',gate:'V0.4.27.5_PREDECESSOR_RELEASE_CONTRACTS_SUCCESSOR_AWARE',current_version:current,staged_version:'v0.4.27.4',contracts},null,2));