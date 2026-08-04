import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
const index=fs.readFileSync('index.html','utf8');

const versionMatch=bootstrap.match(/const APP_VERSION = '(v\d+\.\d+\.\d+)'/);
const buildMatch=bootstrap.match(/const VERSION = '([^']+)'/);
assert.ok(versionMatch,'bootstrap active version missing');
assert.ok(buildMatch,'bootstrap active build missing');
const activeVersion=versionMatch[1];
const activeBuild=buildMatch[1];
assert.match(bootstrap,/version_authority_repaired/);
assert.match(bootstrap,/MutationObserver/);
assert.match(bootstrap,/unified-import-analysis-workbench\.js/);
assert.ok(worker.includes(`pokemon-sleep-ai-${activeVersion}-${activeBuild.replace(/^\d{8}-/,'')}`),'worker cache must match bootstrap authority');
assert.ok(worker.includes(`app_version:'${activeVersion}'`),'worker activation version must match bootstrap authority');
assert.ok(worker.includes(`build:'${activeBuild}'`),'worker activation build must match bootstrap authority');
assert.match(worker,/pokemon-sleep-version-activated/);
assert.match(worker,/cache:'no-store'/);
assert.match(worker,/keys\.filter\(\(key\)=>key!==CACHE\)|keys\.filter\(\(key\) => key !== CACHE\)/);
assert.ok(index.includes(`bootstrap.js?v=${activeBuild}`),'index bootstrap build must equal active authority build');
assert.match(activeVersion,/^v\d+\.\d+\.\d+$/,'active version must use three-part semver');
console.log(JSON.stringify({ok:true,gate:`${activeVersion} version authority`,downgrade_guard:true,cache_rotated:true,three_part_version:true}));