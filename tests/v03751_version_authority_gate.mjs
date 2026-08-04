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
assert.equal(activeVersion,'v0.3.77');
assert.equal(activeBuild,'20260804-v0377a-backup-truth-restore-verification');
assert.match(bootstrap,/version_authority_repaired/);
assert.match(bootstrap,/MutationObserver/);
assert.match(bootstrap,/unified-import-analysis-workbench\.js/);
assert.match(worker,new RegExp(`pokemon-sleep-ai-${activeVersion.replaceAll('.','\\.')}-v0377a-backup-truth-restore-verification`));
assert.match(worker,new RegExp(`app_version:'${activeVersion.replaceAll('.','\\.')}'`));
assert.match(worker,/pokemon-sleep-version-activated/);
assert.match(worker,/cache:'no-store'/);
assert.match(worker,/keys\.filter\(\(key\) => key !== CACHE\)/);
assert.ok(index.includes(`bootstrap.js?v=${activeBuild}`),'index bootstrap build must equal active authority build');
assert.ok(!/^const APP_VERSION = 'v0\.3\.7[0-6]'/m.test(bootstrap),'bootstrap must not declare an older active version');
console.log(JSON.stringify({ok:true,gate:`${activeVersion} version authority`,downgrade_guard:true,cache_rotated:true,three_part_version:true}));