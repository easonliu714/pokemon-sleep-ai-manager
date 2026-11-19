// G265 #861: actual production G3 weekly-context writer must reserve the
// same-page exclusive window and native Primary lease before snapshot or SQL.
// This intentionally fails on the unadmitted legacy writer (negative-first).
// Source-only contract; real Chromium / IDB proof is an independent requirement.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const start='function weeklyForm() {',end='function recipeShortageText(row) {';
assert.equal(source.split(start).length,2,'G265 weeklyForm production function must remain unique');
const operation=start+source.split(start)[1].split(end)[0];
assert.ok(operation.includes(end)===false,'G265 weeklyForm end marker must be excluded');
assert.match(operation,/document\.getElementById\('weeklyContextForm'\)\.onsubmit\s*=\s*async/);
assert.match(operation,/beginSqliteExclusiveWriteWindow\s*\(/,'G265: same-page exclusive window missing');
assert.match(operation,/withPrimarySqliteMutationLock\s*\(/,'G265: native primary lease missing');
assert.match(operation,/withSqliteCoordinatedMutation\s*\(\s*begin\s*\)/,'G265: coordinated SQL BEGIN missing');
assert.match(operation,/withSqliteCoordinatedMutation\s*\(\s*commit\s*\)/,'G265: coordinated SQL COMMIT missing');
assert.match(operation,/persist\s*\(\s*\{\s*primaryMutationLease\s*:\s*lease\s*\}\s*\)/,'G265: exact-lease durable ACK missing');
assert.match(operation,/if\s*\(\s*!committed\s*\)[\s\S]*withSqliteCoordinatedMutation\s*\(\s*rollback\s*\)/,'G265: pre-COMMIT-only rollback missing');
assert.match(operation,/close\s*\(\s*\{\s*uncertainOutcome\s*:\s*!acknowledged\s*\}\s*\)/,'G265: uncertain durable failure must sticky HOLD');
const lease=operation.indexOf('withPrimarySqliteMutationLock(');
const snapshot=operation.indexOf("snapshot('manual:weekly-context')");
const sql=operation.indexOf('INSERT OR REPLACE INTO weekly_context');
const acknowledged=operation.indexOf('acknowledged = true;');
const success=operation.indexOf("document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'))");
assert.ok(lease>=0&&lease<snapshot&&snapshot<sql&&sql<acknowledged&&acknowledged<success,
  'G265: lease -> snapshot -> SQL -> ACK -> UI success ordering required');
assert.match(operation,/new Set\(berries\)\.size !== berries\.length/,'preserve duplicate-berry rejection');
assert.match(operation,/weekly_context\(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at\)/,
  'G265: existing weekly schema and fields must remain unchanged');
console.log('PASS G265_PRODUCTION_WEEKLY_CONTEXT_NATIVE_PRE_SQL_EXACT_LEASE_AND_ACK_SOURCE');
