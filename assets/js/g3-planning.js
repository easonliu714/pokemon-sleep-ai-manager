import { rows, run, persist, snapshot } from './database.js';
import { localIso } from './time-utils.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char]);

const now = () => localIso();

const field = (name, label, value = '', type = 'text') =>
  `<label class="edit-field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value ?? '')}"></label>`;

const area = (name, label, value = '') =>
  `<label class="edit-field full"><span>${label}</span><textarea name="${name}">${esc(value ?? '')}</textarea></label>`;

function ensureUi() {
  const nav = document.querySelector('nav');
  const guideButton = nav.querySelector('[data-view="guide"]');

  for (const [id, label] of [
    ['weekly', '本週環境'],
    ['warroom', '戰情室'],
    ['collection', '收集指南'],
  ]) {
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
      <section id="weekly" class="view">
        <h2>本週營地／活動</h2>
        <div id="weeklyContextPanel" class="panel"></div>
      </section>
      <section id="warroom" class="view">
        <h2>本週戰情室</h2>
        <div id="warroomPanel" class="panel"></div>
      </section>
      <section id="collection" class="view">
        <h2>寶可夢收集策略／指南</h2>
        <div class="panel">
          <form id="collectionAddForm" class="edit-grid">
            ${field('species', '寶可夢')}
            ${field('target_type', '目標類型')}
            ${field('priority', '優先度')}
            ${field('camp', '建議營地')}
            ${area('desired_traits', '理想條件')}
            ${area('capture_strategy', '捕捉策略')}
            <button type="submit">新增目標</button>
          </form>
        </div>
        <div class="table-wrap"><table id="collectionTable"></table></div>
      </section>
    `);
  }

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

function weeklyForm() {
  const row = rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0] || {};
  const panel = document.getElementById('weeklyContextPanel');

  panel.innerHTML = `
    <form id="weeklyContextForm">
      <div class="edit-grid">
        ${field('week_start', '週起始日', row.week_start, 'date')}
        ${field('camp', '營地', row.camp)}
        ${field('dish_category', '料理類型', row.dish_category)}
        ${field('pot_size', '鍋子容量', row.pot_size, 'number')}
        ${field('favorite_berry_1', '喜好樹果 1', row.favorite_berry_1)}
        ${field('favorite_berry_2', '喜好樹果 2', row.favorite_berry_2)}
        ${field('favorite_berry_3', '喜好樹果 3', row.favorite_berry_3)}
        ${field('event_name', '活動名稱', row.event_name)}
        ${area('event_effects', '活動效果', row.event_effects)}
        ${area('base_notes', '基礎環境與假設', row.base_notes)}
      </div>
      <button type="submit">儲存本週環境</button>
    </form>
  `;

  document.getElementById('weeklyContextForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = `week_${form.get('week_start') || 'current'}`;

    await snapshot('manual:weekly-context');
    run(
      'INSERT OR REPLACE INTO weekly_context(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id,
        form.get('week_start') || '',
        form.get('camp') || '',
        form.get('dish_category') || '',
        form.get('favorite_berry_1') || '',
        form.get('favorite_berry_2') || '',
        form.get('favorite_berry_3') || '',
        form.get('event_name') || '',
        form.get('event_effects') || '',
        Number(form.get('pot_size')) || null,
        form.get('base_notes') || '',
        now(),
      ],
    );
    await persist();
    alert('本週環境已儲存');
  };
}

function warroomForm() {
  const row = rows('SELECT * FROM weekly_strategy ORDER BY updated_at DESC LIMIT 1')[0] || {};
  const panel = document.getElementById('warroomPanel');

  panel.innerHTML = `
    <form id="warroomForm">
      <div class="edit-grid">
        ${field('week_start', '週起始日', row.week_start, 'date')}
        ${area('team_summary', '主隊與替補', row.team_summary)}
        ${area('substitution_rules', '替換條件', row.substitution_rules)}
        ${area('time_schedule', '時段攻略', row.time_schedule)}
        ${area('meal_strategy', '料理節奏', row.meal_strategy)}
        ${field('ingredient_estimate', '預估食材收益', row.ingredient_estimate, 'number')}
        ${field('berry_estimate', '預估樹果收益', row.berry_estimate, 'number')}
        ${field('shard_estimate', '預估夢之碎片', row.shard_estimate, 'number')}
        ${field('snorlax_energy_estimate', '預估卡比獸能量', row.snorlax_energy_estimate, 'number')}
        ${area('assumptions', '估算假設', row.assumptions)}
      </div>
      <button type="submit">儲存戰情室策略</button>
    </form>
  `;

  document.getElementById('warroomForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = `strategy_${form.get('week_start') || 'current'}`;

    await snapshot('manual:weekly-strategy');
    run(
      'INSERT OR REPLACE INTO weekly_strategy(strategy_id,week_start,team_summary,substitution_rules,time_schedule,meal_strategy,ingredient_estimate,berry_estimate,shard_estimate,snorlax_energy_estimate,assumptions,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id,
        form.get('week_start') || '',
        form.get('team_summary') || '',
        form.get('substitution_rules') || '',
        form.get('time_schedule') || '',
        form.get('meal_strategy') || '',
        Number(form.get('ingredient_estimate')) || null,
        Number(form.get('berry_estimate')) || null,
        Number(form.get('shard_estimate')) || null,
        Number(form.get('snorlax_energy_estimate')) || null,
        form.get('assumptions') || '',
        now(),
      ],
    );
    await persist();
    alert('戰情室策略已儲存');
  };
}

function renderCollection() {
  const data = rows(
    'SELECT * FROM collection_targets ORDER BY CASE priority WHEN "S" THEN 1 WHEN "A" THEN 2 WHEN "B" THEN 3 ELSE 9 END, species',
  );
  const table = document.getElementById('collectionTable');

  if (!data.length) {
    table.innerHTML = '<tbody><tr><td>尚無收集目標</td></tr></tbody>';
    return;
  }

  table.innerHTML = `
    <thead><tr><th>寶可夢</th><th>目標</th><th>優先</th><th>營地</th><th>理想條件</th><th>策略</th></tr></thead>
    <tbody>${data.map((row) => `
      <tr>
        <td>${esc(row.species)}</td>
        <td>${esc(row.target_type)}</td>
        <td>${esc(row.priority)}</td>
        <td>${esc(row.camp)}</td>
        <td>${esc(row.desired_traits)}</td>
        <td>${esc(row.capture_strategy)}</td>
      </tr>
    `).join('')}</tbody>
  `;
}

export function setupG3Pages() {
  ensureUi();
  weeklyForm();
  warroomForm();
  renderCollection();

  document.getElementById('collectionAddForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const species = form.get('species');
    if (!species) {
      alert('請輸入寶可夢名稱');
      return;
    }

    await snapshot('manual:collection-target');
    run(
      'INSERT OR REPLACE INTO collection_targets(target_id,species,target_type,priority,camp,desired_traits,capture_strategy,status,notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [
        `target_${Date.now()}`,
        species,
        form.get('target_type') || '',
        form.get('priority') || '',
        form.get('camp') || '',
        form.get('desired_traits') || '',
        form.get('capture_strategy') || '',
        'active',
        '',
        now(),
      ],
    );
    await persist();
    event.target.reset();
    renderCollection();
  };
}
