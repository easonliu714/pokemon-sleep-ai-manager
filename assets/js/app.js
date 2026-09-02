import {
  initializeDatabase,
  rows,
  scalar,
  exportBytes,
  replaceDatabase,
  snapshot,
} from './database.js';
import { dryRun, applyPayload } from './importer.js';
import { listSnapshots, clearAllStorage } from './storage.js';
import { setupPokemonDetail, openPokemonDetail } from './pokemon-detail.js';
import { validateWorkflow, approveReviewed } from './ai-workflow.js';
import { saveIngredient, saveItem } from './manual-editor.js';
import { PROMPT_CATALOG, buildScenarioTemplate } from './prompt-catalog.js';
import { setupG3Pages } from './g3-planning.js';
import { formatLocal, localIso } from './time-utils.js';

const $ = (id) => document.getElementById(id);
const perfNow=()=>globalThis.performance?.now?.()??Date.now();
const state = {
  payload: null,
  preview: null,
  pokemon: [],
  seeded: false,
  workflow: null,
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

function renderTable(element, data, columns, rowClass = '', rowAttrs = null) {
  if (!element) return;
  if (!data.length) {
    element.innerHTML = '<tbody><tr><td>目前沒有資料</td></tr></tbody>';
    return;
  }

  const header = columns.map((column) => `<th>${esc(column.label)}</th>`).join('');
  const body = data.map((row) => {
    const cells = columns.map((column) => {
      const value = column.render ? column.render(row) : esc(row[column.key]);
      return `<td>${value}</td>`;
    }).join('');
    const attrs = rowAttrs ? rowAttrs(row) : '';
    return `<tr class="${rowClass}" ${attrs}>${cells}</tr>`;
  }).join('');

  element.innerHTML = `<thead><tr>${header}</tr></thead><tbody>${body}</tbody>`;
}

function bindNavigation() {
  document.querySelectorAll('nav button').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.view').forEach((view) => {
        view.classList.toggle('active', view.id === button.dataset.view);
      });
      document.querySelectorAll('nav button').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
    };
  });
}

function renderPokemon() {
  const query = $('pokemonSearch')?.value.trim().toLowerCase() ?? '';
  const rating = $('ratingFilter')?.value ?? '';
  const specialty = $('specialtyFilter')?.value ?? '';

  const data = state.pokemon.filter((pokemon) => {
    const matchText = !query || JSON.stringify(pokemon).toLowerCase().includes(query);
    const matchRating = !rating || pokemon.rating === rating;
    const matchSpecialty = !specialty || pokemon.specialty === specialty;
    return matchText && matchRating && matchSpecialty;
  });

  $('pokemonResultSummary').textContent =
    `顯示 ${data.length}／${state.pokemon.length} 隻；點選任一列查看或編輯完整個體資料`;

  renderTable(
    $('pokemonTable'),
    data,
    [
      { label: '名稱', key: 'original_label' },
      { label: 'Lv', key: 'level' },
      { label: '評級', key: 'rating' },
      { label: '專長', key: 'specialty' },
      { label: '屬性', key: 'type' },
      { label: '暱稱', key: 'nickname' },
      { label: '等效字數', key: 'nickname_halfwidth_units' },
      { label: '定位', key: 'core_role' },
    ],
    'pokemon-row',
    (pokemon) => `data-pokemon-id="${esc(pokemon.pokemon_id)}"`,
  );

  document.querySelectorAll('.pokemon-row').forEach((row) => {
    row.onclick = () => openPokemonDetail(row.dataset.pokemonId);
  });
}

