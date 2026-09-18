import fs from 'node:fs';
import assert from 'node:assert/strict';

// .55.3.3.10 regression-first contract.
// This gate intentionally lands before production navigation markup/runtime.
// It pins a narrow, auditable mobile path to UC.IMG-A review/status/trace without
// changing existing Update Center shell ownership.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

const requiredIds=[
  'ucImgAMobileQuickNavV0427553310',
  'ucImgAReviewAnchorV0427553310',
  'ucImgAStatusAnchorV0427553310',
  'ucImgATraceAnchorV0427553310',
];
for(const id of requiredIds){
  assert.match(html,new RegExp(`id=["']${id}["']`),`missing .55.3.3.10 Update Center mobile navigation authority: ${id}`);
}

assert.match(html,/data-uc-img-a-mobile-nav=["']true["']/,'mobile quick navigation must expose an auditable authority marker');
assert.match(html,/href=["']#ucImgAReviewAnchorV0427553310["']/,'quick navigation must link to UC.IMG-A review');
assert.match(html,/href=["']#ucImgAStatusAnchorV0427553310["']/,'quick navigation must link to UC.IMG-A status');
assert.match(html,/href=["']#ucImgATraceAnchorV0427553310["']/,'quick navigation must link to UC.IMG-A trace');

// Frozen layout ownership: the existing static shell remains the owner. The
// successor may add anchors/navigation but must not replace or duplicate it.
assert.equal((html.match(/id=["']updateCenterDynamicContent["']/g)||[]).length,1,'Update Center dynamic shell ownership must remain singular');
assert.equal((html.match(/id=["']updateCenterAnalysisStaticShell["']/g)||[]).length,1,'analysis static shell ownership must remain singular');

console.log('V0427553310_UPDATE_CENTER_MOBILE_NAVIGATION_REGRESSION_GATE=PASS');
