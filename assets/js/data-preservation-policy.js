export const DATA_PRESERVATION_POLICY_VERSION='data-preservation-policy-2026-08-11-a';
export const MASTER_FIELD_PRECEDENCE_POLICY_VERSION='master-field-precedence-2026-09-02-a';

export const POKEMON_CANDY_PUBLIC_COMPLETENESS_ATTESTATION=Object.freeze({
  status:'NOT_ATTESTED',
  pokemon_name_zh_tw_complete:false,
  candy_name_zh_tw_complete:false,
  public_primary_allowed:false,
  reason:'Public zh-TW Pokémon/Candy name completeness has not been proven with a versioned full-coverage authority manifest.',
});

const LOCAL_FIRST_SUPPLEMENT_FIELDS=Object.freeze([
  'pokemon_name','pokemon_name_zh_tw','pokemon_species_name','pokemon_species_name_zh_tw',
  'candy_name','candy_name_zh_tw',
]);
const PUBLIC_FIRST_REFERENCE_FIELDS=Object.freeze([
  'berry_name','berry_name_zh_tw',
  'recipe_name','recipe_name_zh_tw','recipe_ingredients','recipe_formula',
  'ingredient_name','ingredient_name_zh_tw',
  'camp_name','camp_name_zh_tw',
  'skill_name','skill_name_zh_tw',
  'nature_name','nature_name_zh_tw',
]);
const LOCAL_OBSERVED_ONLY_FIELDS=Object.freeze([
  'quantity','inventory_quantity','observed_quantity','observed_count',
  'visible_target_count','confirmed_visible_target_count',
  'level','energy','unlocked','discovered','favorite','nickname',
]);

export function isObservedWriteValue(value){
  if(value===null||value===undefined)return false;
  if(typeof value==='string'&&value.trim()==='')return false;
  return true;
}

function comparable(value){
  if(typeof value==='string')return value.trim().normalize('NFKC');
  try{return JSON.stringify(value);}catch{return String(value);}
}

export function classifyMasterFieldAuthority(field){
  const key=String(field??'').trim();
  if(LOCAL_FIRST_SUPPLEMENT_FIELDS.includes(key))return 'LOCAL_PRIMARY_PUBLIC_SUPPLEMENT';
  if(PUBLIC_FIRST_REFERENCE_FIELDS.includes(key))return 'PUBLIC_PRIMARY_LOCAL_FALLBACK';
  if(LOCAL_OBSERVED_ONLY_FIELDS.includes(key))return 'LOCAL_OBSERVED_ONLY';
  return 'UNCLASSIFIED_REVIEW_REQUIRED';
}

export function resolveMasterFieldAuthority({field,localValue,publicValue}={}){
  const authority=classifyMasterFieldAuthority(field);
  const hasLocal=isObservedWriteValue(localValue),hasPublic=isObservedWriteValue(publicValue);
  const same=hasLocal&&hasPublic&&comparable(localValue)===comparable(publicValue);
  if(authority==='LOCAL_PRIMARY_PUBLIC_SUPPLEMENT'){
    if(hasLocal)return Object.freeze({
      authority,decision:hasPublic?(same?'LOCAL_PRIMARY_PUBLIC_CORROBORATED':'LOCAL_PRIMARY_PUBLIC_CONFLICT_PRESERVED'):'LOCAL_PRIMARY_PUBLIC_MISSING',
      effective:localValue,local_present:true,public_present:hasPublic,conflict:hasPublic&&!same,review_required:hasPublic&&!same,
      public_overwrite_allowed:false,auto_resolution:true,
    });
    if(hasPublic)return Object.freeze({
      authority,decision:'PUBLIC_SUPPLEMENT_FILLED_LOCAL_GAP',effective:publicValue,local_present:false,public_present:true,conflict:false,review_required:false,
      public_overwrite_allowed:false,auto_resolution:true,
    });
    return Object.freeze({authority,decision:'NO_VALUE',effective:localValue,local_present:false,public_present:false,conflict:false,review_required:false,public_overwrite_allowed:false,auto_resolution:true});
  }
  if(authority==='PUBLIC_PRIMARY_LOCAL_FALLBACK'){
    if(hasPublic)return Object.freeze({
      authority,decision:hasLocal?(same?'PUBLIC_PRIMARY_LOCAL_CORROBORATED':'PUBLIC_PRIMARY_REPLACED_LOCAL_REFERENCE'):'PUBLIC_PRIMARY_FILLED_LOCAL_GAP',
      effective:publicValue,local_present:hasLocal,public_present:true,conflict:hasLocal&&!same,review_required:false,
      public_overwrite_allowed:true,auto_resolution:true,
    });
    if(hasLocal)return Object.freeze({
      authority,decision:'LOCAL_FALLBACK_PUBLIC_MISSING',effective:localValue,local_present:true,public_present:false,conflict:false,review_required:false,
      public_overwrite_allowed:false,auto_resolution:true,
    });
    return Object.freeze({authority,decision:'NO_VALUE',effective:localValue,local_present:false,public_present:false,conflict:false,review_required:false,public_overwrite_allowed:false,auto_resolution:true});
  }
  if(authority==='LOCAL_OBSERVED_ONLY'){
    return Object.freeze({
      authority,decision:hasLocal?'LOCAL_OBSERVATION_PRESERVED':'LOCAL_OBSERVATION_MISSING',effective:hasLocal?localValue:null,
      local_present:hasLocal,public_present:hasPublic,conflict:false,review_required:false,public_overwrite_allowed:false,auto_resolution:true,
    });
  }
  return Object.freeze({
    authority,decision:'UNCLASSIFIED_FIELD_REVIEW_REQUIRED',effective:hasLocal?localValue:null,
    local_present:hasLocal,public_present:hasPublic,conflict:false,review_required:true,public_overwrite_allowed:false,auto_resolution:false,
  });
}

export function buildSparseObservedPatch(source={},clearFields=[]){
  const clear=new Set(Array.isArray(clearFields)?clearFields:[]);
  const result={};
  for(const [field,value] of Object.entries(source||{})){
    if(isObservedWriteValue(value))result[field]=value;
    else if(clear.has(field))result[field]=null;
  }
  for(const field of clear){
    if(!Object.prototype.hasOwnProperty.call(source||{},field))result[field]=null;
  }
  return result;
}

export function classifyObservedFieldWrite({existing,incoming,hasIncoming=true,explicitClear=false}={}){
  if(explicitClear&&!isObservedWriteValue(incoming))return Object.freeze({decision:'explicit_clear',effective:null});
  if(!hasIncoming||!isObservedWriteValue(incoming)){
    const hadExisting=isObservedWriteValue(existing);
    return Object.freeze({decision:hadExisting?'preserve_existing_empty_incoming':'ignore_empty_incoming',effective:existing});
  }
  if(Object.is(existing,incoming)||(typeof existing==='number'&&typeof incoming==='boolean'&&existing===Number(incoming))){
    return Object.freeze({decision:'same_value',effective:existing});
  }
  return Object.freeze({decision:isObservedWriteValue(existing)?'update_non_empty':'insert_non_empty',effective:incoming});
}
