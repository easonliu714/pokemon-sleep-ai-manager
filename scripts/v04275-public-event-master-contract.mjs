import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  PUBLIC_EVENT_AUTHORITY_VERSION,
  PUBLIC_EVENT_MANIFEST_SCHEMA,
  PUBLIC_EVENT_MASTER_SCHEMA,
  nextPublicEventBoundary,
  resolvePublicEventProjection,
  validatePublicEventManifest,
  validatePublicEventPayload,
} from '../assets/js/public-event-master-contract.js';
import {buildEffectiveWeeklyContext,EFFECTIVE_WEEKLY_CONTEXT_VERSION} from '../assets/js/effective-weekly-context.js';
import {PUBLIC_EVENT_MASTER_SCHEMA_MIGRATION_VERSION} from '../assets/js/public-event-master-schema.js';
import {WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,projectWeeklyEventEffects} from '../assets/js/weekly-event-effect-registry.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const json=path=>JSON.parse(read(path));
const sha256=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const source=(name)=>read(`assets/js/${name}`);

const versionSource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const version=sandbox.PokemonSleepVersionAuthority;
assert.equal(version.app_version,'v0.4.27.5');
assert.equal(version.app_build,'20260817-v04275-public-event-master');
assert.equal(version.cache_name,'pokemon-sleep-ai-v0.4.27.5-v04275-public-event-master');
for(const token of [
  "// app_version: 'v0.4.27.4'",
  "// app_build: '20260817-v04274-live-s2-s4-hotfix'",
  "// cache_name: 'pokemon-sleep-ai-v0.4.27.4-v04274-live-s2-s4-hotfix'",
])assert.ok(versionSource.includes(token),`v0.4.27.4 lineage missing ${token}`);

assert.equal(PUBLIC_EVENT_MANIFEST_SCHEMA,'pokemon-sleep-public-event-manifest/1.0');
assert.equal(PUBLIC_EVENT_MASTER_SCHEMA,'pokemon-sleep-public-event-master/1.0');
assert.equal(PUBLIC_EVENT_AUTHORITY_VERSION,'public-event-authority-2026-08-17-a');
assert.equal(PUBLIC_EVENT_MASTER_SCHEMA_MIGRATION_VERSION,14);
assert.equal(EFFECTIVE_WEEKLY_CONTEXT_VERSION,'effective-weekly-context-2026-08-17-a');
assert.equal(WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,'weekly-event-effect-registry-2026-08-17-b-public-event-master');

