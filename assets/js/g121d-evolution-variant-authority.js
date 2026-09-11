const text=value=>String(value??'').normalize('NFKC').trim();

const CAPTAIN_SPECIES_LABELS=new Set([
  '皮卡丘（船長）',
  '皮卡丘(船長)',
  'Pikachu (Captain)',
  'Pikachu（Captain）',
]);

const CAPTAIN_NICKNAME_MARKERS=new Set(['船長','Captain']);
const ORDINARY_PIKACHU_LABELS=new Set(['皮卡丘','Pikachu']);

/**
 * Fail-closed authority for special/costume evolution routing.
 * Only exact Captain identity markers are blocked here; generic parentheses
 * and arbitrary nicknames are intentionally not treated as variant evidence.
 */
export function evaluateG121DEvolutionVariantRouteAuthority(pokemon={}){
  const currentSpecies=text(pokemon.current_species||pokemon.species);
  const species=text(pokemon.species);
  const originalLabel=text(pokemon.original_label);
  const nickname=text(pokemon.nickname);

  const exactIdentity=[
    ['original_label',originalLabel],
    ['current_species',currentSpecies],
    ['species',species],
  ].find(([,value])=>CAPTAIN_SPECIES_LABELS.has(value));

  if(exactIdentity){
    return Object.freeze({
      allowed:false,
      reason:'VARIANT_SPECIFIC_EVOLUTION_ROUTE_AUTHORITY_REQUIRED',
      variant:'PIKACHU_CAPTAIN',
      identity_source:exactIdentity[0],
      identity_value:exactIdentity[1],
      ordinary_species_route_forbidden:true,
    });
  }

  if(ORDINARY_PIKACHU_LABELS.has(currentSpecies)&&CAPTAIN_NICKNAME_MARKERS.has(nickname)){
    return Object.freeze({
      allowed:false,
      reason:'VARIANT_SPECIFIC_EVOLUTION_ROUTE_AUTHORITY_REQUIRED',
      variant:'PIKACHU_CAPTAIN',
      identity_source:'nickname_exact_marker',
      identity_value:nickname,
      ordinary_species_route_forbidden:true,
    });
  }

  return Object.freeze({
    allowed:true,
    reason:'NO_GOVERNED_VARIANT_EXCLUSION',
    variant:null,
    identity_source:null,
    identity_value:null,
    ordinary_species_route_forbidden:false,
  });
}
