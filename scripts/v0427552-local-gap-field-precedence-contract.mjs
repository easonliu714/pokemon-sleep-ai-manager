import assert from 'node:assert/strict';
import {
  MASTER_FIELD_PRECEDENCE_POLICY_VERSION,
  POKEMON_CANDY_PUBLIC_COMPLETENESS_ATTESTATION,
  classifyMasterFieldAuthority,
  resolveMasterFieldAuthority,
} from '../assets/js/data-preservation-policy.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  PUBLIC_CANDY_LOCAL_ADMISSION_POLICY,
  PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,
  PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,
  commitPublicCandyLocalAdmission,
  localAdmissionCandyIdForSpecies,
  prepareConfirmedMatchedCandyLocalAdmission,
  preparePublicCandyLocalAdmission,
  readPublicCandyLocalAdmissionState,
} from '../assets/js/public-candy-local-admission-authority.js';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  currentPublicCandyDisplayNameAuthorityRows,
  resolvePublicCandyDisplayNameForSpecies,
} from '../assets/js/public-candy-display-name-authority.js';
import {resolvePublicCandyFamilyForSpecies} from '../assets/js/public-candy-family-authority.js';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

class MemoryStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed));}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

const iso='2026-09-02T10:00:00.000Z';
const quaxlyCandyId=localAdmissionCandyIdForSpecies('潤水鴨');
const legacyQuaxlyRow={candy_id:quaxlyCandyId,candy_name:'潤水鴨的糖果',candy_type:'species',target_species_name:'潤水鴨',target_type_name:null,name_rule:'USER_CONFIRMED_EXACT_GAME_SCREENSHOT_CANDY_NAME',verification_status:'USER_CONFIRMED_GAME_SCREENSHOT_LOCAL_ADMISSION',source_type:'user_confirmed_game_screenshot_local_admission',source_name:'User-confirmed Pokémon Sleep in-game screenshot',source_ref:'local-admission:candy-image-001',source_image_ref:'candy-image-001',observation_id:'obs-quaxly',confirmed_at:iso,admission_action:PUBLIC_CANDY_LOCAL_ADMISSION_ACTION};

