import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(current!=='v0.4.27.16')throw new Error(`V042716_PREDECESSOR_UNEXPECTED_VERSION:${current}`);

const staged=original
  .replace(/app_version:\s*'[^']+'/, "app_version: 'v0.4.27.15'")
  .replace(/app_build:\s*'[^']+'/, "app_build: '20260819-v042715-platform-identity-doctor-transfer'")
  .replace(/cache_name:\s*'[^']+'/, "cache_name: 'pokemon-sleep-ai-v0.4.27.15-v042715-platform-identity-doctor-transfer'");

try{
  fs.writeFileSync(authorityPath,staged,'utf8');
  const result=spawnSync(process.execPath,['scripts/v042715-platform-identity-doctor-transfer-contract.mjs'],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`V042716_PREDECESSOR_V042715_FAILED:${result.status}`);
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042716_PREDECESSOR_V042715_REPLAY',
  current_version:current,
  staged_version:'v0.4.27.15',
  contract:'scripts/v042715-platform-identity-doctor-transfer-contract.mjs',
},null,2));
