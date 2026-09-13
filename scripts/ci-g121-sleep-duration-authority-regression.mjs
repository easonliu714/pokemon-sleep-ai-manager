import assert from 'node:assert/strict';
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
  ['0:05', 5],
  ['0', 0],
];
for (const [input, expected] of exact) {
  assert.equal(parsePlayerSleepDurationToMinutes(input), expected, `${input} -> ${expected} minutes`);
}
assert.equal(parsePlayerSleepDurationToMinutes(''), null);

for (const invalid of ['8:60', '-1', '-0.5', 'abc', '8h30m', '8:5']) {
  assert.throws(() => parsePlayerSleepDurationToMinutes(invalid), undefined, `must reject ${invalid}`);
}

const canonicalMinutes = parsePlayerSleepDurationToMinutes('8.5');
const storedHours = sleepMinutesToStoredHours(canonicalMinutes);
assert.equal(storedHours, 8.5);
assert.equal(storedHoursToSleepMinutes(storedHours), 510);
assert.equal(formatPlayerSleepMinutes(510), '510 分鐘');

assert.equal(G121_SLEEP_DURATION_CONTRACT.browse_unit, 'minutes');
assert.deepEqual(G121_SLEEP_DURATION_CONTRACT.edit_inputs, ['decimal_hours', 'HH:MM']);
assert.equal(G121_SLEEP_DURATION_CONTRACT.public_evolution_requirement_mutable, false);

console.log('G121_SLEEP_DURATION_AUTHORITY_REGRESSION=PASS');
console.log('DECIMAL_8_5_MINUTES=510');
console.log('HHMM_08_30_MINUTES=510');
console.log('ROUND_TRIP_MINUTES=510');
console.log('PUBLIC_EVOLUTION_REQUIREMENT_MUTABLE=FALSE');
