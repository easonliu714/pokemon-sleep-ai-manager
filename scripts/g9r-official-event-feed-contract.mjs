import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  validatePublicEventManifest,
  validatePublicEventPayload,
  resolvePublicEventProjection,
  nextPublicEventBoundary,
} from '../assets/js/public-event-master-contract.js';

const raw=readFileSync('assets/data/public-event-master.json','utf8');
const manifest=validatePublicEventManifest(JSON.parse(readFileSync('assets/data/public-event-master-manifest.json','utf8')));
const digest=createHash('sha256').update(raw,'utf8').digest('hex');
assert.equal(digest,manifest.payload_sha256,'The published manifest MUST bind every payload byte to SHA-256');
const payload=validatePublicEventPayload(JSON.parse(raw),{expectedVersion:manifest.master_version});
assert.equal(manifest.payload_path,'./assets/data/public-event-master.json');
assert.equal(payload.registry_version,'weekly-event-effect-registry-2026-08-17-b-public-event-master');
assert.equal(payload.events.length,3,'Preserve the original August event and exact two verified October events');
assert.equal(payload.events[0].event_id,'pokemon_horizons_special_collaboration_2026');
assert.equal(payload.events[0].authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(payload.events[0].effects,{});
assert.ok(payload.events[0].field_provenance.event_effects.deterministic_authority===false);

const cooking=payload.events.find(x=>x.event_id==='cooking_week_vol3_2026_10');
const growth=payload.events.find(x=>x.event_id==='growth_week_vol6_2026_10');
assert.ok(cooking&&growth);
const cookingUrl='https://www.pokemonsleep.net/zh/news/343430323735323935393936343737343435/';
const growthUrl='https://www.pokemonsleep.net/zh/news/343430333034343435353738383035323530/';
assert.equal(cooking.source.source_ref,cookingUrl);
assert.equal(growth.source.source_ref,growthUrl);
assert.equal(cooking.authority_status,'PARTIAL_VERIFIED','Not all cooking multipliers have model consumers');
assert.equal(growth.authority_status,'VERIFIED');
assert.deepEqual(cooking.camp_scope,['*']);
assert.deepEqual(growth.camp_scope,['*']);
assert.equal(growth.field_provenance.event_effects.pokemon_candy_multiplier_scope,'FIRST_SLEEP_RESEARCH_OF_DAY_ONLY');
assert.equal(growth.field_provenance.event_effects.not_candy_use_exp,true);
assert.equal(growth.field_provenance.event_effects.deterministic_model_status,'FEATURE_ONLY_NOT_PLAYER_WRITE');
assert.equal(cooking.field_provenance.event_effects.consumer_semantics,'FEATURE_ONLY_AND_VERIFIED_EXISTING_REGISTRY_ONLY');
const at=(s)=>resolvePublicEventProjection(payload,{date:new Date(s),camp:'黃金舊發電廠'});
const before=at('2026-10-05T03:59:59+08:00');
const cookingStart=at('2026-10-05T04:00:00+08:00');
const cookingEnd=at('2026-10-12T03:59:59+08:00');
const growthStart=at('2026-10-12T04:00:00+08:00');
const growthEnd=at('2026-10-19T03:59:59+08:00');
const after=at('2026-10-19T04:00:00+08:00');
assert.equal(before.active_event_count,0);
assert.equal(cookingStart.active_event_count,1);
assert.equal(cookingEnd.active_event_count,1);
assert.equal(cookingStart.strategy_event_effects.recipe_final_energy_multiplier,1.25);
assert.equal(growthStart.active_event_count,1);
assert.equal(growthStart.event_name,'寶可夢快快長大週 vol.6');
assert.equal(growthStart.feature_only_event_effects.sleep_exp_multiplier,1.5);
assert.equal(growthStart.feature_only_event_effects.pokemon_candy_multiplier,1.5);
assert.ok(!Object.hasOwn(growthStart.strategy_event_effects,'sleep_exp_multiplier'));
assert.ok(!Object.hasOwn(growthStart.strategy_event_effects,'pokemon_candy_multiplier'));
assert.equal(growthEnd.active_event_count,1);
assert.equal(after.active_event_count,0);
const next=nextPublicEventBoundary(payload,{date:new Date('2026-10-12T03:59:59+08:00'),camp:'黃金舊發電廠'});
assert.equal(next.at_iso,'2026-10-11T20:00:00.000Z');
for(const event of [cooking,growth]){
  assert.equal(event.source.source_type,'OFFICIAL_ANNOUNCEMENT');
  assert.ok(event.source.source_ref.startsWith('https://www.pokemonsleep.net/zh/news/'));
  assert.equal(event.field_provenance.period.end_exclusive,true);
}
const version=readFileSync('assets/js/version-authority.js','utf8');
assert.ok(version.includes("app_version: 'v0.4.27.55.3.3.21'"),'Data-only release MUST NOT bump app code version');
assert.ok(version.includes("app_build: '20261011-v0427553321-ingredient-review-weekly-bonuses'"));
assert.ok(version.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.21-v0427553321-ingredient-review-weekly-bonuses'"));
console.log('PASS G9R_VERIFIED_OFFICIAL_SOURCES');
console.log('PASS G9R_MANIFEST_PAYLOAD_SHA256');
console.log('PASS G9R_0400_WEEK_BOUNDARIES');
console.log('PASS G9R_FIRST_SLEEP_CANDY_FEATURE_ONLY');
console.log('PASS G9R_NO_PWA_RELEASE_BUMP');
