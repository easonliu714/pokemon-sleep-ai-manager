import {PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER} from './public-pokemon-knowledge-master.js';
import {
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_VERSION,
  currentPublicSpeciesFormZhTwIdentityRows,
} from './public-species-form-zh-tw-identity.js';

export const PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION='public-pokemon-species-authority-2026-08-29-a';
export const PUBLIC_POKEMON_SPECIES_AUTHORITY_STATUS='ACTIVE_GOVERNED_PUBLIC_SPECIES_AUTHORITY';

const OFFICIAL_TINKATINK_NEWS='https://www.pokemonsleep.net/zh/news/333731343735353735333130363438343934/';
const displayText=value=>String(value??'').trim();
const normalizeKey=value=>displayText(value).normalize('NFKC');

export const PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS=Object.freeze([
  Object.freeze({
    display_name_zh_tw:'小鍛匠',
    source_keys:Object.freeze(['TINKATINK']),
    identity_kind:'BASE',
    verification_status:'OFFICIAL_ZH_TW_VERIFIED',
    authority_class:'OFFICIAL_LIVE_RECENCY_ADDITION',
    source_ref:OFFICIAL_TINKATINK_NEWS,
    announced_at:'2026-08-12',
    appearing_from:'2026-08-17T15:00:00+08:00',
  }),
  Object.freeze({
    display_name_zh_tw:'巧鍛匠',
    source_keys:Object.freeze(['TINKATUFF']),
    identity_kind:'BASE',
    verification_status:'OFFICIAL_ZH_TW_VERIFIED',
    authority_class:'OFFICIAL_LIVE_RECENCY_ADDITION',
    source_ref:OFFICIAL_TINKATINK_NEWS,
    announced_at:'2026-08-12',
    appearing_from:'2026-08-17T15:00:00+08:00',
  }),
  Object.freeze({
    display_name_zh_tw:'巨鍛匠',
    source_keys:Object.freeze(['TINKATON']),
    identity_kind:'BASE',
    verification_status:'OFFICIAL_ZH_TW_VERIFIED',
    authority_class:'OFFICIAL_LIVE_RECENCY_ADDITION',
    source_ref:OFFICIAL_TINKATINK_NEWS,
    announced_at:'2026-08-12',
    appearing_from:'2026-08-17T15:00:00+08:00',
  }),
]);

function freezeAuthorityRow(row){
  return Object.freeze({...row,source_keys:Object.freeze([...(row.source_keys||[])])});
}

function buildAuthorityRows(){
  const byName=new Map();
  for(const row of currentPublicSpeciesFormZhTwIdentityRows()){
    const display=displayText(row.display_name_zh_tw);
    const key=normalizeKey(display);
    if(!display||!key)continue;
    if(byName.has(key))throw new Error(`public_pokemon_species_authority_duplicate_identity:${display}`);
    byName.set(key,freezeAuthorityRow({
      display_name_zh_tw:display,
      source_keys:row.source_keys,
      pokedex_number:row.pokedex_number??null,
      identity_kind:row.identity_kind??null,
      verification_status:'PUBLIC_IDENTITY_VERIFIED',
      authority_class:'PINNED_PUBLIC_ZH_TW_IDENTITY',
      source_ref:PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_VERSION,
      announced_at:null,
      appearing_from:null,
    }));
  }
  for(const row of PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS){
    const key=normalizeKey(row.display_name_zh_tw);
    if(byName.has(key))throw new Error(`public_pokemon_species_authority_live_addition_conflicts_with_base:${row.display_name_zh_tw}`);
    byName.set(key,freezeAuthorityRow(row));
  }
  return Object.freeze([...byName.values()].sort((a,b)=>a.display_name_zh_tw.localeCompare(b.display_name_zh_tw,'zh-Hant')));
}

export const PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS=buildAuthorityRows();
const AUTHORITY_INDEX=new Map(PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS.map(row=>[normalizeKey(row.display_name_zh_tw),row]));

export const PUBLIC_POKEMON_SPECIES_AUTHORITY_POLICY=Object.freeze({
  exact_display_name_only:true,
  fuzzy_auto_match:false,
  ai_species_guess:false,
  private_player_data_used:false,
  player_write_authority:false,
  official_live_recency_overlay:true,
  official_live_addition_count:PUBLIC_POKEMON_SPECIES_OFFICIAL_LIVE_ADDITIONS.length,
  candy_family_authority:false,
  candy_display_name_authority:false,
  legacy_candy_projection_compatibility_only:true,
  official_live_additions_auto_project_to_candy:false,
});

export function currentPublicPokemonSpeciesAuthorityRows(){
  return Object.freeze(PUBLIC_POKEMON_SPECIES_AUTHORITY_ROWS.map(row=>freezeAuthorityRow(row)));
}

export function resolvePublicPokemonSpeciesAuthority(displayName){
  const observed=displayText(displayName);
  if(!observed){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'PUBLIC_SPECIES_DISPLAY_NAME_MISSING',
      observed_name:observed,
      source_keys:null,
      player_species_generated:false,
    });
  }
  const row=AUTHORITY_INDEX.get(normalizeKey(observed));
  if(!row){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'PUBLIC_SPECIES_NOT_IN_EXACT_AUTHORITY',
      observed_name:observed,
      source_keys:null,
      fuzzy_auto_match:false,
      player_species_generated:false,
    });
  }
  return Object.freeze({
    status:'MATCH',
    reason:'EXACT_PUBLIC_POKEMON_SPECIES_AUTHORITY',
    observed_name:observed,
    display_name_zh_tw:row.display_name_zh_tw,
    source_keys:row.source_keys,
    verification_status:row.verification_status,
    authority_class:row.authority_class,
    source_ref:row.source_ref,
    appearing_from:row.appearing_from,
    player_species_generated:false,
  });
}

// P0-B2 compatibility boundary: Candy remains on the exact pre-B2 Pokémon-name
// projection until a separate Candy family/display-name authority is verified.
// New official-live species are therefore recognized as Pokémon here but MUST
// NOT silently create `${species}的糖果` rows.
export function publicPokemonNamesForLegacyCandyProjection(){
  const names=new Map();
  const add=value=>{
    const display=displayText(value),key=normalizeKey(value);
    if(display&&key&&!names.has(key))names.set(key,display);
  };
  for(const row of PUBLIC_EVOLUTION_MASTER){add(row.from_species);add(row.to_species);}
  for(const row of PUBLIC_EVOLUTION_STATUS_MASTER)add(row.species_name);
  return [...names.values()].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}
