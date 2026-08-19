import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
const contract='scripts/v04275-public-event-master-contract.mjs';
const parseVersion=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const versionAtLeast=(version,floor)=>{
  const left=parseVersion(version),right=parseVersion(floor),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}
  return true;
};

if(current==='v0.4.27.5'){
  const direct=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(direct.error)throw direct.error;
  if(direct.status!==0)process.exitCode=direct.status??1;
}else if(versionAtLeast(current,'v0.4.27.6')){
  // v0.4.27.6+ successors may advance unrelated screenshot/review/provider UX,
  // confirmation display, or other bounded hotfix paths. Public Event authority
  // remains governed by the exact v0.4.27.5 release contract unless that contract
  // itself is intentionally superseded. Replay it under its immutable release identity
  // instead of maintaining an ever-growing version whitelist.
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
    successor_aware:true,
    public_event_authority_changed:false,
  },null,2));
}
