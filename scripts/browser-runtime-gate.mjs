import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/';
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
  const text = message.text();
  observed.consoleErrors.push(text);
});

page.on('requestfailed', request => {
  const url = request.url();
  const failure = request.failure()?.errorText || 'unknown request failure';
  observed.failedRequests.push(`${failure}: ${url}`);
});

try {
  const response = await page.goto(baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  if (!response?.ok()) {
    failures.push(`首頁 HTTP 狀態異常：${response?.status() ?? 'no response'}`);
  }

  await page.waitForFunction(() => {
    const status = document.getElementById('dbStatus');
    if (!status) return false;
    const text = status.textContent?.trim() || '';
    return text !== '' && text !== '資料庫初始化中';
  }, null, { timeout: 30_000 });

  const runtime = await page.evaluate(() => {
    const status = document.getElementById('dbStatus');
    const visibleViews = [...document.querySelectorAll('section.view.active')].map(x => x.id);
    const navTargets = [...document.querySelectorAll('nav [data-view]')].map(x => x.dataset.view);
    return {
      title: document.title,
      dbStatus: status?.textContent?.trim() || null,
      dbStatusClass: status?.className || null,
      appVersion: document.documentElement.dataset.appVersion || null,
      visibleViews,
      navTargets,
      storageWarning: document.getElementById('storageWarning')?.textContent?.trim() || '',
    };
  });

  if (runtime.title !== 'Pokémon Sleep AI Manager') {
    failures.push(`頁面標題異常：${runtime.title}`);
  }
  if (!runtime.appVersion) {
    failures.push('bootstrap.js 未寫入 appVersion，可能未完成啟動');
  }
  if (!runtime.dbStatus || /失敗|錯誤/.test(runtime.dbStatus)) {
    failures.push(`SQLite 初始化狀態異常：${runtime.dbStatus || 'missing'}`);
  }
  if (runtime.visibleViews.length !== 1 || runtime.visibleViews[0] !== 'dashboard') {
    failures.push(`預設 view 異常：${runtime.visibleViews.join(',') || 'none'}`);
  }

  const requiredViews = ['dashboard', 'pokemon', 'ingredients', 'items', 'recipes', 'updates', 'backup', 'guide'];
  for (const view of requiredViews) {
    if (!runtime.navTargets.includes(view)) failures.push(`缺少導覽 view：${view}`);
  }

  await page.click('nav [data-view="recipes"]', { timeout: 10_000 });
  await page.waitForFunction(
    () => document.getElementById('recipes')?.classList.contains('active'),
    null,
    { timeout: 10_000 },
  );

  const recipeState = await page.evaluate(() => ({
    active: document.getElementById('recipes')?.classList.contains('active') || false,
    tableExists: Boolean(document.getElementById('recipeTable')),
    bodyText: document.getElementById('recipes')?.innerText || '',
  }));
  if (!recipeState.active || !recipeState.tableExists) failures.push('食譜 view 無法正常切換或缺少表格');

  const blockingConsole = observed.consoleErrors.filter(text =>
    !/favicon\.ico|Receiving end does not exist/i.test(text)
  );
  const blockingRequests = observed.failedRequests.filter(text =>
    !/favicon\.ico/i.test(text)
  );

  if (observed.pageErrors.length) failures.push(`pageerror：${observed.pageErrors.join(' | ')}`);
  if (blockingConsole.length) failures.push(`console error：${blockingConsole.join(' | ')}`);
  if (blockingRequests.length) failures.push(`request failure：${blockingRequests.join(' | ')}`);

  console.log(JSON.stringify({
    ok: failures.length === 0,
    baseUrl,
    runtime,
    recipeState,
    observed,
    failures,
  }, null, 2));
} catch (error) {
  failures.push(error?.stack || error?.message || String(error));
  console.error(JSON.stringify({ ok: false, baseUrl, observed, failures }, null, 2));
} finally {
  await Promise.race([
    browser.close(),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
}

process.exit(failures.length ? 1 : 0);
