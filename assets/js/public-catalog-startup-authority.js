export const PUBLIC_CATALOG_STARTUP_AUTHORITY_VERSION='public-catalog-startup-authority-2026-09-02-a-v0427553';
export const PUBLIC_CATALOG_AUTHORITY_KEYS=Object.freeze(['shared','recipes','items','candy','canonical','pokemon_knowledge']);

export function canonicalPublicCatalogFingerprint(values={}){
  return PUBLIC_CATALOG_AUTHORITY_KEYS.map(key=>`${key}=${String(values?.[key]??'MISSING')}`).join('|');
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

export function publicCatalogProjectionViewForLocalEntity(entity){
  const mapping=Object.freeze({
    ingredient_inventory:'ingredients',
    item_inventory:'items',
    recipes:'recipes',
    recipe_status:'recipes',
  });
  return mapping[String(entity||'')]||null;
}

export function shouldInvalidatePublicCatalogFingerprint(detail={}){
  return detail?.public_master_changed===true||detail?.public_authority_changed===true;
}

export function canBypassPublicCatalogHydration({authority,integrity_ok=false}={}){
  return Boolean(authority?.exact&&integrity_ok&&!authority?.updated);
}
