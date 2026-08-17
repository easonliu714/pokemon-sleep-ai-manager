import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(current!=='v0.4.27.5')throw new Error(`V04275_PREDECESSOR_RUNNER_UNEXPECTED_VERSION:${current}`);
const staged=original
  .replace("app_version: 'v0.4.27.5'","app_version: 'v0.4.27.4'")
  .replace("app_build: '20260817-v04275-public-event-master'","app_build: '20260817-v04274-live-s2-s4-hotfix'")
  .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.5-v04275-public-event-master'","cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'");
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
console.log(JSON.stringify({status:'PASS',gate:'V0.4.27.5_PREDECESSOR_RELEASE_CONTRACTS',staged_version:'v0.4.27.4',contracts},null,2));
