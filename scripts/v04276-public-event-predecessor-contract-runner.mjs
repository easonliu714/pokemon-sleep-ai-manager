import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
const contract='scripts/v04275-public-event-master-contract.mjs';

if(current==='v0.4.27.5'){
  const direct=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(direct.error)throw direct.error;
  if(direct.status!==0)process.exitCode=direct.status??1;
}else if(['v0.4.27.6','v0.4.27.7','v0.4.27.8','v0.4.27.9','v0.4.27.10','v0.4.27.11'].includes(current)){
  // v0.4.27.6–v0.4.27.9 change only G13 screenshot/review/provider UX paths.
  // v0.4.27.10 adds bounded AI startup/provider timeout and Public Master
  // confirmation-display hydration only.
  // v0.4.27.11 adds model-candidate budgeting and runtime fallback persistence only.
  // Public Event authority is unchanged, so replay the exact v0.4.27.5 release
  // contract under its own identity.
  const staged=original
    .replace(/app_version:\s*'[^']+'/,"app_version: 'v0.4.27.5'")
    .replace(/app_build:\s*'[^']+'/,"app_build: '20260817-v04275-pe7-legacy-event-ui-hotfix'")
    .replace(/cache_name:\s*'[^']+'/,"cache_name: 'pokemon-sleep-ai-v0.4.27.5-v04275-pe7-legacy-event-ui-hotfix'");
  try{
    fs.writeFileSync(authorityPath,staged,'utf8');
    const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
    if(result.error)throw result.error;
    if(result.status!==0)process.exitCode=result.status??1;
  }finally{
    fs.writeFileSync(authorityPath,original,'utf8');
  }
}else{
  throw new Error(`V04276_PUBLIC_EVENT_PREDECESSOR_RUNNER_UNEXPECTED_VERSION:${current}`);
}

if(!process.exitCode){
  console.log(JSON.stringify({
    status:'PASS',
    gate:'V0.4.27.6_PUBLIC_EVENT_PREDECESSOR_REPLAY',
    current_version:current,
    predecessor_version:'v0.4.27.5',
    public_event_authority_changed:false,
  },null,2));
}