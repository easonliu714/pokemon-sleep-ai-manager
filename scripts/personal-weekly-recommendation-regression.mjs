import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const shared=read('assets/js/shared-knowledge-ui.js');
const unifiedPath='assets/js/recipe-unified-player-workbench.js';

if(fs.existsSync(unifiedPath)){
  const unified=read(unifiedPath);
  for(const token of [
    "from './weekly-context-store.js'",
    'currentWeeklyContext()',
    'normalizeDishCategory',
    'recommendations(data,week)',
    'weekly_recommended',
    'recipeWeeklyAuthoritySummary',
    'lockedRecipeTable',
  ])assert.ok(unified.includes(token),`missing unified weekly recommendation contract: ${token}`);
  assert.equal(shared.includes('personalRecipeAnalysisTable'),false,'v0.4.12 must retire duplicate unlocked recommendation table');
  assert.equal(shared.includes('referenceRecipeTable'),false,'v0.4.12 must retire duplicate locked recommendation table');
  assert.equal(unified.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false,'unified recipe recommendations must use resolved Current Weekly Context');
  console.log('PASS personal weekly recommendation regression: unified recipe workbench + current-week authority');
}else{
  for(const token of [
    "from './weekly-context-store.js'",
    'currentWeeklyContext()',
    'const personalWeekly=weeklyRecommendations(personal,week)',
    'referenceWeekly=weeklyRecommendations(reference,week)',
    "{label:'本週',render:r=>personalWeekly.has(r.recipe_id)?'<b>推薦</b>':'—'}",
    "r=>personalWeekly.has(r.recipe_id)?'weekly-recommended':''",
    'normalizeDishCategory',
    'recipeWeeklyAuthoritySummary',
  ])assert.ok(shared.includes(token),`missing personal weekly recommendation contract: ${token}`);
  assert.equal(shared.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false,'recipe recommendations must use resolved Current Weekly Context, not latest-updated row');
  assert.equal(shared.includes("const weekly=weeklyRecommendations(reference)"),false,'legacy reference-only weekly recommendation must be removed');
  console.log('PASS personal weekly recommendation regression: current-week authority + canonical category');
}
