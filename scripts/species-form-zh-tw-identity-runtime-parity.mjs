import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_STATUS,
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_POLICY,
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_SOURCE,
  currentPublicSpeciesFormZhTwIdentityRows,
} from '../assets/js/public-species-form-zh-tw-identity.js';
import {
  PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RESOLVER_POLICY,
  resolvePublicSpeciesFormSourceKeys,
  publicSpeciesIngredientCandidatesForObservedName,
} from '../assets/js/public-species-form-zh-tw-identity-resolver.js';

const artifact=JSON.parse(fs.readFileSync('artifacts/public-species-form-zh-tw-identity-source.json','utf8'));
const runtime=currentPublicSpeciesFormZhTwIdentityRows();
assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_STATUS,'ACTIVE_EXACT_PUBLIC_IDENTITY');
assert.equal(runtime.length,artifact.identities.length);
assert.equal(runtime.length,237);
assert.equal(artifact.source_key_pokedex_mapped_count,242);
assert.equal(artifact.base_identity_count,227);
assert.equal(artifact.form_override_count,10);
assert.deepEqual(artifact.unresolved_base_groups,[]);
assert.deepEqual(artifact.extraction_failures,[]);
assert.deepEqual(artifact.duplicate_identity_names,[]);
assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_SOURCE.pokeapi_commit,artifact.pokeapi_commit);
assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_SOURCE.neroli_commit,artifact.neroli_commit);
for(const flag of ['fuzzy_auto_match','ai_source_key_guess','private_player_data_used','public_identity_may_generate_player_species'])assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_POLICY[flag],false,`unsafe identity policy flag ${flag}`);
assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RESOLVER_POLICY.lookup_normalization,'NFKC_TRIM_ONLY');
assert.equal(PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RESOLVER_POLICY.normalization_is_fuzzy_match,false);

const runtimeByName=new Map(runtime.map(row=>[row.display_name_zh_tw,row]));
const covered=new Set();
for(const source of artifact.identities){
  const actual=runtimeByName.get(source.display_name_zh_tw);
  assert.ok(actual,`runtime identity missing: ${source.display_name_zh_tw}`);
  assert.deepEqual(actual.source_keys,source.source_keys,`source-key identity drift: ${source.display_name_zh_tw}`);
  assert.equal(actual.pokedex_number,source.pokedex_number,`dex drift: ${source.display_name_zh_tw}`);
  assert.equal(actual.identity_kind,source.form_override?'FORM':'BASE',`identity kind drift: ${source.display_name_zh_tw}`);
  const resolved=resolvePublicSpeciesFormSourceKeys(source.display_name_zh_tw);
  assert.equal(resolved.status,'MATCH',`exact resolver failed: ${source.display_name_zh_tw}`);
  assert.deepEqual(resolved.source_keys,source.source_keys);
  assert.equal(resolved.canonical_display_name_zh_tw,source.display_name_zh_tw);
  for(const key of source.source_keys)covered.add(key);
}
assert.equal(covered.size,242,'all governed source keys must be reachable from exact public identity');

assert.equal(resolvePublicSpeciesFormSourceKeys('').status,'REVIEW_REQUIRED');
const typo=resolvePublicSpeciesFormSourceKeys('電竜');
assert.equal(typo.status,'REVIEW_REQUIRED');
assert.equal(typo.reason,'SPECIES_DISPLAY_NAME_NOT_IN_EXACT_PUBLIC_IDENTITY');
assert.equal(typo.fuzzy_auto_match,false);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('六尾').source_keys,['VULPIX']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('六尾（阿羅拉的樣子）').source_keys,['VULPIX_ALOLAN']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('烏波').source_keys,['WOOPER']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('烏波（帕底亞的樣子）').source_keys,['WOOPER_PALDEAN']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('南瓜精').source_keys,['PUMPKABOO_JUMBO','PUMPKABOO_LARGE','PUMPKABOO_MEDIUM','PUMPKABOO_SMALL']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('顫弦蠑螈').source_keys,['TOXTRICITY_AMPED','TOXTRICITY_LOW_KEY']);
// Canonical PokeAPI display text contains full-width Q; NFKC lookup normalization must not reject its own canonical identity.
const mimikyu=resolvePublicSpeciesFormSourceKeys('謎擬Ｑ');
assert.equal(mimikyu.status,'MATCH');
assert.equal(mimikyu.canonical_display_name_zh_tw,'謎擬Ｑ');
assert.deepEqual(mimikyu.source_keys,['MIMIKYU']);
assert.deepEqual(resolvePublicSpeciesFormSourceKeys('謎擬Q').source_keys,['MIMIKYU'],'NFKC-equivalent lookup is not fuzzy matching');

const dratini=publicSpeciesIngredientCandidatesForObservedName('迷你龍',60);
assert.equal(dratini.status,'MATCHABLE_PUBLIC_CANDIDATES');
assert.deepEqual(dratini.candidates,['火辣香草','萌綠玉米','純粹油']);
const pumpkin=publicSpeciesIngredientCandidatesForObservedName('南瓜精',60);
assert.equal(pumpkin.status,'MATCHABLE_PUBLIC_CANDIDATES');
assert.deepEqual(pumpkin.candidates,['沉甸甸南瓜','萌綠大豆','窩心洋芋']);
const unknown=publicSpeciesIngredientCandidatesForObservedName('不存在寶可夢',30);
assert.equal(unknown.status,'REVIEW_REQUIRED');
assert.equal(unknown.candidates,null);

const serviceWorker=fs.readFileSync('service-worker.js','utf8');
for(const asset of [
  './assets/js/public-species-ingredient-candidate-authority.js',
  './assets/js/public-species-form-zh-tw-identity.js',
  './assets/js/public-species-form-zh-tw-identity-resolver.js',
])assert.ok(serviceWorker.includes(`'${asset}'`),`offline authority dependency missing from Service Worker: ${asset}`);

console.log(JSON.stringify({status:'PASS',gate:'PUBLIC_SPECIES_FORM_ZH_TW_IDENTITY_RUNTIME_PARITY',runtime_identity_rows:runtime.length,reachable_source_keys:covered.size,base_identity_count:artifact.base_identity_count,official_sleep_form_override_count:artifact.form_override_count,exact_name_only:true,lookup_normalization:'NFKC_TRIM_ONLY',normalization_is_fuzzy_match:false,canonical_display_text_preserved:true,fuzzy_auto_match:false,ai_source_key_guess:false,private_player_data_used:false,pwa_offline_authority_dependencies:true},null,2));
