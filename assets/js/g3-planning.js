import { rows, run, persist, snapshot } from './database.js';
import { localIso } from './time-utils.js';
import { buildLocalRecipeStrategyProjection } from './recipe-strategy-local.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const now = () => localIso();
let strategyListenersInstalled = false;

const CAMP_OPTIONS = [
  '萌綠之島', '天青沙灘', '灰褐洞窟', '白花雪原',
  '寶藍湖畔', '黃金舊發電廠', '琥褐溪谷', '萌綠之島EX',
];
const DISH_OPTIONS = ['咖哩／濃湯', '沙拉', '點心／飲料'];
const PRIORITY_OPTIONS = ['S+', 'S', 'A', 'B', 'C'];
const TARGET_TYPE_OPTIONS = ['立即培養', '進化目標', '食材補強', '樹果補強', '技能支援', '圖鑑收集', '保留觀察'];
const EVENT_OPTIONS = ['無活動', '待依遊戲公告確認', '自訂活動'];
const RECIPE_STATUS_LABELS = Object.freeze({
  COOK_NOW_UNLOCKED: '已解鎖／可立即製作',
  UNLOCK_CANDIDATE_READY: '可立即嘗試解鎖',
  NEAR_COOK_UNLOCKED: '已解鎖／接近可製作',
  UNLOCK_CANDIDATE_NEAR: '接近可解鎖',
  BLOCKED_SAFE_RESERVE: '安全庫存限制',
  BLOCKED_INGREDIENT_SHORTAGE: '食材不足',
  BLOCKED_POT_CAPACITY: '鍋子容量不足',
  REVIEW_MISSING_INPUT: '資料待補',
  REVIEW_PROVENANCE: '來源待核對',
});

const field = (name, label, value = '', type = 'text') =>
  `<label class="edit-field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value ?? '')}"></label>`;
const area = (name, label, value = '') =>
  `<label class="edit-field full"><span>${label}</span><textarea name="${name}">${esc(value ?? '')}</textarea></label>`;
function optionList(options, value, allowBlank = true) {
  const current = String(value ?? '');
  const values = [...options];
  if (current && !values.includes(current)) values.unshift(current);
  return `${allowBlank ? '<option value="">請選擇</option>' : ''}${values.map((item) =>
    `<option value="${esc(item)}"${item === current ? ' selected' : ''}>${esc(item)}</option>`).join('')}`;
}
function selectField(name, label, value, options, allowBlank = true) {
  return `<label class="edit-field"><span>${label}</span><select name="${name}">${optionList(options, value, allowBlank)}</select></label>`;
}
function berryOptions(value) {
  const berries = rows('SELECT berry_name FROM berry_master ORDER BY type_name')
    .map((row) => row.berry_name)
    .filter(Boolean);
  return optionList([...new Set(berries)], value);
}
function berryField(name, label, value) {
  return `<label class="edit-field"><span>${label}</span><select name="${name}">${berryOptions(value)}</select></label>`;
}

function ensureUi() {
  const nav = document.querySelector('nav');
  const guideButton = nav.querySelector('[data-view="guide"]');
  for (const [id, label] of [['weekly', '本週環境'], ['warroom', '戰情室'], ['collection', '收集指南']]) {
    if (!nav.querySelector(`[data-view="${id}"]`)) {
      const button = document.createElement('button');
      button.dataset.view = id;
      button.textContent = label;
      nav.insertBefore(button, guideButton);
    }
  }
  const main = document.querySelector('main');
  if (!document.getElementById('weekly')) {
    main.insertAdjacentHTML('beforeend', `
      <section id="weekly" class="view"><h2>本週營地／活動</h2><div id="weeklyContextPanel" class="panel"></div></section>
      <section id="warroom" class="view"><h2>本週戰情室</h2><div id="warroomPanel" class="panel"></div></section>
      <section id="collection" class="view">
        <h2>寶可夢收集策略／指南</h2>
        <div class="panel"><form id="collectionAddForm" class="edit-grid">
          ${field('species', '寶可夢')}
          ${selectField('target_type', '目標類型', '', TARGET_TYPE_OPTIONS)}
          ${selectField('priority', '優先度', '', PRIORITY_OPTIONS)}
          ${selectField('camp', '建議營地', '', CAMP_OPTIONS)}
          ${area('desired_traits', '理想條件')}${area('capture_strategy', '捕捉策略')}
          <button type="submit">新增目標</button>
        </form></div>
        <div class="table-wrap"><table id="collectionTable"></table></div>
      </section>`);
  }
  document.querySelectorAll('nav button').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === button.dataset.view));
      document.querySelectorAll('nav button').forEach((item) => item.classList.toggle('active', item === button));
      if (button.dataset.view === 'warroom') queueMicrotask(renderRecipeStrategyProjection);
    };
  });
}

