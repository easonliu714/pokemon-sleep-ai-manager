import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;
if(current!=='v0.4.27.17')throw new Error(`V042717_PREDECESSOR_UNEXPECTED_VERSION:${current}`);

function stageAuthority({version,build,cache}){
  return original
    .replace(/app_version:\s*'[^']+'/,`app_version: '${version}'`)
    .replace(/app_build:\s*'[^']+'/,`app_build: '${build}'`)
    .replace(/cache_name:\s*'[^']+'/,`cache_name: '${cache}'`);
}
function runContract(contract,{version,build,cache}){
  fs.writeFileSync(authorityPath,stageAuthority({version,build,cache}),'utf8');
  const result=spawnSync(process.execPath,[contract],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`V042717_PREDECESSOR_FAILED:${contract}:${result.status}`);
}

// v0.4.27.13 exact replay is intentionally NOT forced against successor
// runtime files: later releases validly evolved the export/identity contracts.
// The direct v042714 runner is successor-aware on v0.4.27.17, while the
// v0.4.27.16 predecessor + release contracts below verify retained safety
// invariants at the immediate predecessor boundary.
const replayPlan=[
  {
    contract:'scripts/v042716-predecessor-v042715-runner.mjs',
    version:'v0.4.27.16',
    build:'20260819-v042716-existing-baseline-sparse-diff',
    cache:'pokemon-sleep-ai-v0.4.27.16-v042716-existing-baseline-sparse-diff',
  },
  {
    contract:'scripts/v042716-existing-baseline-sparse-diff-contract.mjs',
    version:'v0.4.27.16',
    build:'20260819-v042716-existing-baseline-sparse-diff',
    cache:'pokemon-sleep-ai-v0.4.27.16-v042716-existing-baseline-sparse-diff',
  },
];

try{
  for(const entry of replayPlan)runContract(entry.contract,entry);
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042717_PREDECESSOR_V042716_REPLAY',
  current_version:current,
  staged_version:'v0.4.27.16',
  contracts:replayPlan.map(row=>row.contract),
  v042713_exact_replay:'SUPERSEDED_BY_SUCCESSOR_CONTRACTS',
  current_authority_restored:true,
},null,2));
