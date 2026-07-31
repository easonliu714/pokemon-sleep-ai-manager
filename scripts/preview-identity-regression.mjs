import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync('assets/js/update-center-ui-guard.js','utf8');
const convergence=fs.readFileSync('assets/js/identity-convergence.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

for(const token of ['jsonFile','changeTable','importSummary','applyBtn']){
  assert.ok(guard.includes(token),`missing preview reset token: ${token}`);
}
for(const token of ['identity_review_required=1','registered_at','identity_fingerprint','identity_confidence,0)>=0.95','automatic_strong_evidence_confirmation']){
  assert.ok(convergence.includes(token),`missing identity convergence token: ${token}`);
}
assert.ok(bootstrap.includes('identity-convergence.js'));
assert.ok(bootstrap.includes('update-center-ui-guard.js'));
assert.ok(sw.includes('identity-convergence.js'));
assert.ok(sw.includes('update-center-ui-guard.js'));
console.log('PASS preview reset and identity convergence regression');
