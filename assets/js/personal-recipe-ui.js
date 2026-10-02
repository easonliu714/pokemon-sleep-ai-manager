export const PERSONAL_RECIPE_UI_VERSION='g51-personal-recipe-ui-retired-2026-10-01-a';
export const PERSONAL_RECIPE_UI_RETIRED=true;

export function retirePersonalRecipeUi(){
  const root=globalThis.document?.getElementById?.('g51PersonalRecipeRoot')||null;
  root?.remove?.();
  return null;
}

// Compatibility export for any stale consumer that still imports this module.
// The retired module must never recreate player_manual recipe CRUD.
export function setupPersonalRecipeUi(){
  return retirePersonalRecipeUi();
}

setupPersonalRecipeUi();
globalThis.addEventListener?.('pokemon-sleep:database-ready',retirePersonalRecipeUi);
globalThis.addEventListener?.('pokemon-sleep-data-refreshed',retirePersonalRecipeUi);