const manifestRaw=read('assets/data/public-event-master-manifest.json');
const payloadRaw=read('assets/data/public-event-master.json');
const manifest=validatePublicEventManifest(JSON.parse(manifestRaw));
assert.equal(sha256(payloadRaw),manifest.payload_sha256,'Public Event payload SHA-256 must match manifest');
const payload=validatePublicEventPayload(JSON.parse(payloadRaw),{expectedVersion:manifest.master_version});
assert.equal(payload.events.length,1);
assert.equal(payload.events[0].authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(payload.events[0].effects,{});
assert.equal(payload.events[0].field_provenance.event_effects.deterministic_authority,false);

const before=resolvePublicEventProjection(payload,{date:new Date('2026-08-17T03:59:59+08:00'),camp:'萌綠之島'});
const atStart=resolvePublicEventProjection(payload,{date:new Date('2026-08-17T04:00:00+08:00'),camp:'萌綠之島'});
const atEnd=resolvePublicEventProjection(payload,{date:new Date('2026-08-24T04:00:00+08:00'),camp:'萌綠之島'});
assert.equal(before.active_event_count,0);
assert.equal(atStart.active_event_count,1);
assert.equal(atStart.event_authority_status,'PARTIAL_VERIFIED');
assert.equal(Object.keys(atStart.strategy_event_effects).length,0,'initial PARTIAL seed must not fabricate deterministic effects');
assert.equal(atEnd.active_event_count,0,'Public Event periods are half-open');

const officialSource={source_type:'OFFICIAL_ANNOUNCEMENT',source_name:'fixture official',source_ref:'https://example.invalid/official',verified_at:'2026-08-17T00:00:00Z'};
const phasePayload=validatePublicEventPayload({
  schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'fixture-phase-v1',locale:'zh-TW',region:'TW',events:[{
    event_id:'phase_fixture',title:'Phase Fixture',locale:'zh-TW',region:'TW',start_at:'2026-08-17T04:00:00+08:00',end_at:'2026-08-24T04:00:00+08:00',camp_scope:['*'],effects:{recipe_final_energy_multiplier:1.25},authority_status:'VERIFIED',source:officialSource,
    phases:[
      {phase_id:'p1',title:'P1',start_at:'2026-08-17T04:00:00+08:00',end_at:'2026-08-21T04:00:00+08:00',effects:{recipe_final_energy_multiplier:1.5},authority_status:'VERIFIED',source:officialSource},
      {phase_id:'p2',title:'P2',start_at:'2026-08-21T04:00:00+08:00',end_at:'2026-08-24T04:00:00+08:00',effects:{recipe_final_energy_multiplier:2},authority_status:'VERIFIED',source:officialSource},
    ],
  }],
});
const p1=resolvePublicEventProjection(phasePayload,{date:new Date('2026-08-20T12:00:00+08:00'),camp:'萌綠之島'});
const p2=resolvePublicEventProjection(phasePayload,{date:new Date('2026-08-21T04:00:00+08:00'),camp:'萌綠之島'});
assert.equal(p1.strategy_event_effects.recipe_final_energy_multiplier,1.5);
assert.equal(p1.active_events[0].phase_id,'p1');
assert.equal(p2.strategy_event_effects.recipe_final_energy_multiplier,2);
assert.equal(p2.active_events[0].phase_id,'p2');
const phaseBoundary=nextPublicEventBoundary(phasePayload,{date:new Date('2026-08-21T03:59:59+08:00'),camp:'萌綠之島'});
assert.equal(phaseBoundary.at_iso,'2026-08-20T20:00:00.000Z','04:00 Asia/Taipei boundary must resolve exactly');

const conflictEvents=[1.5,2,3].map((multiplier,index)=>({
  event_id:`conflict_${index+1}`,title:`Conflict ${index+1}`,locale:'zh-TW',region:'TW',start_at:'2026-08-17T04:00:00+08:00',end_at:'2026-08-24T04:00:00+08:00',camp_scope:['*'],effects:{recipe_final_energy_multiplier:multiplier},phases:[],authority_status:'VERIFIED',source:officialSource,
}));
const conflictPayload=validatePublicEventPayload({schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'fixture-conflict-v1',locale:'zh-TW',region:'TW',events:conflictEvents});
const conflict=resolvePublicEventProjection(conflictPayload,{date:new Date('2026-08-18T12:00:00+08:00'),camp:'萌綠之島'});
assert.equal(Object.hasOwn(conflict.strategy_event_effects,'recipe_final_energy_multiplier'),false,'conflicted deterministic effect must be removed');
assert.equal(conflict.effect_conflicts.length,1,'once conflicted, later overlapping events cannot reintroduce the effect');
assert.equal(conflict.event_effect_review_required,true);
assert.equal(conflict.event_authority_status,'REVIEW_REQUIRED');

const unknownPayload=validatePublicEventPayload({schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'fixture-unknown-v1',locale:'zh-TW',region:'TW',events:[{
  event_id:'unknown_fixture',title:'Unknown Fixture',locale:'zh-TW',region:'TW',start_at:'2026-08-17T04:00:00+08:00',end_at:'2026-08-24T04:00:00+08:00',camp_scope:['*'],effects:{unknown_effects:[{source_text:'官方新效果，尚未建立 deterministic contract',observed_value:2}]},phases:[],authority_status:'VERIFIED',source:officialSource,
}]});
const unknown=resolvePublicEventProjection(unknownPayload,{date:new Date('2026-08-18T12:00:00+08:00'),camp:'萌綠之島'});
assert.equal(unknown.event_effect_review_required,true);
assert.equal(Object.keys(unknown.strategy_event_effects).length,0);
assert.equal(unknown.review_event_effects.length,1);

const featureOnly=projectWeeklyEventEffects({drowsy_power_multiplier:2,main_skill_trigger_multiplier:1.5});
assert.equal(Object.keys(featureOnly.deterministic_effects).length,0,'new public multipliers remain FEATURE_ONLY until dedicated Production contracts exist');
assert.equal(featureOnly.feature_only_effects.drowsy_power_multiplier,2);
assert.equal(featureOnly.feature_only_effects.main_skill_trigger_multiplier,1.5);

const publicProjection={
  ...p2,
  event_name:'PUBLIC EVENT',
  event_effects:{recipe_final_energy_multiplier:2},
  event_effects_serialized:JSON.stringify({recipe_final_energy_multiplier:2}),
  strategy_event_effects:{recipe_final_energy_multiplier:2},
  feature_only_event_effects:{},review_event_effects:[],event_effect_states:p2.event_effect_states,
};
const effective=buildEffectiveWeeklyContext({
  playerContext:{context_id:'weekly_context_2026-08-17_import',week_start:'2026-08-17',camp:'萌綠之島',dish_category:'沙拉',event_name:'PLAYER LEGACY',event_effects:JSON.stringify({recipe_final_energy_multiplier:9.9}),event_effects_parsed:{recipe_final_energy_multiplier:9.9},authority_source:'UPDATE_CENTER_JSON',field_sources:{event_name:'UPDATE_CENTER_JSON',event_effects:'UPDATE_CENTER_JSON'}},
  publicEventProjection:publicProjection,
});
assert.equal(effective.event_name,'PUBLIC EVENT');
assert.equal(effective.strategy_event_effects.recipe_final_energy_multiplier,2);
assert.equal(effective.legacy_player_event_observation.event_name,'PLAYER LEGACY');
assert.equal(effective.legacy_player_event_observation.event_effects_parsed.recipe_final_energy_multiplier,9.9);
assert.equal(effective.legacy_player_event_observation.deterministic_authority,false);
assert.equal(effective.field_sources.event_name,'PUBLIC_EVENT_MASTER');
assert.equal(effective.event_authority_source,'PUBLIC_EVENT_MASTER');
assert.equal(effective.player_weekly_authority_source,'UPDATE_CENTER_JSON');

const storeSource=source('public-event-master-store.js');
for(const forbidden of [
  /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+weekly_context/i,
  /UPDATE\s+weekly_context/i,
  /DELETE\s+FROM\s+weekly_context/i,
  /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+pokemon\b/i,
  /UPDATE\s+pokemon\b/i,
])assert.equal(forbidden.test(storeSource),false,`Public Event refresh must not write player data: ${forbidden}`);
for(const required of ['BEGIN IMMEDIATE','PRAGMA integrity_check','public_event_master_version','OFFLINE_CACHED','PUBLIC_EVENT_SHA256_MISMATCH'])assert.ok(storeSource.includes(required),`Public Event refresh contract missing ${required}`);

for(const file of ['recipe-strategy-local.js','pokemon-candidate-local.js','strategy-context-local.js','current-week-recipe-recommendation-bridge.js']){
  const text=source(file);
  assert.ok(text.includes("from './effective-weekly-context.js'"),`${file} must consume Effective Weekly Context`);
}
const ui=source('public-event-authority-ui-guard.js');
for(const token of ['LEGACY_PLAYER_OBSERVATION_AUDIT_ONLY','PUBLIC_EVENT_MASTER','data-public-event-authority'])assert.ok(ui.includes(token),`Public Event UI authority guard missing ${token}`);
const bootstrap=source('public-event-master-bootstrap.js');
assert.ok(bootstrap.includes('pokemon-sleep:database-ready'),'Public Event manifest refresh must start after SQLite ready');
assert.ok(bootstrap.includes('public-event-boundary-crossed'),'Public Event boundary must reproject current week');
const migrations=source('migrations.js');
assert.ok(migrations.includes('PUBLIC_EVENT_MASTER_SCHEMA_MIGRATION_VERSION'));
assert.ok(migrations.includes('applyPublicEventMasterSchemaMigration'));
const docs=read('docs/PUBLIC_EVENT_MASTER_CONTRACT.md');
for(const token of ['Effective Weekly Context','OFFLINE_CACHED','PUBLIC_EVENT_EFFECT_CONFLICT','deterministic_authority=false'])assert.ok(docs.includes(token),`normative Public Event contract missing ${token}`);

const production=currentProductionAuthorityRegistry();
assert.equal(production.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(production.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(production.active_verified_dimensions.length,4);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.5_PUBLIC_EVENT_MASTER_PLAYER_WEEKLY_SPLIT',
  app_version:version.app_version,
  public_event_master_version:payload.master_version,
  public_event_authority:PUBLIC_EVENT_AUTHORITY_VERSION,
  initial_event_status:atStart.event_authority_status,
  initial_numeric_effect_count:Object.keys(atStart.strategy_event_effects).length,
  manifest_sha256_verified:true,
  phase_boundary_resolver:true,
  contradictory_effects_fail_closed:true,
  unknown_effects_review_required:true,
  legacy_player_event_deterministic_authority:false,
  public_refresh_player_write:false,
  offline_cache_preserved:true,
  production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',
  android_pwa_live_validation_required:true,
},null,2));
