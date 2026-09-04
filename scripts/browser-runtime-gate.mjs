import { chromium } from 'playwright';
import '../assets/js/version-authority.js';

const expectedAuthority = globalThis.PokemonSleepVersionAuthority;
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const hardStop = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, stage: 'node_hard_timeout', baseUrl }, null, 2));
  process.exit(124);
}, 90_000);
hardStop.unref?.();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 412, height: 915 },
  serviceWorkers: 'block',
});
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(30_000);

const failures = [];
const observed = {
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
};

page.on('pageerror', error => {
  observed.pageErrors.push(error.message || String(error));
});

page.on('console', message => {
  if (message.type() !== 'error') return;
  observed.consoleErrors.push(message.text());
});

page.on('requestfailed', request => {
  const failure = request.failure()?.errorText || 'unknown request failure';
  observed.failedRequests.push(`${failure}: ${request.url()}`);
});

async function installLegacyRescueFixture() {
  const fixtureUrl = new URL('manifest.webmanifest', baseUrl).href;
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('pokemon_sleep_ai_manager', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('database')) db.createObjectStore('database');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata');
      };
      request.onerror = () => reject(request.error || new Error('fixture_open_failed'));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['database', 'metadata'], 'readwrite');
        transaction.objectStore('database').put(new ArrayBuffer(16), 'primary');
        transaction.objectStore('metadata').delete('primary');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error || new Error('fixture_write_failed'));
        transaction.onabort = () => reject(transaction.error || new Error('fixture_write_aborted'));
      };
    });
  });
}