function weeklyForm() {
  const row = rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0] || {};
  const panel = document.getElementById('weeklyContextPanel');
  panel.innerHTML = `<form id="weeklyContextForm"><div class="edit-grid">
    ${field('week_start', '週起始日', row.week_start, 'date')}
    ${selectField('camp', '營地', row.camp, CAMP_OPTIONS, false)}
    ${selectField('dish_category', '料理類型', row.dish_category, DISH_OPTIONS, false)}
    ${field('pot_size', '鍋子容量', row.pot_size, 'number')}
    ${berryField('favorite_berry_1', '喜好樹果 1', row.favorite_berry_1)}
    ${berryField('favorite_berry_2', '喜好樹果 2', row.favorite_berry_2)}
    ${berryField('favorite_berry_3', '喜好樹果 3', row.favorite_berry_3)}
    ${selectField('event_name', '活動名稱', row.event_name, EVENT_OPTIONS)}
    ${area('event_effects', '活動效果', row.event_effects)}
    ${area('base_notes', '基礎環境與假設', row.base_notes)}
  </div><button type="submit">儲存本週環境</button></form>`;

  document.getElementById('weeklyContextForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const berries = ['favorite_berry_1', 'favorite_berry_2', 'favorite_berry_3'].map((key) => form.get(key)).filter(Boolean);
    if (new Set(berries).size !== berries.length) return alert('三個喜好樹果不可重複');
    const id = `week_${form.get('week_start') || 'current'}`;
    await snapshot('manual:weekly-context');
    run('INSERT OR REPLACE INTO weekly_context(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [
      id, form.get('week_start') || '', form.get('camp') || '', form.get('dish_category') || '',
      form.get('favorite_berry_1') || '', form.get('favorite_berry_2') || '', form.get('favorite_berry_3') || '',
      form.get('event_name') || '', form.get('event_effects') || '', Number(form.get('pot_size')) || null,
      form.get('base_notes') || '', now(),
    ]);
    await persist();
    document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed'));
    renderRecipeStrategyProjection();
    alert('本週環境已儲存');
  };
}

function recipeShortageText(row) {
  const missing = row.requirements.filter((item) => Number(item.strategy_shortage || 0) > 0);
  if (!missing.length) return '無';
  return missing.map((item) => {
    const reserveOnly = Number(item.raw_shortage || 0) === 0 && Number(item.reserve_blocked || 0) > 0;
    return `${esc(item.ingredient_name)} 缺 ${item.strategy_shortage}${reserveOnly ? '（保留限制）' : ''}`;
  }).join('、');
}
function potText(row) {
  if (row.pot_fit === null) return `未設定（需求 ${row.pot_required}）`;
  return row.pot_fit ? `可（${row.pot_required}/${row.pot_capacity}）` : `不足（${row.pot_required}/${row.pot_capacity}）`;
}
function renderRecipeStrategyProjection() {
  const target = document.getElementById('warroomRecipeProjection');
  if (!target) return;
  try {
    const result = buildLocalRecipeStrategyProjection({
      requireVerifiedMaster: true,
      sortMode: 'unlock_recipes',
    });
    if (result.projection_status !== 'READY') {
      target.innerHTML = '<p class="notice">目前為救援／唯讀狀態，沒有玩家資料可進行本機料理策略計算。</p>';
      return;
    }
    const candidates = result.candidates.slice(0, 10);
    const counts = result.summary.status_counts || {};
    target.innerHTML = `
      <h3>料理策略候選（本機 deterministic）</h3>
      <p class="notice">只使用目前 ACTIVE 公版料理、您的本機食材／解鎖狀態與本週鍋子。此區不呼叫 Gemini，也不修改任何庫存或料理狀態。</p>
      <p class="notice">本週料理：<b>${esc(result.context.dish_category || '未設定')}</b>　鍋子：<b>${esc(result.context.pot_size ?? '未設定')}</b>　可立即解鎖：<b>${Number(counts.UNLOCK_CANDIDATE_READY || 0)}</b>　接近可解鎖：<b>${Number(counts.UNLOCK_CANDIDATE_NEAR || 0)}</b></p>
      <div class="table-wrap"><table><thead><tr><th>狀態</th><th>料理</th><th>解鎖</th><th>鍋子</th><th>策略缺料</th><th>證據</th></tr></thead><tbody>
        ${candidates.length ? candidates.map((row) => `<tr>
          <td>${esc(RECIPE_STATUS_LABELS[row.candidate_status] || row.candidate_status)}</td>
          <td>${esc(row.recipe_name)}</td>
          <td>${row.unlocked ? '已解鎖' : '未解鎖'}</td>
          <td>${esc(potText(row))}</td>
          <td>${recipeShortageText(row)}</td>
          <td>${esc(row.formula_evidence || '—')}</td>
        </tr>`).join('') : '<tr><td colspan="6">本週料理類型目前沒有可分析的 ACTIVE recipe。</td></tr>'}
      </tbody></table></div>
      <p class="notice">Projection Fingerprint：<code>${esc(result.input_fingerprint || '—')}</code></p>`;
  } catch (error) {
    target.innerHTML = `<p class="notice">料理策略投影尚未就緒：${esc(error?.message || String(error))}</p>`;
  }
}

