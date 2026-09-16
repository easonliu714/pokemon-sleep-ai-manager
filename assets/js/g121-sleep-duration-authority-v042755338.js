// v0.4.27.55.3.3.9 successor of G12.1 duration authority
// Player-owned sleep progress duration authority.
// Public Evolution Master requirements are intentionally outside this module.

const DECIMAL_HOURS_RE = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
// Hours are intentionally unbounded in digit count; only the minute field is fixed-width.
// Optional whitespace around ':' and the fullwidth mobile colon are accepted because
// mobile keyboards / IMEs may emit either punctuation form.
const HHMM_RE = /^(\d+)\s*[:：]\s*(\d{2})$/;

/**
 * Parse player-entered duration to canonical total minutes.
 * Supported contracts:
 *   "8.5"     => 510 minutes (decimal hours; never 8:05)
 *   "1.25"    => 75 minutes
 *   "08:30"   => 510 minutes (explicit HH:MM)
 *   "1100:25" => 66025 minutes
 *   "1100 : 25" => 66025 minutes (mobile-friendly whitespace)
 *   "1214：22" => 72862 minutes (fullwidth mobile punctuation)
 * Empty input returns null. Invalid/negative/non-finite input throws.
 */
export function parsePlayerSleepDurationToMinutes(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const hhmm = HHMM_RE.exec(raw);
  if (hhmm) {
    const hours = Number(hhmm[1]);
    const minutes = Number(hhmm[2]);
    if (!Number.isSafeInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      throw new RangeError('共眠時間 HH:MM 格式無效；分鐘必須介於 00–59。');
    }
    const total = hours * 60 + minutes;
    if (!Number.isSafeInteger(total)) throw new RangeError('共眠時間超出可儲存範圍。');
    return total;
  }

  if (!DECIMAL_HOURS_RE.test(raw)) {
    throw new TypeError('共眠時間請輸入十進位小時（例如 8.5）或 HH:MM（例如 08:30）。');
  }
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 0) throw new RangeError('共眠時間不可為負數。');
  const total = Math.round(hours * 60);
  if (!Number.isSafeInteger(total)) throw new RangeError('共眠時間超出可儲存範圍。');
  return total;
}

/** Existing schema compatibility: pokemon.sleep_hours remains storage authority. */
export function sleepMinutesToStoredHours(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes === '') return null;
  const minutes = Number(totalMinutes);
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('共眠分鐘必須為非負整數。');
  return minutes / 60;
}

/** Browse projection: canonical player progress is always rendered as whole minutes. */
export function storedHoursToSleepMinutes(storedHours) {
  if (storedHours === null || storedHours === undefined || storedHours === '') return null;
  const hours = Number(storedHours);
  if (!Number.isFinite(hours) || hours < 0) throw new RangeError('已儲存共眠時數無效。');
  return Math.round(hours * 60);
}

export function formatPlayerSleepMinutes(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes === '') return null;
  const minutes = Number(totalMinutes);
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('共眠分鐘必須為非負整數。');
  return `${minutes} 分鐘`;
}

export const G121_SLEEP_DURATION_CONTRACT = Object.freeze({
  version: 'v0.4.27.55.3.3.9',
  browse_unit: 'minutes',
  edit_inputs: Object.freeze(['decimal_hours', 'HH:MM']),
  decimal_example: Object.freeze({input: '8.5', minutes: 510}),
  hhmm_example: Object.freeze({input: '08:30', minutes: 510}),
  long_hhmm_example: Object.freeze({input: '1100 : 25', minutes: 66025}),
  storage_column: 'pokemon.sleep_hours',
  public_evolution_requirement_mutable: false,
});
