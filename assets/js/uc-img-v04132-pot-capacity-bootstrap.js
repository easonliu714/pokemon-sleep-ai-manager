import {UC_IMG_A_SCENARIOS} from './unified-screenshot-update-center.js';

export const UC_IMG_V04132_POT_CAPACITY_BOOTSTRAP_VERSION='uc-img-v04132-pot-capacity-bootstrap-2026-08-12-a';

const recipeEntities=UC_IMG_A_SCENARIOS?.recipes?.entities;
if(Array.isArray(recipeEntities)&&!recipeEntities.includes('account_capacity'))recipeEntities.push('account_capacity');

export function recipeScenarioAcceptsPotCapacity(){
  return Boolean(Array.isArray(recipeEntities)&&recipeEntities.includes('recipes')&&recipeEntities.includes('account_capacity'));
}
