export const DATA_VERSION='PUBLIC-EMPTY-PROFILE-20260804';

// Public GitHub Pages deployments must never contain or preload a user's
// Pokémon roster, inventory quantities, nicknames, ratings, or recommendations.
// Official/versioned game master data belongs in dedicated canonical master
// tables; personal account data must arrive only through local user actions.
export const CORE_POKEMON=Object.freeze([]);
export const CORE_ITEMS=Object.freeze([]);

export function applyG2ASeed(){
  return false;
}
