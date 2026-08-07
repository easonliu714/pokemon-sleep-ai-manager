import { rows } from './database.js';
import { debugTrace } from './debug-trace-manager.js';

const INGREDIENT_LEVELS = Object.freeze([1, 30, 60]);
const SUBSKILL_LEVELS = Object.freeze([10, 25, 50, 70, 80]);
const CORE_FIELDS = Object.freeze([
  'pokemon_id','pokemon_instance_id','identity_fingerprint','registered_at','species','level','specialty',
  'type','nature','main_skill','main_skill_level','helper_seconds','carry_limit','favorite_berry',
]);
const TEAM_FIELDS = Object.freeze(['species','level','specialty','type','nature','main_skill','helper_seconds','carry_limit']);
const TRAINING_FIELDS = Object.freeze([...TEAM_FIELDS,'main_skill_level']);
const EVOLUTION_FIELDS = Object.freeze(['species','registered_at']);

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const meaningful = (value) => value !== null && value !== undefined && value !== '';

function loadConfirmedSlots() {
  const confirmed = new Map();
  for (const batch of rows('SELECT result_json FROM import_batches ORDER BY imported_at')) {
    let result;
    try { result = JSON.parse(batch.result_json || '{}'); } catch { continue; }
    for (const item of result.profile_audit_confirmations || []) {
      if (item?.confirmed_by_user !== true || item?.status !== 'user_confirmed_not_visible') continue;
      const levels = Array.isArray(item.unlock_levels) ? item.unlock_levels : [];
      for (const level of levels) confirmed.set(`${item.pokemon_id}|${item.slot_type}|${Number(level)}`, item);
    }
  }
  return confirmed;
}

function missingFields(pokemon, fields) {
  return fields.filter((field) => !meaningful(pokemon[field]));
}

function slotStatus(pokemonId, level, row, confirmed, slotType) {
  if (row) return { status: 'observed', unlocked: false, value: row };
  const confirmation = confirmed.get(`${pokemonId}|${slotType}|${level}`);
  if (confirmation) return { status: 'user_confirmed_not_visible', unlocked: false, value: null };
  return { status: 'missing', unlocked: false, value: null };
}

function buildReadiness(pokemon, ingredientSlots, subskillSlots) {
  const teamMissing = missingFields(pokemon, TEAM_FIELDS);
  const trainingMissing = missingFields(pokemon, TRAINING_FIELDS);
  const evolutionMissing = missingFields(pokemon, EVOLUTION_FIELDS);
  const currentIngredientMissing = ingredientSlots.filter((slot) => slot.unlocked && slot.status === 'missing').map((slot) => `ingredient@${slot.level}`);
  const currentSubskillMissing = subskillSlots.filter((slot) => slot.unlocked && slot.status === 'missing').map((slot) => `subskill@${slot.level}`);
  return {
    profile_analysis_ready: missingFields(pokemon, CORE_FIELDS).length === 0 && currentIngredientMissing.length === 0 && currentSubskillMissing.length === 0,
    team_builder: { ready: teamMissing.length === 0 && currentIngredientMissing.length === 0 && currentSubskillMissing.length === 0, reasons: [...teamMissing, ...currentIngredientMissing, ...currentSubskillMissing] },
    training_coach: { ready: trainingMissing.length === 0 && currentIngredientMissing.length === 0 && currentSubskillMissing.length === 0, reasons: [...trainingMissing, ...currentIngredientMissing, ...currentSubskillMissing] },
    evolution_planner: { ready: evolutionMissing.length === 0, reasons: evolutionMissing },
  };
}

