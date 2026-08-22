import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostic=fs.readFileSync('assets/js/data1d1-ocr-ai-ab-diagnostic.js','utf8');
const required=[
  "import {snapshotStandaloneImage} from './standalone-image-byte-snapshot.js'",
  'detached=await snapshotStandaloneImage(file)',
  'standaloneFiles.set(id,snapshotBlob)',
  'URL.createObjectURL(snapshotBlob)',
  'standalone_single_image_snapshot_failed',
  'snapshot_schema:detached.snapshot?.schema||null',
];
for(const token of required)assert.equal(diagnostic.includes(token),true,`missing_contract:${token}`);
assert.equal(diagnostic.includes('standaloneFiles.set(id,file)'),false,'raw standalone File retention forbidden');
assert.equal(diagnostic.includes('URL.createObjectURL(file)'),false,'raw standalone File preview forbidden');
assert.equal(diagnostic.includes('&quot;'),true,'HTML escaping contract must remain intact');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.14_V042726_STANDALONE_SNAPSHOT_INTEGRATION',
  raw_file_retention_forbidden:true,
  raw_file_preview_forbidden:true,
},null,2));
