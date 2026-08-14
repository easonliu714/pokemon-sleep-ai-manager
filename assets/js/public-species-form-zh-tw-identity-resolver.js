import {
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_POLICY,
  currentPublicSpeciesFormZhTwIdentityRows,
} from './public-species-form-zh-tw-identity.js';
import {equivalentCandidateSetAcrossSourceKeys} from './public-species-ingredient-candidate-authority.js';

export const PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RESOLVER_VERSION='public-species-form-zh-tw-identity-resolver-2026-08-15-a';
export const PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RESOLVER_POLICY=Object.freeze({
  ...PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_POLICY,
  lookup_normalization:'NFKC_TRIM_ONLY',
  canonical_display_text_preserved:true,
  normalization_is_fuzzy_match:false,
});

const normalizeLookup=value=>String(value??'').normalize('NFKC').trim();
const rows=currentPublicSpeciesFormZhTwIdentityRows();
const INDEX=new Map();
for(const row of rows){
  const key=normalizeLookup(row.display_name_zh_tw);
  if(INDEX.has(key))throw new Error(`public_species_form_zh_tw_normalized_identity_collision:${key}`);
  INDEX.set(key,row);
}

export function resolvePublicSpeciesFormSourceKeys(displayName){
  const observed=String(displayName??'').trim();
  const lookup=normalizeLookup(displayName);
  if(!lookup)return Object.freeze({status:'REVIEW_REQUIRED',reason:'SPECIES_DISPLAY_NAME_MISSING',observed_name:observed,source_keys:null});
  const row=INDEX.get(lookup);
  if(!row)return Object.freeze({status:'REVIEW_REQUIRED',reason:'SPECIES_DISPLAY_NAME_NOT_IN_EXACT_PUBLIC_IDENTITY',observed_name:observed,source_keys:null,fuzzy_auto_match:false});
  return Object.freeze({
    status:'MATCH',
    reason:row.source_keys.length===1?'EXACT_PUBLIC_SPECIES_FORM_IDENTITY':'EXACT_DISPLAY_NAME_EQUIVALENT_SOURCE_KEYS',
    observed_name:observed,
    canonical_display_name_zh_tw:row.display_name_zh_tw,
    source_keys:row.source_keys,
    pokedex_number:row.pokedex_number,
    identity_kind:row.identity_kind,
    lookup_normalization:'NFKC_TRIM_ONLY',
    fuzzy_auto_match:false,
    player_species_generated:false,
  });
}

export function publicSpeciesIngredientCandidatesForObservedName(displayName,unlockLevel){
  const identity=resolvePublicSpeciesFormSourceKeys(displayName);
  if(identity.status!=='MATCH')return Object.freeze({status:'REVIEW_REQUIRED',reason:identity.reason,identity,candidates:null});
  const candidateSet=equivalentCandidateSetAcrossSourceKeys(identity.source_keys,unlockLevel);
  if(candidateSet.status!=='MATCHABLE_EQUIVALENT_FORM_SET')return Object.freeze({status:'REVIEW_REQUIRED',reason:candidateSet.reason,identity,candidates:null});
  return Object.freeze({
    status:'MATCHABLE_PUBLIC_CANDIDATES',identity,unlock_level:Number(unlockLevel),candidates:candidateSet.candidates,
    player_ingredient_generated:false,ingredient_probability_authority:false,production_slot_distribution_authority:false,
  });
}

if(INDEX.size!==237)throw new Error(`public_species_form_zh_tw_normalized_identity_expected_237_got_${INDEX.size}`);
