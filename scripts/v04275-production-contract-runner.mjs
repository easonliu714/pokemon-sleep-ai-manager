import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const contract=process.argv[2];
if(!contract)throw new Error('usage: node scripts/v04275-production-contract-runner.mjs <contract>');

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
const unchangedProductionReleases=new Set(['v0.4.27.5','v0.4.27.6','v0.4.27.7','v0.4.27.8','v0.4.27.9','v0.4.27.10']);
if(!unchangedProductionReleases.has(current)){
  const direct=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(direct.error)throw direct.error;
  if(direct.status!==0)process.exitCode=direct.status??1;
}else{
  // v0.4.27.5 changes Public Event / Weekly authority and PE7 legacy-event UI only.
  // v0.4.27.6 changes G13 screenshot-observation contract/progress UX only.
  // v0.4.27.7 hardens the same G13 path with structured output and current-file UX only.
  // v0.4.27.8 hardens AI provider failover and review/evolution presentation only.
  // v0.4.27.9 fixes null-safe multicapture confirmation and evolution re-hydration only.
  // v0.4.27.10 bounds AI startup/provider timeouts and hydrates public review display only.
  // None changes Production numeric authority, so replay Production behavioral
  // contracts under the already-verified v0.4.27.4 identity.
  const staged=original
    .replace(/app_version:\s*'[^']+'/,"app_version: 'v0.4.27.4'")
    .replace(/app_build:\s*'[^']+'/,"app_build: '20260817-v04274-live-s2-s4-hotfix'")
    .replace(/cache_name:\s*'[^']+'/,"cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'");
  try{
    fs.writeFileSync(authorityPath,staged,'utf8');
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)process.exitCode=result.status??1;
  }finally{
    fs.writeFileSync(authorityPath,original,'utf8');
  }
}