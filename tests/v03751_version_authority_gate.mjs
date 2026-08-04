import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(bootstrap,/const APP_VERSION = 'v0\.3\.76'/);
assert.match(bootstrap,/const VERSION = '20260804-v0376-version-authority-hotfix'/);
assert.match(bootstrap,/version_authority_repaired/);
assert.match(bootstrap,/MutationObserver/);
assert.match(bootstrap,/unified-import-analysis-workbench\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.76-version-authority-hotfix/);
assert.match(worker,/pokemon-sleep-version-activated/);
assert.match(worker,/cache:'no-store'/);
assert.match(worker,/keys\.filter\(\(key\) => key !== CACHE\)/);
assert.match(index,/bootstrap\.js\?v=20260804-g13-3b-analysis-confirmation-apply/);
assert.ok(!/^const APP_VERSION = 'v0\.3\.7[0-5]'/m.test(bootstrap),'bootstrap must not declare an older active version');
console.log(JSON.stringify({ok:true,gate:'v0.3.76 version authority',downgrade_guard:true,cache_rotated:true,three_part_version:true}));
