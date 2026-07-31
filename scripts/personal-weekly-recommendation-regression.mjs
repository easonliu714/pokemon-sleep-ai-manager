import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/js/shared-knowledge-ui.js','utf8');
for(const token of [
  'const personalWeekly=weeklyRecommendations(personal)',
  "{label:'本週',render:r=>personalWeekly.has(r.recipe_id)?'<b>推薦</b>':'—'}",
  "r=>personalWeekly.has(r.recipe_id)?'weekly-recommended':''",
  "replaceAll('/','／')",
  "const pool=category?analysis.filter(r=>normalizeCategory(r.category)===category):[]",
]) assert.ok(source.includes(token),`missing personal weekly recommendation contract: ${token}`);

assert.ok(!source.includes("const weekly=weeklyRecommendations(reference)"),'legacy reference-only weekly recommendation must be removed');
console.log('PASS personal weekly recommendation regression');
