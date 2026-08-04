const EXPECTED_FULL75_COUNTS = Object.freeze({
  total: 821,
  pokemon_upsert: 75,
  pokemon_archive: 5,
  pokemon_subskills: 369,
  pokemon_ingredients: 222,
  pokemon_identity_evidence: 150,
});

function countFull75Operations(payload) {
  const operations = Array.isArray(payload?.operations) ? payload.operations : [];
  return {
    total: operations.length,
    pokemon_upsert: operations.filter((op) => op.entity === 'pokemon' && op.action === 'upsert').length,
    pokemon_archive: operations.filter((op) => op.entity === 'pokemon' && op.action === 'archive').length,
    pokemon_subskills: operations.filter((op) => op.entity === 'pokemon_subskills').length,
    pokemon_ingredients: operations.filter((op) => op.entity === 'pokemon_ingredients').length,
    pokemon_identity_evidence: operations.filter((op) => op.entity === 'pokemon_identity_evidence').length,
  };
}

function validateFull75Contract(payload) {
  const updateId = String(payload?.update_id || '');
  if (!/FULL75/i.test(updateId) && payload?.metadata?.pokemon_count !== 75) {
    throw new Error('此工作台僅接受 FULL75 完整能力更新包。');
  }
  const actual = countFull75Operations(payload);
  const mismatches = Object.entries(EXPECTED_FULL75_COUNTS)
    .filter(([key, expected]) => actual[key] !== expected)
    .map(([key, expected]) => `${key} 預期 ${expected}、實際 ${actual[key]}`);
  if (mismatches.length) throw new Error(`FULL75 契約不符：${mismatches.join('；')}`);
  return actual;
}

export { EXPECTED_FULL75_COUNTS, countFull75Operations, validateFull75Contract };
