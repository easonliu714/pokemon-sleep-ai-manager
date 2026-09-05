import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.POKEMON_SLEEP_TEST_URL || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 980, height: 1897 } });
const page = await context.newPage();
const browserDiagnostics=[];
page.on('console',message=>browserDiagnostics.push({type:'console',level:message.type(),text:message.text()}));
page.on('pageerror',error=>browserDiagnostics.push({type:'pageerror',text:error?.stack||error?.message||String(error)}));
page.on('requestfailed',request=>browserDiagnostics.push({type:'requestfailed',url:request.url(),failure:request.failure()?.errorText||null}));

async function startupDiagnostic(){
  const evaluation=page.evaluate(() => {
    const manager=globalThis.DebugTrace;
    const sessionId=manager?.sessionId;
    return {
      db_status:document.getElementById('dbStatus')?.textContent||null,
      db_status_class:document.getElementById('dbStatus')?.className||null,
      storage_warning:document.getElementById('storageWarning')?.textContent||null,
      storage_warning_hidden:document.getElementById('storageWarning')?.classList?.contains('hidden')??null,
      startup_watchdog:globalThis.PokemonSleepStartupWatchdog?.getStartupWatchdogState?.()||null,
      startup_events:(manager?.events||[]).filter(event=>event.session_id===sessionId&&['startup','service_worker','app'].includes(event.category)).slice(-30).map(event=>({category:event.category,event:event.event,status:event.status,details:event.details,error:event.error})),
      version:globalThis.PokemonSleepVersionAuthority||null,
    };
  }).catch(error=>({diagnostic_evaluation_failed:error?.message||String(error)}));
  const deadline=new Promise(resolve=>setTimeout(()=>resolve({diagnostic_evaluation_timed_out:true}),1500));
  return Promise.race([evaluation,deadline]);
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  // v0.4.27.55.3.3.1 makes the startup-only refresh materially faster by no longer
  // materializing hidden page DOM. The historical intermediate "SQLite 已就緒｜介面載入中…"
  // state can therefore complete before Playwright attaches this waiter. Bind this
  // browser predecessor contract to the stronger canonical App Ready authority instead
  // of depending on observability of a transient intermediate badge.
  // Keep the existing 30 s authority boundary, but fail early on explicit terminal
  // rescue/initialization failure and print the exact startup evidence instead of
  // masking the cause behind a generic waitForFunction timeout.
  try{
    await page.waitForFunction(() => {
      const text=document.getElementById('dbStatus')?.textContent||'';
      return text.includes('App 已就緒')||text.includes('初始化失敗')||text.includes('救援／唯讀模式');
    }, null, { timeout: 30000 });
  }catch(error){
    const diagnostic=await startupDiagnostic();
    console.error('STARTUP_AUTHORITY_TIMEOUT_DIAGNOSTIC',JSON.stringify({diagnostic,browser_diagnostics:browserDiagnostics.slice(-30)},null,2));
    throw error;
  }
  const startup=await startupDiagnostic();
  if(startup.db_status!=='App 已就緒'){
    console.error('STARTUP_AUTHORITY_TERMINAL_FAILURE',JSON.stringify({diagnostic:startup,browser_diagnostics:browserDiagnostics.slice(-30)},null,2));
  }
  assert.equal(startup.db_status,'App 已就緒',`canonical App Ready required before legacy confirmation handshake; observed=${startup.db_status||'missing'}`);

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

  console.log('PASS browser review UX: canonical App Ready -> real Update Center navigation -> grouped 4 confirmations -> 0 -> Dry Run enabled -> formal Dry Run success -> review synchronized');
} finally {
  await browser.close();
}