assert.equal(MASTER_FIELD_PRECEDENCE_POLICY_VERSION,'master-field-precedence-2026-09-02-a');
assert.equal(POKEMON_CANDY_PUBLIC_COMPLETENESS_ATTESTATION.status,'NOT_ATTESTED');
assert.equal(POKEMON_CANDY_PUBLIC_COMPLETENESS_ATTESTATION.public_primary_allowed,false);
assert.equal(classifyMasterFieldAuthority('pokemon_name_zh_tw'),'LOCAL_PRIMARY_PUBLIC_SUPPLEMENT');
assert.equal(classifyMasterFieldAuthority('candy_name_zh_tw'),'LOCAL_PRIMARY_PUBLIC_SUPPLEMENT');
assert.equal(classifyMasterFieldAuthority('berry_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('recipe_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('ingredient_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('camp_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('skill_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('nature_name_zh_tw'),'PUBLIC_PRIMARY_LOCAL_FALLBACK');
assert.equal(classifyMasterFieldAuthority('quantity'),'LOCAL_OBSERVED_ONLY');
const localPokemonConflict=resolveMasterFieldAuthority({field:'pokemon_name_zh_tw',localValue:'本機已確認名稱',publicValue:'公版不同名稱'});assert.equal(localPokemonConflict.effective,'本機已確認名稱');assert.equal(localPokemonConflict.public_overwrite_allowed,false);assert.equal(localPokemonConflict.review_required,true);assert.equal(localPokemonConflict.conflict,true);
const publicCandySupplement=resolveMasterFieldAuthority({field:'candy_name_zh_tw',localValue:null,publicValue:'潤水鴨的糖果'});assert.equal(publicCandySupplement.effective,'潤水鴨的糖果');assert.equal(publicCandySupplement.decision,'PUBLIC_SUPPLEMENT_FILLED_LOCAL_GAP');
const publicRecipe=resolveMasterFieldAuthority({field:'recipe_name_zh_tw',localValue:'舊料理名',publicValue:'公版料理名'});assert.equal(publicRecipe.effective,'公版料理名');assert.equal(publicRecipe.public_overwrite_allowed,true);
const localQuantity=resolveMasterFieldAuthority({field:'quantity',localValue:123,publicValue:0});assert.equal(localQuantity.effective,123);assert.equal(localQuantity.public_overwrite_allowed,false);
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,'public-candy-local-admission-2026-09-02-c');assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.public_species_exact_authority_required,false);assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.public_master_supplemental_for_pokemon_candy_names,true);assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.public_master_may_overwrite_local_pokemon_candy_names,false);assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.player_quantity_stored,false);assert.deepEqual(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.legacy_authority_versions,['public-candy-local-admission-2026-09-01-a','public-candy-local-admission-2026-09-01-b']);
for(const legacyVersion of PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.legacy_authority_versions){const storage=new MemoryStorage({[PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY]:JSON.stringify({schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:legacyVersion,rows:[legacyQuaxlyRow]})});const migrated=readPublicCandyLocalAdmissionState({storage});assert.equal(migrated.authority_version,PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION);assert.equal(migrated.migrated_from_authority_version,legacyVersion);assert.equal(migrated.rows.length,1);assert.equal(migrated.rows[0].candy_name,'潤水鴨的糖果');assert.equal(Object.hasOwn(migrated.rows[0],'quantity'),false);const persisted=JSON.parse(storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));assert.equal(persisted.authority_version,PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION);assert.equal(persisted.rows[0].candy_id,quaxlyCandyId);assert.equal(persisted.rows[0].candy_name,'潤水鴨的糖果');assert.equal(persisted.rows[0].field_precedence_policy_version,MASTER_FIELD_PRECEDENCE_POLICY_VERSION);}
const unsupportedStorage=new MemoryStorage({[PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY]:JSON.stringify({schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:'public-candy-local-admission-future-x',rows:[]})});assert.throws(()=>readPublicCandyLocalAdmissionState({storage:unsupportedStorage}),/schema\/version 不相符/);
const corruptStorage=new MemoryStorage({[PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY]:'{broken-json'});assert.throws(()=>readPublicCandyLocalAdmissionState({storage:corruptStorage}),/JSON 損毀/);
const quantityPollutedStorage=new MemoryStorage({[PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY]:JSON.stringify({schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,rows:[{...legacyQuaxlyRow,authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,quantity:999}]})});assert.throws(()=>readPublicCandyLocalAdmissionState({storage:quantityPollutedStorage}),/禁止包含玩家 quantity/);
const unmatchedUnknown={observation_id:'obs-local-only',status:'UNMATCHED',observed_text:'測試獸的糖果',observed_data:{quantity:7},source_image_ref:'candy-image-099',confidence:0.99};const localOnlyPrepared=preparePublicCandyLocalAdmission({observation:unmatchedUnknown,confirmedAt:iso});assert.equal(localOnlyPrepared.candy_name,'測試獸的糖果');assert.equal(localOnlyPrepared.public_species_resolution_status,'REVIEW_REQUIRED');assert.equal(Object.hasOwn(localOnlyPrepared,'quantity'),false);
const confirmedQuaxly={observation_id:'obs-quaxly-current',status:'MATCHED',observed_text:'潤水鴨的糖果',canonical_name:'潤水鴨的糖果',canonical_key:{candy_id:quaxlyCandyId},observed_data:{quantity:20},source_image_ref:'candy-image-001',confidence:0.99,user_resolution:{action:'USER_CONFIRMED_CANDY_QUANTITY',confirmed_at:iso,confirmed_quantity:20}};const confirmedPrepared=prepareConfirmedMatchedCandyLocalAdmission({observation:confirmedQuaxly});assert.equal(confirmedPrepared.candy_name,'潤水鴨的糖果');assert.equal(confirmedPrepared.target_species_name,'潤水鴨');assert.equal(Object.hasOwn(confirmedPrepared,'quantity'),false);assert.throws(()=>prepareConfirmedMatchedCandyLocalAdmission({observation:{...confirmedQuaxly,canonical_name:'湧躍鴨的糖果'}}),/exact 一致/);assert.throws(()=>prepareConfirmedMatchedCandyLocalAdmission({observation:{...confirmedQuaxly,user_resolution:null}}),/user-confirmed quantity/);
const quaxlyFamily=resolvePublicCandyFamilyForSpecies('潤水鴨'),quaxwellFamily=resolvePublicCandyFamilyForSpecies('湧躍鴨'),quaquavalFamily=resolvePublicCandyFamilyForSpecies('狂歡浪舞鴨');assert.equal(quaxlyFamily.status,'MATCH');assert.equal(quaxwellFamily.status,'MATCH');assert.equal(quaquavalFamily.status,'MATCH');assert.equal(quaxlyFamily.family_id,quaxwellFamily.family_id);assert.equal(quaxlyFamily.family_id,quaquavalFamily.family_id);
const priorLocalStorage=globalThis.localStorage;try{const quaxlyStorage=new MemoryStorage();globalThis.localStorage=quaxlyStorage;const committed=commitPublicCandyLocalAdmission(confirmedPrepared,{storage:quaxlyStorage});assert.equal(committed.status,'CREATED');const quaxlyDisplay=resolvePublicCandyDisplayNameForSpecies('潤水鴨');assert.equal(quaxlyDisplay.status,'MATCH');assert.equal(quaxlyDisplay.candy_display_name,'潤水鴨的糖果');assert.equal(quaxlyDisplay.local_admission_authority,true);assert.equal(quaxlyDisplay.local_evidence_preserved,true);const pikachuStorage=new MemoryStorage();globalThis.localStorage=pikachuStorage;const pikachuPrepared=prepareConfirmedMatchedCandyLocalAdmission({observation:{observation_id:'obs-pikachu',status:'MATCHED',observed_text:'皮卡丘的糖果',canonical_name:'皮卡丘的糖果',canonical_key:{candy_id:localAdmissionCandyIdForSpecies('皮卡丘')},observed_data:{quantity:88},source_image_ref:'candy-image-002',confidence:0.99,user_resolution:{action:'USER_CONFIRMED_CANDY_QUANTITY',confirmed_at:iso,confirmed_quantity:88}}});commitPublicCandyLocalAdmission(pikachuPrepared,{storage:pikachuStorage});const pikachuDisplay=resolvePublicCandyDisplayNameForSpecies('皮卡丘');assert.equal(pikachuDisplay.status,'MATCH');assert.equal(pikachuDisplay.candy_display_name,'皮卡丘的糖果');assert.equal(pikachuDisplay.local_admission_authority,true);assert.equal(pikachuDisplay.public_corroborated,true);globalThis.localStorage=corruptStorage;assert.throws(()=>currentPublicCandyDisplayNameAuthorityRows(),/JSON 損毀/);}finally{if(priorLocalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=priorLocalStorage;}
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,'public-candy-display-name-authority-2026-09-02-f');assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_name_precedes_public_name_while_public_completeness_unattested,true);assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.public_name_may_silently_overwrite_local_name,false);assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_admission_read_failure_silent_drop,false);assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.automatic_display_name_generation,false);assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15);
await import('../assets/js/version-authority.js');
const currentVersion=globalThis.PokemonSleepVersionAuthority?.app_version||'';
const currentBuild=globalThis.PokemonSleepVersionAuthority?.app_build||'';
const currentCache=globalThis.PokemonSleepVersionAuthority?.cache_name||'';
if(currentVersion==='v0.4.27.55.3.3.1'){
  assert.equal(currentBuild,'20260905-v042755331-page-prewarm-collapsible-hydration');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration');
}else if(currentVersion==='v0.4.27.55.3.3'){
  assert.equal(currentBuild,'20260904-v04275533-page-hydration-authority');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority');
}else{
  assert.equal(currentVersion,'v0.4.27.55.3.2');
  assert.equal(currentBuild,'20260903-v04275532-page-aware-static-shell');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.27.55.3.2-v04275532-page-aware-static-shell');
}
console.log(`v0.4.27.55.2 local gap durability / field precedence contract PASS on ${currentVersion} successor`);