export function buildProfileCompletenessReport() {
  const pokemonRows = rows("SELECT * FROM pokemon WHERE status='active' ORDER BY pokemon_id");
  const ingredients = rows('SELECT * FROM pokemon_ingredients ORDER BY pokemon_id, unlock_level');
  const subskills = rows('SELECT * FROM pokemon_subskills ORDER BY pokemon_id, unlock_level');
  const evidence = rows('SELECT pokemon_instance_id, COUNT(*) count FROM pokemon_identity_evidence GROUP BY pokemon_instance_id');
  const confirmed = loadConfirmedSlots();
  const ingredientMap = new Map(ingredients.map((row) => [`${row.pokemon_id}|${Number(row.unlock_level)}`, row]));
  const subskillMap = new Map(subskills.map((row) => [`${row.pokemon_id}|${Number(row.unlock_level)}`, row]));
  const evidenceMap = new Map(evidence.map((row) => [row.pokemon_instance_id, Number(row.count)]));
  const fingerprintCounts = new Map();
  for (const pokemon of pokemonRows) if (meaningful(pokemon.identity_fingerprint)) fingerprintCounts.set(pokemon.identity_fingerprint, (fingerprintCounts.get(pokemon.identity_fingerprint) || 0) + 1);

  const reports = pokemonRows.map((pokemon) => {
    const level = Number(pokemon.level || 0);
    const ingredientSlots = INGREDIENT_LEVELS.map((unlockLevel) => ({
      level: unlockLevel,
      ...slotStatus(pokemon.pokemon_id, unlockLevel, ingredientMap.get(`${pokemon.pokemon_id}|${unlockLevel}`), confirmed, 'ingredient'),
      unlocked: level >= unlockLevel,
    }));
    const subskillSlots = SUBSKILL_LEVELS.map((unlockLevel) => ({
      level: unlockLevel,
      ...slotStatus(pokemon.pokemon_id, unlockLevel, subskillMap.get(`${pokemon.pokemon_id}|${unlockLevel}`), confirmed, 'subskill'),
      unlocked: level >= unlockLevel,
    }));
    const coreMissing = missingFields(pokemon, CORE_FIELDS);
    const conflicts = [];
    if (meaningful(pokemon.identity_fingerprint) && fingerprintCounts.get(pokemon.identity_fingerprint) > 1) conflicts.push('identity_fingerprint_collision');
    if (!meaningful(pokemon.pokemon_instance_id)) conflicts.push('missing_pokemon_instance_id');
    const neutralNature = meaningful(pokemon.nature) && !meaningful(pokemon.nature_bonus) && !meaningful(pokemon.nature_penalty);
    const readiness = buildReadiness(pokemon, ingredientSlots, subskillSlots);
    const statuses = [
      ...coreMissing.map((field) => ({ field, status: 'missing' })),
      ...ingredientSlots.map((slot) => ({ field: `ingredient@${slot.level}`, status: slot.status })),
      ...subskillSlots.map((slot) => ({ field: `subskill@${slot.level}`, status: slot.status })),
      ...(neutralNature ? [{ field: 'nature_effect', status: 'not_applicable' }] : []),
      ...conflicts.map((field) => ({ field, status: 'conflicting' })),
    ];
    return {
      pokemon_id: pokemon.pokemon_id,
      pokemon_instance_id: pokemon.pokemon_instance_id,
      label: pokemon.nickname || pokemon.original_label || pokemon.species || pokemon.pokemon_id,
      species: pokemon.species,
      level,
      evidence_count: evidenceMap.get(pokemon.pokemon_instance_id) || 0,
      ingredient_slots: ingredientSlots,
      subskill_slots: subskillSlots,
      statuses,
      core_missing: coreMissing,
      conflicts,
      neutral_nature: neutralNature,
      readiness,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    pokemon_count: reports.length,
    unique_pokemon_id_count: new Set(reports.map((item) => item.pokemon_id)).size,
    unique_instance_id_count: new Set(reports.map((item) => item.pokemon_instance_id).filter(Boolean)).size,
    fingerprint_collision_count: reports.filter((item) => item.conflicts.includes('identity_fingerprint_collision')).length,
    profile_analysis_ready_count: reports.filter((item) => item.readiness.profile_analysis_ready).length,
    team_builder_ready_count: reports.filter((item) => item.readiness.team_builder.ready).length,
    training_coach_ready_count: reports.filter((item) => item.readiness.training_coach.ready).length,
    evolution_planner_ready_count: reports.filter((item) => item.readiness.evolution_planner.ready).length,
    user_confirmed_not_visible_count: reports.flatMap((item) => item.statuses).filter((item) => item.status === 'user_confirmed_not_visible').length,
    missing_count: reports.flatMap((item) => item.statuses).filter((item) => item.status === 'missing').length,
    reports,
  };
}

function downloadJson(payload) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  anchor.download = `pokemon_profile_completeness_${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

function renderReport() {
  const target = document.getElementById('profileCompletenessPanel');
  if (!target) return;
  let report;
  try { report = buildProfileCompletenessReport(); }
  catch (error) { target.innerHTML = `<b>完整度稽核尚未就緒</b><br>${esc(error.message)}`; return; }
  const incomplete = report.reports.filter((item) => !item.readiness.profile_analysis_ready || item.conflicts.length);
  target.innerHTML = `
    <div class="section-head"><h3>DATA.2A 個體完整度與分析就緒</h3><button id="downloadProfileCompletenessBtn">下載完整稽核 JSON</button></div>
    <div class="cards">
      <article><strong>${report.pokemon_count}</strong><span>有效個體</span></article>
      <article><strong>${report.profile_analysis_ready_count}</strong><span>基礎分析就緒</span></article>
      <article><strong>${report.team_builder_ready_count}</strong><span>Team Builder 就緒</span></article>
      <article><strong>${report.user_confirmed_not_visible_count}</strong><span>用戶確認未顯示槽位</span></article>
      <article><strong>${report.missing_count}</strong><span>真正缺漏欄位</span></article>
      <article><strong>${report.fingerprint_collision_count}</strong><span>Fingerprint 衝突</span></article>
    </div>
    <p class="notice">解鎖狀態由目前等級即時計算；未解鎖能力不列入 current production。用戶已確認未顯示的槽位與真正缺漏分開統計。</p>
    <div class="table-wrap"><table><thead><tr><th>個體</th><th>Lv</th><th>食材槽</th><th>副技能槽</th><th>Evidence</th><th>分析狀態</th><th>缺漏／衝突</th></tr></thead><tbody>${incomplete.length ? incomplete.map((item) => {
      const ingredientSummary = item.ingredient_slots.map((slot) => `${slot.level}:${slot.status}${slot.unlocked?'✓':'○'}`).join('、');
      const subskillSummary = item.subskill_slots.map((slot) => `${slot.level}:${slot.status}${slot.unlocked?'✓':'○'}`).join('、');
      const reasons = [...item.core_missing, ...item.conflicts, ...item.readiness.team_builder.reasons].filter((value, index, values) => values.indexOf(value) === index);
      return `<tr><td>${esc(item.label)}<br><code>${esc(item.pokemon_id)}</code></td><td>${item.level}</td><td>${esc(ingredientSummary)}</td><td>${esc(subskillSummary)}</td><td>${item.evidence_count}</td><td>${item.readiness.profile_analysis_ready?'READY':'DEGRADED'}</td><td>${esc(reasons.join('、') || '—')}</td></tr>`;
    }).join('') : '<tr><td colspan="7">所有個體皆符合目前基礎分析門檻。</td></tr>'}</tbody></table></div>`;
  document.getElementById('downloadProfileCompletenessBtn')?.addEventListener('click', () => downloadJson(report));
  debugTrace.record('profile_completeness','profile_completeness_rendered',{status:'completed',details:{pokemon_count:report.pokemon_count,ready_count:report.profile_analysis_ready_count,missing_count:report.missing_count,confirmed_not_visible_count:report.user_confirmed_not_visible_count}});
}

function install() {
  const updates = document.getElementById('updateCenterDynamicContent');
  if (!updates || document.getElementById('profileCompletenessPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'profileCompletenessPanel';
  panel.className = 'panel';
  panel.textContent = '個體完整度稽核載入中…';
  updates.appendChild(panel);
  renderReport();
  addEventListener('pokemon-sleep:data-changed', renderReport);
  addEventListener('pokemon-sleep:database-ready', renderReport);
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(install, 0), { once: true });
else setTimeout(install, 0);

export { renderReport };
