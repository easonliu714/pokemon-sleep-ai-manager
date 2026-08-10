import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/js/shared-knowledge-ui.js','utf8');
for(const token of [
  "from './weekly-context-store.js'",
  'currentWeeklyContext()',
  'const personalWeekly=weeklyRecommendations(personal,week)',
  'referenceWeekly=weeklyRecommendations(reference,week)',
  "{label:'本週',render:r=>personalWeekly.has(r.recipe_id)?'<b>推薦</b>':'—'}",
  "r=>personalWeekly.has(r.recipe_id)?'weekly-recommended':''",
  'normalizeDishCategory',
  'recipeWeeklyAuthoritySummary',
]) assert.ok(source.includes(token),`missing personal weekly recommendation contract: ${token}`);

assert.equal(source.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false,'recipe recommendations must use resolved Current Weekly Context, not latest-updated row');
assert.equal(source.includes("const weekly=weeklyRecommendations(reference)"),false,'legacy reference-only weekly recommendation must be removed');
console.log('PASS personal weekly recommendation regression: current-week authority + canonical category');
