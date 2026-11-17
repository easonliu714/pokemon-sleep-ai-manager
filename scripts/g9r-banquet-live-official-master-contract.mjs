// G9R November 2026: negative-first contract for official, already-live public
// event and ingredient data. Read-only: never touches player SQLite or AI candidates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  validatePublicEventManifest,validatePublicEventPayload,resolvePublicEventProjection
} from '../assets/js/public-event-master-contract.js';
import {PUBLIC_INGREDIENT_NAMES,MASTER_DATA_VERSION} from '../assets/js/shared-master-data.js';
import {inspectIngredientIdentity} from '../assets/js/public-ingredient-identity.js';
import {
  resolvePublicPokemonSpeciesAuthority,publicPokemonNamesForLegacyCandyProjection
} from '../assets/js/public-pokemon-species-authority.js';

const officialEvent='https://www.pokemonsleep.net/zh/news/343537333535313639333033313031343531/';
const officialIngredient='https://www.pokemonsleep.net/zh/news/343535303736323034303630333434333236/';
const raw=readFileSync('assets/data/public-event-master.json','utf8');
const manifest=validatePublicEventManifest(JSON.parse(readFileSync('assets/data/public-event-master-manifest.json','utf8')));
const hash=createHash('sha256').update(raw,'utf8').digest('hex');
assert.equal(hash,manifest.payload_sha256,'G9R_MANIFEST_SHA_MUST_BIND_PUBLISHED_BYTES');
const payload=validatePublicEventPayload(JSON.parse(raw),{expectedVersion:manifest.master_version});
assert.equal(payload.events.length,7,'G9R_NOV16_BANQUET_APPEND_ONLY_EVENT_SEVEN');
assert.ok(payload.events.slice(0,6).every(x=>x.event_id!=='banquet_week_vol1_2026_11'),
  'G9R_HISTORIC_SIX_NEVER_OVERWRITTEN');
const current=payload.events[6];
assert.equal(current.event_id,'banquet_week_vol1_2026_11');
// Public Event contract canonicalizes NFKC punctuation (！→ !).
assert.equal(current.title,'來什麼都吃光光！大餐週vol.1'.normalize('NFKC'));
assert.equal(current.start_at,'2026-11-16T04:00:00+08:00');
assert.equal(current.end_at,'2026-11-23T04:00:00+08:00');
assert.deepEqual([...current.camp_scope],['*']);
assert.equal(current.source.source_ref,officialEvent);
assert.equal(current.authority_status,'PARTIAL_VERIFIED');
assert.equal(current.field_provenance?.event_effects?.deterministic_authority,false);
assert.equal(current.effects.recipe_final_energy_multiplier,undefined,
  'G9R_CONDITIONAL_NUT_RECIPE_1_5_MUST_NOT_BECOME_GLOBAL_RECIPE_1_5');
assert.equal(current.effects.ingredient_help_quantity_bonus,undefined,
  'G9R_INGREDIENT_SPECIALTY_BONUS_MUST_NOT_BECOME_GLOBAL');
for(const phrase of ['一口堅果','鍋子容量','木棉球','風妖精','39','121','91']){
  assert.ok(current.limited_mechanics.some(s=>String(s).includes(phrase)),
    'G9R_MISSING_OFFICIAL_BANQUET_FACT:'+phrase);
}
const day=resolvePublicEventProjection(payload,{date:'2026-11-17T12:00:00+08:00',camp:'萌綠之島'});
assert.ok(day.active_events.some(x=>x.event_id===current.event_id),
  'G9R_TODAY_NOV17_MUST_DISPLAY_OFFICIAL_BANQUET');
assert.equal(day.event_effects.recipe_final_energy_multiplier,undefined,
  'G9R_NOV17_CONDITIONAL_RECIPE_EFFECT_MUST_NOT_BE_GLOBAL');
const outside=resolvePublicEventProjection(payload,{date:'2026-11-23T04:00:00+08:00',camp:'萌綠之島'});
assert.ok(!outside.active_events.some(x=>x.event_id===current.event_id),
  'G9R_NEXT_MONDAY_4AM_EXCLUSIVE_BOUNDARY');
assert.ok(PUBLIC_INGREDIENT_NAMES.includes('一口堅果'),'G9R_OFFICIAL_NUT_PUBLIC_NAME_MISSING');
const nut=inspectIngredientIdentity('一口堅果');
assert.equal(nut.status,'MATCH','G9R_NUT_CANONICAL_IDENTITY_MISSING');
assert.equal(nut.canonical_name,'一口堅果');
assert.ok(MASTER_DATA_VERSION.includes('2026-11'),'G9R_SHARED_PUBLIC_MASTER_VERSION_MUST_MOVE');
for(const [name,key] of [['木棉球','COTTONEE'],['風妖精','WHIMSICOTT']]){
  const resolved=resolvePublicPokemonSpeciesAuthority(name);
  assert.equal(resolved.status,'MATCH','G9R_OFFICIAL_NOV2026_SPECIES_NOT_RECOGNIZED:'+name);
  assert.equal(resolved.source_ref,'https://www.pokemonsleep.net/zh/news/343537333535313639323832313239393330/');
  assert.deepEqual([...resolved.source_keys],[key]);
  assert.equal(resolved.appearing_from,'2026-11-16T15:00:00+08:00');
  assert.equal(resolved.player_species_generated,false,'G9R_OFFICIAL_SPECIES_NEVER_CREATE_PLAYER');
  assert.ok(!publicPokemonNamesForLegacyCandyProjection().includes(name),
    'G9R_OFFICIAL_SPECIES_MUST_NOT_CREATE_UNVERIFIED_CANDY_FAMILY:'+name);
}
assert.equal(officialIngredient,'https://www.pokemonsleep.net/zh/news/343535303736323034303630333434333236/');
console.log('PASS G9R_NOV2026_OFFICIAL_BANQUET_ACTIVE_EVENT_NUT_IDENTITY_SHA_HISTORY_FAILCLOSED');
