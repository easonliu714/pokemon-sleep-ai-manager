import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.POKEMON_SLEEP_TEST_URL || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 980, height: 1897 } });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('dbStatus')?.textContent?.includes('SQLite 已就緒'), null, { timeout: 30000 });

  const updatesNav = page.locator('nav button[data-view="updates"]');
  await updatesNav.waitFor({ state: 'visible', timeout: 10000 });
  await updatesNav.click();
  await page.waitForFunction(() => document.getElementById('updates')?.classList.contains('active'), null, { timeout: 10000 });
  await page.locator('#updates').waitFor({ state: 'visible', timeout: 10000 });

  const payload = {
    schema_version: '1.1',
    update_id: `CI-V03981-${Date.now()}`,
    generated_at: new Date().toISOString(),
    source: 'v0.3.98.1 browser handshake fixture',
    scenario: 'ingredient_inventory_update',
    profile_audit_confirmations: [
      { pokemon_id: 'pkm_darkrai', slot_type: 'ingredient', unlock_levels: [30, 60], status: 'user_confirmed_not_visible', confirmed_by_user: false },
      { pokemon_id: 'pkm_darkrai', slot_type: 'subskill', unlock_levels: [50, 70, 80], status: 'user_confirmed_not_visible', confirmed_by_user: false },
      { pokemon_id: 'pkm_mew', slot_type: 'ingredient', unlock_levels: [60], status: 'user_confirmed_not_visible', confirmed_by_user: false },
      { pokemon_id: 'pkm_mew', slot_type: 'subskill', unlock_levels: [50, 70, 80], status: 'user_confirmed_not_visible', confirmed_by_user: false },
    ],
    operations: [
      {
        operation_id: 'OP-1',
        entity: 'ingredient_inventory',
        action: 'upsert',
        key: { ingredient_name: '好眠番茄' },
        data: { quantity: 0, updated_at: new Date().toISOString() },
        clear_fields: [],
        review_required: false,
      },
    ],
  };

  await page.locator('#jsonFile').setInputFiles({
    name: 'v03981-confirmation-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });

  await page.waitForFunction(() => document.querySelectorAll('#workflowIssues .status-conflict').length === 4);
  assert.equal(await page.locator('#dryRunBtn').isDisabled(), true, 'Dry Run must be blocked before confirmation');
  assert.equal(await page.locator('[data-profile-confirmation]').count(), 4, 'four confirmation controls must render');
  assert.equal(await page.locator('.profile-confirmation-card').count(), 2, 'confirmations must group into two Pokémon review cards');

  const acceptAll = page.locator('#acceptProfileAuditBtn');
  await acceptAll.waitFor({ state: 'visible', timeout: 10000 });
  await acceptAll.click();
  await page.waitForFunction(() => document.querySelectorAll('#workflowIssues .status-conflict').length === 0 && !document.getElementById('dryRunBtn')?.disabled, null, { timeout: 10000 });

  assert.equal(await page.locator('#dryRunBtn').isDisabled(), false, 'Dry Run must unlock after canonical handshake');
  assert.match(await page.locator('#workflowSummary').innerText(), /錯誤：0/);
  assert.match(await page.locator('#profileAuditDryRunState').innerText(), /已可執行 Dry Run/);

  await page.locator('#dryRunBtn').click();
  await page.waitForFunction(() => document.getElementById('importSummary')?.textContent?.includes('可套用'), null, { timeout: 10000 });
  assert.match(await page.locator('#importSummary').innerText(), /衝突：0/);

  // Formal Dry Run success is established by importSummary above. The review UI then
  // synchronizes that result in a separate event-loop turn without invoking a second
  // formal dryRun on the canonical payload.
  await page.waitForFunction(() => {
    const manager = globalThis.DebugTrace;
    const sessionId = manager?.sessionId;
    return (manager?.events || []).some((event) => event.session_id === sessionId && event.event === 'dry_run_review_synced');
  }, null, { timeout: 10000 });

  const trace = await page.evaluate(() => {
    const manager = globalThis.DebugTrace;
    const sessionId = manager?.sessionId;
    return (manager?.events || []).filter((event) => event.session_id === sessionId).map((event) => event.event);
  });
  for (const required of [
    'json_file_loaded',
    'profile_audit_confirmed',
    'canonical_payload_rebuilt',
    'main_state_payload_reloaded',
    'workflow_validation_completed',
    'dry_run_eligibility_changed',
    'dry_run_started',
    'dry_run_review_synced',
  ]) {
    assert.ok(trace.includes(required), `missing debug event ${required}`);
  }

  console.log('PASS browser review UX: real Update Center navigation -> grouped 4 confirmations -> 0 -> Dry Run enabled -> formal Dry Run success -> review synchronized');
} finally {
  await browser.close();
}
