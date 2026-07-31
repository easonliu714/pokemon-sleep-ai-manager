import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('assets/js/g3-planning.js', 'utf8');
for (const token of [
  'const CAMP_OPTIONS', 'const DISH_OPTIONS', 'function selectField',
  "selectField('camp'", "selectField('dish_category'",
  "berryField('favorite_berry_1'", "berryField('favorite_berry_2'", "berryField('favorite_berry_3'",
]) assert.ok(source.includes(token), `missing weekly select contract: ${token}`);

assert.ok(!source.includes("field('camp', '營地'"), 'camp must not remain free text');
assert.ok(!source.includes("field('dish_category', '料理類型'"), 'dish category must not remain free text');
assert.ok(source.includes("new Set(berries).size !== berries.length"), 'duplicate berry guard missing');
console.log('PASS weekly fixed-value select regression');
