import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAuditFromFiles } from './v043-recipe-zh-tw-evidence-audit.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'tests/fixtures/v043_recipe_zh_tw_evidence_sanitized_fixture.json');
const publicMaster = path.join(root, 'assets/js/public-recipe-master.js');

const report = runAuditFromFiles({ privateFile: fixture, publicMasterFile: publicMaster, requireCount: 5 });

assert.equal(report.schema, 'pokemon-sleep-recipe-zh-tw-evidence-audit/1.0');
assert.equal(report.read_only, true);
assert.equal(report.database_opened, false);
assert.equal(report.database_write_performed, false);
assert.equal(report.observed_recipe_count, 5);
assert.deepEqual(report.category_counts, { '咖哩／濃湯': 4, '甜點／飲料': 1 });

const byObservedName = new Map(report.records.map((row) => [row.observed_name, row]));

const apple = byObservedName.get('特選蘋果咖哩');
assert.ok(apple);
assert.equal(apple.classification, 'EXACT_NAME');
assert.equal(apple.matched_public_name, '特選蘋果咖哩');
assert.equal(apple.match_basis, 'CATEGORY_INGREDIENT_SIGNATURE');

const corn = byObservedName.get('柔軟玉米濃湯');
assert.ok(corn);
assert.equal(corn.classification, 'NAME_ALIAS');
assert.equal(corn.matched_public_name, '玉米濃湯');

const whiteStew = byObservedName.get('單純白醬濃湯');
assert.ok(whiteStew);
assert.equal(whiteStew.classification, 'NAME_ALIAS');
assert.equal(whiteStew.matched_public_name, '簡易白醬濃湯');

const dizzyPunch = byObservedName.get('迷昏拳辣味咖哩');
assert.ok(dizzyPunch);
assert.equal(dizzyPunch.classification, 'FORMULA_CONFLICT');
assert.equal(dizzyPunch.matched_public_name, '暈眩拳辣味咖哩');
assert.equal(dizzyPunch.match_basis, 'CONSERVATIVE_NAME_SIMILARITY_SAME_TOTAL');

const warmMilk = byObservedName.get('哞哞熱鮮奶');
assert.ok(warmMilk);
assert.equal(warmMilk.category, '甜點／飲料');
assert.equal(warmMilk.classification, 'NAME_ALIAS');
assert.equal(warmMilk.matched_public_name, '溫熱哞哞鮮奶');

assert.deepEqual(report.classification_counts, {
  EXACT_NAME: 1,
  NAME_ALIAS: 3,
  FORMULA_CONFLICT: 1,
  UNRESOLVED: 0,
});

const serialized = JSON.stringify(report);
for (const forbidden of [
  'synthetic_private_001','synthetic_private_002','synthetic_private_003','synthetic_private_004','synthetic_private_005',
  'SYNTHETIC_PRIVATE_UPDATE_DO_NOT_LEAK','SYNTHETIC_PRIVATE_NOTE_SHOULD_NOT_LEAK','SYNTHETIC_SCREENSHOT_DO_NOT_LEAK.png',
  'recipe_level','current_energy','source_image_ref','operation_id','notes','update_id',
]) assert.equal(serialized.includes(forbidden), false, `sanitized report leaked ${forbidden}`);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  gate: 'R2.1_RECIPE_ZH_TW_EVIDENCE_AUDIT',
  observed_fixture_recipes: report.observed_recipe_count,
  classifications: report.classification_counts,
  category_alias: '點心／飲料 -> 甜點／飲料',
  in_game_name_guard: '哞哞熱鮮奶 -> NAME_ALIAS -> 溫熱哞哞鮮奶',
  private_identifiers_in_output: false,
  database_opened: report.database_opened,
  database_write_performed: report.database_write_performed,
}, null, 2)}\n`);
