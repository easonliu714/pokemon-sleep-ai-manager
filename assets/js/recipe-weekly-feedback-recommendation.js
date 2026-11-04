import {applyRecipeAttemptFeedback} from './recipe-attempt-feedback.js';
import {analyzeIngredientGaps,sortGapResults} from './ingredient-gap-engine.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';

// G6.2: legacy weekly badges have no "source under review" label.
// Unlike the unified workbench, never silently badge paused OR suspect references.
// This is a read-only projection: player feedback, inventory and public authority are unchanged.
export function weeklyRecipeRecommendationNames(analysis=[],category='',feedbackRows=[]){
  const normalized=normalizeDishCategory(category);
  if(!normalized)return new Set();
  const eligible=applyRecipeAttemptFeedback(analysis,feedbackRows).filter(row=>
    normalizeDishCategory(row.category)===normalized
    &&row.recommendation_paused!==true
    &&row.reference_maybe_wrong!==true);
  return new Set(sortGapResults(eligible,'shortage').slice(0,3)
    .map(row=>String(row.recipe_name||'').trim()).filter(Boolean));
}