function renderIngredients() {
  const data = rows('SELECT * FROM ingredient_inventory ORDER BY ingredient_name');
  renderTable($('ingredientTable'), data, [
    { label: '食材', key: 'ingredient_name' },
    {
      label: '庫存',
      render: (row) =>
        `<input class="inline-number ingredient-qty" type="number" min="0" value="${row.quantity}" data-name="${esc(row.ingredient_name)}">`,
    },
    { label: '更新時間', render: (row) => esc(formatLocal(row.updated_at)) },
    {
      label: '操作',
      render: (row) => `<button class="save-ingredient" data-name="${esc(row.ingredient_name)}">儲存</button>`,
    },
  ]);

  document.querySelectorAll('.save-ingredient').forEach((button) => {
    button.onclick = async () => {
      const name = button.dataset.name;
      const selector = `.ingredient-qty[data-name="${CSS.escape(name)}"]`;
      const input = document.querySelector(selector);
      try {
        await saveIngredient(name, input.value);
        alert('食材庫存已儲存');
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    };
  });
}

function renderItems() {
  const data = rows(
    'SELECT *, MAX(0, quantity-safe_reserve) available FROM item_inventory ORDER BY item_name',
  );

  renderTable($('itemTable'), data, [
    { label: '道具', key: 'item_name' },
    {
      label: '庫存',
      render: (row) =>
        `<input class="inline-number item-qty" type="number" min="0" value="${row.quantity}" data-name="${esc(row.item_name)}">`,
    },
    {
      label: '保留',
      render: (row) =>
        `<input class="inline-number item-reserve" type="number" min="0" value="${row.safe_reserve}" data-name="${esc(row.item_name)}">`,
    },
    { label: '可動用', key: 'available' },
    {
      label: '建議',
      render: (row) =>
        `<textarea class="inline-text item-rec" data-name="${esc(row.item_name)}">${esc(row.recommendation || '')}</textarea>`,
    },
    { label: '更新時間', render: (row) => esc(formatLocal(row.updated_at)) },
    {
      label: '操作',
      render: (row) => `<button class="save-item" data-name="${esc(row.item_name)}">儲存</button>`,
    },
  ]);

  document.querySelectorAll('.save-item').forEach((button) => {
    button.onclick = async () => {
      const name = button.dataset.name;
      const escapedName = CSS.escape(name);
      const quantity = document.querySelector(`.item-qty[data-name="${escapedName}"]`).value;
      const reserve = document.querySelector(`.item-reserve[data-name="${escapedName}"]`).value;
      const recommendation = document.querySelector(`.item-rec[data-name="${escapedName}"]`).value;
      try {
        await saveItem(name, quantity, reserve, recommendation);
        alert('道具資料已儲存');
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    };
  });
}

async function refresh() {
  const refreshStarted=perfNow();
  const capacityLabels = {
    pot: '鍋子容量',
    ingredient_bag: '食材包',
    item_bag: '道具包',
    pokemon_box: '寶可夢盒',
  };

  $('capacityCards').innerHTML = rows(
    'SELECT * FROM account_capacity ORDER BY capacity_key',
  ).map((capacity) => {
    const count = capacity.used_count == null
      ? capacity.total_capacity
      : `${capacity.used_count}/${capacity.total_capacity}`;
    const label = capacityLabels[capacity.capacity_key] || capacity.capacity_key;
    return `<article><strong>${esc(count)}</strong><span>${esc(label)}</span></article>`;
  }).join('');

  $('pokemonCount').textContent = scalar("SELECT COUNT(*) FROM pokemon WHERE status='active'") || 0;
  $('ingredientCount').textContent = scalar('SELECT COUNT(*) FROM ingredient_inventory') || 0;
  $('itemCount').textContent = scalar('SELECT COUNT(*) FROM item_inventory') || 0;
  $('recipeUnlocked').textContent = scalar('SELECT COUNT(*) FROM recipes WHERE unlocked=1') || 0;

  $('ratingSummary').innerHTML = rows(
    "SELECT rating, COUNT(*) count FROM pokemon WHERE status='active' GROUP BY rating " +
    "ORDER BY CASE rating WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 WHEN 'B' THEN 4 ELSE 9 END",
  ).map((row) => `<span><b>${esc(row.rating || '未評級')}</b>：${row.count}</span>`).join('');

  state.pokemon = rows(
    "SELECT * FROM pokemon WHERE status='active' " +
    "ORDER BY CASE rating WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 WHEN 'B' THEN 4 ELSE 9 END, level DESC, species",
  );
  renderPokemon();
  renderIngredients();
  renderItems();

  renderTable(
    $('recipeTable'),
    rows('SELECT * FROM recipes ORDER BY category, recipe_name'),
    [
      { label: '分類', key: 'category' },
      { label: '食譜', key: 'recipe_name' },
      { label: '已開啟', render: (row) => (row.unlocked ? '是' : '否') },
    ],
  );

  renderTable(
    $('historyTable'),
    rows('SELECT * FROM import_batches ORDER BY imported_at DESC LIMIT 100'),
    [
      { label: 'Update ID', key: 'update_id' },
      { label: 'Schema', key: 'schema_version' },
      { label: '來源', key: 'source' },
      { label: '操作', key: 'operation_count' },
      { label: '匯入時間', render: (row) => esc(formatLocal(row.imported_at)) },
    ],
  );

  const snapshots = await listSnapshots();
  $('snapshotList').innerHTML = snapshots.length
    ? snapshots.map((item) =>
      `<div class="snapshot"><b>${esc(item.reason)}</b><br><small>${esc(formatLocal(item.created_at))}</small></div>`,
    ).join('')
    : '尚無自動快照';

  const estimate = await navigator.storage?.estimate?.();
  const persistent = await navigator.storage?.persisted?.();
  $('storageSummary').innerHTML =
    `已使用：<b>${estimate?.usage ? `${(estimate.usage / 1048576).toFixed(2)} MB` : '未知'}</b><br>` +
    `可用配額：約 <b>${estimate?.quota ? `${(estimate.quota / 1048576).toFixed(0)} MB` : '未知'}</b><br>` +
    `持久化權限：<b>${persistent ? '已允許' : '未確認／未允許'}</b>`;

  if (state.seeded) {
    $('seedNotice').classList.remove('hidden');
    $('seedNotice').innerHTML =
      '<b>Phase G2 資料初始化完成</b><br>已套用版本化資料，不會覆蓋既有個人資料。';
    state.seeded = false;
  }
  globalThis.DebugTrace?.record?.('app','ui_refresh_completed',{status:'completed',details:{elapsed_ms:Math.round((perfNow()-refreshStarted)*10)/10,snapshot_count:snapshots.length,snapshot_list_metadata_only:true}});
}

function download(bytes, name, type) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([bytes], { type }));
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

function setupPrompts() {
  const select = $('promptScenario');
  select.innerHTML = Object.entries(PROMPT_CATALOG)
    .map(([key, value]) => `<option value="${key}">${esc(value.title)}</option>`)
    .join('');

  const showPrompt = () => {
    $('aiPromptText').value = PROMPT_CATALOG[select.value].prompt;
  };

  select.onchange = showPrompt;
  showPrompt();

  $('guideScenarioList').innerHTML = Object.values(PROMPT_CATALOG)
    .map((item) =>
      `<div class="guide-scenario"><b>${esc(item.title)}</b><br><span>${esc(item.entities.join('、'))}</span></div>`,
    )
    .join('');

  $('copyPromptBtn').onclick = async () => {
    await navigator.clipboard.writeText(PROMPT_CATALOG[select.value].prompt);
    alert('提示詞已複製');
  };

  $('downloadTemplateBtn').onclick = () => {
    download(
      JSON.stringify(buildScenarioTemplate(select.value), null, 2),
      `pokemon_sleep_${select.value}_template_v1.1.json`,
      'application/json',
    );
  };
}

function renderWorkflow() {
  const result = state.workflow;
  if (!result) return;

  $('workflowSummary').innerHTML =
    `操作：<b>${result.summary.operation_count || 0}</b>；` +
    `錯誤：<b>${result.errors.length}</b>；` +
    `警告：<b>${result.warnings.length}</b>；` +
    `待覆核：<b>${result.review.length}</b><br>` +
    Object.entries(result.summary.entity_counts || {})
      .map(([key, value]) => `${esc(key)}=${value}`)
      .join('、');

  const lines = [
    ...result.errors.map((item) => `<div class="status-conflict">錯誤：${esc(item)}</div>`),
    ...result.warnings.map((item) => `<div>警告：${esc(item)}</div>`),
    ...result.review.map((item) =>
      `<div>待覆核：${esc(item.operation_id)}／${esc(item.entity)}／${esc(JSON.stringify(item.key))}</div>`,
    ),
  ];

  $('workflowIssues').innerHTML =
    lines.join('') || '結構檢查通過，沒有錯誤、警告或待覆核項目。';
  $('workflowIssues').classList.remove('hidden');
  $('approveReviewBtn').disabled = !result.review.length;
  $('dryRunBtn').disabled = Boolean(result.errors.length || result.review.length);
}

// Local deterministic producers (for example E3C-6B manual observation capture)
// feed the same Update Center state as a selected JSON file without DataTransfer/file spoofing.
function loadUpdatePayload(payload) {
  state.payload = payload;
  state.preview = null;
  state.workflow = validateWorkflow(state.payload);
  $('importSummary').textContent = '尚未執行 Dry Run。';
  $('applyBtn').disabled = true;
  renderWorkflow();
}

function setupEventHandlers() {
  ['pokemonSearch', 'ratingFilter', 'specialtyFilter'].forEach((id) => {
    $(id).oninput = renderPokemon;
  });

  $('jsonFile').onchange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      loadUpdatePayload(JSON.parse(await file.text()));
    } catch (error) {
      alert(`JSON 格式錯誤：${error.message}`);
    }
  };

  globalThis.addEventListener('pokemon-sleep:local-update-package-ready', (event) => {
    const payload=event?.detail?.payload;
    if(!payload)return;
    loadUpdatePayload(payload);
    if($('jsonFile'))$('jsonFile').value='';
    $('workflowIssues').classList.remove('hidden');
  });

  $('validateJsonBtn').onclick = () => {
    if (!state.payload) return alert('請先選擇 JSON');
    state.workflow = validateWorkflow(state.payload);
    renderWorkflow();
  };

  $('approveReviewBtn').onclick = () => {
    if (!state.payload || !state.workflow?.review.length) return;
    if (!confirm(`確認已人工檢查 ${state.workflow.review.length} 筆待覆核項目？`)) return;
    state.payload = approveReviewed(state.payload);
    state.workflow = validateWorkflow(state.payload);
    renderWorkflow();
    alert('已在本次匯入中解除 review_required；原始檔案不會修改');
  };

  $('dryRunBtn').onclick = () => {
    try {
      if (!state.payload) throw new Error('請先選擇 JSON');
      state.workflow = validateWorkflow(state.payload);
      renderWorkflow();
      if (state.workflow.errors.length || state.workflow.review.length) {
        throw new Error('請先排除結構錯誤與待覆核項目');
      }
      state.preview = dryRun(state.payload);
      $('importSummary').innerHTML =
        `更新ID：<b>${esc(state.preview.update_id)}</b><br>` +
        `操作：${state.preview.operation_count}；可套用：${state.preview.ready_count}；衝突：${state.preview.conflict_count}`;
      renderTable($('changeTable'), state.preview.changes, [
        { label: '#', key: 'index' },
        { label: '實體', key: 'entity' },
        { label: '要求', key: 'requested_action' },
        { label: '實際', key: 'effective_action' },
        { label: '狀態', key: 'status' },
        { label: '訊息', key: 'message' },
      ]);
      $('applyBtn').disabled = state.preview.conflict_count !== 0;
    } catch (error) {
      alert(error.message);
    }
  };

  $('applyBtn').onclick = async () => {
    if (!confirm('確定套用更新？')) return;
    try {
      const appliedPayload=state.payload;
      const result = await applyPayload(appliedPayload);
      alert(`更新完成，共 ${result.operation_count} 筆`);
      $('applyBtn').disabled = true;
      await refresh();
      globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:update-applied',{detail:{payload:appliedPayload,result}}));
    } catch (error) {
      alert(`套用失敗：${error.message}`);
    }
  };

  $('downloadDbBtn').onclick = () => {
    download(
      exportBytes(),
      `pokemon_sleep_${new Date().toISOString().slice(0, 10)}.sqlite3`,
      'application/vnd.sqlite3',
    );
  };

  $('downloadJsonBtn').onclick = () => {
    const tables = [
      'settings',
      'account_capacity',
      'pokemon',
      'pokemon_subskills',
      'pokemon_ingredients',
      'pokemon_history',
      'discarded_pokemon',
      'ingredient_inventory',
      'item_inventory',
      'candy_inventory',
      'recipes',
      'recipe_ingredients',
      'weekly_plan',
      'weekly_context',
      'weekly_strategy',
      'collection_targets',
      'ingredient_probability_observations',
      'import_batches',
      'import_changes',
    ];
    const payload = {
      schema_version: '1.0',
      exported_at: localIso(),
      data: Object.fromEntries(tables.map((table) => [table, rows(`SELECT * FROM "${table}"`)])),
    };
    download(JSON.stringify(payload, null, 2), 'pokemon_sleep_full.json', 'application/json');
  };

  $('restoreDbBtn').onclick = async () => {
    const file = $('restoreDbFile').files[0];
    if (!file) return alert('請選擇 SQLite');
    try {
      await snapshot('before-restore');
      await replaceDatabase(new Uint8Array(await file.arrayBuffer()));
      alert('還原完成');
      await refresh();
    } catch (error) {
      alert(error.message);
    }
  };

  $('resetDbBtn').onclick = async () => {
    if (confirm('確定清除全部個人資料？')) {
      await clearAllStorage();
      location.reload();
    }
  };

  $('requestPersistenceBtn').onclick = async () => {
    const granted = await navigator.storage?.persist?.();
    alert(granted ? '已允許持久化儲存' : '未允許，請定期備份');
    await refresh();
  };
}

