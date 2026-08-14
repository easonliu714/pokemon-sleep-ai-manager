export const SPECIES_INGREDIENT_RATE_REFERENCE_VERSION='species-ingredient-rate-reference-2026-08-14-a';
export const SPECIES_INGREDIENT_RATE_REFERENCE_STATUS='REFERENCE_ONLY_COMMUNITY_DERIVED';
export const SPECIES_INGREDIENT_RATE_SOURCE_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831';

export const SPECIES_INGREDIENT_RATE_REFERENCE_POLICY=Object.freeze({
  policy_version:'species-ingredient-rate-reference-policy-2026-08-14-a',
  hidden_game_rate_officially_published:false,
  reference_values_may_activate_production_dimension:false,
  infer_from_specialty:false,
  form_identity_required_when_species_is_ambiguous:true,
  missing_is_zero:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
  evidence_class:SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
  sources:Object.freeze([
    Object.freeze({source:'Neroli’s Lab current open-source Pokémon model',commit:SPECIES_INGREDIENT_RATE_SOURCE_COMMIT,license:'Apache-2.0'}),
    Object.freeze({source:'PokeAPI Traditional Chinese species-name mapping',language_id:4}),
    Object.freeze({source:'RaenonX / Pokémon Sleep verification references',role:'cross-check only; hidden rates are not represented as official values'}),
  ]),
});

const row=(source_key,pokedex_number,species_zh_tw,type,percent)=>Object.freeze({
  source_key,pokedex_number,species_zh_tw,type,
  base_ingredient_probability:percent/100,
  base_ingredient_percentage:percent,
  evidence_status:SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
  eligible_for_numeric_activation:false,
  source_commit:SPECIES_INGREDIENT_RATE_SOURCE_COMMIT,
});

// Public anchor rows only. This is intentionally NOT a roster-derived or complete activation master.
// Values mirror the pinned community model and exist to govern identity/form semantics and formula evidence.
export const SPECIES_INGREDIENT_RATE_REFERENCE_ROWS=Object.freeze([
  row('BULBASAUR',1,'妙蛙種子','草',25.7),
  row('VENUSAUR',3,'妙蛙花','草',26.6),
  row('CHARIZARD',6,'噴火龍','火',22.4),
  row('SQUIRTLE',7,'傑尼龜','水',27.1),
  row('CATERPIE',10,'綠毛蟲','蟲',17.9),
  row('PIKACHU',25,'皮卡丘','電',20.7),
  row('VULPIX',37,'六尾','火',16.8),
  row('VULPIX_ALOLAN',37,'六尾','冰',23.0),
  row('CHIKORITA',152,'菊草葉','草',16.9),
]);

const norm=value=>String(value??'').normalize('NFKC').trim();

export function resolveReferenceSpeciesIngredientRate(candidate={}){
  const species=norm(candidate.species??candidate.species_name),type=norm(candidate.type);
  if(!species)return Object.freeze({status:'NOT_RESOLVED',reason:'SPECIES_MISSING',row:null,eligible_for_numeric_activation:false});
  const bySpecies=SPECIES_INGREDIENT_RATE_REFERENCE_ROWS.filter(item=>item.species_zh_tw===species);
  if(!bySpecies.length)return Object.freeze({status:'NOT_RESOLVED',reason:'SPECIES_NOT_IN_REFERENCE_SNAPSHOT',row:null,eligible_for_numeric_activation:false});
  if(bySpecies.length===1){
    const only=bySpecies[0];
    if(type&&only.type!==type)return Object.freeze({status:'REVIEW_REQUIRED',reason:'SPECIES_TYPE_MISMATCH',row:null,eligible_for_numeric_activation:false});
    return Object.freeze({status:'REFERENCE_IDENTIFIED',reason:null,row:only,eligible_for_numeric_activation:false});
  }
  if(!type)return Object.freeze({status:'REVIEW_REQUIRED',reason:'AMBIGUOUS_FORM_TYPE_REQUIRED',row:null,eligible_for_numeric_activation:false});
  const exact=bySpecies.filter(item=>item.type===type);
  if(exact.length!==1)return Object.freeze({status:'REVIEW_REQUIRED',reason:exact.length?'AMBIGUOUS_FORM_MATCH':'FORM_TYPE_NOT_IN_REFERENCE_SNAPSHOT',row:null,eligible_for_numeric_activation:false});
  return Object.freeze({status:'REFERENCE_IDENTIFIED',reason:null,row:exact[0],eligible_for_numeric_activation:false});
}

export function currentSpeciesIngredientRateReference(){
  return Object.freeze({
    version:SPECIES_INGREDIENT_RATE_REFERENCE_VERSION,
    status:SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
    row_count:SPECIES_INGREDIENT_RATE_REFERENCE_ROWS.length,
    complete_catalog:false,
    eligible_for_numeric_activation:false,
    policy:SPECIES_INGREDIENT_RATE_REFERENCE_POLICY,
  });
}