function warroomForm() {
  const row = rows('SELECT * FROM weekly_strategy ORDER BY updated_at DESC LIMIT 1')[0] || {};
  const panel = document.getElementById('warroomPanel');
  panel.innerHTML = `<div id="warroomRecipeProjection"></div><h3>人工策略備註</h3><form id="warroomForm"><div class="edit-grid">
    ${field('week_start', '週起始日', row.week_start, 'date')}
    ${area('team_summary', '主隊與替補', row.team_summary)}${area('substitution_rules', '替換條件', row.substitution_rules)}
    ${area('time_schedule', '時段攻略', row.time_schedule)}${area('meal_strategy', '料理節奏', row.meal_strategy)}
    ${field('ingredient_estimate', '預估食材收益', row.ingredient_estimate, 'number')}
    ${field('berry_estimate', '預估樹果收益', row.berry_estimate, 'number')}
    ${field('shard_estimate', '預估夢之碎片', row.shard_estimate, 'number')}
    ${field('snorlax_energy_estimate', '預估卡比獸能量', row.snorlax_energy_estimate, 'number')}
    ${area('assumptions', '估算假設', row.assumptions)}
  </div><button type="submit">儲存戰情室策略</button></form>`;
  renderRecipeStrategyProjection();
  document.getElementById('warroomForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = `strategy_${form.get('week_start') || 'current'}`;
    await snapshot('manual:weekly-strategy');
    run('INSERT OR REPLACE INTO weekly_strategy(strategy_id,week_start,team_summary,substitution_rules,time_schedule,meal_strategy,ingredient_estimate,berry_estimate,shard_estimate,snorlax_energy_estimate,assumptions,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [
      id, form.get('week_start') || '', form.get('team_summary') || '', form.get('substitution_rules') || '',
      form.get('time_schedule') || '', form.get('meal_strategy') || '', Number(form.get('ingredient_estimate')) || null,
      Number(form.get('berry_estimate')) || null, Number(form.get('shard_estimate')) || null,
      Number(form.get('snorlax_energy_estimate')) || null, form.get('assumptions') || '', now(),
    ]);
    await persist();
    alert('戰情室策略已儲存');
  };
}

function renderCollection() {
  const data = rows('SELECT * FROM collection_targets ORDER BY CASE priority WHEN "S+" THEN 0 WHEN "S" THEN 1 WHEN "A" THEN 2 WHEN "B" THEN 3 ELSE 9 END, species');
  const table = document.getElementById('collectionTable');
  if (!data.length) { table.innerHTML = '<tbody><tr><td>尚無收集目標</td></tr></tbody>'; return; }
  table.innerHTML = `<thead><tr><th>寶可夢</th><th>目標</th><th>優先</th><th>營地</th><th>理想條件</th><th>策略</th></tr></thead><tbody>${data.map((row) => `<tr>
    <td>${esc(row.species)}</td><td>${esc(row.target_type)}</td><td>${esc(row.priority)}</td><td>${esc(row.camp)}</td>
    <td>${esc(row.desired_traits)}</td><td>${esc(row.capture_strategy)}</td></tr>`).join('')}</tbody>`;
}

function installStrategyRefreshListeners() {
  if (strategyListenersInstalled) return;
  strategyListenersInstalled = true;
  document.addEventListener('pokemon-sleep-data-refreshed', renderRecipeStrategyProjection);
  window.addEventListener('pokemon-sleep:data-changed', renderRecipeStrategyProjection);
  window.addEventListener('pokemon-sleep:database-ready', renderRecipeStrategyProjection);
}

export function setupG3Pages() {
  ensureUi(); weeklyForm(); warroomForm(); renderCollection(); installStrategyRefreshListeners();
  document.getElementById('collectionAddForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const species = form.get('species');
    if (!species) return alert('請輸入寶可夢名稱');
    await snapshot('manual:collection-target');
    run('INSERT OR REPLACE INTO collection_targets(target_id,species,target_type,priority,camp,desired_traits,capture_strategy,status,notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [
      `target_${Date.now()}`, species, form.get('target_type') || '', form.get('priority') || '', form.get('camp') || '',
      form.get('desired_traits') || '', form.get('capture_strategy') || '', 'active', '', now(),
    ]);
    await persist(); event.target.reset(); renderCollection();
  };
}
