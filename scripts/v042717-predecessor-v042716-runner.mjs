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

const replayPlan=[
  {
    contract:'scripts/v042714-predecessor-v042713-runner.mjs',
    version:'v0.4.27.14',
    build:'20260819-v042714-nickname-guard-bidirectional-review',
    cache:'pokemon-sleep-ai-v0.4.27.14-v042714-nickname-guard-bidirectional-review',
  },
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
  gate:'V042717_PREDECESSOR_CHAIN_REPLAY',
  current_version:current,
  staged_versions:[...new Set(replayPlan.map(row=>row.version))],
  contracts:replayPlan.map(row=>row.contract),
  current_authority_restored:true,
},null,2));
