import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const authorityPath='assets/js/version-authority.js';
const original=fs.readFileSync(authorityPath,'utf8');
const current=original.match(/app_version:\s*'([^']+)'/)?.[1]||null;

// v0.4.27.15 intentionally changes the identity authority and bumps the
// per-image export schema. Replaying the v0.4.27.13 exact source contract
// against the successor runtime would assert superseded behavior. The new
// v0.4.27.15 contract explicitly re-checks the retained v0.4.27.14 invariants.
if(current==='v0.4.27.15'){
  console.log(JSON.stringify({
    status:'PASS',
    gate:'V042714_PREDECESSOR_V042713_REPLAY_SUPERSEDED',
    current_version:current,
    superseded_by:'scripts/v042715-platform-identity-doctor-transfer-contract.mjs',
    reason:'PLATFORM_IDENTITY_AUTHORITY_AND_PER_IMAGE_EXPORT_SCHEMA_SUCCESSOR',
  },null,2));
  process.exit(0);
}

if(current!=='v0.4.27.14')throw new Error(`V042714_PREDECESSOR_UNEXPECTED_VERSION:${current}`);

const staged=original
  .replace(/app_version:\s*'[^']+'/, "app_version: 'v0.4.27.13'")
  .replace(/app_build:\s*'[^']+'/, "app_build: '20260819-v042713-physical-validation-closure'")
  .replace(/cache_name:\s*'[^']+'/, "cache_name: 'pokemon-sleep-ai-v0.4.27.13-v042713-physical-validation-closure'");

try{
  fs.writeFileSync(authorityPath,staged,'utf8');
  const result=spawnSync(process.execPath,['scripts/v042713-physical-closure-contract.mjs'],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`V042714_PREDECESSOR_V042713_FAILED:${result.status}`);
}finally{
  fs.writeFileSync(authorityPath,original,'utf8');
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042714_PREDECESSOR_V042713_REPLAY',
  current_version:current,
  staged_version:'v0.4.27.13',
  contract:'scripts/v042713-physical-closure-contract.mjs',
},null,2));
