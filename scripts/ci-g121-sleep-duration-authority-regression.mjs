import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  parsePlayerSleepDurationToMinutes,
  sleepMinutesToStoredHours,
  storedHoursToSleepMinutes,
  formatPlayerSleepMinutes,
  G121_SLEEP_DURATION_CONTRACT,
} from '../assets/js/g121-sleep-duration-authority-v042755338.js';

const exact = [
  ['8', 480],
  ['8.5', 510],
  ['1.25', 75],
  ['08:30', 510],
  ['08 : 30', 510],
  ['1100:25', 66025],
  ['1100 : 25', 66025],
  ['0:05', 5],
  ['0', 0],
];
for (const [input, expected] of exact) {
  assert.equal(parsePlayerSleepDurationToMinutes(input), expected, `${input} -> ${expected} minutes`);
}
assert.equal(parsePlayerSleepDurationToMinutes(''), null);

for (const invalid of ['8:60', '1100:60', '1100:2', '-1', '-0.5', 'abc', '8h30m', '8:5']) {
  assert.throws(() => parsePlayerSleepDurationToMinutes(invalid), undefined, `must reject ${invalid}`);
}

const canonicalMinutes = parsePlayerSleepDurationToMinutes('8.5');
const storedHours = sleepMinutesToStoredHours(canonicalMinutes);
assert.equal(storedHours, 8.5);
assert.equal(storedHoursToSleepMinutes(storedHours), 510);
assert.equal(formatPlayerSleepMinutes(510), '510 分鐘');

const longMinutes = parsePlayerSleepDurationToMinutes('1100 : 25');
assert.equal(longMinutes, 66025);
assert.equal(storedHoursToSleepMinutes(sleepMinutesToStoredHours(longMinutes)), 66025);

assert.equal(G121_SLEEP_DURATION_CONTRACT.version, 'v0.4.27.55.3.3.9');
assert.equal(G121_SLEEP_DURATION_CONTRACT.browse_unit, 'minutes');
assert.deepEqual(G121_SLEEP_DURATION_CONTRACT.edit_inputs, ['decimal_hours', 'HH:MM']);
assert.deepEqual(G121_SLEEP_DURATION_CONTRACT.long_hhmm_example, {input: '1100 : 25', minutes: 66025});
assert.equal(G121_SLEEP_DURATION_CONTRACT.public_evolution_requirement_mutable, false);

// Integration contract: detail UI must consume the duration authority and must not
// re-introduce Public Evolution Master fields into the ordinary player write path.
const detail = readFileSync(new URL('../assets/js/pokemon-detail.js', import.meta.url), 'utf8');
assert.match(detail, /parsePlayerSleepDurationToMinutes\(f\.get\('sleep_duration'\)\)/);
assert.match(detail, /data\.sleep_hours=sleepMinutesToStoredHours\(sleepMinutes\)/);
assert.match(detail, /formatPlayerSleepMinutes\(storedHoursToSleepMinutes\(p\.sleep_hours\)\)/);
assert.match(detail, /目前共眠（十進位小時或 HH:MM）/);
assert.match(detail, /公版進化條件（唯讀）/);

const saveStart = detail.indexOf('async function saveEdit()');
assert.notEqual(saveStart, -1, 'saveEdit must exist');
const saveSource = detail.slice(saveStart);
for (const field of [
  'evolution_level_required',
  'evolution_sleep_hours_required',
  'evolution_candy_required',
  'evolution_item_required',
  'evolution_other_requirement',
  'sleep_time_text',
]) {
  assert.equal(saveSource.includes(`f.get('${field}')`), false, `${field} must not be written by ordinary detail edit`);
}

console.log('G121_SLEEP_DURATION_AUTHORITY_REGRESSION=PASS');
console.log('DECIMAL_8_5_MINUTES=510');
console.log('HHMM_08_30_MINUTES=510');
console.log('LONG_HHMM_1100_25_MINUTES=66025');
console.log('LONG_HHMM_WHITESPACE=PASS');
console.log('ROUND_TRIP_MINUTES=510');
console.log('DETAIL_BROWSE_UNIT=MINUTES');
console.log('DETAIL_PUBLIC_EVOLUTION_WRITE_ISOLATION=PASS');
console.log('PUBLIC_EVOLUTION_REQUIREMENT_MUTABLE=FALSE');
