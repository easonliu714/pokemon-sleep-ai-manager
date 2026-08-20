import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(current!=='v0.4.27.20')throw new Error(`V042720_PREDECESSOR_UNEXPECTED_VERSION:${current}`);

const staged=original
  .replace(/app_version:\s*'[^']+'/, "app_version: 'v0.4.27.19'")
  .replace(/app_build:\s*'[^']+'/, "app_build: '20260819-v042719-manual-draft-querysafe-offline'")
  .replace(/cache_name:\s*'[^']+'/, "cache_name: 'pokemon-sleep-ai-v0.4.27.19-v042719-manual-draft-querysafe-offline'");

const contracts=[
  'scripts/v042719-predecessor-v042718-runner.mjs',
  'scripts/v042719-manual-draft-querysafe-offline-contract.mjs',
];

try{
  fs.writeFileSync(authorityPath,staged,'utf8');
  for(const contract of contracts){
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`V042720_PREDECESSOR_FAILED:${contract}:${result.status}`);
  }
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}

console.log(JSON.stringify({status:'PASS',gate:'V042720_PREDECESSOR_V042719_REPLAY',current_version:current,staged_version:'v0.4.27.19',contracts,current_authority_restored:true},null,2));
