export const PUBLIC_CATALOG_STARTUP_AUTHORITY_VERSION='public-catalog-startup-authority-2026-09-02-b-v0427553';
export const PUBLIC_CATALOG_AUTHORITY_KEYS=Object.freeze(['shared','recipes','items','candy','canonical','pokemon_knowledge']);
export const PUBLIC_CATALOG_FINGERPRINT_STORAGE_KEY='pokemon_sleep_public_catalog_fingerprint_v1';

export function canonicalPublicCatalogFingerprint(values={}){
  return PUBLIC_CATALOG_AUTHORITY_KEYS.map(key=>`${key}=${encodeURIComponent(String(values?.[key]??'MISSING'))}`).join('|');
}

export function evaluatePublicCatalogVersionAuthority(publicMaster={}){
  const expected=publicMaster?.expected||{};
  const applied=publicMaster?.applied||{};
  const expectedComplete=PUBLIC_CATALOG_AUTHORITY_KEYS.every(key=>expected[key]!=null&&String(expected[key]).length>0);
  const exact=expectedComplete&&PUBLIC_CATALOG_AUTHORITY_KEYS.every(key=>String(applied[key]??'')===String(expected[key]??''));
  return Object.freeze({
    exact,
    expected_complete:expectedComplete,
    fingerprint:canonicalPublicCatalogFingerprint(expected),
    applied_fingerprint:canonicalPublicCatalogFingerprint(applied),
    expected:{...expected},
    applied:{...applied},
    updated:Boolean(publicMaster?.updated),
    updated_authorities:Object.freeze([...(publicMaster?.updated_authorities||[])]),
  });
}

export function readPersistedPublicCatalogFingerprint(storage=globalThis.localStorage){
  try{
    const value=JSON.parse(storage?.getItem?.(PUBLIC_CATALOG_FINGERPRINT_STORAGE_KEY)||'null');
    if(!value||typeof value!=='object'||typeof value.fingerprint!=='string'||!value.fingerprint)return null;
    return Object.freeze({fingerprint:value.fingerprint,verified_at:value.verified_at||null,authority_version:value.authority_version||null});
  }catch{return null;}
}

export function persistPublicCatalogFingerprint(fingerprint,storage=globalThis.localStorage){
  if(!fingerprint)throw new Error('public_catalog_fingerprint_required');
  const metadata=Object.freeze({fingerprint,verified_at:new Date().toISOString(),authority_version:PUBLIC_CATALOG_STARTUP_AUTHORITY_VERSION});
  storage?.setItem?.(PUBLIC_CATALOG_FINGERPRINT_STORAGE_KEY,JSON.stringify(metadata));
  return metadata;
}

export function decidePublicCatalogStartup({authority,integrity_ok=false,persisted=readPersistedPublicCatalogFingerprint()}={}){
  if(!authority?.expected_complete||!authority?.exact||!integrity_ok){
    return Object.freeze({action:'HYDRATE_REQUIRED',reason:!authority?.expected_complete?'EXPECTED_AUTHORITY_INCOMPLETE':!authority?.exact?'DATABASE_AUTHORITY_MISMATCH':'INTEGRITY_SENTINEL_FAILED',fingerprint:authority?.fingerprint||null});
  }
  if(!authority.updated&&persisted?.fingerprint===authority.fingerprint){
    return Object.freeze({action:'VERSION_MATCH_BYPASS',reason:'RELEASE_LOCAL_FINGERPRINT_EXACT',fingerprint:authority.fingerprint});
  }
  return Object.freeze({action:'HYDRATE_REQUIRED',reason:authority.updated?'DATABASE_RECONCILED_THIS_BOOT':persisted?.fingerprint?'PERSISTED_FINGERPRINT_MISMATCH':'PERSISTED_FINGERPRINT_MISSING',fingerprint:authority.fingerprint});
}

export function publicCatalogProjectionViewForLocalEntity(entity){
  const mapping=Object.freeze({ingredient_inventory:'ingredients',item_inventory:'items',recipes:'recipes',recipe_status:'recipes'});
  return mapping[String(entity||'')]||null;
}

export function shouldInvalidatePublicCatalogFingerprint(detail={}){
  return detail?.public_master_changed===true||detail?.public_authority_changed===true;
}

export function canBypassPublicCatalogHydration({authority,integrity_ok=false,persisted=readPersistedPublicCatalogFingerprint()}={}){
  return decidePublicCatalogStartup({authority,integrity_ok,persisted}).action==='VERSION_MATCH_BYPASS';
}
