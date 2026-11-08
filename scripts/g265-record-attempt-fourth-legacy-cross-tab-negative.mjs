// Historical negative: two unadmitted tabs overwrote acknowledged recipe attempts.
// Current production contract must instead reject the queued stale contender
// BEFORE its canonical SQL read, snapshot or BEGIN. Native Chromium regression
// and source-bound execution are run as separate required steps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('assets/js/recipe-attempt-feedback-local.js','utf8');
const body=source.split('export async function recordRecipeAttemptFailure(')[1]
  ?.split('// G6.2: share the attempt-write')[0];
assert.ok(body,'exact named production operation required');
assert.match(body,/withPrimarySqliteMutationLock\(async lease/);
assert.match(body,/snapshot\('recipe-feedback:record-attempt'\)/);
assert.match(body,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(body,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(body,/withSqliteCoordinatedMutation\(commit\)/);
console.log('PASS G265_RECORD_ATTEMPT_HISTORIC_LOST_UPDATE_PREVENTED_BY_NAMED_ADMISSION');
console.log('HOLD G265_OTHER_LEGACY_WRITERS_AND_ANDROID_UAT');
