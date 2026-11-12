import { rows, run, persist, snapshot } from './database.js';
import { localIso } from './time-utils.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function ensureUi() {
  if (document.getElementById('identityReview')) return;
  const nav = document.querySelector('nav');
  const main = document.querySelector('main');
  if (!nav || !main) return;

  const button = document.createElement('button');
  button.dataset.view = 'identityReview';
  button.textContent = '身份覆核';
  nav.appendChild(button);

  const section = document.createElement('section');
  section.id = 'identityReview';
  section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div><h2>寶可夢身份覆核</h2><p class="notice">只處理永久個體 ID、登錄證據與進化關係，不以名稱或等級猜測合併。</p></div>
      <button id="refreshIdentityReviewBtn">重新整理</button>
    </div>
    <div id="identityReviewSummary" class="panel"></div>
    <div id="identityReviewList" class="identity-review-list"></div>`;
  main.appendChild(section);

  const style = document.createElement('style');
  style.textContent = `
    .identity-review-list{display:grid;gap:12px}.identity-card{background:#fff;border:1px solid #d9e2de;border-radius:14px;padding:14px;box-shadow:0 4px 16px rgba(24,63,49,.05)}
    .identity-card h3{margin:0 0 6px}.identity-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}.identity-meta span{background:#f4f8f6;border-radius:9px;padding:8px}
    .identity-actions{display:flex;flex-wrap:wrap;gap:8px}.identity-actions button{white-space:nowrap}.identity-warning{color:#9a5b00}.identity-ok{color:#176b4d}
  `;
  document.head.appendChild(style);

  button.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'identityReview'));
    document.querySelectorAll('nav button').forEach((item) => item.classList.toggle('active', item === button));
    renderIdentityReview();
  });
  document.getElementById('refreshIdentityReviewBtn').addEventListener('click', renderIdentityReview);
}

function evidenceCount(instanceId) {
  return rows('SELECT COUNT(*) AS count FROM pokemon_identity_evidence WHERE pokemon_instance_id=?', [instanceId])[0]?.count || 0;
}

async function confirmIndependent(pokemonId) {
  await snapshot(`identity-confirm:${pokemonId}`);
  const now = localIso();
  run(`UPDATE pokemon SET identity_review_required=0,identity_confidence=1,last_updated_at=? WHERE pokemon_id=?`, [now, pokemonId]);
  run(`INSERT OR REPLACE INTO pokemon_identity_evidence(evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id)
       SELECT ?,pokemon_instance_id,'manual_independent_confirmation',?,1,?,'MANUAL-IDENTITY-REVIEW' FROM pokemon WHERE pokemon_id=?`,
      [`manual-independent-${pokemonId}-${Date.now()}`, JSON.stringify({ pokemon_id: pokemonId }), now, pokemonId]);
  await persist();
  renderIdentityReview();
}

async function markEvolution(pokemonId) {
  const record = rows('SELECT * FROM pokemon WHERE pokemon_id=?', [pokemonId])[0];
  if (!record) return;
  const fromSpecies = prompt('進化前物種', record.original_species || record.species || '');
  if (fromSpecies == null) return;
  const toSpecies = prompt('目前／進化後物種', record.current_species || record.species || '');
  if (!toSpecies) return;
  const evolvedAt = prompt('進化時間（可留空，格式 YYYY-MM-DDTHH:mm:ss+08:00）', '') || null;
  await snapshot(`identity-evolution:${pokemonId}`);
  const now = localIso();
  run(`UPDATE pokemon SET original_species=?,current_species=?,species=?,identity_review_required=0,last_updated_at=? WHERE pokemon_id=?`,
      [fromSpecies, toSpecies, toSpecies, now, pokemonId]);
  run(`INSERT INTO pokemon_evolution_history(evolution_id,pokemon_instance_id,from_species,to_species,evolved_at,confidence,source_update_id)
       VALUES(?,?,?,?,?,1,'MANUAL-IDENTITY-REVIEW')`,
      [`evo-${pokemonId}-${Date.now()}`, record.pokemon_instance_id || pokemonId, fromSpecies, toSpecies, evolvedAt]);
  await persist();
  renderIdentityReview();
}

async function mergeIntoExisting(sourceId) {
  const targetId = prompt('輸入要合併至的既有 pokemon_id。此操作會保留目標資料，搬移食材／副技能／證據，並封存來源個體。');
  if (!targetId || targetId === sourceId) return;
  const source = rows('SELECT * FROM pokemon WHERE pokemon_id=?', [sourceId])[0];
  const target = rows('SELECT * FROM pokemon WHERE pokemon_id=?', [targetId])[0];
  if (!source || !target) return alert('來源或目標 pokemon_id 不存在。');
  if (!confirm(`確定將 ${source.species} (${sourceId}) 合併至 ${target.species} (${targetId})？`)) return;

  await snapshot(`identity-merge:${sourceId}->${targetId}`);
  const now = localIso();
  run(`INSERT OR REPLACE INTO pokemon_ingredients(pokemon_id,unlock_level,ingredient_name,quantity)
       SELECT ?,unlock_level,ingredient_name,quantity FROM pokemon_ingredients WHERE pokemon_id=?`, [targetId, sourceId]);
  run(`INSERT OR REPLACE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked)
       SELECT ?,unlock_level,subskill_name,is_unlocked FROM pokemon_subskills WHERE pokemon_id=?`, [targetId, sourceId]);
  run(`UPDATE pokemon_identity_evidence SET pokemon_instance_id=? WHERE pokemon_instance_id=?`,
      [target.pokemon_instance_id || targetId, source.pokemon_instance_id || sourceId]);
  run(`UPDATE pokemon SET status='archived',identity_review_required=0,last_updated_at=? WHERE pokemon_id=?`, [now, sourceId]);
  run(`INSERT INTO pokemon_identity_evidence(evidence_id,pokemon_instance_id,evidence_type,evidence_value,confidence,observed_at,source_update_id)
       VALUES(?,?,?,?,1,?,'MANUAL-IDENTITY-REVIEW')`,
      [`manual-merge-${sourceId}-${Date.now()}`, target.pokemon_instance_id || targetId, 'manual_merge', JSON.stringify({ source_id: sourceId, target_id: targetId }), now]);
  await persist();
  renderIdentityReview();
}

export function renderIdentityReview() {
  ensureUi();
  const summary = document.getElementById('identityReviewSummary');
  const list = document.getElementById('identityReviewList');
  if (!summary || !list) return;
  let pending;
  try {
    pending = rows(`SELECT * FROM pokemon WHERE status<>'archived' AND identity_review_required=1 ORDER BY rating,level DESC,species`);
  } catch {
    summary.textContent = '資料庫尚未完成初始化。';
    return;
  }
  const confirmed = rows(`SELECT COUNT(*) AS count FROM pokemon WHERE status<>'archived' AND identity_review_required=0`)[0]?.count || 0;
  summary.innerHTML = `<b>待覆核：${pending.length}</b>　已確認：${confirmed}　總非封存個體：${pending.length + confirmed}`;
  if (!pending.length) {
    list.innerHTML = '<div class="panel identity-ok">目前沒有待覆核個體。</div>';
    return;
  }
  list.innerHTML = pending.map((p) => {
    const instanceId = p.pokemon_instance_id || p.pokemon_id;
    return `<article class="identity-card" data-pokemon-id="${esc(p.pokemon_id)}">
      <h3>${esc(p.species)} <small>${esc(p.rating || '未評級')}</small></h3>
      <div class="identity-meta">
        <span><b>pokemon_id</b><br>${esc(p.pokemon_id)}</span>
        <span><b>永久 ID</b><br>${esc(instanceId)}</span>
        <span><b>登錄時間</b><br>${esc(p.registered_at || '尚未匯入')}</span>
        <span><b>能力指紋</b><br>${esc(p.identity_fingerprint || '尚未建立')}</span>
        <span><b>信心度</b><br>${esc(p.identity_confidence ?? '—')}</span>
        <span><b>證據數</b><br>${evidenceCount(instanceId)}</span>
      </div>
      <p class="identity-warning">目前只確認此列存在，尚未以遊戲 ID、登錄時間或完整能力指紋完成身份定錨。</p>
      <div class="identity-actions">
        <button data-action="independent">確認為獨立個體</button>
        <button data-action="evolution">標記／確認進化</button>
        <button data-action="merge" class="danger">改綁既有個體</button>
      </div>
    </article>`;
  }).join('');
  list.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.closest('[data-pokemon-id]').dataset.pokemonId;
      if (button.dataset.action === 'independent') await confirmIndependent(id);
      if (button.dataset.action === 'evolution') await markEvolution(id);
      if (button.dataset.action === 'merge') await mergeIntoExisting(id);
    });
  });
}

function boot() {
  ensureUi();
  const timer = setInterval(() => {
    try {
      rows('SELECT 1');
      clearInterval(timer);
      renderIdentityReview();
    } catch {}
  }, 400);
  setTimeout(() => clearInterval(timer), 30000);
}

boot();
