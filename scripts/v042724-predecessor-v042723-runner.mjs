import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
const currentPatch=Number(/^v0\.4\.27\.(\d+)$/.exec(current||'')?.[1]);
if(!Number.isInteger(currentPatch)||currentPatch<24)throw new Error(`V042724_PREDECESSOR_UNEXPECTED_VERSION:${current}`);

const staged=original
  .replace(/app_version:\s*'[^']+'/, "app_version: 'v0.4.27.23'")
  .replace(/app_build:\s*'[^']+'/, "app_build: '20260820-v042723-player-profile-consistency'")
  .replace(/cache_name:\s*'[^']+'/, "cache_name: 'pokemon-sleep-ai-v0.4.27.23-v042723-player-profile-consistency'");

const contracts=[
  'scripts/v042723-predecessor-v042722-runner.mjs',
  'scripts/v042723-player-profile-consistency-contract.mjs',
];

try{
  fs.writeFileSync(authorityPath,staged,'utf8');
  for(const contract of contracts){
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`V042724_PREDECESSOR_FAILED:${contract}:${result.status}`);
  }
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}

console.log(JSON.stringify({status:'PASS',gate:'V042724_PREDECESSOR_V042723_REPLAY',current_version:current,current_patch:currentPatch,minimum_successor_patch:24,staged_version:'v0.4.27.23',contracts,current_authority_restored:true},null,2));