async function start() {
  const startAt=perfNow();
  try {
    setupPrompts();
    setupPokemonDetail(refresh);
    setupEventHandlers();
    bindNavigation();

    const result = await initializeDatabase();
    state.seeded = Boolean(result?.seeded);

    setupG3Pages();
    bindNavigation();

    $('dbStatus').textContent = 'SQLite 已就緒｜介面載入中…';
    $('dbStatus').className = 'badge pending';
    const hydrationStarted=perfNow();
    await refresh();
    const hydrationMs=Math.round((perfNow()-hydrationStarted)*10)/10;
    $('dbStatus').textContent = 'App 已就緒';
    $('dbStatus').className = 'badge ok';
    globalThis.DebugTrace?.record?.('app','app_hydration_ready',{status:'completed',details:{hydration_ms:hydrationMs,total_startup_ms:Math.round((perfNow()-startAt)*10)/10,database_ready_before_ui_ready:true}});
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:app-ready',{detail:{hydration_ms:hydrationMs}}));
  } catch (error) {
    console.error('Application initialization failed', error);
    $('dbStatus').textContent = '初始化失敗';
    $('dbStatus').className = 'badge error';
    $('storageWarning').textContent = `初始化失敗：${error.message || error}`;
    $('storageWarning').classList.remove('hidden');
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch((error) => {
    console.warn('Service Worker registration failed', error);
  });
}

start();