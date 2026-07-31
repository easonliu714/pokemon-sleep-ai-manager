import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('assets/js/g3-planning.js', 'utf8');

for (const token of [
  "const CAMP_OPTIONS",
  "const DISH_OPTIONS",
  "function selectField",
  "selectField('camp'",
  "selectField('dish_category'",
  "selectField('favorite_berry_1'",
  "selectField('favorite_berry_2'",
  "selectField('favorite_berry_3'",
]) {
  assert.ok(source.includes(token), `missing weekly select contract: ${token}`);
}

assert.ok(!source.includes("field('camp', '營地'"), 'camp must not remain a free-text field');
assert.ok(!source.includes("field('dish_category', '料理類型'"), 'dish category must not remain a free-text field');
assert.ok(!source.includes("field('favorite_berry_1', '喜好樹果 1'"), 'berry 1 must not remain free text');

console.log('PASS weekly fixed-value select regression');
