import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildEffectiveWeeklyContext} from '../assets/js/effective-weekly-context.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const bannerSource=fs.readFileSync('assets/js/weekly-context-consumer-banner.js','utf8');

assert.ok(
  bannerSource.includes("import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';"),
  'PE4 consumer banner must import Effective Weekly Context',
);
assert.equal(
  bannerSource.includes("from './weekly-context-store.js'"),
  false,
  'PE4 consumer banner must not read raw Player Weekly Context directly',
);
assert.ok(
  bannerSource.includes('const week=currentEffectiveWeeklyContext();'),
  'PE4 banner render path must resolve current Effective Weekly Context',
);
for(const token of [
  '本頁 Effective Weekly Context',
  '玩家週環境 Authority：',
  '活動 Authority：',
  'Public Event Master',
  'Legacy 玩家活動值僅供 audit，不具 deterministic authority',
]){
  assert.ok(bannerSource.includes(token),`PE4 split-authority banner missing ${token}`);
}
assert.equal(
  bannerSource.includes('本頁 Weekly Context 唯一來源'),
  false,
  'PE4 banner must not claim Player Weekly is the sole authority for event fields',
);

const effective=buildEffectiveWeeklyContext({
  playerContext:{
    context_id:'weekly_context_2026-08-17_import',
    context_status:'CURRENT_WEEK_READY',
    week_start:'2026-08-17',
    camp:'黃金舊發電廠',
    dish_category:'甜點/飲料',
    event_name:'LEGACY PLAYER EVENT',
    event_effects:'{"recipe_final_energy_multiplier":9.9}',
    event_effects_parsed:{recipe_final_energy_multiplier:9.9},
    authority_source:'UPDATE_CENTER_JSON',
    authority_update_id:'UPD-PE4-FIXTURE',
    favorite_berries:['萄葡果','墨莓果','靛莓果'],
    field_sources:{event_name:'UPDATE_CENTER_JSON',event_effects:'UPDATE_CENTER_JSON'},
  },
  publicEventProjection:{
    event_name:'PUBLIC MASTER EVENT',
    event_effects:{},
    event_effects_serialized:null,
    strategy_event_effects:{},
    feature_only_event_effects:{},
    review_event_effects:[],
    event_effect_states:[],
    event_effect_strategy_fingerprint:'fixture',
    event_effect_review_required:false,
    master_version:'public-event-master-fixture-v1',
    authority_version:'public-event-authority-fixture-v1',
    event_authority_status:'PARTIAL_VERIFIED',
    active_event_count:1,
    active_events:[],
    effect_conflicts:[],
  },
});

assert.equal(effective.event_name,'PUBLIC MASTER EVENT');
assert.equal(effective.event_authority_source,'PUBLIC_EVENT_MASTER');
assert.equal(effective.player_weekly_authority_source,'UPDATE_CENTER_JSON');
assert.equal(effective.public_event_authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(effective.strategy_event_effects,{});
assert.equal(effective.legacy_player_event_observation.event_name,'LEGACY PLAYER EVENT');
assert.equal(effective.legacy_player_event_observation.deterministic_authority,false);
assert.equal(effective.legacy_player_event_observation.event_effects_parsed.recipe_final_energy_multiplier,9.9);

const production=currentProductionAuthorityRegistry();
assert.equal(production.active_verified_dimensions.length,4);
assert.equal(production.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(production.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.5_PE4_EFFECTIVE_WEEKLY_CONSUMER_BANNER',
  player_weekly_event:'LEGACY PLAYER EVENT',
  effective_event:'PUBLIC MASTER EVENT',
  event_authority:'PUBLIC_EVENT_MASTER',
  player_weekly_authority:'UPDATE_CENTER_JSON',
  legacy_event_deterministic_authority:false,
  deterministic_event_effect_count:Object.keys(effective.strategy_event_effects).length,
  production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',
},null,2));
