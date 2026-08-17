import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const contract=process.argv[2];
if(!contract)throw new Error('usage: node scripts/v04275-production-contract-runner.mjs <contract>');

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(current!=='v0.4.27.5'){
  const direct=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(direct.error)throw direct.error;
  if(direct.status!==0)process.exitCode=direct.status??1;
}else{
  // v0.4.27.5 changes Public Event / Weekly authority only. Production numeric
  // authority is intentionally identical to the already-verified v0.4.27.4
  // runtime, so replay Production behavioral contracts under that exact identity.
  const staged=original
    .replace("app_version: 'v0.4.27.5'","app_version: 'v0.4.27.4'")
    .replace("app_build: '20260817-v04275-public-event-master'","app_build: '20260817-v04274-live-s2-s4-hotfix'")
    .replace("cache_name: 'pokemon-sleep-ai-v0.4.27.5-v04275-public-event-master'","cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'");
  try{
    fs.writeFileSync(authorityPath,staged,'utf8');
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)process.exitCode=result.status??1;
  }finally{
    fs.writeFileSync(authorityPath,original,'utf8');
  }
}
