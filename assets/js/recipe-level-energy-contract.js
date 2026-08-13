import {PUBLIC_RECIPE_MASTER} from './public-recipe-canonical-authority.js';

export const RECIPE_LEVEL_ENERGY_CONTRACT_VERSION='recipe-level-energy-contract-2026-08-13-a';
export const RECIPE_LEVEL_MAX=70;

// Pokémon Sleep uses one common recipe-level bonus table for all registered recipes.
// The recipe screen strength is calculated as:
//   level1_energy + ROUND_HALF_EVEN(level1_energy * level_bonus_percent / 100)
// ROUND_HALF_EVEN is required to reproduce observed in-game .5 boundary cases.
export const RECIPE_LEVEL_BONUS_PERCENT=Object.freeze([
  0,
  2,4,6,8,9,11,13,16,18,19,21,23,24,26,28,30,31,33,35,
  37,40,42,45,47,50,52,55,58,61,64,67,70,74,77,81,84,88,92,96,
  100,104,108,113,117,122,127,132,137,142,148,153,159,165,171,177,183,190,197,203,
  209,215,221,227,234,239,243,248,252,258,
]);

export const RECIPE_LEVEL_ENERGY_EVIDENCE=Object.freeze({
  contract_version:RECIPE_LEVEL_ENERGY_CONTRACT_VERSION,
  max_recipe_level:RECIPE_LEVEL_MAX,
  level_bonus_count:RECIPE_LEVEL_BONUS_PERCENT.length,
  max_level_bonus_percent:258,
  official_cap_source:'Pokémon Sleep official Ver.3.6.0 update: recipe level 65→70',
  level_table_crosscheck:'Pokémon Sleep 攻略・検証 Wiki recipe-level bonus table, checked 2026-08-13',
  exact_value_crosscheck:'current in-game recipe screenshots + Game8 per-recipe level tables, checked 2026-08-13',
});

function integerOrNull(value){
  const parsed=Number(value);
  return Number.isInteger(parsed)?parsed:null;
}

export function roundHalfEven(value){
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  const sign=number<0?-1:1;
  const abs=Math.abs(number);
  const floor=Math.floor(abs);
  const fraction=abs-floor;
  const epsilon=1e-10;
  let rounded;
  if(fraction>0.5+epsilon)rounded=floor+1;
  else if(fraction<0.5-epsilon)rounded=floor;
  else rounded=floor%2===0?floor:floor+1;
  return sign*rounded;
}

export function recipeLevelBonusPercent(level){
  const parsed=integerOrNull(level);
  if(parsed===null||parsed<1||parsed>RECIPE_LEVEL_MAX)return null;
  return RECIPE_LEVEL_BONUS_PERCENT[parsed-1];
}

export function calculateRecipeEnergyAtLevel(level1Energy,level){
  const base=integerOrNull(level1Energy);
  const bonusPercent=recipeLevelBonusPercent(level);
  if(base===null||base<0||bonusPercent===null)return null;
  const bonusEnergy=roundHalfEven(base*bonusPercent/100);
  if(bonusEnergy===null)return null;
  return base+bonusEnergy;
}

const recipeById=new Map(PUBLIC_RECIPE_MASTER.map(recipe=>[String(recipe.recipe_id),recipe]));

export function calculateRecipeEnergyById(recipeId,level){
  const recipe=recipeById.get(String(recipeId??''));
  if(!recipe)return null;
  return calculateRecipeEnergyAtLevel(recipe.level1_energy??recipe.base_energy,level);
}

export function buildRecipeLevelEnergyTable(recipeId){
  const recipe=recipeById.get(String(recipeId??''));
  if(!recipe)return null;
  const level1Energy=integerOrNull(recipe.level1_energy??recipe.base_energy);
  if(level1Energy===null)return null;
  return Object.freeze(Array.from({length:RECIPE_LEVEL_MAX},(_,index)=>{
    const level=index+1;
    return Object.freeze({
      level,
      bonus_percent:RECIPE_LEVEL_BONUS_PERCENT[index],
      energy:calculateRecipeEnergyAtLevel(level1Energy,level),
    });
  }));
}