try {
  await installLegacyRescueFixture();
  console.log('BROWSER_GATE_STAGE fixture_ready');

  const response = await page.goto(baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  console.log('BROWSER_GATE_STAGE domcontentloaded');

  if (!response?.ok()) failures.push(`首頁 HTTP 狀態異常：${response?.status() ?? 'no response'}`);

  await page.waitForFunction(() => {
    const status = document.getElementById('dbStatus');
    if (!status) return false;
    const text = status.textContent?.trim() || '';
    return text !== '' && text !== '資料庫初始化中';
  }, null, { timeout: 30_000 });
  console.log('BROWSER_GATE_STAGE database_status_ready');

  const runtime = await page.evaluate(() => {
    const status = document.getElementById('dbStatus');
    return {
      title: document.title,
      dbStatus: status?.textContent?.trim() || null,
      dbStatusClass: status?.className || null,
      appVersion: document.documentElement.dataset.appVersion || null,
      appBuild: document.documentElement.dataset.appBuild || null,
      visibleViews: [...document.querySelectorAll('section.view.active')].map(x => x.id),
      navTargets: [...document.querySelectorAll('nav [data-view]')].map(x => x.dataset.view),
      storageWarning: document.getElementById('storageWarning')?.textContent?.trim() || '',
    };
  });

  if (runtime.title !== 'Pokémon Sleep AI Manager') failures.push(`頁面標題異常：${runtime.title}`);
  if (runtime.appVersion !== expectedAuthority.app_version) failures.push(`版本 authority 異常：${runtime.appVersion || 'missing'}；expected=${expectedAuthority.app_version}`);
  if (runtime.appBuild !== expectedAuthority.app_build) failures.push(`Build authority 異常：${runtime.appBuild || 'missing'}；expected=${expectedAuthority.app_build}`);
  if (!runtime.dbStatus || /失敗|錯誤/.test(runtime.dbStatus)) failures.push(`SQLite 初始化狀態異常：${runtime.dbStatus || 'missing'}`);

  const unifiedReadinessSuccessor = /^v0\.4\.27\.55\.3\.(?:[1-9]\d*)$/.test(expectedAuthority.app_version || '');
  const explicitSafeBootRescueFixture = true;
  if (explicitSafeBootRescueFixture) {
    if (!/救援|唯讀/.test(runtime.dbStatus)) failures.push(`explicit safe-boot fixture 未維持救援／唯讀 authority：${runtime.dbStatus || 'missing'}`);
    if (!/玩家資料尚未載入/.test(runtime.storageWarning)) failures.push('explicit safe-boot fixture 缺少「玩家資料尚未載入」安全警示');
    if (!/僅可瀏覽公版頁面/.test(runtime.storageWarning)) failures.push('explicit safe-boot fixture 缺少 public-only 瀏覽邊界');
    if (!/不會寫入玩家資料/.test(runtime.storageWarning)) failures.push('explicit safe-boot fixture 缺少 no-player-write 安全邊界');
  } else if (unifiedReadinessSuccessor) {
    if (runtime.dbStatus !== 'App 已就緒') failures.push(`.55.3.1+ 最終 readiness authority 異常：${runtime.dbStatus || 'missing'}`);
  } else if (!/救援|唯讀/.test(runtime.dbStatus)) {
    failures.push(`未進入預期的零 SQL 救援模式：${runtime.dbStatus}`);
  }

  if (runtime.visibleViews.length !== 1 || runtime.visibleViews[0] !== 'dashboard') {
    failures.push(`預設 view 異常：${runtime.visibleViews.join(',') || 'none'}`);
  }

  const requiredViews = ['dashboard', 'pokemon', 'ingredients', 'items', 'recipes', 'updates', 'backup', 'guide'];
  for (const view of requiredViews) {
    if (!runtime.navTargets.includes(view)) failures.push(`缺少導覽 view：${view}`);
  }

  const pe7LegacyGuard = await page.evaluate(async () => {
    const form = document.createElement('form');
    form.id = 'pe7LegacyEventAuditFixture';
    form.innerHTML = '<label id="pe7LegacyEventNameLabel"><span>活動名稱</span><input name="event_name"></label><label id="pe7LegacyEventEffectsLabel"><span>活動效果</span><textarea name="event_effects"></textarea></label>';
    document.body.append(form);
    const eventName = form.elements.namedItem('event_name');
    const eventEffects = form.elements.namedItem('event_effects');
    const legacyName = '寶可夢動畫合作週';
    const legacyEffects = '{"recipe_final_energy_multiplier":1.25,"extra_tasty_multiplier":2.5,"sunday_extra_tasty_multiplier":3.75}';
    eventName.value = legacyName;
    eventEffects.value = legacyEffects;
    const moduleUrl = new URL('assets/js/public-event-authority-ui-guard.js', document.baseURI).href;
    const guard = await import(moduleUrl);
    const guardedCount = guard.applyLegacyPlayerEventObservationGuard(form);
    const nameLabel = document.getElementById('pe7LegacyEventNameLabel');
    const effectsLabel = document.getElementById('pe7LegacyEventEffectsLabel');
    const result = {
      guardedCount,
      nameValuePreserved: eventName.value === legacyName,
      effectsValuePreserved: eventEffects.value === legacyEffects,
      nameDisabled: eventName.disabled,
      effectsDisabled: eventEffects.disabled,
      nameAuthority: eventName.dataset.authoritySource || null,
      effectsAuthority: eventEffects.dataset.authoritySource || null,
      nameHidden: nameLabel.hidden,
      effectsHidden: effectsLabel.hidden,
      nameDisplay: getComputedStyle(nameLabel).display,
      effectsDisplay: getComputedStyle(effectsLabel).display,
      nameAuditMarker: nameLabel.dataset.legacyPlayerEventObservation || null,
      effectsAuditMarker: effectsLabel.dataset.legacyPlayerEventObservation || null,
    };
    form.remove();
    return result;
  });
  console.log('BROWSER_GATE_STAGE pe7_legacy_event_guard_verified');

  const auditOnly = 'LEGACY_PLAYER_OBSERVATION_AUDIT_ONLY';
  if (pe7LegacyGuard.guardedCount !== 2) failures.push(`PE7 legacy event guard 數量異常：${pe7LegacyGuard.guardedCount}`);
  if (!pe7LegacyGuard.nameValuePreserved || !pe7LegacyGuard.effectsValuePreserved) failures.push('PE7 guard 不得清空或改寫 legacy audit observation');
  if (!pe7LegacyGuard.nameDisabled || !pe7LegacyGuard.effectsDisabled) failures.push('PE7 legacy event 欄位必須永久 disabled');
  if (pe7LegacyGuard.nameAuthority !== auditOnly || pe7LegacyGuard.effectsAuthority !== auditOnly) failures.push('PE7 legacy event authority 必須是 audit-only');
  if (!pe7LegacyGuard.nameHidden || !pe7LegacyGuard.effectsHidden || pe7LegacyGuard.nameDisplay !== 'none' || pe7LegacyGuard.effectsDisplay !== 'none') failures.push('PE7 legacy event 欄位必須從正常 Weekly UI 完全隱藏');
  if (pe7LegacyGuard.nameAuditMarker !== '1' || pe7LegacyGuard.effectsAuditMarker !== '1') failures.push('PE7 legacy event wrapper 缺少 audit marker');

  await page.click('nav [data-view="recipes"]', { timeout: 10_000 });
  await page.waitForFunction(
    () => document.getElementById('recipes')?.classList.contains('active'),
    null,
    { timeout: 10_000 },
  );
  console.log('BROWSER_GATE_STAGE recipes_active');

  const recipeState = await page.evaluate(() => ({
    active: document.getElementById('recipes')?.classList.contains('active') || false,
    tableExists: Boolean(document.getElementById('recipeTable')),
    bodyText: document.getElementById('recipes')?.innerText || '',
  }));
  if (!recipeState.active || !recipeState.tableExists) failures.push('食譜 view 無法正常切換或缺少表格');

  const blockingConsole = observed.consoleErrors.filter(text => !/favicon\.ico|Receiving end does not exist/i.test(text));
  const blockingRequests = observed.failedRequests.filter(text => !/favicon\.ico|cdn\.jsdelivr\.net/i.test(text));

  if (observed.pageErrors.length) failures.push(`pageerror：${observed.pageErrors.join(' | ')}`);
  if (blockingConsole.length) failures.push(`console error：${blockingConsole.join(' | ')}`);
  if (blockingRequests.length) failures.push(`request failure：${blockingRequests.join(' | ')}`);

  console.log(JSON.stringify({
    ok: failures.length === 0,
    mode: 'legacy_metadata_missing_zero_sql_rescue',
    readinessContract: explicitSafeBootRescueFixture
      ? 'EXPLICIT_SAFE_BOOT_RESCUE_WITH_ZERO_SQL_SAFETY_WARNING'
      : (unifiedReadinessSuccessor ? 'UNIFIED_FINAL_APP_READY' : 'LEGACY_RESCUE_STATUS_LABEL'),
    baseUrl,
    expectedAuthority,
    runtime,
    pe7LegacyGuard,
    recipeState,
    observed,
    failures,
  }, null, 2));
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
  console.error(JSON.stringify({ ok: false, baseUrl, expectedAuthority, observed, failures }, null, 2));
} finally {
  clearTimeout(hardStop);
  await Promise.race([
    browser.close(),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
}

process.exit(failures.length ? 1 : 0);
